import logging
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.models import User, get_db, Role, Subscription, Usage
from app.schemas.auth import (
    AccountResponse,
    ChangePasswordRequest,
    ChangePasswordWithTokenRequest,
    ForgotPasswordRequest,
    LogoUploadResponse,
    ProfileUpdateRequest,
    ProfileResponse,
    SubscriptionInfoResponse,
    UsageInfoResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.middleware.auth import get_current_user, get_db_session
from app.services.billing import get_plan_features, get_plan_tier_str, PLAN_NAMES

logger = logging.getLogger(__name__)

router = APIRouter()


def _validate_password_strength(password: str):
    """Raise 400 if password does not meet minimum requirements (>= 8 characters)."""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

# Maximum logo file size (2 MB)
MAX_LOGO_SIZE = 2 * 1024 * 1024
ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/svg+xml"}


def _build_subscription_info(db_user: User) -> SubscriptionInfoResponse:
    """Build subscription info from user's subscription row (single source of truth)."""
    tier = get_plan_tier_str(db_user)
    features = get_plan_features(db_user)
    plan_name = PLAN_NAMES.get(tier, tier.capitalize())

    if db_user.subscription:
        sub = db_user.subscription
        return SubscriptionInfoResponse(
            plan_tier=tier,
            plan_name=plan_name,
            status=sub.status,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            watermark=features["watermark"],
            logo_branding=features["logo_branding"],
            custom_branding=features["custom_branding"],
        )
    return SubscriptionInfoResponse(
        plan_tier="free",
        plan_name="Free",
        status="active",
        watermark=True,
        logo_branding=False,
        custom_branding=False,
    )


def _build_usage_info(db_user: User) -> UsageInfoResponse:
    """Build usage info, limits from plan features only (no role checks)."""
    features = get_plan_features(db_user)
    generations_limit = features["generations_per_month"]

    if db_user.usage:
        u = db_user.usage
        remaining = (
            max(0, generations_limit - u.generation_count)
            if generations_limit > 0
            else -1
        )
        return UsageInfoResponse(
            generation_count=u.generation_count,
            generations_limit=generations_limit,
            remaining=remaining,
            extra_studios_used=u.extra_studios_used,
            logo_branding_used=u.logo_branding_used,
            premium_ai_uses=u.premium_ai_uses,
            four_k_exports=u.four_k_exports,
        )

    remaining = generations_limit if generations_limit > 0 else -1
    return UsageInfoResponse(
        generation_count=0,
        generations_limit=generations_limit,
        remaining=remaining,
    )


@router.post("/register", response_model=TokenResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = get_user_by_email(db, email=user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = create_user(db, email=user.email, password=user.password, name=user.name)

    # Every new user gets a FREE subscription row — ensures tier is always defined
    free_sub = Subscription(user_id=new_user.id, plan_tier="free", status="active")
    db.add(free_sub)

    # Create empty usage record
    usage_record = Usage(user_id=new_user.id)
    db.add(usage_record)

    db.commit()

    access_token = create_access_token(data={"sub": new_user.email})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        email=new_user.email,
        name=new_user.name,
    )


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = authenticate_user(db, email=user.email, password=user.password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db_user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(data={"sub": db_user.email})
    force_reset = getattr(db_user, "force_password_reset", False)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        email=db_user.email,
        name=db_user.name,
        force_password_reset=force_reset,
    )


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    db_user = authenticate_user(db, email=payload.email, password=payload.current_password)
    if not db_user:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    _validate_password_strength(payload.new_password)

    db_user.hashed_password = hash_password(payload.new_password)
    db_user.force_password_reset = False
    db_user.password_changed_at = datetime.utcnow()
    db.commit()
    return {"detail": "Password changed successfully", "force_password_reset": False}


@router.post("/change-password-token")
def change_password_with_token(payload: ChangePasswordWithTokenRequest, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_session(request) or next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(payload.current_password, db_user.hashed_password):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match")

        _validate_password_strength(payload.new_password)
        db_user.hashed_password = hash_password(payload.new_password)
        db_user.password_changed_at = datetime.utcnow()
        if db_user.force_password_reset:
            db_user.force_password_reset = False
        db.commit()

        return {"detail": "Password changed successfully. Please log in again.", "require_relogin": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error changing password: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")


@router.get("/account", response_model=AccountResponse)
def get_account_info(request: Request):
    """Full account info — plan entitlements from subscription tier only."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_session(request) or next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        profile = ProfileResponse(
            id=db_user.id,
            email=db_user.email,
            name=db_user.name,
            role=db_user.role.value if db_user.role else "USER",
            is_active=db_user.is_active,
            is_disabled=db_user.is_disabled,
            created_at=db_user.created_at,
            last_login=db_user.last_login,
            password_changed_at=db_user.password_changed_at,
        )

        subscription_info = _build_subscription_info(db_user)
        usage_info = _build_usage_info(db_user)

        security = {
            "last_login": db_user.last_login.isoformat() if db_user.last_login else None,
            "password_changed_at": db_user.password_changed_at.isoformat() if db_user.password_changed_at else None,
            "account_status": (
                "active" if db_user.is_active and not db_user.is_disabled
                else ("disabled" if db_user.is_disabled else "inactive")
            ),
            "force_password_reset": db_user.force_password_reset,
        }

        return AccountResponse(
            profile=profile,
            subscription=subscription_info,
            usage=usage_info,
            security=security,
            has_logo=db_user.logo_data is not None,
            logo_placement=db_user.logo_placement or "bottom_right",
            logo_scale=db_user.logo_scale or 0.12,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get account information")


@router.put("/profile", response_model=ProfileResponse)
def update_profile(payload: ProfileUpdateRequest, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_session(request) or next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        if payload.name is not None:
            db_user.name = payload.name

        if payload.email is not None and payload.email != db_user.email:
            existing = db.query(User).filter(User.email == payload.email).first()
            if existing:
                raise HTTPException(status_code=409, detail="Email address is already in use")
            db_user.email = payload.email

        db_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_user)

        return ProfileResponse(
            id=db_user.id,
            email=db_user.email,
            name=db_user.name,
            role=db_user.role.value if db_user.role else "USER",
            is_active=db_user.is_active,
            is_disabled=db_user.is_disabled,
            created_at=db_user.created_at,
            last_login=db_user.last_login,
            password_changed_at=db_user.password_changed_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.put("/profile/logo", response_model=LogoUploadResponse)
async def upload_logo(request: Request, file: UploadFile = File(...)):
    """Upload a custom wall logo (PRO / ENTERPRISE only).

    Stores the raw image bytes on the user row. The compositing pipeline reads
    it directly from the DB at render time.
    """
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_session(request) or next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check plan entitlement
        features = get_plan_features(db_user)
        if not features.get("logo_branding"):
            raise HTTPException(
                status_code=403,
                detail="Logo branding requires a Pro or Enterprise plan.",
            )

        # Validate MIME type
        mime = file.content_type or ""
        if mime not in ALLOWED_LOGO_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{mime}'. Use PNG, JPEG, or SVG.",
            )

        # Read and size-check
        data = await file.read()
        if len(data) > MAX_LOGO_SIZE:
            raise HTTPException(status_code=413, detail="Logo file must be under 2 MB.")

        db_user.logo_data = data
        db_user.logo_mime_type = mime
        db_user.updated_at = datetime.utcnow()
        db.commit()

        return LogoUploadResponse(
            success=True,
            has_logo=True,
            logo_placement=db_user.logo_placement or "bottom_right",
            logo_scale=db_user.logo_scale or 0.12,
            logo_mime_type=mime,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error uploading logo: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload logo")


@router.delete("/profile/logo", response_model=LogoUploadResponse)
def delete_logo(request: Request):
    """Remove the user's custom wall logo."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_session(request) or next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        db_user.logo_data = None
        db_user.logo_mime_type = None
        db_user.updated_at = datetime.utcnow()
        db.commit()

        return LogoUploadResponse(
            success=True,
            has_logo=False,
            logo_placement=db_user.logo_placement or "bottom_right",
            logo_scale=db_user.logo_scale or 0.12,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting logo: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete logo")


@router.put("/profile/logo-settings", response_model=LogoUploadResponse)
def update_logo_settings(
    request: Request,
    placement: str = "bottom_right",
    scale: float = 0.12,
):
    """Update logo placement and scale without re-uploading the image."""
    valid_placements = {"bottom_right", "bottom_left", "top_right", "top_left", "center"}
    if placement not in valid_placements:
        raise HTTPException(status_code=400, detail=f"Invalid placement. Choose: {valid_placements}")
    if not (0.05 <= scale <= 0.40):
        raise HTTPException(status_code=400, detail="Scale must be between 0.05 and 0.40")

    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db_session(request) or next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        features = get_plan_features(db_user)
        if not features.get("logo_branding"):
            raise HTTPException(status_code=403, detail="Logo branding requires Pro or Enterprise.")

        db_user.logo_placement = placement
        db_user.logo_scale = scale
        db_user.updated_at = datetime.utcnow()
        db.commit()

        return LogoUploadResponse(
            success=True,
            has_logo=db_user.logo_data is not None,
            logo_placement=placement,
            logo_scale=scale,
            logo_mime_type=db_user.logo_mime_type,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating logo settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update logo settings")


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    return {"detail": "If an account with that email exists, a reset link has been sent."}


@router.post("/signup")
def signup_legacy(user: UserCreate, db: Session = Depends(get_db)):
    """Legacy endpoint — use /register instead."""
    return register(user, db)


@router.post("/token")
def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

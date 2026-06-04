import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app.models import User, get_db, Role, Subscription, Usage, PlanTier
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordWithTokenRequest,
    ForgotPasswordRequest,
    ProfileUpdateRequest,
    ProfileResponse,
    AccountResponse,
    SubscriptionInfoResponse,
    UsageInfoResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
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

logger = logging.getLogger(__name__)

router = APIRouter()


# Plan tier display names
PLAN_NAMES = {
    PlanTier.BASIC: "Basic",
    PlanTier.PROFESSIONAL: "Professional",
    PlanTier.ENTERPRISE: "Enterprise",
}

# Free plan limits
FREE_PLAN_LIMITS = {
    "generations_limit": 5,
    "extra_studios_limit": 0,
    "logo_branding": False,
    "premium_ai": False,
    "four_k_exports_limit": 0,
}


@router.post("/register", response_model=TokenResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Checks if the email already exists and creates a new user
    with a hashed password.
    """
    existing_user = get_user_by_email(db, email=user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    new_user = create_user(db, email=user.email, password=user.password, name=user.name)

    access_token = create_access_token(data={"sub": new_user.email})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        email=new_user.email,
        name=new_user.name,
    )


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user and return a JWT token.

    If the user has force_password_reset set, the response will include
    a flag indicating that the user must change their password.
    """
    db_user = authenticate_user(db, email=user.email, password=user.password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last_login
    db_user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(data={"sub": db_user.email})

    # Check if user needs to force password reset
    force_reset = getattr(db_user, 'force_password_reset', False)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        email=db_user.email,
        name=db_user.name,
        force_password_reset=force_reset,
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Change password for the current user. Used when force_password_reset is True.

    Requires the current password for verification.
    """
    db_user = authenticate_user(db, email=payload.email, password=payload.current_password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )

    db_user.hashed_password = hash_password(payload.new_password)
    db_user.force_password_reset = False
    db_user.password_changed_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)

    return {"detail": "Password changed successfully", "force_password_reset": False}


@router.post("/change-password-token")
def change_password_with_token(
    payload: ChangePasswordWithTokenRequest,
    request: Request,
):
    """
    Change password using JWT token authentication.

    Requires:
    - current_password: the user's current password
    - new_password: the new password (min 8 characters)
    - confirm_password: must match new_password
    """
    user = get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Get db session from request state
    db = get_db_session(request)
    if not db:
        db = next(get_db())

    try:
        # Verify current password
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(payload.current_password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )

        # Verify new password matches confirmation
        if payload.new_password != payload.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password and confirmation do not match",
            )

        # Update password
        db_user.hashed_password = hash_password(payload.new_password)
        db_user.password_changed_at = datetime.utcnow()
        if db_user.force_password_reset:
            db_user.force_password_reset = False
        db.commit()
        db.refresh(db_user)

        return {
            "detail": "Password changed successfully. Please log in again.",
            "require_relogin": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error changing password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password",
        )


@router.get("/account", response_model=AccountResponse)
def get_account_info(request: Request):
    """
    Get full account information for the authenticated user.

    Returns profile, subscription, usage, and security information.
    """
    user = get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    db = get_db_session(request)
    if not db:
        db = next(get_db())

    try:
        # Get full user from DB to access relationships
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Build profile response
        profile = ProfileResponse(
            id=db_user.id,
            email=db_user.email,
            name=db_user.name,
            role=db_user.role.value if db_user.role else "FREE",
            is_active=db_user.is_active,
            is_disabled=db_user.is_disabled,
            created_at=db_user.created_at,
            last_login=db_user.last_login,
            password_changed_at=db_user.password_changed_at,
        )

        # Build subscription info
        subscription_info = None
        if db_user.subscription:
            sub = db_user.subscription
            plan_name = PLAN_NAMES.get(sub.plan_tier, sub.plan_tier.value if sub.plan_tier else "Free")
            subscription_info = SubscriptionInfoResponse(
                plan_tier=sub.plan_tier.value if sub.plan_tier else None,
                plan_name=plan_name,
                status=sub.status,
                current_period_start=sub.current_period_start,
                current_period_end=sub.current_period_end,
            )
        else:
            # No subscription = FREE plan based on role
            if db_user.role == Role.PREMIUM:
                subscription_info = SubscriptionInfoResponse(
                    plan_tier="professional",
                    plan_name="Professional",
                    status="active",
                )
            else:
                subscription_info = SubscriptionInfoResponse(
                    plan_tier=None,
                    plan_name="Free",
                    status="active",
                )

        # Build usage info
        usage_info = None
        if db_user.usage:
            u = db_user.usage
            # Determine limits based on plan
            if db_user.role == Role.PREMIUM:
                generations_limit = 100
            elif db_user.role == Role.ADMIN:
                generations_limit = -1  # Unlimited
            else:
                generations_limit = FREE_PLAN_LIMITS["generations_limit"]

            remaining = max(0, generations_limit - u.generation_count) if generations_limit > 0 else -1

            usage_info = UsageInfoResponse(
                generation_count=u.generation_count,
                generations_limit=generations_limit,
                remaining=remaining,
                extra_studios_used=u.extra_studios_used,
                logo_branding_used=u.logo_branding_used,
                premium_ai_uses=u.premium_ai_uses,
                four_k_exports=u.four_k_exports,
            )
        else:
            # Default usage for FREE user with no usage record
            generations_limit = FREE_PLAN_LIMITS["generations_limit"] if db_user.role == Role.FREE else (100 if db_user.role == Role.PREMIUM else -1)
            usage_info = UsageInfoResponse(
                generation_count=0,
                generations_limit=generations_limit,
                remaining=generations_limit if generations_limit > 0 else -1,
            )

        # Build security info
        security = {
            "last_login": db_user.last_login.isoformat() if db_user.last_login else None,
            "password_changed_at": db_user.password_changed_at.isoformat() if db_user.password_changed_at else None,
            "account_status": "active" if db_user.is_active and not db_user.is_disabled else ("disabled" if db_user.is_disabled else "inactive"),
            "force_password_reset": db_user.force_password_reset,
        }

        return AccountResponse(
            profile=profile,
            subscription=subscription_info,
            usage=usage_info,
            security=security,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get account information",
        )


@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    request: Request,
):
    """
    Update the authenticated user's profile (name and/or email).

    Validates email uniqueness before updating.
    """
    user = get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    db = get_db_session(request)
    if not db:
        db = next(get_db())

    try:
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Update name if provided
        if payload.name is not None:
            db_user.name = payload.name

        # Update email if provided and different
        if payload.email is not None and payload.email != db_user.email:
            # Check email uniqueness
            existing = db.query(User).filter(User.email == payload.email).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email address is already in use",
                )
            db_user.email = payload.email

        db_user.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_user)

        return ProfileResponse(
            id=db_user.id,
            email=db_user.email,
            name=db_user.name,
            role=db_user.role.value if db_user.role else "FREE",
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    """
    Request a password reset.

    For security, always returns success even if the user does not exist,
    to prevent email enumeration attacks.
    """
    # In production, this would send a reset link via email
    return {
        "detail": "If an account with that email exists, a reset link has been sent."
    }


@router.post("/signup")
def signup_legacy(user: UserCreate, db: Session = Depends(get_db)):
    """Legacy endpoint - use /register instead"""
    return register(user, db)


@router.post("/token")
def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 compatible token login endpoint.

    Accepts username (email) and password from form data.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}
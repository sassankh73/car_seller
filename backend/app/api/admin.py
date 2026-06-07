"""
Admin API routes for user management and dashboard.

This module contains admin-only endpoints for:
- Dashboard statistics
- User management (search, view, edit, disable)
- Password management (reset, force reset)
- Role management
- Account activation/deactivation
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Project, Subscription, User, get_db, Role, PlanTier
from app.middleware.auth import get_current_admin
from app.services.auth import hash_password

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class RecentRegistration(BaseModel):
    """Recent user registration."""
    user_id: int
    email: str
    name: Optional[str]
    registered_at: datetime


class DashboardStats(BaseModel):
    """Dashboard statistics response."""
    total_users: int
    active_users: int
    total_projects: int
    total_revenue: float
    revenue_last_30_days: float
    revenue_last_7_days: float
    recent_registrations: List[RecentRegistration]


class UserSearchResult(BaseModel):
    """User search result."""
    id: int
    email: str
    name: Optional[str]
    role: str
    is_active: bool
    is_disabled: bool
    force_password_reset: bool = False
    created_at: datetime
    subscription_plan: Optional[str]
    project_count: int


class UserDetail(BaseModel):
    """Detailed user information."""
    id: int
    email: str
    name: Optional[str]
    role: str
    is_active: bool
    is_disabled: bool
    force_password_reset: bool = False
    created_at: datetime
    updated_at: datetime
    project_count: int
    subscription_plan: Optional[str]
    subscription_status: Optional[str]
    subscription_end_date: Optional[datetime]


class DisableUserRequest(BaseModel):
    """Request to disable a user."""
    disable: bool = True
    reason: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    """Request to update user details by admin."""
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_disabled: Optional[bool] = None
    subscription_plan: Optional[str] = None


class AdminPasswordResetRequest(BaseModel):
    """Request to reset a user's password by admin."""
    password: Optional[str] = None
    generate_temp: bool = False
    force_password_reset: bool = False


class AdminPasswordResetResponse(BaseModel):
    """Response for admin password reset."""
    message: str
    temp_password: Optional[str] = None
    force_password_reset: bool = False


class AdminRoleChangeRequest(BaseModel):
    """Request to change a user's role."""
    role: str  # ADMIN, PREMIUM, FREE


class AdminStatusChangeRequest(BaseModel):
    """Request to activate or deactivate a user account."""
    is_disabled: bool


class ForcePasswordResetRequest(BaseModel):
    """Request to toggle force password reset."""
    force_password_reset: bool


# ============================================================================
# Helper functions
# ============================================================================

def _get_user_detail(db: Session, user: User) -> UserDetail:
    """Build a UserDetail response from a User model."""
    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    project_count = db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar()
    return UserDetail(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value if user.role else "FREE",
        is_active=user.is_active,
        is_disabled=user.is_disabled,
        force_password_reset=user.force_password_reset if hasattr(user, 'force_password_reset') else False,
        created_at=user.created_at,
        updated_at=user.updated_at,
        project_count=project_count or 0,
        subscription_plan=getattr(subscription.plan_tier, "value", subscription.plan_tier) if subscription else None,
        subscription_status=subscription.status if subscription else None,
        subscription_end_date=subscription.current_period_end if subscription else None,
    )


def _generate_temp_password(length: int = 12) -> str:
    """Generate a cryptographically secure temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def _validate_role(role_str: str) -> str:
    """Validate and return a role string."""
    valid_roles = [r.value for r in Role]
    if role_str not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    return role_str


# ============================================================================
# Audit logging
# ============================================================================

def _audit_log(action: str, admin_user: User, target_user: User, details: str = ""):
    """Log admin actions for audit trail."""
    logger.info(
        f"AUDIT: admin={admin_user.email} action={action} "
        f"target_user={target_user.email} target_id={target_user.id} "
        f"details={details}"
    )


# ============================================================================
# Dashboard endpoints
# ============================================================================

@router.get("/admin/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Get dashboard statistics."""
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(
        User.is_active == True,
        User.is_disabled == False
    ).scalar()
    total_projects = db.query(func.count(Project.id)).scalar()
    total_revenue = 0.0
    revenue_last_30_days = 0.0
    revenue_last_7_days = 0.0

    recent_registrations = db.query(User).order_by(User.created_at.desc()).limit(10).all()
    recent_reg_list = [
        RecentRegistration(
            user_id=u.id,
            email=u.email,
            name=u.name,
            registered_at=u.created_at
        )
        for u in recent_registrations
    ]

    return DashboardStats(
        total_users=total_users or 0,
        active_users=active_users or 0,
        total_projects=total_projects or 0,
        total_revenue=total_revenue,
        revenue_last_30_days=revenue_last_30_days,
        revenue_last_7_days=revenue_last_7_days,
        recent_registrations=recent_reg_list
    )


# ============================================================================
# User management endpoints
# ============================================================================

@router.get("/admin/users/search", response_model=List[UserSearchResult])
async def search_users(
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
    email: Optional[str] = Query(None, description="Email to search"),
    name: Optional[str] = Query(None, description="Name to search"),
    role: Optional[str] = Query(None, description="Role to filter by"),
    limit: int = Query(50, le=100),
):
    """Search users by email or name."""
    query = db.query(User)

    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    if name:
        query = query.filter(User.name.ilike(f"%{name}%"))
    if role:
        query = query.filter(User.role == role)

    users = query.limit(limit).all()

    results = []
    for u in users:
        subscription = db.query(Subscription).filter(Subscription.user_id == u.id).first()
        subscription_plan = getattr(subscription.plan_tier, "value", subscription.plan_tier) if subscription else None
        project_count = db.query(func.count(Project.id)).filter(Project.user_id == u.id).scalar()

        results.append(UserSearchResult(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role.value if u.role else "FREE",
            is_active=u.is_active,
            is_disabled=u.is_disabled,
            force_password_reset=u.force_password_reset if hasattr(u, 'force_password_reset') else False,
            created_at=u.created_at,
            subscription_plan=subscription_plan,
            project_count=project_count or 0
        ))

    return results


@router.get("/admin/users/{user_id}", response_model=UserDetail)
async def get_user_details(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Get detailed information about a specific user."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return _get_user_detail(db, u)


# ============================================================================
# Edit user endpoint
# ============================================================================

@router.put("/admin/users/{user_id}", response_model=UserDetail)
async def update_user(
    request: Request,
    user_id: int,
    update_data: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Update user details (name, email, role, status, subscription plan)."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admins from disabling themselves
    if update_data.is_disabled is True and u.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    # Update fields that were provided
    if update_data.name is not None:
        u.name = update_data.name
    if update_data.email is not None:
        # Check if email is already taken
        existing = db.query(User).filter(User.email == update_data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        u.email = update_data.email
    if update_data.role is not None:
        role_value = _validate_role(update_data.role)
        # Prevent removing the last admin
        if u.role == Role.ADMIN and role_value != Role.ADMIN.value:
            admin_count = db.query(func.count(User.id)).filter(
                User.role == Role.ADMIN,
                User.is_disabled == False
            ).scalar()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove the last admin. Promote another user first."
                )
        u.role = Role(role_value)
    if update_data.is_active is not None:
        u.is_active = update_data.is_active
        if not update_data.is_active:
            u.is_disabled = True
    if update_data.is_disabled is not None:
        u.is_disabled = update_data.is_disabled
        if update_data.is_disabled:
            u.is_active = False
        else:
            u.is_active = True
    if update_data.subscription_plan is not None:
        subscription = db.query(Subscription).filter(Subscription.user_id == u.id).first()
        if subscription:
            subscription.plan_tier = PlanTier(update_data.subscription_plan)
        else:
            # Create subscription if it doesn't exist
            new_sub = Subscription(
                user_id=u.id,
                plan_tier=PlanTier(update_data.subscription_plan),
                status="active"
            )
            db.add(new_sub)

    db.commit()
    db.refresh(u)

    _audit_log("update_user", current_user, u, f"Updated fields: {update_data.model_dump(exclude_none=True)}")

    return _get_user_detail(db, u)


# ============================================================================
# Password management endpoints
# ============================================================================

@router.post("/admin/users/{user_id}/reset-password", response_model=AdminPasswordResetResponse)
async def reset_user_password(
    request: Request,
    user_id: int,
    reset_data: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Reset a user's password. Admin can provide a new password or generate a temporary one."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from resetting their own password via this endpoint
    if u.id == current_user.id:
        raise HTTPException(status_code=400, detail="Use the profile settings to change your own password")

    temp_password = None

    if reset_data.generate_temp:
        # Generate a temporary random password
        temp_password = _generate_temp_password()
        u.hashed_password = hash_password(temp_password)
    elif reset_data.password:
        # Use the provided password
        if len(reset_data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        u.hashed_password = hash_password(reset_data.password)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either provide a password or set generate_temp to true"
        )

    # Set force_password_reset flag
    if reset_data.force_password_reset:
        u.force_password_reset = True

    db.commit()
    db.refresh(u)

    _audit_log(
        "reset_password",
        current_user,
        u,
        f"Password reset. force_reset={reset_data.force_password_reset}, generated={reset_data.generate_temp}"
    )

    return AdminPasswordResetResponse(
        message="Password has been reset successfully",
        temp_password=temp_password,
        force_password_reset=u.force_password_reset if hasattr(u, 'force_password_reset') else False,
    )


@router.post("/admin/users/{user_id}/force-password-reset", response_model=UserDetail)
async def toggle_force_password_reset(
    request: Request,
    user_id: int,
    force_data: ForcePasswordResetRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Toggle the force_password_reset flag for a user."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u.force_password_reset = force_data.force_password_reset
    db.commit()
    db.refresh(u)

    _audit_log(
        "force_password_reset",
        current_user,
        u,
        f"force_password_reset set to {force_data.force_password_reset}"
    )

    return _get_user_detail(db, u)


# ============================================================================
# Role management endpoints
# ============================================================================

@router.put("/admin/users/{user_id}/role", response_model=UserDetail)
async def change_user_role(
    request: Request,
    user_id: int,
    role_data: AdminRoleChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Change a user's role."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    new_role = _validate_role(role_data.role)

    # Prevent removing the last admin
    if u.role == Role.ADMIN and new_role != Role.ADMIN.value:
        admin_count = db.query(func.count(User.id)).filter(
            User.role == Role.ADMIN,
            User.is_disabled == False
        ).scalar()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last admin. Promote another user first."
            )

    # Only admins can promote to admin
    if new_role == Role.ADMIN.value and current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can promote users to admin"
        )

    old_role = u.role.value if u.role else "FREE"
    u.role = Role(new_role)
    db.commit()
    db.refresh(u)

    _audit_log("change_role", current_user, u, f"Role changed from {old_role} to {new_role}")

    return _get_user_detail(db, u)


# ============================================================================
# Account status management endpoints
# ============================================================================

@router.put("/admin/users/{user_id}/status", response_model=UserDetail)
async def change_user_status(
    request: Request,
    user_id: int,
    status_data: AdminStatusChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Activate or deactivate a user account."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent disabling yourself
    if u.id == current_user.id and status_data.is_disabled:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    # Prevent disabling the last admin
    if status_data.is_disabled and u.role == Role.ADMIN:
        admin_count = db.query(func.count(User.id)).filter(
            User.role == Role.ADMIN,
            User.is_disabled == False
        ).scalar()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot disable the last admin user. Create another admin first."
            )

    u.is_disabled = status_data.is_disabled
    u.is_active = not status_data.is_disabled
    db.commit()
    db.refresh(u)

    action = "deactivate" if status_data.is_disabled else "activate"
    _audit_log(f"{action}_account", current_user, u, f"is_disabled={status_data.is_disabled}")

    return _get_user_detail(db, u)


@router.post("/admin/users/{user_id}/disable", response_model=UserDetail)
async def disable_user(
    request: Request,
    user_id: int,
    disable_request: DisableUserRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Disable or enable a user account (legacy endpoint)."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if disable_request.disable and u.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    if disable_request.disable and u.role == Role.ADMIN:
        admin_count = db.query(func.count(User.id)).filter(
            User.role == Role.ADMIN,
            User.is_disabled == False
        ).scalar()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot disable the last admin user. Create another admin first."
            )

    u.is_disabled = disable_request.disable
    u.is_active = not disable_request.disable
    db.commit()
    db.refresh(u)

    return _get_user_detail(db, u)


@router.get("/admin/users/{user_id}/projects", response_model=List[dict])
async def get_user_projects(
    request: Request,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Get all projects for a specific user."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    projects = db.query(Project).filter(Project.user_id == u.id).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "background": p.background,
            "image_url": p.image_url,
            "original_format": p.original_format if hasattr(p, 'original_format') else None,
            "created_at": p.created_at,
        }
        for p in projects
    ]


# ============================================================================
# Role listing endpoint
# ============================================================================

@router.get("/admin/roles", response_model=List[dict])
async def get_available_roles(
    request: Request,
    current_user=Depends(get_current_admin),
):
    """Get all available roles."""
    return [{"value": r.value, "label": r.value.capitalize()} for r in Role]

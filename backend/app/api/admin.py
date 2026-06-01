"""
Admin API routes for user management and dashboard.

This module contains admin-only endpoints for:
- Dashboard statistics
- User management (search, view, disable)
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Project, Subscription, User, get_db, Role
from app.middleware.auth import get_current_admin

router = APIRouter()


# Request/Response Models
class DashboardStats(BaseModel):
    """Dashboard statistics response."""
    total_users: int
    active_users: int
    total_projects: int
    total_revenue: float
    revenue_last_30_days: float
    revenue_last_7_days: float
    recent_registrations: List["RecentRegistration"]


class RecentRegistration(BaseModel):
    """Recent user registration."""
    user_id: int
    email: str
    name: Optional[str]
    registered_at: datetime


class UserSearchResult(BaseModel):
    """User search result."""
    id: int
    email: str
    name: Optional[str]
    role: str
    is_active: bool
    is_disabled: bool
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


# Dashboard endpoints
@router.get("/admin/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin),
):
    """Get dashboard statistics."""
    # Total users
    total_users = db.query(func.count(User.id)).scalar()
    
    # Active users (is_active=True and not disabled)
    active_users = db.query(func.count(User.id)).filter(
        User.is_active == True,
        User.is_disabled == False
    ).scalar()
    
    # Total projects
    total_projects = db.query(func.count(Project.id)).scalar()
    
    # Total revenue (sum of all subscription amounts)
    # Note: In production, this would query Stripe or the actual payment records
    total_revenue = 0.0  # Placeholder - would calculate from subscriptions
    
    # Revenue_last_30_days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    revenue_last_30_days = 0.0  # Placeholder - would calculate from recent subscriptions
    
    # Revenue_last_7_days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    revenue_last_7_days = 0.0  # Placeholder - would calculate from recent subscriptions
    
    # Recent registrations (last 10 users)
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


# User management endpoints
@router.get("/admin/users/search", response_model=List[UserSearchResult])
async def search_users(
    request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin),
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
    for user in users:
        # Get subscription plan
        subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
        subscription_plan = subscription.plan_tier.value if subscription else None
        
        # Count projects
        project_count = db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar()
        
        results.append(UserSearchResult(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role.value,
            is_active=user.is_active,
            is_disabled=user.is_disabled,
            created_at=user.created_at,
            subscription_plan=subscription_plan,
            project_count=project_count or 0
        ))
    
    return results


@router.get("/admin/users/{user_id}", response_model=UserDetail)
async def get_user_details(
    request,
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin),
):
    """Get detailed information about a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get subscription info
    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    
    # Count projects
    project_count = db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar()
    
    return UserDetail(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        is_active=user.is_active,
        is_disabled=user.is_disabled,
        created_at=user.created_at,
        updated_at=user.updated_at,
        project_count=project_count or 0,
        subscription_plan=subscription.plan_tier.value if subscription else None,
        subscription_status=subscription.status if subscription else None,
        subscription_end_date=subscription.current_period_end if subscription else None
    )


@router.post("/admin/users/{user_id}/disable", response_model=UserDetail)
async def disable_user(
    request,
    user_id: int,
    disable_request: DisableUserRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin),
):
    """Disable or enable a user account."""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow disabling yourself if you're the only admin
    if disable_request.disable and user.role == Role.ADMIN:
        admin_count = db.query(func.count(User.id)).filter(
            User.role == Role.ADMIN,
            User.is_disabled == False
        ).scalar()
        
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot disable the only admin user. Create another admin first."
            )
    
    user.is_disabled = disable_request.disable
    db.commit()
    db.refresh(user)
    
    # Get subscription info
    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    
    # Count projects
    project_count = db.query(func.count(Project.id)).filter(Project.user_id == user.id).scalar()
    
    return UserDetail(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        is_active=user.is_active,
        is_disabled=user.is_disabled,
        created_at=user.created_at,
        updated_at=user.updated_at,
        project_count=project_count or 0,
        subscription_plan=subscription.plan_tier.value if subscription else None,
        subscription_status=subscription.status if subscription else None,
        subscription_end_date=subscription.current_period_end if subscription else None
    )


@router.get("/admin/users/{user_id}/projects", response_model=List[dict])
async def get_user_projects(
    request,
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin),
):
    """Get all projects for a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    projects = db.query(Project).filter(Project.user_id == user.id).all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "background": p.background,
            "image_url": p.image_url,
            "created_at": p.created_at,
        }
        for p in projects
    ]
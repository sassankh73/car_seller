"""
Authentication schemas for AutoStudio AI.

This module contains Pydantic models for authentication-related operations.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class TokenPayload(BaseModel):
    """JWT token payload structure."""

    sub: Optional[str] = None  # Subject (user email)
    iat: Optional[datetime] = None  # Issued at
    exp: Optional[datetime] = None  # Expiration
    scopes: Optional[list[str]] = None  # Token scopes


class UserCreate(BaseModel):
    """Request model for user registration."""

    email: str
    password: str
    name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        """Basic email validation that allows internal domains like .local."""
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()


class UserLogin(BaseModel):
    """Request model for user login."""

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        """Basic email validation that allows internal domains like .local."""
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()


class TokenResponse(BaseModel):
    """Response model for authentication tokens."""

    access_token: str
    token_type: str = "bearer"
    email: str
    name: Optional[str] = None
    force_password_reset: bool = False


class UserResponse(BaseModel):
    """Response model for user information."""

    id: int
    email: str
    name: Optional[str] = None
    role: str = "FREE"
    is_active: bool = True
    is_disabled: bool = False
    force_password_reset: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    """Request model for updating user profile."""

    name: Optional[str] = None
    email: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        """Basic email validation."""
        if v is not None:
            if not v or "@" not in v:
                raise ValueError("Invalid email address")
            return v.strip().lower()
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        """Validate name is not empty if provided."""
        if v is not None and len(v.strip()) == 0:
            raise ValueError("Name cannot be empty")
        return v.strip() if v else v


class ChangePasswordRequest(BaseModel):
    """Request model for changing password (used when force_password_reset is True)."""

    email: str
    current_password: str
    new_password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        """Basic email validation."""
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        """Validate new password length."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordWithTokenRequest(BaseModel):
    """Request model for changing password using JWT token (no email required)."""

    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        """Validate new password length and strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ProfileResponse(BaseModel):
    """Response model for user profile information."""

    id: int
    email: str
    name: Optional[str] = None
    role: str = "FREE"
    is_active: bool = True
    is_disabled: bool = False
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None


class SubscriptionInfoResponse(BaseModel):
    """Response model for subscription information."""

    plan_tier: Optional[str] = None
    plan_name: Optional[str] = None
    status: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None


class UsageInfoResponse(BaseModel):
    """Response model for usage information."""

    generation_count: int = 0
    generations_limit: int = 0
    remaining: int = 0
    extra_studios_used: int = 0
    logo_branding_used: int = 0
    premium_ai_uses: int = 0
    four_k_exports: int = 0


class AccountResponse(BaseModel):
    """Full account response model combining profile, subscription, and usage."""

    profile: ProfileResponse
    subscription: Optional[SubscriptionInfoResponse] = None
    usage: Optional[UsageInfoResponse] = None
    security: dict = {}


class ForgotPasswordRequest(BaseModel):
    """Request model for forgot password."""

    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        """Basic email validation that allows internal domains like .local."""
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()


class ResetPasswordRequest(BaseModel):
    """Request model for reset password."""

    token: str
    new_password: str

"""
Authentication schemas for AutoStudio AI.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    iat: Optional[datetime] = None
    exp: Optional[datetime] = None
    scopes: Optional[list[str]] = None


class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    name: Optional[str] = None
    force_password_reset: bool = False


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    role: str = "USER"
    is_active: bool = True
    is_disabled: bool = False
    force_password_reset: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v is not None:
            if not v or "@" not in v:
                raise ValueError("Invalid email address")
            return v.strip().lower()
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None and len(v.strip()) == 0:
            raise ValueError("Name cannot be empty")
        return v.strip() if v else v


class ChangePasswordRequest(BaseModel):
    email: str
    current_password: str
    new_password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordWithTokenRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ProfileResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    role: str = "USER"
    is_active: bool = True
    is_disabled: bool = False
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    password_changed_at: Optional[datetime] = None


class SubscriptionInfoResponse(BaseModel):
    plan_tier: Optional[str] = None      # "free" | "starter" | "pro" | "enterprise"
    plan_name: Optional[str] = None
    status: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    # Feature flags derived from tier — for frontend consumption
    watermark: bool = True
    logo_branding: bool = False
    custom_branding: bool = False


class UsageInfoResponse(BaseModel):
    generation_count: int = 0
    generations_limit: int = 0
    remaining: int = 0
    extra_studios_used: int = 0
    logo_branding_used: int = 0
    premium_ai_uses: int = 0
    four_k_exports: int = 0


class LogoUploadResponse(BaseModel):
    """Response after uploading or clearing a logo."""
    success: bool
    has_logo: bool
    logo_placement: str
    logo_scale: float
    logo_mime_type: Optional[str] = None


class AccountResponse(BaseModel):
    profile: ProfileResponse
    subscription: Optional[SubscriptionInfoResponse] = None
    usage: Optional[UsageInfoResponse] = None
    security: dict = {}
    # Logo state (for settings page)
    has_logo: bool = False
    logo_placement: str = "bottom_right"
    logo_scale: float = 0.12


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not v or "@" not in v:
            raise ValueError("Invalid email address")
        return v.strip().lower()


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

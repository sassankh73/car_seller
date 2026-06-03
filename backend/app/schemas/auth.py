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
    role: str = "user"
    is_active: bool = True

    class Config:
        from_attributes = True


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
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v
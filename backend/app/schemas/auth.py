"""
Authentication schemas for AutoStudio AI.

This module contains Pydantic models for authentication-related operations.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class TokenPayload(BaseModel):
    """JWT token payload structure."""

    sub: Optional[str] = None  # Subject (user email)
    iat: Optional[datetime] = None  # Issued at
    exp: Optional[datetime] = None  # Expiration
    scopes: Optional[list[str]] = None  # Token scopes


class UserCreate(BaseModel):
    """Request model for user registration."""

    email: EmailStr
    password: str
    name: Optional[str] = None


class UserLogin(BaseModel):
    """Request model for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response model for authentication tokens."""

    access_token: str
    token_type: str = "bearer"
    email: str
    name: Optional[str] = None


class UserResponse(BaseModel):
    """Response model for user information."""

    id: int
    email: str
    name: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    """Request model for forgot password."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request model for reset password."""

    token: str
    new_password: str
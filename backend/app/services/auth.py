"""
Authentication service for AutoStudio AI.

Handles:
- Password hashing and verification using bcrypt
- JWT token generation and validation
- User authentication flow
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import TokenPayload

# JWT Configuration — SECRET_KEY must be set via environment variable (no fallback)
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Payload data to encode in token
        expires_delta: Optional token expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenPayload]:
    """
    Decode and validate a JWT access token.

    Args:
        token: JWT token string

    Returns:
        TokenPayload if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**payload)
    except JWTError:
        return None


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Get a user by their email address.

    Args:
        db: Database session
        email: User email to search for

    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.email == email).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user by email and password.

    Args:
        db: Database session
        email: User email
        password: Plain text password

    Returns:
        User object if authentication succeeds, None otherwise
    """
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if user.is_disabled:
        return None
    return user


def create_user(db: Session, email: str, password: str, name: Optional[str] = None) -> User:
    """
    Create a new user with hashed password.

    Args:
        db: Database session
        email: User email
        password: Plain text password
        name: Optional user name

    Returns:
        Created User object
    """
    hashed_password = hash_password(password)
    user = User(
        email=email,
        hashed_password=hashed_password,
        name=name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_user(db: Session, token: str) -> Optional[User]:
    """
    Get the current authenticated user from a JWT token.

    Args:
        db: Database session
        token: JWT access token

    Returns:
        User object if token is valid, None otherwise
    """
    payload = decode_access_token(token)
    if payload is None or payload.sub is None:
        return None

    user = get_user_by_email(db, email=payload.sub)
    return user
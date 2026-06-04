"""
Database models for AutoStudio AI.

This module contains SQLAlchemy models for:
- User: Authentication and user profile
- Project: Studio project ownership
- Subscription: Plan subscriptions
- Usage: Billing usage tracking
"""

import os
import logging
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

# SQLAlchemy configuration - read from environment variable (set via .env)
# DATABASE_URL MUST be set in the environment; no hardcoded fallback.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is required but not set. "
        "Copy backend/.env.example to backend/.env and configure it."
    )

engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger = logging.getLogger(__name__)

Base = declarative_base()


class Role(str, Enum):
    """User role for access control.

    These values MUST match the PostgreSQL enum type exactly:
      ADMIN  - Full administrative access
      PREMIUM - Premium/paid features
      FREE  - Default free-tier user

    Migration plan (future): If more granular roles are needed, the
    PostgreSQL enum must be altered via:
      ALTER TYPE role ADD VALUE 'new_value';
    """

    ADMIN = "ADMIN"
    PREMIUM = "PREMIUM"
    FREE = "FREE"


class PlanTier(str, Enum):
    """Subscription plan tiers."""

    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class User(Base):
    """User model for authentication and profile."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(SQLEnum(Role, name="role"), default=Role.FREE)
    is_active = Column(Boolean, default=True)
    is_disabled = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    force_password_reset = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    usage = relationship("Usage", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role.value}')>"


class Subscription(Base):
    """Subscription model for tracking user plan subscriptions."""

    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_tier = Column(SQLEnum(PlanTier), nullable=False)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    status = Column(String(50), default="active")  # active, past_due, canceled, etc.
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="subscription")

    def __repr__(self) -> str:
        return f"<Subscription(id={self.id}, user_id={self.user_id}, plan='{self.plan_tier}')>"


class Usage(Base):
    """Usage tracking for billing purposes."""

    __tablename__ = "usages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    generation_count = Column(Integer, default=0)
    extra_studios_used = Column(Integer, default=0)
    logo_branding_used = Column(Integer, default=0)
    premium_ai_uses = Column(Integer, default=0)
    four_k_exports = Column(Integer, default=0)
    last_reset = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="usage")

    def __repr__(self) -> str:
        return f"<Usage(id={self.id}, user_id={self.user_id}, generations={self.generation_count})>"


class Project(Base):
    """Project model for studio projects with user ownership."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    background = Column(String(255), nullable=False)  # studio key
    image_url = Column(Text, nullable=True)
    original_format = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="projects")

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', user_id={self.user_id})>"


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)

    # Auto-migrate: add columns that may not exist yet in older databases
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    user_columns = [col["name"] for col in inspector.get_columns("users")]

    with engine.connect() as conn:
        if "last_login" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_login TIMESTAMP"))
            conn.commit()
            logger.info("Added last_login column to users table")
        if "password_changed_at" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP"))
            conn.commit()
            logger.info("Added password_changed_at column to users table")


def get_engine():
    """Get SQLAlchemy engine."""
    return engine


def get_session():
    """Get database session."""
    return SessionLocal()
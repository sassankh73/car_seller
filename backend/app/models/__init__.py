"""
Database models for AutoStudio AI.

This module contains SQLAlchemy models for:
- User: Authentication and user profile
- Project: Studio project ownership
- Subscription: Plan subscriptions
- Usage: Billing usage tracking
"""

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

# SQLAlchemy configuration
SQLALCHEMY_DATABASE_URL = "postgresql://autostudio_user:autostudio@192.168.0.106:5432/autostudio"

engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Role(str, Enum):
    """User role for access control."""

    ADMIN = "admin"
    PREMIUM = "premium"
    FREE = "free"


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
    role = Column(SQLEnum(Role), default=Role.FREE)
    is_active = Column(Boolean, default=True)
    is_disabled = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
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


def get_engine():
    """Get SQLAlchemy engine."""
    return engine


def get_session():
    """Get database session."""
    return SessionLocal()
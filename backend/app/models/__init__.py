"""
Database models for AutoStudio AI.
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
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

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
    """User role — controls access only, NOT entitlements.

    Entitlements (watermark, logo, generations) come from PlanTier only.
      USER  — all registered users
      ADMIN — full administrative access
    Legacy values PREMIUM and FREE are kept as aliases so existing DB rows
    remain valid; all business logic should compare against USER / ADMIN.
    """

    ADMIN = "ADMIN"
    USER = "USER"
    # Legacy aliases — present in DB, treated as USER everywhere in code
    PREMIUM = "PREMIUM"
    FREE = "FREE"


class PlanTier(str, Enum):
    """Subscription plan tier — single source of truth for feature entitlements."""

    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"
    # Legacy aliases kept for backward compat during migration
    BASIC = "basic"
    PROFESSIONAL = "professional"


class User(Base):
    """User model for authentication and profile."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(SQLEnum(Role, name="role"), default=Role.USER)
    is_active = Column(Boolean, default=True)
    is_disabled = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    force_password_reset = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Password reset (single-use token enforcement)
    password_reset_token_hash = Column(String(64), nullable=True)

    # Logo branding (PRO / ENTERPRISE only)
    logo_data = Column(LargeBinary, nullable=True)
    logo_mime_type = Column(String(50), nullable=True)
    logo_placement = Column(String(20), default="bottom_right")
    logo_scale = Column(Float, default=0.12)

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    usage = relationship("Usage", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role.value}')>"


class Subscription(Base):
    """Subscription model — plan_tier is the only source of feature entitlements."""

    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_tier = Column(String(50), nullable=False, default="free")
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    status = Column(String(50), default="active")
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
    background = Column(String(255), nullable=False)
    image_url = Column(Text, nullable=True)
    original_format = Column(String(50), nullable=True)
    watermark_applied = Column(Boolean, default=False)
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
    """Initialize database tables and apply incremental column migrations."""
    Base.metadata.create_all(bind=engine)

    from sqlalchemy import text, inspect
    inspector = inspect(engine)

    with engine.connect() as conn:
        # users table — incremental columns
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        _add_col_if_missing(conn, "users", "last_login", "TIMESTAMP", user_cols)
        _add_col_if_missing(conn, "users", "password_changed_at", "TIMESTAMP", user_cols)
        _add_col_if_missing(conn, "users", "is_disabled", "BOOLEAN DEFAULT FALSE", user_cols)
        _add_col_if_missing(conn, "users", "force_password_reset", "BOOLEAN DEFAULT FALSE", user_cols)
        _add_col_if_missing(conn, "users", "logo_data", "BYTEA", user_cols)
        _add_col_if_missing(conn, "users", "logo_mime_type", "VARCHAR(50)", user_cols)
        _add_col_if_missing(conn, "users", "logo_placement", "VARCHAR(20) DEFAULT 'bottom_right'", user_cols)
        _add_col_if_missing(conn, "users", "logo_scale", "FLOAT DEFAULT 0.12", user_cols)
        _add_col_if_missing(conn, "users", "password_reset_token_hash", "VARCHAR(64)", user_cols)

        # Migrate plan_tier column from native PG enum to plain VARCHAR (idempotent)
        try:
            conn.execute(text(
                "ALTER TABLE subscriptions ALTER COLUMN plan_tier TYPE VARCHAR(50) USING plan_tier::text"
            ))
            conn.commit()
            logger.info("Migrated subscriptions.plan_tier from enum to VARCHAR(50)")
        except Exception:
            conn.rollback()

        # Backfill legacy plan tier names (guard against native PG enum constraints)
        for old, new in [("basic", "starter"), ("professional", "pro")]:
            try:
                conn.execute(text(
                    f"UPDATE subscriptions SET plan_tier='{new}' WHERE plan_tier::text='{old}'"
                ))
                conn.commit()
            except Exception:
                conn.rollback()

        # Ensure every user has a FREE subscription row.
        # ON CONFLICT DO NOTHING is safe with the uq_subscriptions_user_id constraint.
        try:
            conn.execute(text("""
                INSERT INTO subscriptions (user_id, plan_tier, status, created_at, updated_at)
                SELECT u.id, 'free', 'active', NOW(), NOW()
                FROM users u
                WHERE NOT EXISTS (
                    SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
                )
                ON CONFLICT (user_id) DO NOTHING
            """))
            conn.commit()
        except Exception:
            conn.rollback()

        # Add USER enum value to the role enum type (safe, idempotent on PG)
        try:
            conn.execute(text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'USER'"))
            conn.commit()
        except Exception:
            conn.rollback()

        # Add UNIQUE(user_id) to subscriptions — deduplicate first, then constrain
        try:
            dup_rows = conn.execute(text(
                "SELECT user_id FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1"
            )).fetchall()
            tier_priority = {"enterprise": 5, "pro": 4, "professional": 4,
                             "starter": 3, "basic": 3, "free": 1}
            for (uid,) in dup_rows:
                rows = conn.execute(text(
                    "SELECT id, plan_tier FROM subscriptions WHERE user_id = :uid ORDER BY id"
                ), {"uid": uid}).fetchall()
                best_id = max(rows, key=lambda r: (tier_priority.get(r[1], 0), r[0]))[0]
                conn.execute(text(
                    "DELETE FROM subscriptions WHERE user_id = :uid AND id != :keep"
                ), {"uid": uid, "keep": best_id})
            conn.commit()
        except Exception:
            conn.rollback()

        try:
            exists = conn.execute(text(
                "SELECT 1 FROM pg_constraint WHERE conname = 'uq_subscriptions_user_id'"
            )).fetchone()
            if not exists:
                conn.execute(text(
                    "ALTER TABLE subscriptions ADD CONSTRAINT uq_subscriptions_user_id UNIQUE (user_id)"
                ))
                conn.commit()
                logger.info("Added UNIQUE(user_id) constraint to subscriptions")
        except Exception:
            conn.rollback()

        # projects table — incremental columns
        proj_cols = [c["name"] for c in inspector.get_columns("projects")]
        _add_col_if_missing(conn, "projects", "watermark_applied", "BOOLEAN DEFAULT FALSE", proj_cols)
        _add_col_if_missing(conn, "projects", "original_format", "VARCHAR(50)", proj_cols)


_ALLOWED_TABLES = {"users", "subscriptions", "usages", "projects"}
_ALLOWED_COLS = {
    "last_login", "password_changed_at", "is_disabled", "force_password_reset",
    "logo_data", "logo_mime_type", "logo_placement", "logo_scale",
    "watermark_applied", "original_format", "password_reset_token_hash",
}


def _add_col_if_missing(conn, table: str, col: str, definition: str, existing: list):
    from sqlalchemy import text
    if table not in _ALLOWED_TABLES or col not in _ALLOWED_COLS:
        raise ValueError(f"_add_col_if_missing: disallowed table '{table}' or column '{col}'")
    if col not in existing:
        # table and col are validated against allow-lists above — safe to interpolate
        conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{col}" {definition}'))
        conn.commit()
        logger.info("Added column %s.%s", table, col)


def get_engine():
    return engine


def get_session():
    return SessionLocal()

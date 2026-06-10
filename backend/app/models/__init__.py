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
    CheckConstraint,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
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
    EDITOR = "EDITOR"
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

    # Rating fields (denormalized for performance)
    rating_avg = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    usage = relationship("Usage", back_populates="user", uselist=False, cascade="all, delete-orphan")
    assigned_tickets = relationship("Ticket", foreign_keys="Ticket.assigned_to_id", back_populates="assigned_to")
    ratings_received = relationship("EditorRating", foreign_keys="EditorRating.editor_id", back_populates="editor")

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
    original_image_url = Column(Text, nullable=True)
    editor_result_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="projects")
    tickets = relationship("Ticket", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', user_id={self.user_id})>"


class Ticket(Base):
    """Editor workflow ticket — one per customer order (vehicle), may contain multiple images."""

    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_order_id = Column(String(36), nullable=True, index=True)  # UUID linking all photos in one batch
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), default="open")
    priority = Column(String(20), default="normal")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    editor_note = Column(Text, nullable=True)
    # Legacy single-image fields kept for backward compat
    original_image_url = Column(Text, nullable=True)
    ai_result_url = Column(Text, nullable=True)
    result_image_url = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="tickets", foreign_keys=[project_id])
    customer = relationship("User", foreign_keys=[customer_user_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_tickets")
    created_by = relationship("User", foreign_keys=[created_by_id])
    notes = relationship("TicketNote", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketNote.created_at")
    rating = relationship("EditorRating", back_populates="ticket", uselist=False)
    images = relationship("TicketImage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketImage.sort_order")

    def __repr__(self) -> str:
        return f"<Ticket(id={self.id}, title='{self.title}', status='{self.status}')>"


class TicketNote(Base):
    """Notes thread on a ticket — visible to Editor unless is_internal=True."""

    __tablename__ = "ticket_notes"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    ticket = relationship("Ticket", back_populates="notes")
    author = relationship("User", foreign_keys=[author_id])

    def __repr__(self) -> str:
        return f"<TicketNote(id={self.id}, ticket_id={self.ticket_id}, internal={self.is_internal})>"


class EditorRating(Base):
    """Per-ticket quality rating given by Admin to the assigned Editor."""

    __tablename__ = "editor_ratings"
    __table_args__ = (
        UniqueConstraint("ticket_id", name="uq_editor_ratings_ticket_id"),
        CheckConstraint("stars >= 1 AND stars <= 5", name="ck_editor_ratings_stars"),
    )

    id = Column(Integer, primary_key=True, index=True)
    editor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    rated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    stars = Column(Integer, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    editor = relationship("User", foreign_keys=[editor_id], back_populates="ratings_received")
    ticket = relationship("Ticket", back_populates="rating")

    def __repr__(self) -> str:
        return f"<EditorRating(id={self.id}, ticket_id={self.ticket_id}, stars={self.stars})>"


class TicketImage(Base):
    """One photo angle/view within a customer order ticket."""

    __tablename__ = "ticket_images"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    label = Column(String(50), default="photo")  # front, rear, left_side, right_side, front_45, rear_45, other
    sort_order = Column(Integer, default=0)
    original_image_url = Column(Text, nullable=True)
    ai_result_url = Column(Text, nullable=True)
    editor_result_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ticket = relationship("Ticket", back_populates="images")
    project = relationship("Project")

    def __repr__(self) -> str:
        return f"<TicketImage(id={self.id}, ticket_id={self.ticket_id}, label='{self.label}')>"


class DownloadLog(Base):
    """Audit log for file downloads by editors."""
    __tablename__ = "download_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    downloaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_type = Column(String(30), nullable=False)  # 'original', 'ai_result', 'editor_result', 'zip'
    downloaded_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<DownloadLog(ticket={self.ticket_id}, by={self.downloaded_by_id}, type={self.file_type})>"


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

        # Add EDITOR enum value — must run outside transaction block on PG
        try:
            conn.execute(text("COMMIT"))
            conn.execute(text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'EDITOR'"))
            conn.execute(text("COMMIT"))
            logger.info("Added EDITOR to role enum (or already existed)")
        except Exception as e:
            logger.warning("ALTER TYPE role ADD VALUE 'EDITOR' skipped: %s", e)
            try:
                conn.rollback()
            except Exception:
                pass

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
        _add_col_if_missing(conn, "projects", "original_image_url", "TEXT", proj_cols)
        _add_col_if_missing(conn, "projects", "editor_result_url", "TEXT", proj_cols)

        # tickets table — v2 columns
        ticket_cols = [c["name"] for c in inspector.get_columns("tickets")]
        _add_col_if_missing(conn, "tickets", "ai_result_url", "TEXT", ticket_cols)
        _add_col_if_missing(conn, "tickets", "claimed_at", "TIMESTAMP", ticket_cols)
        _add_col_if_missing(conn, "tickets", "started_at", "TIMESTAMP", ticket_cols)
        # tickets table — v3 customer-order columns
        _add_col_if_missing(conn, "tickets", "customer_user_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL", ticket_cols)
        _add_col_if_missing(conn, "tickets", "delivered_at", "TIMESTAMP", ticket_cols)
        _add_col_if_missing(conn, "tickets", "vehicle_order_id", "VARCHAR(36)", ticket_cols)
        # Make project_id nullable for tickets that span multiple projects
        try:
            conn.execute(text("ALTER TABLE tickets ALTER COLUMN project_id DROP NOT NULL"))
            conn.commit()
        except Exception:
            conn.rollback()

        # ticket_images table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ticket_images (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
                label VARCHAR(50) NOT NULL DEFAULT 'photo',
                sort_order INTEGER NOT NULL DEFAULT 0,
                original_image_url TEXT,
                ai_result_url TEXT,
                editor_result_url TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ticket_images_ticket_id ON ticket_images(ticket_id)"))
        conn.commit()

        # download_logs audit table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS download_logs (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                downloaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                file_type VARCHAR(30) NOT NULL,
                downloaded_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_download_logs_ticket_id ON download_logs(ticket_id)"))
        conn.commit()

        # users table — editor rating columns
        user_cols2 = [c["name"] for c in inspector.get_columns("users")]
        _add_col_if_missing(conn, "users", "rating_avg", "FLOAT DEFAULT 0.0", user_cols2)
        _add_col_if_missing(conn, "users", "rating_count", "INTEGER DEFAULT 0", user_cols2)


_ALLOWED_TABLES = {"users", "subscriptions", "usages", "projects", "tickets", "ticket_notes", "editor_ratings", "download_logs", "ticket_images"}
_ALLOWED_COLS = {
    "last_login", "password_changed_at", "is_disabled", "force_password_reset",
    "logo_data", "logo_mime_type", "logo_placement", "logo_scale",
    "watermark_applied", "original_format", "password_reset_token_hash",
    # users — editor rating
    "rating_avg", "rating_count",
    # projects — editor workflow
    "original_image_url", "editor_result_url",
    # tickets
    "id", "project_id", "assigned_to_id", "created_by_id", "customer_user_id", "status", "priority",
    "title", "description", "editor_note", "result_image_url", "ai_result_url",
    "due_date", "completed_at", "claimed_at", "started_at", "delivered_at", "created_at", "updated_at",
    "vehicle_order_id",
    # ticket_notes
    "ticket_id", "author_id", "body", "is_internal",
    # editor_ratings
    "editor_id", "rated_by_id", "stars", "note",
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

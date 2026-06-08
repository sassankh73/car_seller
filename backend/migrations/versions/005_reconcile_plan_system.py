"""Reconcile plan / subscription system.

- Backfill legacy tier names: basic → starter, professional → pro
- Create FREE subscription rows for users without any subscription
- Add USER enum value to role type (idempotent)
"""

from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Backfill legacy tier names
    conn.execute(sa.text("UPDATE subscriptions SET plan_tier='starter' WHERE plan_tier='basic'"))
    conn.execute(sa.text("UPDATE subscriptions SET plan_tier='pro' WHERE plan_tier='professional'"))

    # Ensure every user has at least a FREE subscription row
    conn.execute(sa.text("""
        INSERT INTO subscriptions (user_id, plan_tier, status, created_at, updated_at)
        SELECT u.id, 'free', 'active', NOW(), NOW()
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
        )
    """))

    # Add USER value to the role enum type (PostgreSQL-specific, idempotent)
    try:
        conn.execute(sa.text("ALTER TYPE role ADD VALUE IF NOT EXISTS 'USER'"))
    except Exception:
        pass


def downgrade():
    # Downgrade is intentionally left as a no-op — tier backfills are non-reversible
    pass

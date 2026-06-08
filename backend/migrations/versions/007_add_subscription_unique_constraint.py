"""Add UNIQUE(user_id) constraint to subscriptions table.

Deduplicates first (keeps highest plan tier per user), then applies constraint.

revision: 007
down_revision: 006
"""

from alembic import op
from sqlalchemy import text

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None

# Higher number = more valuable tier
TIER_PRIORITY = {
    "enterprise": 5,
    "pro": 4,
    "professional": 4,
    "starter": 3,
    "basic": 3,
    "free": 1,
}


def upgrade():
    conn = op.get_bind()

    # 1. Find users with multiple subscription rows
    result = conn.execute(text(
        "SELECT user_id FROM subscriptions GROUP BY user_id HAVING COUNT(*) > 1"
    ))
    dup_users = [row[0] for row in result.fetchall()]

    for user_id in dup_users:
        rows = conn.execute(text(
            "SELECT id, plan_tier FROM subscriptions WHERE user_id = :uid ORDER BY id"
        ), {"uid": user_id}).fetchall()

        # Keep row with highest tier priority; on tie keep the highest id
        best_id = max(rows, key=lambda r: (TIER_PRIORITY.get(r[1], 0), r[0]))[0]

        conn.execute(text(
            "DELETE FROM subscriptions WHERE user_id = :uid AND id != :keep"
        ), {"uid": user_id, "keep": best_id})

    # 2. Add the UNIQUE constraint (idempotent guard via pg catalog)
    exists = conn.execute(text(
        "SELECT 1 FROM pg_constraint WHERE conname = 'uq_subscriptions_user_id'"
    )).fetchone()
    if not exists:
        op.create_unique_constraint("uq_subscriptions_user_id", "subscriptions", ["user_id"])


def downgrade():
    op.drop_constraint("uq_subscriptions_user_id", "subscriptions", type_="unique")

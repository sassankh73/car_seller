"""Add logo and watermark columns.

- users: logo_data (BYTEA), logo_mime_type (VARCHAR), logo_placement (VARCHAR), logo_scale (FLOAT)
- projects: watermark_applied (BOOLEAN)
"""

from alembic import op
import sqlalchemy as sa


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    user_cols = [c["name"] for c in inspector.get_columns("users")]
    if "logo_data" not in user_cols:
        op.add_column("users", sa.Column("logo_data", sa.LargeBinary(), nullable=True))
    if "logo_mime_type" not in user_cols:
        op.add_column("users", sa.Column("logo_mime_type", sa.String(50), nullable=True))
    if "logo_placement" not in user_cols:
        op.add_column("users", sa.Column("logo_placement", sa.String(20), server_default="bottom_right", nullable=True))
    if "logo_scale" not in user_cols:
        op.add_column("users", sa.Column("logo_scale", sa.Float(), server_default="0.12", nullable=True))

    proj_cols = [c["name"] for c in inspector.get_columns("projects")]
    if "watermark_applied" not in proj_cols:
        op.add_column("projects", sa.Column("watermark_applied", sa.Boolean(), server_default="false", nullable=True))


def downgrade():
    op.drop_column("users", "logo_scale")
    op.drop_column("users", "logo_placement")
    op.drop_column("users", "logo_mime_type")
    op.drop_column("users", "logo_data")
    op.drop_column("projects", "watermark_applied")

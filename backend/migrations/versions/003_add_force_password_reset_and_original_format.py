"""
Add force_password_reset column to users and original_format to projects.

Revision ID: 003
Revises: 423cc45866e8
Create Date: 2026-06-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '423cc45866e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add force_password_reset column to users table
    op.add_column('users', sa.Column('force_password_reset', sa.Boolean(), nullable=True, server_default='false'))

    # Add original_format column to projects table
    op.add_column('projects', sa.Column('original_format', sa.String(50), nullable=True))

    # Update existing users to have force_password_reset = False
    op.execute("UPDATE users SET force_password_reset = false WHERE force_password_reset IS NULL")

    # Make force_password_reset non-nullable after setting defaults
    op.alter_column('users', 'force_password_reset', nullable=False, server_default='false')

    # Update role values from old enum to new enum values
    # Map old values: 'admin' -> 'admin', 'premium' -> 'dealer', 'free' -> 'user'
    op.execute("UPDATE users SET role = 'user' WHERE role = 'free'")
    op.execute("UPDATE users SET role = 'dealer' WHERE role = 'premium'")


def downgrade() -> None:
    # Remove original_format column from projects
    op.drop_column('projects', 'original_format')

    # Remove force_password_reset column from users
    op.drop_column('users', 'force_password_reset')
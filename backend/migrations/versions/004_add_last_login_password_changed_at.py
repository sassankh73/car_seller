"""
Add last_login and password_changed_at columns to users table.

Revision ID: 004
Revises: 003
Create Date: 2026-06-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add last_login column to users table
    op.add_column('users', sa.Column('last_login', sa.DateTime(), nullable=True))

    # Add password_changed_at column to users table
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove password_changed_at column from users
    op.drop_column('users', 'password_changed_at')

    # Remove last_login column from users
    op.drop_column('users', 'last_login')
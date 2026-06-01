"""
Add user role system (ADMIN, PREMIUM, FREE) and is_disabled field

Revision ID: 002
Revises: 001
Create Date: 2026-06-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add role column to users table
    op.add_column('users', sa.Column('role', sa.Enum('admin', 'premium', 'free', name='role'), nullable=False, server_default='free'))
    
    # Add is_disabled column to users table
    op.add_column('users', sa.Column('is_disabled', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Drop is_disabled column
    op.drop_column('users', 'is_disabled')
    
    # Drop role column
    op.drop_column('users', 'role')
    
    # Drop enum type (PostgreSQL specific)
    op.execute("DROP TYPE IF EXISTS role")
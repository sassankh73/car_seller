"""Add user role and is_disabled columns

Revision ID: 423cc45866e8
Revises: 002
Create Date: 2026-06-01 14:38:47.714991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '423cc45866e8'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Handle SQLite vs PostgreSQL differently
    import sqlalchemy.dialects as dialects
    
    bind = op.get_bind()
    is_sqlite = "sqlite" in str(type(bind.dialect).__name__).lower()
    
    if is_sqlite:
        # SQLite-specific migration - recreate tables
        # Create new usages table
        op.create_table(
            'usages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('generation_count', sa.Integer(), nullable=True),
            sa.Column('extra_studios_used', sa.Integer(), nullable=True),
            sa.Column('logo_branding_used', sa.Integer(), nullable=True),
            sa.Column('premium_ai_uses', sa.Integer(), nullable=True),
            sa.Column('four_k_exports', sa.Integer(), nullable=True),
            sa.Column('last_reset', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_usages_id'), 'usages', ['id'], unique=False)
        
        # Drop old usage_limits table
        op.drop_table('usage_limits')
        
        # Drop and recreate projects table with new schema
        op.drop_table('projects')
        op.create_table(
            'projects',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('background', sa.String(length=255), nullable=False),
            sa.Column('image_url', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_projects_id'), 'projects', ['id'], unique=False)
        
        # Drop and recreate subscriptions table with new schema
        op.drop_table('subscriptions')
        op.create_table(
            'subscriptions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('stripe_subscription_id', sa.String(length=255), nullable=True),
            sa.Column('stripe_customer_id', sa.String(length=255), nullable=True),
            sa.Column('plan_tier', sa.Enum('BASIC', 'PROFESSIONAL', 'ENTERPRISE', name='plantier'), nullable=False),
            sa.Column('status', sa.String(length=50), nullable=True),
            sa.Column('current_period_start', sa.DateTime(), nullable=True),
            sa.Column('current_period_end', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('stripe_subscription_id')
        )
        op.create_index(op.f('ix_subscriptions_id'), 'subscriptions', ['id'], unique=False)
        
        # Drop and recreate users table with new schema
        op.drop_table('users')
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=True),
            sa.Column('hashed_password', sa.String(length=255), nullable=False),
            sa.Column('role', sa.String(length=7), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True),
            sa.Column('is_disabled', sa.Boolean(), nullable=True),
            sa.Column('is_superuser', sa.Boolean(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('email')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    else:
        # PostgreSQL-specific migration (original)
        op.create_table(
            'usages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('generation_count', sa.Integer(), nullable=True),
            sa.Column('extra_studios_used', sa.Integer(), nullable=True),
            sa.Column('logo_branding_used', sa.Integer(), nullable=True),
            sa.Column('premium_ai_uses', sa.Integer(), nullable=True),
            sa.Column('four_k_exports', sa.Integer(), nullable=True),
            sa.Column('last_reset', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_usages_id'), 'usages', ['id'], unique=False)
        op.drop_table('usage_limits')
        op.alter_column('projects', 'image_url',
                   existing_type=sa.VARCHAR(length=512),
                   type_=sa.Text(),
                   existing_nullable=True)
        op.alter_column('projects', 'created_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        op.alter_column('projects', 'updated_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        op.create_index(op.f('ix_projects_id'), 'projects', ['id'], unique=False)
        op.drop_constraint(None, 'projects', type_='foreignkey')
        op.create_foreign_key(None, 'projects', 'users', ['user_id'], ['id'], ondelete='CASCADE')
        op.drop_column('projects', 'original_image_url')
        op.drop_column('projects', 'processed')
        op.add_column('subscriptions', sa.Column('stripe_customer_id', sa.String(length=255), nullable=True))
        op.alter_column('subscriptions', 'plan_tier',
                   existing_type=sa.VARCHAR(length=50),
                   type_=sa.Enum('BASIC', 'PROFESSIONAL', 'ENTERPRISE', name='plantier'),
                   existing_nullable=False)
        op.alter_column('subscriptions', 'status',
                   existing_type=sa.VARCHAR(length=50),
                   nullable=True)
        op.alter_column('subscriptions', 'created_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        op.alter_column('subscriptions', 'updated_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        op.create_index(op.f('ix_subscriptions_id'), 'subscriptions', ['id'], unique=False)
        op.drop_constraint(None, 'subscriptions', type_='foreignkey')
        op.create_foreign_key(None, 'subscriptions', 'users', ['user_id'], ['id'], ondelete='CASCADE')
        op.add_column('users', sa.Column('is_superuser', sa.Boolean(), nullable=True))
        op.alter_column('users', 'role',
                   existing_type=sa.VARCHAR(length=7),
                   nullable=True,
                   existing_server_default=sa.text("'free'"))
        op.alter_column('users', 'is_active',
                   existing_type=sa.BOOLEAN(),
                   nullable=True,
                   existing_server_default=sa.text("'true'"))
        op.alter_column('users', 'is_disabled',
                   existing_type=sa.BOOLEAN(),
                   nullable=True,
                   existing_server_default=sa.text("'false'"))
        op.alter_column('users', 'created_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        op.alter_column('users', 'updated_at',
                   existing_type=sa.DATETIME(),
                   nullable=True)
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.alter_column('users', 'updated_at',
               existing_type=sa.DATETIME(),
               nullable=False)
    op.alter_column('users', 'created_at',
               existing_type=sa.DATETIME(),
               nullable=False)
    op.alter_column('users', 'is_disabled',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text("'false'"))
    op.alter_column('users', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text("'true'"))
    op.alter_column('users', 'role',
               existing_type=sa.VARCHAR(length=7),
               nullable=False,
               existing_server_default=sa.text("'free'"))
    op.drop_column('users', 'is_superuser')
    op.drop_constraint(None, 'subscriptions', type_='foreignkey')
    op.create_foreign_key(None, 'subscriptions', 'users', ['user_id'], ['id'])
    op.drop_index(op.f('ix_subscriptions_id'), table_name='subscriptions')
    op.alter_column('subscriptions', 'updated_at',
               existing_type=sa.DATETIME(),
               nullable=False)
    op.alter_column('subscriptions', 'created_at',
               existing_type=sa.DATETIME(),
               nullable=False)
    op.alter_column('subscriptions', 'status',
               existing_type=sa.VARCHAR(length=50),
               nullable=False)
    op.alter_column('subscriptions', 'plan_tier',
               existing_type=sa.Enum('BASIC', 'PROFESSIONAL', 'ENTERPRISE', name='plantier'),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
    op.drop_column('subscriptions', 'stripe_customer_id')
    op.add_column('projects', sa.Column('processed', sa.BOOLEAN(), server_default=sa.text("'false'"), nullable=False))
    op.add_column('projects', sa.Column('original_image_url', sa.VARCHAR(length=512), nullable=True))
    op.drop_constraint(None, 'projects', type_='foreignkey')
    op.create_foreign_key(None, 'projects', 'users', ['user_id'], ['id'])
    op.drop_index(op.f('ix_projects_id'), table_name='projects')
    op.alter_column('projects', 'updated_at',
               existing_type=sa.DATETIME(),
               nullable=False)
    op.alter_column('projects', 'created_at',
               existing_type=sa.DATETIME(),
               nullable=False)
    op.alter_column('projects', 'image_url',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=512),
               existing_nullable=True)
    op.create_table('usage_limits',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=False),
    sa.Column('image_count', sa.INTEGER(), server_default=sa.text("'0'"), nullable=False),
    sa.Column('max_images', sa.INTEGER(), server_default=sa.text("'5'"), nullable=False),
    sa.Column('updated_at', sa.DATETIME(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.drop_index(op.f('ix_usages_id'), table_name='usages')
    op.drop_table('usages')
    # ### end Alembic commands ###
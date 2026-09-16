"""add email_verified and google_sub columns for Google OAuth

Revision ID: 20260916_google
Revises: 20260915_admin
Create Date: 2026-09-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260916_google"
down_revision = "20260915_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # For SQLite compatibility, use batch_alter_table when modifying existing columns
    with op.batch_alter_table("users", schema=None) as batch_op:
        # Make password_hash nullable for Google-only accounts
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)

    # Add new columns
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True, unique=True, index=True))


def downgrade() -> None:
    # Drop new columns
    op.drop_column("users", "google_sub")
    op.drop_column("users", "email_verified")

    # Revert password_hash to NOT NULL
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)

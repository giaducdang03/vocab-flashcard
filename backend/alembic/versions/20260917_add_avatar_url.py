"""add avatar_url column for Google profile picture

Revision ID: 20260917_avatar
Revises: 20260916_google
Create Date: 2026-09-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260917_avatar"
down_revision = "20260916_google"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")

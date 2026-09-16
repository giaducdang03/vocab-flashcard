"""add user roles and ai policies

Revision ID: 20260915_admin
Revises: 20260914_ai_quiz
Create Date: 2026-09-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260915_admin"
down_revision = "20260914_ai_quiz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="user"))

    op.create_table(
        "user_ai_policies",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("ai_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("daily_limit", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_ai_policies")
    op.drop_column("users", "role")

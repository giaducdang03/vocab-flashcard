"""add explanation_language to quizzes

Revision ID: 20260920_expl_lang
Revises: 20260917_avatar
Create Date: 2026-09-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260920_expl_lang"
down_revision = "20260917_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quizzes",
        sa.Column("explanation_language", sa.String(length=2), nullable=False, server_default="vi"),
    )


def downgrade() -> None:
    op.drop_column("quizzes", "explanation_language")

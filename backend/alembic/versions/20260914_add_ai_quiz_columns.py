"""add ai quiz columns

Revision ID: 20260914_ai_quiz
Revises: 20260910_quiz
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260914_ai_quiz"
down_revision = "20260910_quiz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("status", sa.String(length=20), nullable=False, server_default="ready"))
    op.add_column("quizzes", sa.Column("uses_ai", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("quizzes", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("quizzes", sa.Column("ai_question_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quizzes", sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("quizzes", sa.Column("requested_count", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("quiz_questions", sa.Column("source", sa.String(length=10), nullable=False, server_default="algo"))
    op.add_column("quiz_questions", sa.Column("explanation", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("quiz_questions", "explanation")
    op.drop_column("quiz_questions", "source")

    op.drop_column("quizzes", "requested_count")
    op.drop_column("quizzes", "retry_count")
    op.drop_column("quizzes", "ai_question_count")
    op.drop_column("quizzes", "error_message")
    op.drop_column("quizzes", "uses_ai")
    op.drop_column("quizzes", "status")

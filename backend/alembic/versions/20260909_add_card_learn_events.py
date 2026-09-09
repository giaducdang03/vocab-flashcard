"""add card_learn_events

Revision ID: 20260909_events
Revises: 20260817_initial
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260909_events"
down_revision = "20260817_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "card_learn_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("card_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["card_id"], ["cards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_card_learn_events_card_id"), "card_learn_events", ["card_id"]
    )
    op.create_index(
        op.f("ix_card_learn_events_occurred_at"), "card_learn_events", ["occurred_at"]
    )

    op.execute(
        """
        INSERT INTO card_learn_events (id, card_id, event_type, occurred_at)
        SELECT gen_random_uuid()::text, id, 'learned', created_at
        FROM cards
        WHERE is_learned = true
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_card_learn_events_occurred_at"), table_name="card_learn_events")
    op.drop_index(op.f("ix_card_learn_events_card_id"), table_name="card_learn_events")
    op.drop_table("card_learn_events")

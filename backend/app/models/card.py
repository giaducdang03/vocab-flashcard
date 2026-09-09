from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False)
    card_type: Mapped[str] = mapped_column(String(20), nullable=False, default="vocab")
    front_text: Mapped[str] = mapped_column(String(500), nullable=False)
    front_phonetic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    back_text: Mapped[str] = mapped_column(Text, nullable=False)
    example: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_learned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    session: Mapped["Session"] = relationship(back_populates="cards")
    synonyms: Mapped[list["Synonym"]] = relationship(back_populates="card", cascade="all, delete-orphan")
    learn_events: Mapped[list["CardLearnEvent"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", passive_deletes=True
    )


class Synonym(Base):
    __tablename__ = "synonyms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id"), nullable=False)
    word: Mapped[str] = mapped_column(String(200), nullable=False)
    phonetic: Mapped[str | None] = mapped_column(String(200), nullable=True)

    card: Mapped[Card] = relationship(back_populates="synonyms")


class CardLearnEvent(Base):
    __tablename__ = "card_learn_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    card: Mapped["Card"] = relationship(back_populates="learn_events")

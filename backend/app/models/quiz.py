from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.session import Session  # Import để resolve relationship


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Comma-separated question type codes, e.g. "en_to_vi,synonym".
    question_types: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    source_sessions: Mapped[list["QuizSourceSession"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )
    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )


class QuizSourceSession(Base):
    __tablename__ = "quiz_source_sessions"

    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )

    quiz: Mapped[Quiz] = relationship(back_populates="source_sessions")
    session: Mapped[Session] = relationship()


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Kept only so review can link back to the card. Questions are snapshots,
    # so the quiz survives the card being edited or deleted.
    card_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_phonetic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # JSON array of exactly four strings.
    options: Mapped[str] = mapped_column(Text, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    answers: Mapped[list["QuizAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", passive_deletes=True
    )


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answer_attempt_question"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    attempt_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    # NULL means the question was left unanswered.
    selected_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")
    question: Mapped[QuizQuestion] = relationship()

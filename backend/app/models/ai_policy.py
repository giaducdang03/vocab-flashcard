from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserAiPolicy(Base):
    """Cấu hình AI riêng của một user. Không có dòng nghĩa là dùng mặc định."""

    __tablename__ = "user_ai_policies"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    ai_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # NULL = theo AI_DAILY_QUIZ_LIMIT của hệ thống
    daily_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

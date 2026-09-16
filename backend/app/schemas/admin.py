from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.ai_policy import MAX_DAILY_LIMIT

Role = Literal["user", "admin"]


class AdminOverviewOut(BaseModel):
    total_users: int
    active_users_7d: int
    total_cards: int
    ai_quizzes_24h: int


class AdminUserRow(BaseModel):
    id: str
    email: str
    display_name: str
    role: Role
    created_at: datetime
    is_config_admin: bool
    email_verified: bool
    has_google: bool
    session_count: int
    card_count: int
    quizzes_taken: int
    avg_accuracy: float | None
    ai_enabled: bool
    ai_daily_limit: int
    ai_limit_is_custom: bool
    ai_used_24h: int


class AdminUserListOut(BaseModel):
    items: list[AdminUserRow]
    total: int
    page: int
    page_size: int


class ActivityDayOut(BaseModel):
    date: date
    count: int


class AiUsageOut(BaseModel):
    used: int
    limit: int
    resets_at: datetime | None


class RecentAiQuizOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    status: str
    ai_question_count: int
    requested_count: int


class AdminUserDetailOut(AdminUserRow):
    learned_cards: int
    last_active_at: datetime | None
    activity_7d: list[ActivityDayOut]
    ai_usage: AiUsageOut
    ai_system_default_limit: int
    recent_ai_quizzes: list[RecentAiQuizOut]


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    ai_enabled: bool | None = None
    # null = về mặc định hệ thống; phân biệt với "không gửi" qua model_fields_set
    ai_daily_limit: int | None = Field(default=None, ge=0, le=MAX_DAILY_LIMIT)

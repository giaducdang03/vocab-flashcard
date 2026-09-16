"""Policy AI theo từng user: bật/tắt và hạn mức quiz AI trong 24 giờ trượt.

Phần đầu là hàm thuần (unit test được); phần sau là wrapper DB mỏng mà router gọi.
Thiếu dòng `user_ai_policies` luôn nghĩa là mặc định — chỉ `resolve_policy` xử lý điều đó.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_policy import UserAiPolicy
from app.models.quiz import Quiz

ROLLING_WINDOW = timedelta(hours=24)
MAX_DAILY_LIMIT = 1000
DISABLED_DETAIL = "AI features are disabled for your account"


@dataclass(frozen=True)
class EffectivePolicy:
    enabled: bool
    limit: int
    is_custom: bool


@dataclass(frozen=True)
class AiUsage:
    used: int
    limit: int
    resets_at: datetime | None


@dataclass(frozen=True)
class PolicyViolation:
    status_code: int
    detail: str


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def resolve_policy(row: UserAiPolicy | None, default_limit: int) -> EffectivePolicy:
    if row is None:
        return EffectivePolicy(enabled=True, limit=default_limit, is_custom=False)
    if row.daily_limit is None:
        return EffectivePolicy(enabled=row.ai_enabled, limit=default_limit, is_custom=False)
    return EffectivePolicy(enabled=row.ai_enabled, limit=row.daily_limit, is_custom=True)


def compute_resets_at(oldest_in_window: datetime | None) -> datetime | None:
    if oldest_in_window is None:
        return None
    return _as_utc(oldest_in_window) + ROLLING_WINDOW


def window_start(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) - ROLLING_WINDOW


def check_enabled(policy: EffectivePolicy) -> PolicyViolation | None:
    if not policy.enabled:
        return PolicyViolation(status_code=403, detail=DISABLED_DETAIL)
    return None


def check_creation(policy: EffectivePolicy, used: int) -> PolicyViolation | None:
    violation = check_enabled(policy)
    if violation is not None:
        return violation
    if used >= policy.limit:
        return PolicyViolation(
            status_code=429,
            detail=f"You have used all {policy.limit} AI quiz generations in the last 24 hours",
        )
    return None


def apply_policy_update(
    row: UserAiPolicy | None,
    user_id: str,
    *,
    updated_by: str | None,
    ai_enabled: bool | None = None,
    daily_limit: int | None = None,
    set_limit: bool = False,
    now: datetime | None = None,
) -> tuple[UserAiPolicy, bool]:
    """Áp thay đổi lên dòng policy (tạo mới nếu chưa có).

    `set_limit` phân biệt "không đụng tới limit" với "đặt limit về NULL".
    """
    created = row is None
    if row is None:
        row = UserAiPolicy(user_id=user_id, ai_enabled=True, daily_limit=None)
    if ai_enabled is not None:
        row.ai_enabled = ai_enabled
    if set_limit:
        row.daily_limit = daily_limit
    row.updated_by = updated_by
    row.updated_at = now or datetime.now(timezone.utc)
    return row, created


def _raise_if(violation: PolicyViolation | None) -> None:
    if violation is not None:
        raise HTTPException(status_code=violation.status_code, detail=violation.detail)


async def get_policy(db: AsyncSession, user_id: str) -> EffectivePolicy:
    row = await db.get(UserAiPolicy, user_id)
    return resolve_policy(row, settings.AI_DAILY_QUIZ_LIMIT)


def _ai_quizzes_in_window(user_id: str):
    return (
        Quiz.user_id == user_id,
        Quiz.uses_ai.is_(True),
        Quiz.created_at >= window_start(),
    )


async def count_ai_quizzes_24h(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(select(func.count(Quiz.id)).where(*_ai_quizzes_in_window(user_id)))
    return result.scalar() or 0


async def get_usage(
    db: AsyncSession, user_id: str, policy: EffectivePolicy | None = None
) -> AiUsage:
    if policy is None:
        policy = await get_policy(db, user_id)
    result = await db.execute(
        select(func.count(Quiz.id), func.min(Quiz.created_at)).where(*_ai_quizzes_in_window(user_id))
    )
    used, oldest = result.one()
    return AiUsage(used=used or 0, limit=policy.limit, resets_at=compute_resets_at(oldest))


async def enforce_can_create(db: AsyncSession, user_id: str) -> None:
    policy = await get_policy(db, user_id)
    violation = check_enabled(policy)
    if violation is None:
        violation = check_creation(policy, await count_ai_quizzes_24h(db, user_id))
    _raise_if(violation)


async def enforce_enabled(db: AsyncSession, user_id: str) -> None:
    _raise_if(check_enabled(await get_policy(db, user_id)))


async def upsert_policy(
    db: AsyncSession,
    user_id: str,
    *,
    updated_by: str | None,
    ai_enabled: bool | None = None,
    daily_limit: int | None = None,
    set_limit: bool = False,
) -> UserAiPolicy:
    """Tạo/cập nhật dòng policy trong session hiện tại. Caller tự commit."""
    row = await db.get(UserAiPolicy, user_id)
    row, created = apply_policy_update(
        row,
        user_id,
        updated_by=updated_by,
        ai_enabled=ai_enabled,
        daily_limit=daily_limit,
        set_limit=set_limit,
    )
    if created:
        db.add(row)
    return row

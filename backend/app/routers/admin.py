"""Admin API: tổng quan, danh sách user, chi tiết, đổi role và policy AI."""
from datetime import datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Float, case, cast, func, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import require_admin
from app.errors import ErrorCode, api_error
from app.models.ai_policy import UserAiPolicy
from app.models.card import Card, CardLearnEvent
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt
from app.models.session import Session
from app.models.user import User
from app.schemas.admin import (
    ActivityDayOut,
    AdminOverviewOut,
    AdminUserDetailOut,
    AdminUserListOut,
    AdminUserRow,
    AdminUserUpdate,
    AiUsageOut,
    RecentAiQuizOut,
)
from app.services import ai_policy
from app.services.admin_access import ADMIN_ROLE, check_role_change, is_config_admin
from app.services.admin_stats import build_activity_7d, latest_timestamp

router = APIRouter(dependencies=[Depends(require_admin)])

ACTIVE_WINDOW = timedelta(days=7)
ACTIVITY_DAYS = 7
RECENT_AI_QUIZ_LIMIT = 10


def _user_row_query():
    """SELECT User, UserAiPolicy và các số đếm tổng hợp — một query, không N+1."""
    sessions_sq = (
        select(Session.user_id.label("user_id"), func.count(Session.id).label("session_count"))
        .group_by(Session.user_id)
        .subquery()
    )
    cards_sq = (
        select(
            Session.user_id.label("user_id"),
            func.count(Card.id).label("card_count"),
            func.sum(case((Card.is_learned.is_(True), 1), else_=0)).label("learned_cards"),
        )
        .join(Card, Card.session_id == Session.id)
        .group_by(Session.user_id)
        .subquery()
    )
    attempts_sq = (
        select(
            QuizAttempt.user_id.label("user_id"),
            func.count(QuizAttempt.id).label("quizzes_taken"),
            func.avg(
                case(
                    (QuizAttempt.total_questions > 0, cast(QuizAttempt.score, Float) / QuizAttempt.total_questions),
                    else_=None,
                )
            ).label("avg_accuracy"),
        )
        .where(QuizAttempt.submitted_at.is_not(None))
        .group_by(QuizAttempt.user_id)
        .subquery()
    )
    ai_sq = (
        select(Quiz.user_id.label("user_id"), func.count(Quiz.id).label("ai_used"))
        .where(Quiz.uses_ai.is_(True), Quiz.created_at >= ai_policy.window_start())
        .group_by(Quiz.user_id)
        .subquery()
    )
    return (
        select(
            User,
            UserAiPolicy,
            func.coalesce(sessions_sq.c.session_count, 0).label("session_count"),
            func.coalesce(cards_sq.c.card_count, 0).label("card_count"),
            func.coalesce(cards_sq.c.learned_cards, 0).label("learned_cards"),
            func.coalesce(attempts_sq.c.quizzes_taken, 0).label("quizzes_taken"),
            attempts_sq.c.avg_accuracy.label("avg_accuracy"),
            func.coalesce(ai_sq.c.ai_used, 0).label("ai_used"),
        )
        .outerjoin(UserAiPolicy, UserAiPolicy.user_id == User.id)
        .outerjoin(sessions_sq, sessions_sq.c.user_id == User.id)
        .outerjoin(cards_sq, cards_sq.c.user_id == User.id)
        .outerjoin(attempts_sq, attempts_sq.c.user_id == User.id)
        .outerjoin(ai_sq, ai_sq.c.user_id == User.id)
    )


def _apply_filters(query, search: str | None, role: str | None, ai: str | None):
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(func.lower(User.email).like(pattern), func.lower(User.display_name).like(pattern))
        )
    if role:
        query = query.where(User.role == role)
    if ai == "disabled":
        query = query.where(UserAiPolicy.ai_enabled.is_(False))
    elif ai == "enabled":
        query = query.where(or_(UserAiPolicy.user_id.is_(None), UserAiPolicy.ai_enabled.is_(True)))
    return query


def _to_row(row) -> AdminUserRow:
    user: User = row[0]
    policy = ai_policy.resolve_policy(row[1], settings.AI_DAILY_QUIZ_LIMIT)
    return AdminUserRow(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        created_at=user.created_at,
        is_config_admin=is_config_admin(user.email),
        email_verified=user.email_verified,
        has_google=user.google_sub is not None,
        avatar_url=user.avatar_url,
        session_count=int(row.session_count),
        card_count=int(row.card_count),
        quizzes_taken=int(row.quizzes_taken),
        avg_accuracy=float(row.avg_accuracy) if row.avg_accuracy is not None else None,
        ai_enabled=policy.enabled,
        ai_daily_limit=policy.limit,
        ai_limit_is_custom=policy.is_custom,
        ai_used_24h=int(row.ai_used),
    )


async def _build_detail(db: AsyncSession, user_id: str) -> AdminUserDetailOut:
    result = await db.execute(_user_row_query().where(User.id == user_id))
    row = result.first()
    if row is None:
        raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.USER_NOT_FOUND, "User not found")

    base = _to_row(row)
    policy = ai_policy.resolve_policy(row[1], settings.AI_DAILY_QUIZ_LIMIT)

    today = datetime.now(timezone.utc).date()
    since = datetime.combine(today - timedelta(days=ACTIVITY_DAYS - 1), time.min, tzinfo=timezone.utc)

    learn_times = (
        await db.execute(
            select(CardLearnEvent.occurred_at)
            .join(Card, CardLearnEvent.card_id == Card.id)
            .join(Session, Card.session_id == Session.id)
            .where(Session.user_id == user_id, CardLearnEvent.occurred_at >= since)
        )
    ).scalars().all()
    answer_times = (
        await db.execute(
            select(QuizAnswer.answered_at)
            .join(QuizAttempt, QuizAnswer.attempt_id == QuizAttempt.id)
            .where(QuizAttempt.user_id == user_id, QuizAnswer.answered_at >= since)
        )
    ).scalars().all()

    last_learn = (
        await db.execute(
            select(func.max(CardLearnEvent.occurred_at))
            .join(Card, CardLearnEvent.card_id == Card.id)
            .join(Session, Card.session_id == Session.id)
            .where(Session.user_id == user_id)
        )
    ).scalar()
    last_attempt = (
        await db.execute(select(func.max(QuizAttempt.submitted_at)).where(QuizAttempt.user_id == user_id))
    ).scalar()

    usage = await ai_policy.get_usage(db, user_id, policy)

    recent = (
        await db.execute(
            select(Quiz)
            .where(Quiz.user_id == user_id, Quiz.uses_ai.is_(True))
            .order_by(Quiz.created_at.desc())
            .limit(RECENT_AI_QUIZ_LIMIT)
        )
    ).scalars().all()

    return AdminUserDetailOut(
        **base.model_dump(),
        learned_cards=int(row.learned_cards),
        last_active_at=latest_timestamp([last_learn, last_attempt]),
        activity_7d=[
            ActivityDayOut(date=day.date, count=day.count)
            for day in build_activity_7d([*learn_times, *answer_times], today, ACTIVITY_DAYS)
        ],
        ai_usage=AiUsageOut(used=usage.used, limit=usage.limit, resets_at=usage.resets_at),
        ai_system_default_limit=settings.AI_DAILY_QUIZ_LIMIT,
        recent_ai_quizzes=[
            RecentAiQuizOut(
                id=quiz.id,
                title=quiz.title,
                created_at=quiz.created_at,
                status=quiz.status,
                ai_question_count=quiz.ai_question_count,
                requested_count=quiz.requested_count,
            )
            for quiz in recent
        ],
    )


@router.get("/overview", response_model=AdminOverviewOut)
async def get_overview(db: AsyncSession = Depends(get_db)) -> AdminOverviewOut:
    since = datetime.now(timezone.utc) - ACTIVE_WINDOW

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_cards = (await db.execute(select(func.count(Card.id)))).scalar() or 0

    learn_users = (
        select(Session.user_id.label("user_id"))
        .join(Card, Card.session_id == Session.id)
        .join(CardLearnEvent, CardLearnEvent.card_id == Card.id)
        .where(CardLearnEvent.occurred_at >= since)
    )
    attempt_users = select(QuizAttempt.user_id.label("user_id")).where(QuizAttempt.submitted_at >= since)
    active_sq = union(learn_users, attempt_users).subquery()
    active_users = (await db.execute(select(func.count()).select_from(active_sq))).scalar() or 0

    ai_quizzes = (
        await db.execute(
            select(func.count(Quiz.id)).where(
                Quiz.uses_ai.is_(True), Quiz.created_at >= ai_policy.window_start()
            )
        )
    ).scalar() or 0

    return AdminOverviewOut(
        total_users=total_users,
        active_users_7d=active_users,
        total_cards=total_cards,
        ai_quizzes_24h=ai_quizzes,
    )


@router.get("/users", response_model=AdminUserListOut)
async def list_users(
    search: str | None = Query(default=None, max_length=255),
    role: Literal["user", "admin"] | None = None,
    ai: Literal["enabled", "disabled"] | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListOut:
    count_query = _apply_filters(
        select(func.count(User.id))
        .select_from(User)
        .outerjoin(UserAiPolicy, UserAiPolicy.user_id == User.id),
        search,
        role,
        ai,
    )
    total = (await db.execute(count_query)).scalar() or 0

    rows_query = (
        _apply_filters(_user_row_query(), search, role, ai)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(rows_query)

    return AdminUserListOut(
        items=[_to_row(row) for row in result.all()],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetailOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)) -> AdminUserDetailOut:
    return await _build_detail(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserDetailOut)
async def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserDetailOut:
    target = await db.get(User, user_id)
    if target is None:
        raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.USER_NOT_FOUND, "User not found")

    fields = payload.model_fields_set

    if "role" in fields and payload.role is not None:
        admin_count = (
            await db.execute(select(func.count(User.id)).where(User.role == ADMIN_ROLE))
        ).scalar() or 0
        error = check_role_change(
            actor_id=admin.id,
            target_id=target.id,
            target_email=target.email,
            current_role=target.role,
            new_role=payload.role,
            admin_count=admin_count,
        )
        if error is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
        target.role = payload.role

    if "ai_enabled" in fields or "ai_daily_limit" in fields:
        await ai_policy.upsert_policy(
            db,
            target.id,
            updated_by=admin.id,
            ai_enabled=payload.ai_enabled,
            daily_limit=payload.ai_daily_limit,
            set_limit="ai_daily_limit" in fields,
        )

    await db.commit()
    return await _build_detail(db, target.id)

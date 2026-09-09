from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card, CardLearnEvent
from app.models.session import Session
from app.models.user import User
from app.schemas.stats import DailyPoint, DailyStatsOut
from app.services.learning import calculate_streak

router = APIRouter()


@router.get("/daily", response_model=DailyStatsOut)
async def daily_stats(
    days: int = Query(default=30, ge=1, le=365),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyStatsOut:
    offset = timedelta(minutes=tz_offset_minutes)
    local_date = func.date(CardLearnEvent.occurred_at + offset)

    today = (datetime.now(timezone.utc) + offset).date()
    start_date = today - timedelta(days=days - 1)

    base = (
        select(local_date.label("day"))
        .join(Card, CardLearnEvent.card_id == Card.id)
        .join(Session, Card.session_id == Session.id)
        .where(
            Session.user_id == current_user.id,
            CardLearnEvent.event_type == "learned",
        )
    )

    window_result = await db.execute(
        base.add_columns(func.count(distinct(CardLearnEvent.card_id)).label("learned_count"))
        .where(local_date >= start_date)
        .group_by(local_date)
    )
    counts = {row.day: row.learned_count for row in window_result}

    streak_result = await db.execute(base.distinct())
    learned_dates = {row.day for row in streak_result}

    daily = []
    for index in range(days):
        current = start_date + timedelta(days=index)
        daily.append(DailyPoint(date=current, learned_count=counts.get(current, 0)))

    return DailyStatsOut(
        days=days,
        daily=daily,
        current_streak=calculate_streak(learned_dates, today),
    )

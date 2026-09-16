"""Thống kê thuần cho admin: không chạm DB để unit test được."""
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone


@dataclass(frozen=True)
class ActivityDay:
    date: date
    count: int


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def build_activity_7d(timestamps: Iterable[datetime], today: date, days: int = 7) -> list[ActivityDay]:
    """Đếm hoạt động theo ngày UTC cho `days` ngày kết thúc ở `today`, cũ trước mới sau."""
    start = today - timedelta(days=days - 1)
    counts = Counter(_as_utc(ts).date() for ts in timestamps)
    return [
        ActivityDay(date=start + timedelta(days=offset), count=counts.get(start + timedelta(days=offset), 0))
        for offset in range(days)
    ]


def latest_timestamp(values: Iterable[datetime | None]) -> datetime | None:
    present = [_as_utc(value) for value in values if value is not None]
    return max(present) if present else None

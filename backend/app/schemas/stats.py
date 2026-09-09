from datetime import date

from pydantic import BaseModel


class DailyPoint(BaseModel):
    date: date
    learned_count: int


class DailyStatsOut(BaseModel):
    days: int
    daily: list[DailyPoint]
    current_streak: int

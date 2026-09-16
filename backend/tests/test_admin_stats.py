"""Unit test thống kê thuần cho trang chi tiết user."""
from datetime import date, datetime, timezone

from app.services.admin_stats import ActivityDay, build_activity_7d, latest_timestamp


class TestBuildActivity7d:
    TODAY = date(2026, 9, 15)

    def test_returns_seven_days_oldest_first_with_zeros(self):
        result = build_activity_7d([], self.TODAY)
        assert [day.date for day in result] == [date(2026, 9, d) for d in range(9, 16)]
        assert all(day.count == 0 for day in result)

    def test_counts_events_per_utc_day_and_ignores_older_ones(self):
        timestamps = [
            datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc),
            datetime(2026, 9, 15, 23, 59, tzinfo=timezone.utc),
            datetime(2026, 9, 9, 0, 1, tzinfo=timezone.utc),
            datetime(2026, 9, 8, 23, 59, tzinfo=timezone.utc),
        ]
        result = build_activity_7d(timestamps, self.TODAY)
        assert result[0] == ActivityDay(date=date(2026, 9, 9), count=1)
        assert result[-1] == ActivityDay(date=date(2026, 9, 15), count=2)
        assert sum(day.count for day in result) == 3

    def test_naive_timestamps_are_treated_as_utc(self):
        result = build_activity_7d([datetime(2026, 9, 14, 12, 0)], self.TODAY)
        assert result[-2] == ActivityDay(date=date(2026, 9, 14), count=1)

    def test_non_utc_timestamps_are_bucketed_by_utc_date(self):
        from datetime import timedelta

        plus7 = timezone(timedelta(hours=7))
        # 2026-09-15 03:00 +07:00 == 2026-09-14 20:00 UTC
        result = build_activity_7d([datetime(2026, 9, 15, 3, 0, tzinfo=plus7)], self.TODAY)
        assert result[-2].count == 1
        assert result[-1].count == 0


class TestLatestTimestamp:
    def test_all_none_returns_none(self):
        assert latest_timestamp([None, None]) is None

    def test_picks_latest_and_normalizes_naive_to_utc(self):
        aware = datetime(2026, 9, 14, 8, 0, tzinfo=timezone.utc)
        naive = datetime(2026, 9, 15, 8, 0)
        assert latest_timestamp([aware, None, naive]) == datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc)

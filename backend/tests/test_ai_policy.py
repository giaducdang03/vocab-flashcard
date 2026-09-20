"""Unit test phần thuần của policy AI theo user — không chạm DB."""
from datetime import datetime, timedelta, timezone

# Đăng ký đủ mapper (Session.cards trỏ tới "Card") trước khi tạo instance model.
import app.models.card  # noqa: F401
import app.models.quiz  # noqa: F401
import app.models.user  # noqa: F401
from app.models.ai_policy import UserAiPolicy
from app.services.ai_policy import (
    DISABLED_MESSAGE,
    EffectivePolicy,
    apply_policy_update,
    check_creation,
    check_enabled,
    compute_resets_at,
    resolve_policy,
    window_start,
)


def _row(ai_enabled: bool = True, daily_limit: int | None = None) -> UserAiPolicy:
    return UserAiPolicy(user_id="u1", ai_enabled=ai_enabled, daily_limit=daily_limit)


class TestResolvePolicy:
    def test_missing_row_defaults_to_disabled(self):
        assert resolve_policy(None, 20) == EffectivePolicy(enabled=False, limit=20, is_custom=False)

    def test_null_limit_falls_back_to_system_default(self):
        policy = resolve_policy(_row(ai_enabled=False, daily_limit=None), 20)
        assert policy == EffectivePolicy(enabled=False, limit=20, is_custom=False)

    def test_custom_limit_overrides_default(self):
        assert resolve_policy(_row(daily_limit=5), 20) == EffectivePolicy(enabled=True, limit=5, is_custom=True)

    def test_zero_limit_is_a_real_custom_limit(self):
        assert resolve_policy(_row(daily_limit=0), 20) == EffectivePolicy(enabled=True, limit=0, is_custom=True)


class TestComputeResetsAt:
    def test_no_quiz_in_window_means_no_reset_time(self):
        assert compute_resets_at(None) is None

    def test_reset_is_oldest_quiz_plus_24_hours(self):
        oldest = datetime(2026, 9, 15, 8, 30, tzinfo=timezone.utc)
        assert compute_resets_at(oldest) == datetime(2026, 9, 16, 8, 30, tzinfo=timezone.utc)

    def test_naive_datetime_is_treated_as_utc(self):
        oldest = datetime(2026, 9, 15, 8, 30)
        assert compute_resets_at(oldest) == datetime(2026, 9, 16, 8, 30, tzinfo=timezone.utc)


class TestWindowStart:
    def test_window_is_24_hours_back(self):
        now = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
        assert window_start(now) == now - timedelta(hours=24)


class TestChecks:
    def test_enabled_policy_passes_enabled_check(self):
        assert check_enabled(EffectivePolicy(True, 20, False)) is None

    def test_disabled_policy_is_403(self):
        violation = check_enabled(EffectivePolicy(False, 20, False))
        assert violation is not None
        assert violation.status_code == 403
        assert violation.message == DISABLED_MESSAGE

    def test_creation_allowed_below_limit(self):
        assert check_creation(EffectivePolicy(True, 3, True), used=2) is None

    def test_creation_blocked_at_limit_with_429(self):
        violation = check_creation(EffectivePolicy(True, 3, True), used=3)
        assert violation is not None
        assert violation.status_code == 429
        assert violation.message == "You have used all 3 AI quiz generations in the last 24 hours"
        assert violation.params == {"limit": 3}

    def test_zero_limit_blocks_first_quiz(self):
        violation = check_creation(EffectivePolicy(True, 0, True), used=0)
        assert violation is not None and violation.status_code == 429

    def test_creation_check_reports_disabled_before_limit(self):
        violation = check_creation(EffectivePolicy(False, 0, True), used=5)
        assert violation is not None and violation.status_code == 403


class TestApplyPolicyUpdate:
    NOW = datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)

    def test_creates_row_with_defaults_when_missing(self):
        row, created = apply_policy_update(None, "u1", updated_by="admin", ai_enabled=False, now=self.NOW)
        assert created is True
        assert row.user_id == "u1"
        assert row.ai_enabled is False
        assert row.daily_limit is None
        assert row.updated_by == "admin"
        assert row.updated_at == self.NOW

    def test_new_row_without_ai_enabled_defaults_to_disabled(self):
        row, _ = apply_policy_update(None, "u1", updated_by="admin", daily_limit=7, set_limit=True, now=self.NOW)
        assert row.ai_enabled is False
        assert row.daily_limit == 7

    def test_limit_untouched_when_set_limit_is_false(self):
        existing = _row(daily_limit=9)
        row, created = apply_policy_update(existing, "u1", updated_by="admin", ai_enabled=False, now=self.NOW)
        assert created is False
        assert row is existing
        assert row.daily_limit == 9
        assert row.ai_enabled is False

    def test_set_limit_with_none_resets_to_system_default(self):
        existing = _row(daily_limit=9)
        row, _ = apply_policy_update(existing, "u1", updated_by="admin", daily_limit=None, set_limit=True, now=self.NOW)
        assert row.daily_limit is None

    def test_ai_enabled_none_keeps_existing_value(self):
        existing = _row(ai_enabled=False, daily_limit=4)
        row, _ = apply_policy_update(existing, "u1", updated_by="admin", daily_limit=6, set_limit=True, now=self.NOW)
        assert row.ai_enabled is False
        assert row.daily_limit == 6
        assert row.updated_at == self.NOW

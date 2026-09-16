"""Unit test schema: AiStatusOut và schema admin."""
import pytest
from pydantic import ValidationError

from app.schemas.quiz import AiStatusOut


class TestAiStatusOut:
    def test_exposes_per_user_policy_fields(self):
        status = AiStatusOut(available=True, enabled_for_user=False, daily_limit=5, used_today=2)
        assert status.model_dump() == {
            "available": True,
            "enabled_for_user": False,
            "daily_limit": 5,
            "used_today": 2,
        }

    def test_enabled_for_user_is_required(self):
        with pytest.raises(ValidationError):
            AiStatusOut(available=True, daily_limit=5, used_today=2)


from app.schemas.admin import AdminUserUpdate


class TestAdminUserUpdate:
    def test_empty_body_sets_no_fields(self):
        assert AdminUserUpdate.model_validate({}).model_fields_set == set()

    def test_explicit_null_limit_is_distinguishable_from_missing(self):
        update = AdminUserUpdate.model_validate({"ai_daily_limit": None})
        assert "ai_daily_limit" in update.model_fields_set
        assert update.ai_daily_limit is None

    def test_limit_bounds_are_enforced(self):
        assert AdminUserUpdate.model_validate({"ai_daily_limit": 0}).ai_daily_limit == 0
        assert AdminUserUpdate.model_validate({"ai_daily_limit": 1000}).ai_daily_limit == 1000
        with pytest.raises(ValidationError):
            AdminUserUpdate.model_validate({"ai_daily_limit": 1001})
        with pytest.raises(ValidationError):
            AdminUserUpdate.model_validate({"ai_daily_limit": -1})

    def test_unknown_role_is_rejected(self):
        with pytest.raises(ValidationError):
            AdminUserUpdate.model_validate({"role": "owner"})

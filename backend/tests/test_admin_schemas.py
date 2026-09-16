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

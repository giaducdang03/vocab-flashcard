"""Unit test quy tắc role và ADMIN_EMAILS."""
from types import SimpleNamespace

from app.schemas.auth import UserOut
from app.services.admin_access import (
    CONFIG_ADMIN_DETAIL,
    LAST_ADMIN_DETAIL,
    SELF_ROLE_DETAIL,
    check_role_change,
    is_config_admin,
    parse_admin_emails,
    should_promote,
)


class TestParseAdminEmails:
    def test_splits_trims_lowercases_and_skips_blanks(self):
        assert parse_admin_emails(" A@x.com, b@Y.com ,, ") == frozenset({"a@x.com", "b@y.com"})

    def test_empty_string_means_no_config_admins(self):
        assert parse_admin_emails("") == frozenset()


class TestIsConfigAdmin:
    def test_match_is_case_insensitive(self):
        assert is_config_admin("Boss@Example.com", "boss@example.com") is True

    def test_non_listed_email_is_not_config_admin(self):
        assert is_config_admin("other@example.com", "boss@example.com") is False

    def test_empty_config_matches_nobody(self):
        assert is_config_admin("boss@example.com", "") is False


class TestShouldPromote:
    def test_listed_user_role_is_promoted(self):
        assert should_promote("boss@example.com", "user", "boss@example.com") is True

    def test_listed_admin_needs_no_change(self):
        assert should_promote("boss@example.com", "admin", "boss@example.com") is False

    def test_unlisted_user_is_not_promoted(self):
        assert should_promote("x@example.com", "user", "boss@example.com") is False


def _change(**overrides):
    params = dict(
        actor_id="admin-1",
        target_id="admin-2",
        target_email="second@example.com",
        current_role="admin",
        new_role="user",
        admin_count=2,
        admin_emails_raw="boss@example.com",
    )
    params.update(overrides)
    return check_role_change(**params)


class TestCheckRoleChange:
    def test_unchanged_role_is_allowed(self):
        assert _change(new_role="admin") is None

    def test_promotion_is_always_allowed(self):
        assert _change(current_role="user", new_role="admin", admin_count=1) is None

    def test_demoting_another_admin_is_allowed_when_others_remain(self):
        assert _change() is None

    def test_cannot_demote_yourself(self):
        assert _change(target_id="admin-1") == SELF_ROLE_DETAIL

    def test_cannot_demote_config_admin(self):
        assert _change(target_email="BOSS@example.com") == CONFIG_ADMIN_DETAIL

    def test_cannot_demote_last_admin(self):
        assert _change(admin_count=1) == LAST_ADMIN_DETAIL


class TestUserOut:
    def test_role_is_serialized_from_model_attributes(self):
        user = SimpleNamespace(id="u1", email="a@example.com", display_name="A", role="admin")
        assert UserOut.model_validate(user).role == "admin"

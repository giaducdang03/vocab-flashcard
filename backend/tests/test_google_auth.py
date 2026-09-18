"""Unit test logic thuần của đăng nhập Google."""
import pytest

from app.config import settings
from app.services.google_auth import (
    GoogleAuthError,
    build_authorize_url,
    decide_link_action,
    is_configured,
    normalize_profile,
)


def valid_claims(**overrides) -> dict:
    """Helper: returns dict with sub, email, email_verified=True, name."""
    claims = {
        "sub": "google-sub-123",
        "email": "User@Example.com",
        "email_verified": True,
        "name": "Nguyen Van A",
        "picture": "https://lh3.googleusercontent.com/a/avatar.jpg",
    }
    claims.update(overrides)
    return claims


class TestNormalizeProfile:
    def test_returns_profile_with_lowercased_trimmed_email(self):
        profile = normalize_profile(valid_claims(email="  User@Example.COM  "))

        assert profile.email == "user@example.com"
        assert profile.sub == "google-sub-123"
        assert profile.display_name == "Nguyen Van A"

    def test_rejects_unverified_email(self):
        with pytest.raises(GoogleAuthError) as exc:
            normalize_profile(valid_claims(email_verified=False))

        assert exc.value.code == "email_unverified"

    def test_rejects_missing_email_verified_claim(self):
        claims = valid_claims()
        del claims["email_verified"]

        with pytest.raises(GoogleAuthError) as exc:
            normalize_profile(claims)

        assert exc.value.code == "email_unverified"

    def test_rejects_string_true_not_boolean(self):
        """Chuỗi "true" là truthy — phải so sánh bằng `is True`, nếu không là lỗ hổng."""
        with pytest.raises(GoogleAuthError) as exc:
            normalize_profile(valid_claims(email_verified="true"))

        assert exc.value.code == "email_unverified"

    def test_rejects_missing_sub(self):
        with pytest.raises(GoogleAuthError) as exc:
            normalize_profile(valid_claims(sub=""))

        assert exc.value.code == "google_error"

    def test_rejects_missing_email(self):
        with pytest.raises(GoogleAuthError) as exc:
            normalize_profile(valid_claims(email=""))

        assert exc.value.code == "google_error"

    def test_falls_back_to_email_prefix_when_name_missing(self):
        claims = valid_claims(email="someone@example.com")
        del claims["name"]

        assert normalize_profile(claims).display_name == "someone"

    def test_falls_back_when_name_is_blank(self):
        profile = normalize_profile(valid_claims(email="someone@example.com", name="   "))

        assert profile.display_name == "someone"

    def test_reads_picture_claim_as_avatar_url(self):
        profile = normalize_profile(valid_claims())

        assert profile.avatar_url == "https://lh3.googleusercontent.com/a/avatar.jpg"

    def test_avatar_url_is_none_when_picture_missing(self):
        claims = valid_claims()
        del claims["picture"]

        assert normalize_profile(claims).avatar_url is None


class TestDecideLinkAction:
    def test_known_google_sub_logs_in(self):
        assert decide_link_action(object(), None) == "login"

    def test_google_sub_wins_even_when_another_user_has_the_email(self):
        assert decide_link_action(object(), object()) == "login"

    def test_existing_email_without_sub_is_linked(self):
        assert decide_link_action(None, object()) == "link"

    def test_unknown_user_is_created(self):
        assert decide_link_action(None, None) == "create"


class TestIsConfigured:
    def test_false_when_client_id_empty(self, monkeypatch):
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
        monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://x/cb")

        assert is_configured() is False

    def test_false_when_client_secret_empty(self, monkeypatch):
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "")
        monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://x/cb")

        assert is_configured() is False

    def test_false_when_redirect_uri_empty(self, monkeypatch):
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
        monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "")

        assert is_configured() is False

    def test_true_when_all_three_present(self, monkeypatch):
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id")
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
        monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://x/cb")

        assert is_configured() is True


class TestBuildAuthorizeUrl:
    def test_contains_all_required_params(self, monkeypatch):
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "my-client-id")
        monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

        url = build_authorize_url("state-abc")

        assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
        assert "client_id=my-client-id" in url
        assert "response_type=code" in url
        assert "state=state-abc" in url
        assert "scope=openid+email+profile" in url
        assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fauth%2Fgoogle%2Fcallback" in url

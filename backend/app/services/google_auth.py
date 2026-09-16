"""Đăng nhập Google — Google chỉ chứng minh danh tính một lần.

Token của Google chỉ sống trong đúng request callback: dùng để đọc `sub` và
`email` rồi vứt đi. Không lưu DB, không trả về frontend. Sau đó hệ thống quay
về flow cũ: tra/tạo user trong DB rồi phát JWT của chính mình.
"""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from app.config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_SCOPE = "openid email profile"


class GoogleAuthError(Exception):
    """Lỗi có mã để redirect về frontend. Xem bảng mã trong spec mục 7.5."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class GoogleProfile:
    sub: str
    email: str
    display_name: str


def is_configured() -> bool:
    """Check if Google OAuth is fully configured with all required settings."""
    return bool(
        settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI
    )


def build_authorize_url(state: str) -> str:
    """Build the Google OAuth authorization URL with the given state."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "state": state,
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def normalize_profile(claims: dict) -> GoogleProfile:
    """Đọc claims của id_token thành profile, hoặc ném GoogleAuthError.

    So sánh `is True` chứ không dùng truthy: chuỗi "false" cũng là truthy, và
    đây là hàng rào duy nhất chặn việc chiếm tài khoản bằng email giả mạo.
    """
    if claims.get("email_verified") is not True:
        raise GoogleAuthError("email_unverified")

    sub = (claims.get("sub") or "").strip()
    email = (claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise GoogleAuthError("google_error")

    display_name = (claims.get("name") or "").strip() or email.split("@")[0]
    return GoogleProfile(sub=sub, email=email, display_name=display_name)


def decide_link_action(by_sub, by_email) -> str:
    """login = đã có google_sub; link = có email nhưng chưa có sub; create = user mới.

    Tra theo `sub` trước vì Google cho phép đổi email của tài khoản, còn `sub`
    thì bất biến.
    """
    if by_sub is not None:
        return "login"
    if by_email is not None:
        return "link"
    return "create"

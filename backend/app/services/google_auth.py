"""Đăng nhập Google — Google chỉ chứng minh danh tính một lần.

Token của Google chỉ sống trong đúng request callback: dùng để đọc `sub` và
`email` rồi vứt đi. Không lưu DB, không trả về frontend. Sau đó hệ thống quay
về flow cũ: tra/tạo user trong DB rồi phát JWT của chính mình.
"""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.services.admin_access import ADMIN_ROLE, USER_ROLE, is_config_admin

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
    avatar_url: str | None


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
    avatar_url = (claims.get("picture") or "").strip() or None
    return GoogleProfile(sub=sub, email=email, display_name=display_name, avatar_url=avatar_url)


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


async def exchange_code_for_claims(code: str) -> dict:
    """Đổi authorization code lấy claims của id_token.

    Không verify chữ ký: token lấy trực tiếp từ token endpoint của Google qua
    TLS trong cùng request, không qua trung gian nào (khuyến nghị của Google
    cho server-side code flow).
    """
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
        response.raise_for_status()
        payload = response.json()
        id_token = payload.get("id_token")
        if not id_token:
            raise GoogleAuthError("exchange_failed")
        claims = jwt.get_unverified_claims(id_token)
    except GoogleAuthError:
        raise
    except Exception as exc:  # noqa: BLE001 - mọi lỗi mạng/parse đều quy về exchange_failed
        raise GoogleAuthError("exchange_failed") from exc
    return claims


async def resolve_user(db: AsyncSession, profile: GoogleProfile) -> User:
    """Thực thi quyết định của decide_link_action, commit, trả User."""
    by_sub_result = await db.execute(select(User).where(User.google_sub == profile.sub))
    by_sub = by_sub_result.scalar_one_or_none()

    by_email_result = await db.execute(select(User).where(User.email == profile.email))
    by_email = by_email_result.scalar_one_or_none()

    action = decide_link_action(by_sub, by_email)

    if action == "login":
        if profile.avatar_url and by_sub.avatar_url != profile.avatar_url:
            by_sub.avatar_url = profile.avatar_url
            await db.commit()
            await db.refresh(by_sub)
        return by_sub

    if action == "link":
        by_email.google_sub = profile.sub
        by_email.email_verified = True
        by_email.avatar_url = profile.avatar_url
        await db.commit()
        await db.refresh(by_email)
        return by_email

    user = User(
        email=profile.email,
        google_sub=profile.sub,
        email_verified=True,
        password_hash=None,
        display_name=profile.display_name,
        avatar_url=profile.avatar_url,
        role=ADMIN_ROLE if is_config_admin(profile.email) else USER_ROLE,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

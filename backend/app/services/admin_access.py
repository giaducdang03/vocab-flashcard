"""Quy tắc role: bootstrap admin qua ADMIN_EMAILS và các chặn khi hạ quyền."""
from app.config import settings

ADMIN_ROLE = "admin"
USER_ROLE = "user"

SELF_ROLE_DETAIL = "You cannot change your own role"
CONFIG_ADMIN_DETAIL = "This admin is managed by ADMIN_EMAILS"
LAST_ADMIN_DETAIL = "At least one admin is required"


def parse_admin_emails(raw: str) -> frozenset[str]:
    return frozenset(part.strip().lower() for part in raw.split(",") if part.strip())


def is_config_admin(email: str, admin_emails_raw: str | None = None) -> bool:
    raw = settings.ADMIN_EMAILS if admin_emails_raw is None else admin_emails_raw
    return email.strip().lower() in parse_admin_emails(raw)


def should_promote(email: str, role: str, admin_emails_raw: str | None = None) -> bool:
    return role != ADMIN_ROLE and is_config_admin(email, admin_emails_raw)


def check_role_change(
    *,
    actor_id: str,
    target_id: str,
    target_email: str,
    current_role: str,
    new_role: str,
    admin_count: int,
    admin_emails_raw: str | None = None,
) -> str | None:
    """Trả message lỗi nếu việc đổi role bị cấm, None nếu được phép."""
    if new_role == current_role or new_role == ADMIN_ROLE:
        return None
    if actor_id == target_id:
        return SELF_ROLE_DETAIL
    if is_config_admin(target_email, admin_emails_raw):
        return CONFIG_ADMIN_DETAIL
    if admin_count <= 1:
        return LAST_ADMIN_DETAIL
    return None

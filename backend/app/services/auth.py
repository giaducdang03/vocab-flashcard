from datetime import datetime, timedelta, timezone

from fastapi import status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.errors import ErrorCode, api_error
from app.models.user import User
from app.services.admin_access import ADMIN_ROLE, should_promote

# Use argon2 for password hashing - supports unlimited password length and more secure than bcrypt
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expires_at}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, "Invalid credentials")
    return user


async def sync_config_admin(db: AsyncSession, user: User) -> None:
    """Nâng user lên admin nếu email nằm trong ADMIN_EMAILS."""
    if not should_promote(user.email, user.role):
        return
    user.role = ADMIN_ROLE
    await db.commit()
    await db.refresh(user)

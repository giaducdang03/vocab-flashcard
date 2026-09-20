from typing import Annotated

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.errors import ErrorCode, api_error
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.NOT_AUTHENTICATED, "Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise JWTError("Missing subject")
    except JWTError as exc:
        raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.INVALID_TOKEN, "Invalid token") from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.USER_NOT_FOUND, "User not found")

    return user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "admin":
        raise api_error(status.HTTP_403_FORBIDDEN, ErrorCode.ADMIN_REQUIRED, "Admin access required")
    return current_user

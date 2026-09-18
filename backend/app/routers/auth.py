from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    GoogleExchangeRequest,
    LoginRequest,
    ProvidersOut,
    RegisterRequest,
    UserOut,
)
from app.services import google_auth, oauth_state
from app.services.admin_access import ADMIN_ROLE, USER_ROLE, is_config_admin
from app.services.auth import authenticate_user, create_access_token, hash_password, sync_config_admin
from app.services.google_auth import GoogleAuthError

router = APIRouter()


def _frontend_redirect(**params: str) -> RedirectResponse:
    """Tạo redirect URL về `{FRONTEND_URL}/auth/callback` kèm query params."""
    url = f"{settings.FRONTEND_URL}/auth/callback?{urlencode(params)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


@router.post("/register", response_model=AuthResponse)
async def register_user(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=ADMIN_ROLE if is_config_admin(str(payload.email)) else USER_ROLE,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(user=UserOut.model_validate(user), token=token)


@router.post("/login", response_model=AuthResponse)
async def login_user(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await authenticate_user(db, str(payload.email), payload.password)
    await sync_config_admin(db, user)
    token = create_access_token(user.id)
    return AuthResponse(user=UserOut.model_validate(user), token=token)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.get("/providers", response_model=ProvidersOut)
async def get_providers() -> ProvidersOut:
    return ProvidersOut(google=google_auth.is_configured())


@router.get("/google/login")
async def google_login() -> RedirectResponse:
    if not google_auth.is_configured():
        return _frontend_redirect(error="google_disabled")

    state = oauth_state.state_store.issue("")
    return RedirectResponse(url=google_auth.build_authorize_url(state), status_code=status.HTTP_302_FOUND)


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error:
        return _frontend_redirect(error="google_error")

    if not state or oauth_state.state_store.consume(state) is None:
        return _frontend_redirect(error="invalid_state")

    if not code:
        return _frontend_redirect(error="google_error")

    try:
        claims = await google_auth.exchange_code_for_claims(code)
        profile = google_auth.normalize_profile(claims)
        user = await google_auth.resolve_user(db, profile)
    except GoogleAuthError as exc:
        return _frontend_redirect(error=exc.code)

    await sync_config_admin(db, user)
    login_code = oauth_state.login_code_store.issue(user.id)
    return _frontend_redirect(code=login_code)


@router.post("/google/exchange", response_model=AuthResponse)
async def google_exchange(payload: GoogleExchangeRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user_id = oauth_state.login_code_store.consume(payload.code)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    token = create_access_token(user.id)
    return AuthResponse(user=UserOut.model_validate(user), token=token)

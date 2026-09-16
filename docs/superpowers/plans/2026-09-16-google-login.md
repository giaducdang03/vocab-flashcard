# Google Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép đăng nhập bằng Google, tự động link vào tài khoản cũ trùng email và đánh dấu `email_verified = true`.

**Architecture:** Google chỉ là lớp chứng minh danh tính một lần — backend chạy Authorization Code flow, đọc `sub` + `email` từ `id_token` rồi vứt token của Google đi. Sau đó quay về flow cũ 100%: tra/tạo user trong DB và phát đúng JWT hiện hành. JWT không đi qua URL; callback redirect về frontend kèm một one-time code hạn 60 giây để đổi lấy token.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, python-jose, httpx, pytest (asyncio_mode=auto), React 18 + Vite + TypeScript, axios, react-router-dom v6, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-16-google-login-design.md`

## Global Constraints

- **Không thêm refresh token.** Hệ thống chỉ có một access token HS256 hạn `JWT_EXPIRE_MINUTES` (mặc định 1440). Giữ nguyên.
- **Token của Google không bao giờ được lưu DB hay trả về frontend.** Chỉ dùng trong đúng request callback.
- **Chỉ link tài khoản khi claim `email_verified` của Google là `True`** (kiểm bằng `is True`, không dùng truthy — chuỗi `"false"` cũng là truthy).
- **Link không được xoá `password_hash`**, không đổi `user.id`, `email`, `display_name`, `role`.
- **Lỗi Google không được ảnh hưởng đăng nhập mật khẩu.** Mọi lỗi đều redirect về frontend kèm mã lỗi.
- **Lệnh chạy test:** `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
  (chạy `pytest` trần sẽ hỏng vì `backend/smoke_test.py` cố kết nối server thật — luôn giới hạn vào thư mục `tests/`). Baseline hiện tại: **125 passed**.
- **Lệnh build frontend:** `cd frontend && npm run build`
- **Chỉ unit test logic thuần.** Repo không có hạ tầng test API, không thêm `conftest.py`, không thêm test client. Router giữ mỏng, logic dồn vào hàm thuần.
- Mã lỗi redirect dùng đúng 5 giá trị: `google_disabled`, `invalid_state`, `exchange_failed`, `email_unverified`, `google_error`.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `backend/app/services/oauth_state.py` | **Mới.** `TtlStore` — kho token tạm, hết hạn theo TTL, dùng một lần. Hai thể hiện: `state_store`, `login_code_store`. |
| `backend/app/services/google_auth.py` | **Mới.** Logic Google: hàm thuần (`is_configured`, `build_authorize_url`, `normalize_profile`, `decide_link_action`) + I/O (`exchange_code_for_claims`, `resolve_user`). |
| `backend/app/routers/auth.py` | Thêm 4 endpoint, giữ router mỏng. |
| `backend/app/schemas/auth.py` | `UserOut.email_verified`, `GoogleExchangeRequest`, `ProvidersOut`. |
| `backend/app/models/user.py` | Thêm `email_verified`, `google_sub`; `password_hash` thành nullable. |
| `backend/app/services/auth.py` | `authenticate_user` chịu được `password_hash = None`. |
| `backend/alembic/versions/20260916_add_google_auth.py` | **Mới.** Migration. |
| `backend/app/config.py` | 4 biến môi trường mới. |
| `frontend/src/pages/AuthCallbackPage.tsx` | **Mới.** Đổi one-time code lấy JWT rồi điều hướng. |
| `frontend/src/contexts/AuthContext.tsx` | Thêm `loginWithGoogleCode`. |
| `frontend/src/pages/AuthPage.tsx` | Nút Google + hiện lỗi trả về từ callback. |
| `frontend/src/components/admin/UserTable.tsx`, `frontend/src/pages/AdminUserDetailPage.tsx` | Badge `Verified` / `Google`. |

---

### Task 1: Schema, config và chống vỡ đăng nhập mật khẩu

Nền móng: cột mới, `password_hash` nullable, biến môi trường. Gộp cả sửa `authenticate_user` vào đây vì nó là hệ quả trực tiếp của việc cho phép `password_hash = NULL` — tách ra sẽ để lại một khoảng thời gian code 500 khi gặp user Google-only.

**Files:**
- Modify: `backend/app/models/user.py:16`
- Modify: `backend/app/services/auth.py:31-36`
- Modify: `backend/app/config.py:9`
- Modify: `backend/requirements.txt`
- Modify: `.env.example`, `backend/.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `DEPLOYMENT.md`
- Create: `backend/alembic/versions/20260916_add_google_auth.py`
- Test: `backend/tests/test_auth_service.py`

**Interfaces:**
- Consumes: không có (task đầu tiên).
- Produces: `User.email_verified: bool`, `User.google_sub: str | None`, `User.password_hash: str | None`; `settings.GOOGLE_CLIENT_ID`, `settings.GOOGLE_CLIENT_SECRET`, `settings.GOOGLE_REDIRECT_URI`, `settings.FRONTEND_URL` (đều là `str`, mặc định rỗng trừ `FRONTEND_URL`).

- [ ] **Step 1: Viết test thất bại cho `authenticate_user`**

Tạo `backend/tests/test_auth_service.py`. Repo không có DB test, nên dùng stub thủ công — `authenticate_user` chỉ gọi `db.execute(...)` rồi `.scalar_one_or_none()`:

```python
"""Unit test authenticate_user — không cần DB thật."""
import pytest
from fastapi import HTTPException

from app.services.auth import authenticate_user, hash_password


class FakeResult:
    def __init__(self, user):
        self._user = user

    def scalar_one_or_none(self):
        return self._user


class FakeDb:
    """Chỉ cần đủ giao diện mà authenticate_user dùng."""

    def __init__(self, user):
        self._user = user

    async def execute(self, _query):
        return FakeResult(self._user)


class FakeUser:
    def __init__(self, password_hash):
        self.id = "user-1"
        self.email = "a@example.com"
        self.password_hash = password_hash


class TestAuthenticateUser:
    async def test_google_only_user_cannot_login_with_password(self):
        """password_hash = None (user tạo qua Google) phải trả 401, không ném lỗi passlib."""
        db = FakeDb(FakeUser(password_hash=None))

        with pytest.raises(HTTPException) as exc:
            await authenticate_user(db, "a@example.com", "anything")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Invalid credentials"

    async def test_unknown_email_returns_401(self):
        db = FakeDb(None)

        with pytest.raises(HTTPException) as exc:
            await authenticate_user(db, "missing@example.com", "anything")

        assert exc.value.status_code == 401

    async def test_correct_password_returns_user(self):
        user = FakeUser(password_hash=hash_password("secret123"))
        db = FakeDb(user)

        assert await authenticate_user(db, "a@example.com", "secret123") is user

    async def test_wrong_password_returns_401(self):
        db = FakeDb(FakeUser(password_hash=hash_password("secret123")))

        with pytest.raises(HTTPException) as exc:
            await authenticate_user(db, "a@example.com", "wrong")

        assert exc.value.status_code == 401
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_auth_service.py -q`
Expected: FAIL ở `test_google_only_user_cannot_login_with_password` — passlib ném `TypeError`/`AttributeError` vì hash là `None`, không phải `HTTPException`. Ba test còn lại PASS.

- [ ] **Step 3: Sửa `authenticate_user`**

Trong `backend/app/services/auth.py`, đổi dòng 34:

```python
async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    # password_hash rỗng = tài khoản chỉ đăng nhập bằng Google; báo lỗi chung,
    # không tiết lộ tài khoản có tồn tại.
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user
```

- [ ] **Step 4: Chạy lại test**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_auth_service.py -q`
Expected: PASS (4 passed)

- [ ] **Step 5: Cập nhật model**

Trong `backend/app/models/user.py`, sửa dòng 16 và thêm hai cột. Nhớ import `Boolean`:

```python
from sqlalchemy import String, DateTime, Boolean
...
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user", server_default="user")
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
```

- [ ] **Step 6: Viết migration**

Tạo `backend/alembic/versions/20260916_add_google_auth.py`. **Bắt buộc dùng `batch_alter_table`**: dev local chạy SQLite (`backend/vocabflash.db`), mà SQLite không hỗ trợ `ALTER COLUMN` lẫn `ADD CONSTRAINT` rời.

```python
"""add google auth columns

Revision ID: 20260916_google
Revises: 20260915_admin
Create Date: 2026-09-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260916_google"
down_revision = "20260915_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table để chạy được trên cả SQLite (dev) lẫn Postgres (prod)
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )
        batch.add_column(sa.Column("google_sub", sa.String(length=255), nullable=True))
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)
        batch.create_unique_constraint("uq_users_google_sub", ["google_sub"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_google_sub", type_="unique")
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
        batch.drop_column("google_sub")
        batch.drop_column("email_verified")
```

- [ ] **Step 7: Chạy migration và kiểm tra cột thật sự có**

Run:
```bash
cd backend && .venv/Scripts/python.exe -m alembic upgrade head
```
Expected: log `Running upgrade 20260915_admin -> 20260916_google`, không lỗi.

Kiểm chứng cột (đừng tin log suông):
```bash
cd backend && .venv/Scripts/python.exe -c "import sqlite3; print([(r[1], r[2], r[3]) for r in sqlite3.connect('vocabflash.db').execute('PRAGMA table_info(users)')])"
```
Expected: có `('email_verified', 'BOOLEAN', 1)`, `('google_sub', 'VARCHAR(255)', 0)`, và `password_hash` với cờ notnull = `0`.

- [ ] **Step 8: Thêm config và dependency**

`backend/app/config.py` — thêm sau dòng `ADMIN_EMAILS`:

```python
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
```

`backend/requirements.txt` — thêm dòng (hiện chỉ có httpx gián tiếp qua `openai`, không được dựa vào phụ thuộc bắc cầu):

```
httpx==0.27.2
```

Cài: `cd backend && .venv/Scripts/python.exe -m pip install httpx==0.27.2`

- [ ] **Step 9: Khai biến môi trường ở 5 nơi**

`.env.example` (gốc repo) — thêm khối:

```
# Google sign-in (leave GOOGLE_CLIENT_ID empty to disable the Google button)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Must match EXACTLY an Authorized redirect URI in Google Cloud Console
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
# Where the backend sends the browser back after Google sign-in
FRONTEND_URL=http://localhost:3000
```

`backend/.env.example` — thêm khối tương tự nhưng cho dev chạy trực tiếp:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

`docker-compose.yml` và `docker-compose.prod.yml` — trong `environment:` của service `backend`, thêm 4 dòng theo đúng kiểu đang dùng cho `ADMIN_EMAILS`:

```yaml
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
```

`DEPLOYMENT.md` — thêm mục hướng dẫn:

```markdown
## Google sign-in (tuỳ chọn)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID
   → Application type: **Web application**.
2. Authorized redirect URIs: thêm **đúng từng ký tự** giá trị `GOOGLE_REDIRECT_URI`
   của từng môi trường (kể cả có/không dấu `/` cuối). Ví dụ:
   - chạy qua nginx: `http://localhost:3000/api/auth/google/callback`
   - chạy backend trực tiếp khi dev: `http://localhost:8000/auth/google/callback`
   - production: `https://<domain>/api/auth/google/callback`
   Sai một ký tự thì Google trả lỗi `redirect_uri_mismatch`.
3. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
   `FRONTEND_URL` vào `.env`.
4. Để `GOOGLE_CLIENT_ID` rỗng thì tính năng tắt: nút Google không hiện, đăng nhập
   bằng mật khẩu vẫn hoạt động bình thường.
```

- [ ] **Step 10: Chạy toàn bộ test để chắc không vỡ gì**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS, **129 passed** (125 cũ + 4 mới).

- [ ] **Step 11: Commit**

```bash
git add backend/app/models/user.py backend/app/services/auth.py backend/app/config.py \
        backend/requirements.txt backend/alembic/versions/20260916_add_google_auth.py \
        backend/tests/test_auth_service.py .env.example backend/.env.example \
        docker-compose.yml docker-compose.prod.yml DEPLOYMENT.md
git commit -m "feat(auth): add email_verified and google_sub columns

password_hash becomes nullable for Google-only accounts, so
authenticate_user now rejects a null hash with 401 instead of letting
passlib raise."
```

---

### Task 2: `TtlStore` — kho token tạm dùng một lần

**Files:**
- Create: `backend/app/services/oauth_state.py`
- Test: `backend/tests/test_oauth_state.py`

**Interfaces:**
- Consumes: không có.
- Produces: `TtlStore(ttl_seconds: int, now: Callable[[], datetime] = _utcnow)` với `issue(value: str) -> str`, `consume(token: str) -> str | None`, `purge_expired() -> None`; hai thể hiện module-level `state_store` (TTL 600s) và `login_code_store` (TTL 60s).

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/test_oauth_state.py`. Dùng đồng hồ giả, **không** `sleep`:

```python
"""Unit test kho token tạm cho OAuth state và one-time login code."""
from datetime import datetime, timedelta, timezone

from app.services.oauth_state import TtlStore


class FakeClock:
    def __init__(self):
        self.now = datetime(2026, 9, 16, 12, 0, 0, tzinfo=timezone.utc)

    def __call__(self):
        return self.now

    def advance(self, seconds: int):
        self.now += timedelta(seconds=seconds)


class TestTtlStore:
    def test_issued_token_returns_its_value(self):
        store = TtlStore(ttl_seconds=60)
        token = store.issue("user-1")

        assert store.consume(token) == "user-1"

    def test_token_works_only_once(self):
        store = TtlStore(ttl_seconds=60)
        token = store.issue("user-1")
        store.consume(token)

        assert store.consume(token) is None

    def test_expired_token_is_rejected(self):
        clock = FakeClock()
        store = TtlStore(ttl_seconds=60, now=clock)
        token = store.issue("user-1")
        clock.advance(61)

        assert store.consume(token) is None

    def test_token_still_valid_just_before_expiry(self):
        clock = FakeClock()
        store = TtlStore(ttl_seconds=60, now=clock)
        token = store.issue("user-1")
        clock.advance(59)

        assert store.consume(token) == "user-1"

    def test_unknown_token_is_rejected(self):
        store = TtlStore(ttl_seconds=60)

        assert store.consume("made-up-token") is None

    def test_tokens_are_unique(self):
        store = TtlStore(ttl_seconds=60)

        assert store.issue("user-1") != store.issue("user-1")

    def test_empty_value_is_preserved_not_confused_with_missing(self):
        """state_store lưu chuỗi rỗng; phải phân biệt được với token sai."""
        store = TtlStore(ttl_seconds=60)
        token = store.issue("")

        assert store.consume(token) == ""

    def test_purge_expired_drops_stale_entries(self):
        clock = FakeClock()
        store = TtlStore(ttl_seconds=60, now=clock)
        token = store.issue("user-1")
        clock.advance(61)
        store.purge_expired()

        assert store.consume(token) is None
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_oauth_state.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.oauth_state'`

- [ ] **Step 3: Viết `oauth_state.py`**

```python
"""Kho token tạm có TTL, dùng một lần — cho OAuth state và one-time login code.

In-memory: CHỈ ĐÚNG khi backend chạy một process (Dockerfile hiện không truyền
--workers cho uvicorn). Nếu sau này chạy nhiều worker hoặc nhiều container,
phải thay bằng bảng DB hoặc Redis — nếu không user sẽ ngẫu nhiên gặp lỗi
invalid_state do request rơi vào worker khác. Mất kho khi restart chỉ khiến
user phải đăng nhập lại.
"""
from __future__ import annotations

import secrets
from collections.abc import Callable
from datetime import datetime, timedelta, timezone


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TtlStore:
    def __init__(self, ttl_seconds: int, now: Callable[[], datetime] = _utcnow) -> None:
        self._ttl = timedelta(seconds=ttl_seconds)
        self._now = now
        self._items: dict[str, tuple[str, datetime]] = {}

    def issue(self, value: str) -> str:
        """Sinh token ngẫu nhiên gắn với value, trả token."""
        self.purge_expired()
        token = secrets.token_urlsafe(32)
        self._items[token] = (value, self._now() + self._ttl)
        return token

    def consume(self, token: str) -> str | None:
        """Trả value và xoá token. None nếu token sai hoặc đã hết hạn."""
        item = self._items.pop(token, None)
        if item is None:
            return None
        value, expires_at = item
        if self._now() >= expires_at:
            return None
        return value

    def purge_expired(self) -> None:
        now = self._now()
        for token in [t for t, (_, expires_at) in self._items.items() if now >= expires_at]:
            self._items.pop(token, None)


# state: sống đủ lâu cho user bấm qua màn hình chọn tài khoản của Google
state_store = TtlStore(ttl_seconds=600)
# one-time login code: chỉ cần đủ cho một lần redirect + một request exchange
login_code_store = TtlStore(ttl_seconds=60)
```

- [ ] **Step 4: Chạy lại test**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_oauth_state.py -q`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/oauth_state.py backend/tests/test_oauth_state.py
git commit -m "feat(auth): add single-use TTL store for OAuth state and login codes"
```

---

### Task 3: Logic thuần của Google auth

Phần mang tính bảo mật cốt lõi — quyết định link/tạo user và luật từ chối email chưa xác thực. Tất cả là hàm thuần nên unit test phủ được hết.

**Files:**
- Create: `backend/app/services/google_auth.py`
- Test: `backend/tests/test_google_auth.py`

**Interfaces:**
- Consumes: `settings.GOOGLE_CLIENT_ID`, `settings.GOOGLE_CLIENT_SECRET`, `settings.GOOGLE_REDIRECT_URI` (Task 1).
- Produces: `GoogleProfile(sub: str, email: str, display_name: str)` (frozen dataclass); `GoogleAuthError(code: str)`; `is_configured() -> bool`; `build_authorize_url(state: str) -> str`; `normalize_profile(claims: dict) -> GoogleProfile`; `decide_link_action(by_sub, by_email) -> str` trả `"login" | "link" | "create"`; hằng `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_SCOPE`.

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/test_google_auth.py`:

```python
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
    claims = {
        "sub": "google-sub-123",
        "email": "User@Example.com",
        "email_verified": True,
        "name": "Nguyen Van A",
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
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_google_auth.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.google_auth'`

- [ ] **Step 3: Viết phần thuần của `google_auth.py`**

```python
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
    return bool(
        settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI
    )


def build_authorize_url(state: str) -> str:
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
```

- [ ] **Step 4: Chạy lại test**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_google_auth.py -q`
Expected: PASS (16 passed)

- [ ] **Step 5: Chạy cả bộ test**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS, **153 passed** (129 + 8 của Task 2 + 16 của task này)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/google_auth.py backend/tests/test_google_auth.py
git commit -m "feat(auth): add pure Google profile and account-link logic

Linking only happens when Google reports email_verified as a real
boolean true; this is the check that stops a forged email from taking
over an existing account."
```

---

### Task 4: Endpoint Google ở backend

Ghép phần I/O và router thành một task: chúng không kiểm chứng riêng lẻ được (repo không có test API), chỉ nghiệm thu được khi chạy thật cả luồng.

**Files:**
- Modify: `backend/app/services/google_auth.py` (thêm phần I/O)
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/routers/auth.py`

**Interfaces:**
- Consumes: `state_store`, `login_code_store` (Task 2); `normalize_profile`, `decide_link_action`, `build_authorize_url`, `is_configured`, `GoogleAuthError`, `GoogleProfile`, `GOOGLE_TOKEN_URL` (Task 3); `User.google_sub`, `User.email_verified` (Task 1); `create_access_token`, `sync_config_admin` (có sẵn trong `app/services/auth.py`); `ADMIN_ROLE`, `USER_ROLE`, `is_config_admin` (có sẵn trong `app/services/admin_access.py`).
- Produces: `exchange_code_for_claims(code: str) -> dict`; `resolve_user(db: AsyncSession, profile: GoogleProfile) -> User`; `GoogleExchangeRequest(code: str)`; `ProvidersOut(google: bool)`; 4 endpoint HTTP.

- [ ] **Step 1: Thêm phần I/O vào `google_auth.py`**

Thêm import ở đầu file:

```python
import httpx
from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.admin_access import ADMIN_ROLE, USER_ROLE, is_config_admin
```

Thêm vào cuối file:

```python
async def exchange_code_for_claims(code: str) -> dict:
    """Đổi authorization code lấy claims trong id_token.

    Không verify chữ ký id_token: token lấy trực tiếp từ token endpoint của
    Google qua TLS trong chính request này, không qua trung gian — đúng khuyến
    nghị của Google cho server-side code flow.
    """
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        raise GoogleAuthError("exchange_failed") from exc

    if response.status_code != 200:
        raise GoogleAuthError("exchange_failed")

    id_token = response.json().get("id_token")
    if not id_token:
        raise GoogleAuthError("exchange_failed")

    try:
        return jwt.get_unverified_claims(id_token)
    except Exception as exc:  # token méo mó
        raise GoogleAuthError("exchange_failed") from exc


async def resolve_user(db: AsyncSession, profile: GoogleProfile) -> User:
    """Tìm user theo google_sub, rồi tới email; link hoặc tạo mới."""
    by_sub = (
        await db.execute(select(User).where(User.google_sub == profile.sub))
    ).scalar_one_or_none()
    by_email = (
        await db.execute(select(User).where(func.lower(User.email) == profile.email))
    ).scalar_one_or_none()

    action = decide_link_action(by_sub, by_email)

    if action == "login":
        return by_sub

    if action == "link":
        # GIỮ NGUYÊN password_hash: user vẫn đăng nhập được bằng mật khẩu cũ.
        # Giữ nguyên id nên sessions/cards/quizzes không đổi chủ.
        by_email.google_sub = profile.sub
        by_email.email_verified = True
        await db.commit()
        await db.refresh(by_email)
        return by_email

    user = User(
        email=profile.email,
        password_hash=None,
        display_name=profile.display_name,
        google_sub=profile.sub,
        email_verified=True,
        role=ADMIN_ROLE if is_config_admin(profile.email) else USER_ROLE,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

- [ ] **Step 2: Thêm schema**

`backend/app/schemas/auth.py` — thêm `email_verified` vào `UserOut` và hai model mới:

```python
class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: Literal["user", "admin"] = "user"
    email_verified: bool = False

    class Config:
        from_attributes = True


class GoogleExchangeRequest(BaseModel):
    code: str


class ProvidersOut(BaseModel):
    google: bool
```

- [ ] **Step 3: Thêm endpoint vào router**

`backend/app/routers/auth.py` — thêm import:

```python
from urllib.parse import urlencode

from fastapi.responses import RedirectResponse

from app.config import settings
from app.schemas.auth import GoogleExchangeRequest, ProvidersOut
from app.services import google_auth
from app.services.google_auth import GoogleAuthError
from app.services.oauth_state import login_code_store, state_store
```

và thêm vào cuối file:

```python
def _frontend_redirect(**params: str) -> RedirectResponse:
    """Luôn đưa browser về trang callback của frontend, kèm code hoặc error."""
    base = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(f"{base}/auth/callback?{urlencode(params)}", status_code=302)


@router.get("/providers", response_model=ProvidersOut)
async def get_providers() -> ProvidersOut:
    return ProvidersOut(google=google_auth.is_configured())


@router.get("/google/login")
async def google_login() -> RedirectResponse:
    if not google_auth.is_configured():
        return _frontend_redirect(error="google_disabled")
    state = state_store.issue("")
    return RedirectResponse(google_auth.build_authorize_url(state), status_code=302)


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error or not code or not state:
        return _frontend_redirect(error="google_error")

    # state dùng một lần: chống CSRF và chống replay link callback
    if state_store.consume(state) is None:
        return _frontend_redirect(error="invalid_state")

    try:
        claims = await google_auth.exchange_code_for_claims(code)
        profile = google_auth.normalize_profile(claims)
        user = await google_auth.resolve_user(db, profile)
    except GoogleAuthError as exc:
        return _frontend_redirect(error=exc.code)

    await sync_config_admin(db, user)
    return _frontend_redirect(code=login_code_store.issue(user.id))


@router.post("/google/exchange", response_model=AuthResponse)
async def google_exchange(
    payload: GoogleExchangeRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    user_id = login_code_store.consume(payload.code)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    return AuthResponse(user=UserOut.model_validate(user), token=create_access_token(user.id))
```

- [ ] **Step 4: Kiểm tra app import được và route đã mount**

Run:
```bash
cd backend && .venv/Scripts/python.exe -c "from app.main import app; print(sorted(r.path for r in app.routes if 'auth' in r.path))"
```
Expected: in ra danh sách có `/auth/google/callback`, `/auth/google/exchange`, `/auth/google/login`, `/auth/providers`, `/auth/login`, `/auth/me`, `/auth/register`.

- [ ] **Step 5: Kiểm tra hành vi khi chưa cấu hình Google**

Chạy server: `cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000`
Ở terminal khác:

```bash
curl -s http://localhost:8000/auth/providers
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:8000/auth/google/login
curl -s -X POST http://localhost:8000/auth/google/exchange -H "Content-Type: application/json" -d '{"code":"bogus"}'
```
Expected:
- `{"google":false}` (vì `.env` chưa có client id)
- `302 http://localhost:5173/auth/callback?error=google_disabled`
- `{"detail":"Invalid or expired code"}`

- [ ] **Step 6: Kiểm tra đăng nhập mật khẩu không bị ảnh hưởng**

```bash
curl -s -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"regress@example.com","password":"secret123","display_name":"Regress"}'
```
Expected: trả `token` và `user` có `"email_verified":false`.

- [ ] **Step 7: Chạy cả bộ test**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS, 153 passed (không thêm test mới ở task này)

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/google_auth.py backend/app/schemas/auth.py backend/app/routers/auth.py
git commit -m "feat(auth): add Google OAuth endpoints

The callback hands the browser a single-use 60s code instead of the JWT
so the token never lands in browser history or referer headers."
```

---

### Task 5: Hiển thị `email_verified` và `has_google` trong admin API

**Files:**
- Modify: `backend/app/schemas/admin.py:18-32`
- Modify: `backend/app/routers/admin.py:110-128`

**Interfaces:**
- Consumes: `User.email_verified`, `User.google_sub` (Task 1).
- Produces: `AdminUserRow.email_verified: bool`, `AdminUserRow.has_google: bool` (kế thừa sang `AdminUserDetailOut`).

- [ ] **Step 1: Thêm field vào schema**

`backend/app/schemas/admin.py`, trong `AdminUserRow` thêm ngay sau `is_config_admin`:

```python
    email_verified: bool
    has_google: bool
```

- [ ] **Step 2: Điền giá trị trong `_to_row`**

`backend/app/routers/admin.py`, trong `_to_row` thêm sau `is_config_admin=is_config_admin(user.email),`:

```python
        email_verified=user.email_verified,
        has_google=user.google_sub is not None,
```

Không cần sửa `_user_row_query`: nó đã `select(User, ...)` nguyên entity nên hai cột mới có sẵn, không phát sinh query nào.

- [ ] **Step 3: Xác nhận trang chi tiết tự có hai field**

Không phải sửa gì thêm: `_build_detail` dựng kết quả bằng `AdminUserDetailOut(**base.model_dump(), ...)` ([admin.py:182-183](backend/app/routers/admin.py#L182-L183)), với `base` là `AdminUserRow` do `_to_row` trả về — nên hai field mới chảy sang detail tự động.

Run: `cd backend && .venv/Scripts/python.exe -c "from app.main import app; print('ok')"`
Expected: in `ok`, không `ValidationError`.

- [ ] **Step 4: Kiểm tra thật bằng API**

Chạy server, đăng nhập bằng một tài khoản admin (email nằm trong `ADMIN_EMAILS`), rồi:

```bash
curl -s http://localhost:8000/admin/users -H "Authorization: Bearer <token>" | head -c 400
```
Expected: mỗi phần tử trong `items` có `"email_verified":false` và `"has_google":false`.

- [ ] **Step 5: Chạy cả bộ test**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS, 153 passed. Không test nào dựng `AdminUserRow` trực tiếp (đã kiểm), nên việc thêm hai field bắt buộc không làm fail test sẵn có.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/admin.py backend/app/routers/admin.py
git commit -m "feat(admin): expose email_verified and has_google on user rows"
```

---

### Task 6: Frontend — types và `loginWithGoogleCode`

**Files:**
- Modify: `frontend/src/types/index.ts:3-8`
- Modify: `frontend/src/types/admin.ts:12-27`
- Modify: `frontend/src/contexts/AuthContext.tsx`

**Interfaces:**
- Consumes: `POST /auth/google/exchange` (Task 4), `AdminUserRow` mới (Task 5).
- Produces: `User.email_verified: boolean`; `AdminUserRow.email_verified`, `AdminUserRow.has_google`; `useAuth().loginWithGoogleCode(code: string): Promise<void>`.

- [ ] **Step 1: Cập nhật types**

`frontend/src/types/index.ts`:

```ts
export type User = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  email_verified: boolean;
};
```

`frontend/src/types/admin.ts` — trong `AdminUserRow`, thêm sau `is_config_admin`:

```ts
  email_verified: boolean;
  has_google: boolean;
```

- [ ] **Step 2: Thêm `loginWithGoogleCode` vào AuthContext**

`frontend/src/contexts/AuthContext.tsx` — thêm vào type `AuthContextValue`:

```ts
  loginWithGoogleCode: (code: string) => Promise<void>;
```

Thêm hàm ngay sau `register` (dòng ~69):

```tsx
  const loginWithGoogleCode = useCallback(async (code: string) => {
    const response = await api.post('/auth/google/exchange', { code });
    const nextToken = response.data.token;
    const nextUser = response.data.user;

    setStoredToken(nextToken);
    setAuth({ user: nextUser, token: nextToken, isLoading: false });
  }, []);
```

Và đưa vào `value` cùng mảng dependency:

```tsx
  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      login,
      loginWithGoogleCode,
      register,
      logout,
      refreshUser,
    }),
    [auth, login, loginWithGoogleCode, logout, refreshUser, register],
  );
```

- [ ] **Step 3: Build để xác nhận type khớp**

Run: `cd frontend && npm run build`
Expected: build thành công. Nếu `tsc` báo lỗi ở chỗ nào đó dựng object `User` thiếu `email_verified` (ví dụ dữ liệu giả trong code), sửa chỗ đó.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/types/admin.ts frontend/src/contexts/AuthContext.tsx
git commit -m "feat(frontend): add email_verified type and Google code exchange"
```

---

### Task 7: Nút Google và trang callback

**Files:**
- Create: `frontend/src/pages/AuthCallbackPage.tsx`
- Modify: `frontend/src/App.tsx:53`
- Modify: `frontend/src/pages/AuthPage.tsx`

**Interfaces:**
- Consumes: `useAuth().loginWithGoogleCode` (Task 6); `GET /auth/providers`, `GET /auth/google/login` (Task 4); `API_BASE_URL` từ `frontend/src/api/client.ts`.
- Produces: route công khai `/auth/callback`.

- [ ] **Step 1: Tạo `AuthCallbackPage`**

```tsx
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ERROR_MESSAGES: Record<string, string> = {
  google_disabled: 'Google sign-in is not available right now.',
  invalid_state: 'Your sign-in session expired. Please try again.',
  exchange_failed: 'Could not sign in with Google. Please try again.',
  email_unverified: 'Your Google email is not verified.',
  google_error: 'Google sign-in was cancelled or failed.',
};

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogleCode } = useAuth();
  // One-time code chỉ dùng được một lần, mà StrictMode chạy effect hai lần
  // trong dev — không có cờ này thì lần hai sẽ báo lỗi giả.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) {
      return;
    }
    handled.current = true;

    const error = params.get('error');
    const code = params.get('code');

    if (error || !code) {
      const message = ERROR_MESSAGES[error ?? ''] ?? ERROR_MESSAGES.google_error;
      navigate('/login', { replace: true, state: { authError: message } });
      return;
    }

    loginWithGoogleCode(code)
      .then(() => navigate('/', { replace: true }))
      .catch(() =>
        navigate('/login', {
          replace: true,
          state: { authError: ERROR_MESSAGES.exchange_failed },
        }),
      );
  }, [loginWithGoogleCode, navigate, params]);

  return <div className="app-shell center-block">Signing you in…</div>;
}
```

- [ ] **Step 2: Đăng ký route**

`frontend/src/App.tsx` — import và thêm route **ngoài** `ProtectedRoute`, ngay sau route `/login`:

```tsx
import AuthCallbackPage from './pages/AuthCallbackPage';
```

```tsx
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
```

- [ ] **Step 3: Thêm nút Google và hiện lỗi trong `AuthPage`**

`frontend/src/pages/AuthPage.tsx` — đổi phần import và thêm state:

```tsx
import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
```

Trong component, sau `const [error, setError] = useState('');`:

```tsx
  const location = useLocation();
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    api
      .get('/auth/providers')
      .then((response) => setGoogleEnabled(Boolean(response.data.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  useEffect(() => {
    const authError = (location.state as { authError?: string } | null)?.authError;
    if (authError) {
      setError(authError);
      // Xoá state để F5 không hiện lại lỗi cũ
      window.history.replaceState({}, '');
    }
  }, [location.state]);
```

Trong JSX, ngay **sau** thẻ `</form>` (dòng ~138) và trước `</div>` đóng `.auth-card`:

```tsx
          {googleEnabled && (
            <>
              <div className="my-4 flex items-center gap-3 text-body-sm text-muted">
                <span className="h-px flex-1 bg-hairline" />
                or
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <button
                type="button"
                className="btn wide"
                onClick={() => window.location.assign(`${API_BASE_URL}/auth/google/login`)}
              >
                Continue with Google
              </button>
            </>
          )}
```

Lưu ý: phải dùng `window.location.assign`, **không** dùng `api.get` — đây là điều hướng thật của browser sang Google, không phải request AJAX.

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 5: Kiểm tra khi Google đang tắt**

Chạy `cd frontend && npm run dev` và `cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8000`.
Mở `/login`.
Expected: **không** thấy nút "Continue with Google" (vì `.env` chưa có client id), form đăng nhập/đăng ký hoạt động bình thường.

Mở thẳng `http://localhost:5173/auth/callback?error=invalid_state`.
Expected: nhảy về `/login` và hiện "Your sign-in session expired. Please try again."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AuthCallbackPage.tsx frontend/src/pages/AuthPage.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add Google sign-in button and callback page"
```

---

### Task 8: Badge trong admin và nghiệm thu toàn luồng

**Files:**
- Modify: `frontend/src/components/admin/UserTable.tsx:63-66`
- Modify: `frontend/src/pages/AdminUserDetailPage.tsx:161-170`

**Interfaces:**
- Consumes: `AdminUserRow.email_verified`, `AdminUserRow.has_google` (Task 5, 6).
- Produces: không có (task cuối).

- [ ] **Step 1: Badge trong bảng danh sách**

`frontend/src/components/admin/UserTable.tsx` — đổi khối tên/email (dòng 63-66) thành:

```tsx
                  <div className="min-w-0">
                    <p className="truncate text-title-sm text-ink">{row.display_name}</p>
                    <p className="truncate text-body-sm text-muted">{row.email}</p>
                    {(row.email_verified || row.has_google) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {row.email_verified && (
                          <span className="rounded-full border border-hairline px-2 py-0.5 text-caption-uppercase uppercase text-muted">
                            Verified
                          </span>
                        )}
                        {row.has_google && (
                          <span className="rounded-full border border-hairline px-2 py-0.5 text-caption-uppercase uppercase text-muted">
                            Google
                          </span>
                        )}
                      </div>
                    )}
                  </div>
```

- [ ] **Step 2: Badge trong header trang chi tiết**

`frontend/src/pages/AdminUserDetailPage.tsx` — trong khối `<p className="mt-1.5 flex flex-wrap ...">`, thêm ngay sau `<span>` chứa `{detail.email}` (dòng ~165):

```tsx
                    {detail.email_verified && (
                      <span className="rounded-full border border-hairline px-2.5 py-0.5 text-caption-uppercase uppercase text-muted">
                        Verified
                      </span>
                    )}
                    {detail.has_google && (
                      <span className="rounded-full border border-hairline px-2.5 py-0.5 text-caption-uppercase uppercase text-muted">
                        Google
                      </span>
                    )}
```

(Class này sao chép từ pill "Managed by config" đã có sẵn ở cùng file, dòng 156-158.)

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: build thành công.

- [ ] **Step 4: Cấu hình Google thật**

Làm theo mục vừa thêm trong `DEPLOYMENT.md`: tạo OAuth Client ID, khai redirect URI `http://localhost:8000/auth/google/callback`, rồi điền vào `backend/.env`:

```
GOOGLE_CLIENT_ID=<client id thật>
GOOGLE_CLIENT_SECRET=<client secret thật>
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

Khởi động lại backend.

- [ ] **Step 5: Nghiệm thu 7 kịch bản**

Chạy cả backend và frontend. Kiểm từng mục, **phải thấy đúng kết quả mới được tick**:

1. `/login` giờ có nút "Continue with Google".
2. **Email hoàn toàn mới**: đăng nhập Google → vào thẳng dashboard. Kiểm
   `curl -s http://localhost:8000/auth/me -H "Authorization: Bearer <token trong localStorage>"`
   → `"email_verified":true`.
3. **Auto-link**: đăng ký bằng mật khẩu với chính email Google của bạn, tạo một
   session có vài card, logout, rồi đăng nhập bằng Google → phải vào **đúng tài
   khoản đó**, session và card còn nguyên.
4. **Mật khẩu cũ vẫn dùng được**: sau bước 3, logout rồi đăng nhập lại bằng
   email + mật khẩu cũ → thành công.
5. **Không tạo user trùng**: đăng nhập Google lần hai → vẫn đúng user đó. Kiểm
   `SELECT id, email, google_sub, email_verified FROM users WHERE email = '<email>'`
   chỉ ra **một** dòng.
6. **Code dùng một lần**: sau khi callback xong, bấm Back của browser → hiện lỗi
   hết hạn, không đăng nhập lại được bằng URL cũ.
7. **Tắt được**: xoá `GOOGLE_CLIENT_ID` trong `.env`, restart backend → nút Google
   biến mất, đăng nhập mật khẩu vẫn bình thường.
8. **Admin**: đăng nhập bằng tài khoản admin, mở `/admin/users` → user vừa tạo
   qua Google có badge `Verified` và `Google`; mở trang chi tiết user đó → cũng
   thấy hai badge.

- [ ] **Step 6: Chạy lại toàn bộ test và build**

Run:
```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
cd ../frontend && npm run build
```
Expected: 153 passed; build frontend thành công.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/UserTable.tsx frontend/src/pages/AdminUserDetailPage.tsx
git commit -m "feat(admin): show verified and Google badges on user rows"
```

---

## Ghi chú cho người thực thi

- **Đừng nới lỏng hàng rào `email_verified is True`** trong `normalize_profile`. Nó là thứ duy nhất chặn việc dùng một tài khoản Google Workspace với email tuỳ ý để chiếm tài khoản sẵn có.
- **Đừng xoá `password_hash` khi link.** Người dùng cũ phải giữ được cả hai đường đăng nhập.
- Nếu sau này backend chạy nhiều worker (`uvicorn --workers N`) hoặc nhiều container, `TtlStore` in-memory sẽ hỏng ngẫu nhiên (`invalid_state`). Khi đó chuyển hai kho sang bảng DB hoặc Redis — logic `issue`/`consume` giữ nguyên giao diện nên chỗ gọi không phải sửa.
- Baseline test trước khi bắt đầu là 125 passed; sau Task 3 là 153. Nếu lệch, dừng lại tìm nguyên nhân trước khi đi tiếp.

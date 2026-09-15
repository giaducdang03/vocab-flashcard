# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm role `admin`, bảng `user_ai_policies`, admin API và hai trang quản trị để admin bật/tắt AI và đặt hạn mức quiz AI (24h trượt) cho từng user.

**Architecture:** `role` là cột trên `users`; cấu hình AI nằm ở bảng 1-1 `user_ai_policies` (thiếu dòng = mặc định). Logic nằm trong các module service **thuần** (`ai_policy`, `admin_access`, `admin_stats`) để unit test được; router (`quizzes`, `auth`, `admin` mới) chỉ gọi service và làm query. Frontend thêm `AdminRoute`, API client riêng, trang danh sách và trang chi tiết dựng từ các component nhỏ trong `components/admin/`.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0 async, Alembic, Pydantic v2, pytest 8 + pytest-asyncio (asyncio_mode=auto); React 18 + TypeScript + react-router-dom 6.28 + Tailwind 3 + lucide-react + axios.

**Spec:** `docs/superpowers/specs/2026-09-15-admin-user-management-design.md`

## Global Constraints

- Mọi lệnh Python chạy từ thư mục `backend/` bằng venv có sẵn: `.venv/Scripts/python.exe` (dùng dấu `/`, chạy được cả PowerShell lẫn Git Bash). Alembic: `.venv/Scripts/alembic.exe`.
- Chạy test bằng `.venv/Scripts/python.exe -m pytest tests ...` — **luôn chỉ định `tests`**, vì `smoke_test.py` ở gốc `backend/` gọi server thật và làm hỏng collection.
- Chỉ viết **unit test** (không dựng `conftest.py`, không thêm `httpx`, không test HTTP). Frontend không có test framework — kiểm bằng `npm run build` trong `frontend/`.
- Role hợp lệ: `user` | `admin`. Mặc định `user`.
- `daily_limit`: `NULL` = dùng `settings.AI_DAILY_QUIZ_LIMIT`; nếu có giá trị thì `0..1000`. Không có mức "Unlimited".
- Cửa sổ hạn mức: 24 giờ trượt, đếm `Quiz.uses_ai=True` theo `created_at`.
- `ADMIN_EMAILS`: chuỗi phân tách bằng dấu phẩy, so khớp không phân biệt hoa thường, bỏ khoảng trắng.
- Thông báo lỗi (tiếng Anh, dùng nguyên văn):
  - 403 AI tắt: `AI features are disabled for your account`
  - 429 hết lượt: `You have used all {limit} AI quiz generations in the last 24 hours`
  - 403 không phải admin: `Admin access required`
  - 400 tự hạ quyền: `You cannot change your own role`
  - 400 admin trong config: `This admin is managed by ADMIN_EMAILS`
  - 400 admin cuối: `At least one admin is required`
  - 404: `User not found`
- UI tiếng Anh; dùng token Tailwind có sẵn trong `frontend/tailwind.config.js` (`ink`, `body`, `muted`, `hairline`, `hairline-soft`, `hairline-strong`, `canvas-soft`, `surface-card`, `primary`, `primary-fixed`, `success`, `error`, `learned-surface`) và class dùng chung `page-shell`, `page-container`, `btn btn-primary`, `btn btn-secondary`, `empty-state`.
- Mỗi commit kết thúc bằng trailer: `-m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"`.
- Làm trên nhánh mới `feature/admin-user-management` tạo từ `feature/ai-generation` (tính năng dựa trên code AI của nhánh đó).

---

## File Structure

**Backend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `backend/app/models/ai_policy.py` | Model `UserAiPolicy` |
| `backend/alembic/versions/20260915_add_roles_and_ai_policies.py` | Cột `users.role` + bảng `user_ai_policies` |
| `backend/app/services/ai_policy.py` | Policy AI: hàm thuần (resolve/check/apply) + wrapper DB (get/count/usage/enforce/upsert) |
| `backend/app/services/admin_access.py` | Hằng role, parse `ADMIN_EMAILS`, quy tắc đổi role (thuần) |
| `backend/app/services/admin_stats.py` | `build_activity_7d`, `latest_timestamp` (thuần) |
| `backend/app/schemas/admin.py` | Schema admin API |
| `backend/app/routers/admin.py` | `/admin/overview`, `/admin/users`, `/admin/users/{id}` GET/PATCH |
| `backend/tests/test_ai_policy.py`, `test_admin_access.py`, `test_admin_stats.py`, `test_admin_schemas.py` | Unit test |

**Backend — sửa**

| File | Thay đổi |
|---|---|
| `backend/app/config.py` | `ADMIN_EMAILS` |
| `backend/app/models/user.py` | cột `role` |
| `backend/alembic/env.py` | import `UserAiPolicy` |
| `backend/app/schemas/auth.py` | `UserOut.role` |
| `backend/app/services/auth.py` | `sync_config_admin` |
| `backend/app/routers/auth.py` | gán role khi register, sync khi login |
| `backend/app/deps.py` | `require_admin` |
| `backend/app/schemas/quiz.py` | `AiStatusOut.enabled_for_user` |
| `backend/app/routers/quizzes.py` | dùng `ai_policy` thay hạn mức cứng |
| `backend/app/main.py` | mount router admin |

**Frontend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `frontend/src/types/admin.ts` | Type admin API |
| `frontend/src/api/errors.ts` | `apiErrorMessage` lấy `detail` từ lỗi axios |
| `frontend/src/api/admin.ts` | Hàm gọi admin API |
| `frontend/src/lib/adminFormat.ts` | Format ngày, %, initials, "Resets in" |
| `frontend/src/lib/adminDraft.ts` | Draft chỉnh sửa và diff thành body PATCH |
| `frontend/src/components/admin/AdminKpiCard.tsx` | Thẻ số liệu |
| `frontend/src/components/admin/RolePill.tsx` | Pill role |
| `frontend/src/components/admin/UserTable.tsx` | Bảng user |
| `frontend/src/components/admin/Pagination.tsx` | Phân trang |
| `frontend/src/components/admin/ActivityBars.tsx` | Biểu đồ cột 7 ngày |
| `frontend/src/components/admin/AiAccessCard.tsx` | Toggle AI |
| `frontend/src/components/admin/RateLimitCard.tsx` | Usage + chọn limit |
| `frontend/src/components/admin/RecentAiQuizzes.tsx` | Bảng quiz AI gần đây |
| `frontend/src/pages/AdminUsersPage.tsx` | Trang danh sách |
| `frontend/src/pages/AdminUserDetailPage.tsx` | Trang chi tiết |

**Frontend — sửa:** `src/types/index.ts`, `src/App.tsx`, `src/components/UserMenu.tsx`, `src/components/quiz/QuizCreateModal.tsx`, `src/pages/QuizzesPage.tsx`.

**Docs — sửa:** `.env.example`, `backend/.env.example`, `DEPLOYMENT.md`.

---

### Task 0: Tạo nhánh

- [ ] **Step 1: Tạo nhánh từ `feature/ai-generation`**

```bash
git checkout feature/ai-generation
git checkout -b feature/admin-user-management
```

- [ ] **Step 2: Xác nhận baseline test xanh**

Run (trong `backend/`): `.venv/Scripts/python.exe -m pytest tests -q`
Expected: `79 passed`

---

### Task 1: Dữ liệu — role, UserAiPolicy, migration, config

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/models/user.py`
- Create: `backend/app/models/ai_policy.py`
- Create: `backend/alembic/versions/20260915_add_roles_and_ai_policies.py`
- Modify: `backend/alembic/env.py`

**Interfaces:**
- Produces: `settings.ADMIN_EMAILS: str`; `User.role: str`; `UserAiPolicy(user_id: str, ai_enabled: bool, daily_limit: int | None, updated_at: datetime, updated_by: str | None)`; Alembic revision `20260915_admin`.

Task này chỉ là schema, không có logic để unit test; kiểm bằng import và sinh SQL offline.

- [ ] **Step 1: Thêm `ADMIN_EMAILS` vào config**

Trong `backend/app/config.py`, thêm ngay dưới `JWT_EXPIRE_MINUTES: int = 1440`:

```python
    ADMIN_EMAILS: str = ""
```

- [ ] **Step 2: Thêm cột `role` vào `User`**

Thay toàn bộ `backend/app/models/user.py` bằng:

```python
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import engine
from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user", server_default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
```

- [ ] **Step 3: Tạo model `UserAiPolicy`**

Create `backend/app/models/ai_policy.py`:

```python
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserAiPolicy(Base):
    """Cấu hình AI riêng của một user. Không có dòng nghĩa là dùng mặc định."""

    __tablename__ = "user_ai_policies"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    ai_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # NULL = theo AI_DAILY_QUIZ_LIMIT của hệ thống
    daily_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
```

- [ ] **Step 4: Tạo migration**

Create `backend/alembic/versions/20260915_add_roles_and_ai_policies.py`:

```python
"""add user roles and ai policies

Revision ID: 20260915_admin
Revises: 20260914_ai_quiz
Create Date: 2026-09-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260915_admin"
down_revision = "20260914_ai_quiz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="user"))

    op.create_table(
        "user_ai_policies",
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("ai_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("daily_limit", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_ai_policies")
    op.drop_column("users", "role")
```

- [ ] **Step 5: Đăng ký model cho Alembic**

Trong `backend/alembic/env.py`, thêm ngay dưới dòng `from app.models.user import User`:

```python
from app.models.ai_policy import UserAiPolicy  # noqa: F401
```

- [ ] **Step 6: Kiểm tra import và sinh SQL offline**

Run (trong `backend/`):

```bash
.venv/Scripts/python.exe -c "import app.models.card, app.models.quiz, app.models.user; from app.models.ai_policy import UserAiPolicy; print(UserAiPolicy.__table__.c.keys())"
.venv/Scripts/alembic.exe upgrade 20260914_ai_quiz:20260915_admin --sql
```

Expected: dòng đầu in `['user_id', 'ai_enabled', 'daily_limit', 'updated_at', 'updated_by']`; lệnh thứ hai in ra `ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL` và `CREATE TABLE user_ai_policies (...)` mà không lỗi.

- [ ] **Step 7: Test cũ vẫn xanh**

Run: `.venv/Scripts/python.exe -m pytest tests -q`
Expected: `79 passed`

- [ ] **Step 8: Commit**

```bash
git add backend/app/config.py backend/app/models/user.py backend/app/models/ai_policy.py backend/alembic/versions/20260915_add_roles_and_ai_policies.py backend/alembic/env.py
git commit -m "feat(admin): add user role column and user_ai_policies table" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Service `ai_policy`

**Files:**
- Create: `backend/app/services/ai_policy.py`
- Test: `backend/tests/test_ai_policy.py`

**Interfaces:**
- Consumes: `UserAiPolicy` (Task 1), `Quiz` model, `settings.AI_DAILY_QUIZ_LIMIT`.
- Produces:
  - `ROLLING_WINDOW: timedelta` (24h), `MAX_DAILY_LIMIT = 1000`, `DISABLED_DETAIL: str`
  - `EffectivePolicy(enabled: bool, limit: int, is_custom: bool)` (frozen dataclass)
  - `AiUsage(used: int, limit: int, resets_at: datetime | None)` (frozen dataclass)
  - `PolicyViolation(status_code: int, detail: str)` (frozen dataclass)
  - `resolve_policy(row: UserAiPolicy | None, default_limit: int) -> EffectivePolicy`
  - `compute_resets_at(oldest_in_window: datetime | None) -> datetime | None`
  - `check_enabled(policy: EffectivePolicy) -> PolicyViolation | None`
  - `check_creation(policy: EffectivePolicy, used: int) -> PolicyViolation | None`
  - `apply_policy_update(row: UserAiPolicy | None, user_id: str, *, updated_by: str | None, ai_enabled: bool | None = None, daily_limit: int | None = None, set_limit: bool = False, now: datetime | None = None) -> tuple[UserAiPolicy, bool]` (bool = vừa tạo mới)
  - `window_start(now: datetime | None = None) -> datetime`
  - `async get_policy(db, user_id) -> EffectivePolicy`
  - `async count_ai_quizzes_24h(db, user_id) -> int`
  - `async get_usage(db, user_id, policy: EffectivePolicy | None = None) -> AiUsage`
  - `async enforce_can_create(db, user_id) -> None` (raise HTTPException 403/429)
  - `async enforce_enabled(db, user_id) -> None` (raise HTTPException 403)
  - `async upsert_policy(db, user_id, *, updated_by, ai_enabled=None, daily_limit=None, set_limit=False) -> UserAiPolicy` (không commit)

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_ai_policy.py`:

```python
"""Unit test phần thuần của policy AI theo user — không chạm DB."""
from datetime import datetime, timedelta, timezone

# Đăng ký đủ mapper (Session.cards trỏ tới "Card") trước khi tạo instance model.
import app.models.card  # noqa: F401
import app.models.quiz  # noqa: F401
import app.models.user  # noqa: F401
from app.models.ai_policy import UserAiPolicy
from app.services.ai_policy import (
    DISABLED_DETAIL,
    EffectivePolicy,
    apply_policy_update,
    check_creation,
    check_enabled,
    compute_resets_at,
    resolve_policy,
    window_start,
)


def _row(ai_enabled: bool = True, daily_limit: int | None = None) -> UserAiPolicy:
    return UserAiPolicy(user_id="u1", ai_enabled=ai_enabled, daily_limit=daily_limit)


class TestResolvePolicy:
    def test_missing_row_uses_system_defaults(self):
        assert resolve_policy(None, 20) == EffectivePolicy(enabled=True, limit=20, is_custom=False)

    def test_null_limit_falls_back_to_system_default(self):
        policy = resolve_policy(_row(ai_enabled=False, daily_limit=None), 20)
        assert policy == EffectivePolicy(enabled=False, limit=20, is_custom=False)

    def test_custom_limit_overrides_default(self):
        assert resolve_policy(_row(daily_limit=5), 20) == EffectivePolicy(enabled=True, limit=5, is_custom=True)

    def test_zero_limit_is_a_real_custom_limit(self):
        assert resolve_policy(_row(daily_limit=0), 20) == EffectivePolicy(enabled=True, limit=0, is_custom=True)


class TestComputeResetsAt:
    def test_no_quiz_in_window_means_no_reset_time(self):
        assert compute_resets_at(None) is None

    def test_reset_is_oldest_quiz_plus_24_hours(self):
        oldest = datetime(2026, 9, 15, 8, 30, tzinfo=timezone.utc)
        assert compute_resets_at(oldest) == datetime(2026, 9, 16, 8, 30, tzinfo=timezone.utc)

    def test_naive_datetime_is_treated_as_utc(self):
        oldest = datetime(2026, 9, 15, 8, 30)
        assert compute_resets_at(oldest) == datetime(2026, 9, 16, 8, 30, tzinfo=timezone.utc)


class TestWindowStart:
    def test_window_is_24_hours_back(self):
        now = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
        assert window_start(now) == now - timedelta(hours=24)


class TestChecks:
    def test_enabled_policy_passes_enabled_check(self):
        assert check_enabled(EffectivePolicy(True, 20, False)) is None

    def test_disabled_policy_is_403(self):
        violation = check_enabled(EffectivePolicy(False, 20, False))
        assert violation is not None
        assert violation.status_code == 403
        assert violation.detail == DISABLED_DETAIL

    def test_creation_allowed_below_limit(self):
        assert check_creation(EffectivePolicy(True, 3, True), used=2) is None

    def test_creation_blocked_at_limit_with_429(self):
        violation = check_creation(EffectivePolicy(True, 3, True), used=3)
        assert violation is not None
        assert violation.status_code == 429
        assert violation.detail == "You have used all 3 AI quiz generations in the last 24 hours"

    def test_zero_limit_blocks_first_quiz(self):
        violation = check_creation(EffectivePolicy(True, 0, True), used=0)
        assert violation is not None and violation.status_code == 429

    def test_creation_check_reports_disabled_before_limit(self):
        violation = check_creation(EffectivePolicy(False, 0, True), used=5)
        assert violation is not None and violation.status_code == 403


class TestApplyPolicyUpdate:
    NOW = datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)

    def test_creates_row_with_defaults_when_missing(self):
        row, created = apply_policy_update(None, "u1", updated_by="admin", ai_enabled=False, now=self.NOW)
        assert created is True
        assert row.user_id == "u1"
        assert row.ai_enabled is False
        assert row.daily_limit is None
        assert row.updated_by == "admin"
        assert row.updated_at == self.NOW

    def test_new_row_without_ai_enabled_defaults_to_enabled(self):
        row, _ = apply_policy_update(None, "u1", updated_by="admin", daily_limit=7, set_limit=True, now=self.NOW)
        assert row.ai_enabled is True
        assert row.daily_limit == 7

    def test_limit_untouched_when_set_limit_is_false(self):
        existing = _row(daily_limit=9)
        row, created = apply_policy_update(existing, "u1", updated_by="admin", ai_enabled=False, now=self.NOW)
        assert created is False
        assert row is existing
        assert row.daily_limit == 9
        assert row.ai_enabled is False

    def test_set_limit_with_none_resets_to_system_default(self):
        existing = _row(daily_limit=9)
        row, _ = apply_policy_update(existing, "u1", updated_by="admin", daily_limit=None, set_limit=True, now=self.NOW)
        assert row.daily_limit is None

    def test_ai_enabled_none_keeps_existing_value(self):
        existing = _row(ai_enabled=False, daily_limit=4)
        row, _ = apply_policy_update(existing, "u1", updated_by="admin", daily_limit=6, set_limit=True, now=self.NOW)
        assert row.ai_enabled is False
        assert row.daily_limit == 6
        assert row.updated_at == self.NOW
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `.venv/Scripts/python.exe -m pytest tests/test_ai_policy.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ai_policy'`

- [ ] **Step 3: Viết service**

Create `backend/app/services/ai_policy.py`:

```python
"""Policy AI theo từng user: bật/tắt và hạn mức quiz AI trong 24 giờ trượt.

Phần đầu là hàm thuần (unit test được); phần sau là wrapper DB mỏng mà router gọi.
Thiếu dòng `user_ai_policies` luôn nghĩa là mặc định — chỉ `resolve_policy` xử lý điều đó.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_policy import UserAiPolicy
from app.models.quiz import Quiz

ROLLING_WINDOW = timedelta(hours=24)
MAX_DAILY_LIMIT = 1000
DISABLED_DETAIL = "AI features are disabled for your account"


@dataclass(frozen=True)
class EffectivePolicy:
    enabled: bool
    limit: int
    is_custom: bool


@dataclass(frozen=True)
class AiUsage:
    used: int
    limit: int
    resets_at: datetime | None


@dataclass(frozen=True)
class PolicyViolation:
    status_code: int
    detail: str


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def resolve_policy(row: UserAiPolicy | None, default_limit: int) -> EffectivePolicy:
    if row is None:
        return EffectivePolicy(enabled=True, limit=default_limit, is_custom=False)
    if row.daily_limit is None:
        return EffectivePolicy(enabled=row.ai_enabled, limit=default_limit, is_custom=False)
    return EffectivePolicy(enabled=row.ai_enabled, limit=row.daily_limit, is_custom=True)


def compute_resets_at(oldest_in_window: datetime | None) -> datetime | None:
    if oldest_in_window is None:
        return None
    return _as_utc(oldest_in_window) + ROLLING_WINDOW


def window_start(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) - ROLLING_WINDOW


def check_enabled(policy: EffectivePolicy) -> PolicyViolation | None:
    if not policy.enabled:
        return PolicyViolation(status_code=403, detail=DISABLED_DETAIL)
    return None


def check_creation(policy: EffectivePolicy, used: int) -> PolicyViolation | None:
    violation = check_enabled(policy)
    if violation is not None:
        return violation
    if used >= policy.limit:
        return PolicyViolation(
            status_code=429,
            detail=f"You have used all {policy.limit} AI quiz generations in the last 24 hours",
        )
    return None


def apply_policy_update(
    row: UserAiPolicy | None,
    user_id: str,
    *,
    updated_by: str | None,
    ai_enabled: bool | None = None,
    daily_limit: int | None = None,
    set_limit: bool = False,
    now: datetime | None = None,
) -> tuple[UserAiPolicy, bool]:
    """Áp thay đổi lên dòng policy (tạo mới nếu chưa có).

    `set_limit` phân biệt "không đụng tới limit" với "đặt limit về NULL".
    """
    created = row is None
    if row is None:
        row = UserAiPolicy(user_id=user_id, ai_enabled=True, daily_limit=None)
    if ai_enabled is not None:
        row.ai_enabled = ai_enabled
    if set_limit:
        row.daily_limit = daily_limit
    row.updated_by = updated_by
    row.updated_at = now or datetime.now(timezone.utc)
    return row, created


def _raise_if(violation: PolicyViolation | None) -> None:
    if violation is not None:
        raise HTTPException(status_code=violation.status_code, detail=violation.detail)


async def get_policy(db: AsyncSession, user_id: str) -> EffectivePolicy:
    row = await db.get(UserAiPolicy, user_id)
    return resolve_policy(row, settings.AI_DAILY_QUIZ_LIMIT)


def _ai_quizzes_in_window(user_id: str):
    return (
        Quiz.user_id == user_id,
        Quiz.uses_ai.is_(True),
        Quiz.created_at >= window_start(),
    )


async def count_ai_quizzes_24h(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(select(func.count(Quiz.id)).where(*_ai_quizzes_in_window(user_id)))
    return result.scalar() or 0


async def get_usage(
    db: AsyncSession, user_id: str, policy: EffectivePolicy | None = None
) -> AiUsage:
    if policy is None:
        policy = await get_policy(db, user_id)
    result = await db.execute(
        select(func.count(Quiz.id), func.min(Quiz.created_at)).where(*_ai_quizzes_in_window(user_id))
    )
    used, oldest = result.one()
    return AiUsage(used=used or 0, limit=policy.limit, resets_at=compute_resets_at(oldest))


async def enforce_can_create(db: AsyncSession, user_id: str) -> None:
    policy = await get_policy(db, user_id)
    violation = check_enabled(policy)
    if violation is None:
        violation = check_creation(policy, await count_ai_quizzes_24h(db, user_id))
    _raise_if(violation)


async def enforce_enabled(db: AsyncSession, user_id: str) -> None:
    _raise_if(check_enabled(await get_policy(db, user_id)))


async def upsert_policy(
    db: AsyncSession,
    user_id: str,
    *,
    updated_by: str | None,
    ai_enabled: bool | None = None,
    daily_limit: int | None = None,
    set_limit: bool = False,
) -> UserAiPolicy:
    """Tạo/cập nhật dòng policy trong session hiện tại. Caller tự commit."""
    row = await db.get(UserAiPolicy, user_id)
    row, created = apply_policy_update(
        row,
        user_id,
        updated_by=updated_by,
        ai_enabled=ai_enabled,
        daily_limit=daily_limit,
        set_limit=set_limit,
    )
    if created:
        db.add(row)
    return row
```

- [ ] **Step 4: Chạy test để thấy qua**

Run: `.venv/Scripts/python.exe -m pytest tests/test_ai_policy.py -v`
Expected: PASS (19 test)

- [ ] **Step 5: Toàn bộ test**

Run: `.venv/Scripts/python.exe -m pytest tests -q`
Expected: tất cả PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ai_policy.py backend/tests/test_ai_policy.py
git commit -m "feat(admin): add per-user AI policy service" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Role, `ADMIN_EMAILS` và `require_admin`

**Files:**
- Create: `backend/app/services/admin_access.py`
- Test: `backend/tests/test_admin_access.py`
- Modify: `backend/app/services/auth.py`
- Modify: `backend/app/routers/auth.py`
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/deps.py`

**Interfaces:**
- Consumes: `settings.ADMIN_EMAILS`, `User.role` (Task 1).
- Produces:
  - `ADMIN_ROLE = "admin"`, `USER_ROLE = "user"`
  - `SELF_ROLE_DETAIL`, `CONFIG_ADMIN_DETAIL`, `LAST_ADMIN_DETAIL` (str)
  - `parse_admin_emails(raw: str) -> frozenset[str]`
  - `is_config_admin(email: str, admin_emails_raw: str | None = None) -> bool` (None ⟹ đọc `settings.ADMIN_EMAILS`)
  - `should_promote(email: str, role: str, admin_emails_raw: str | None = None) -> bool`
  - `check_role_change(*, actor_id: str, target_id: str, target_email: str, current_role: str, new_role: str, admin_count: int, admin_emails_raw: str | None = None) -> str | None` (trả message lỗi hoặc None)
  - `services.auth.sync_config_admin(db, user) -> None` (async)
  - `UserOut.role: Literal["user", "admin"]`
  - `deps.require_admin(current_user) -> User` (403 `Admin access required`)

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_admin_access.py`:

```python
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
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `.venv/Scripts/python.exe -m pytest tests/test_admin_access.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.admin_access'`

- [ ] **Step 3: Viết `admin_access`**

Create `backend/app/services/admin_access.py`:

```python
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
```

- [ ] **Step 4: Thêm `role` vào `UserOut`**

Trong `backend/app/schemas/auth.py`, đổi dòng import đầu thành:

```python
from typing import Literal

from pydantic import BaseModel, EmailStr, Field
```

và thay class `UserOut` bằng:

```python
class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: Literal["user", "admin"] = "user"

    class Config:
        from_attributes = True
```

- [ ] **Step 5: Chạy test để thấy qua**

Run: `.venv/Scripts/python.exe -m pytest tests/test_admin_access.py -v`
Expected: PASS (15 test)

- [ ] **Step 6: Thêm `sync_config_admin` vào `services/auth.py`**

Trong `backend/app/services/auth.py`, thêm import dưới `from app.models.user import User`:

```python
from app.services.admin_access import ADMIN_ROLE, should_promote
```

và thêm hàm ở cuối file:

```python
async def sync_config_admin(db: AsyncSession, user: User) -> None:
    """Nâng user lên admin nếu email nằm trong ADMIN_EMAILS."""
    if not should_promote(user.email, user.role):
        return
    user.role = ADMIN_ROLE
    await db.commit()
    await db.refresh(user)
```

- [ ] **Step 7: Gọi trong router auth**

Trong `backend/app/routers/auth.py`:

Đổi import service thành:

```python
from app.services.admin_access import ADMIN_ROLE, USER_ROLE, is_config_admin
from app.services.auth import authenticate_user, create_access_token, hash_password, sync_config_admin
```

Trong `register_user`, thay khối tạo `User(...)` bằng:

```python
    user = User(
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=ADMIN_ROLE if is_config_admin(str(payload.email)) else USER_ROLE,
    )
```

Trong `login_user`, thêm ngay sau `user = await authenticate_user(...)`:

```python
    await sync_config_admin(db, user)
```

- [ ] **Step 8: Thêm `require_admin` vào `deps.py`**

Thêm vào cuối `backend/app/deps.py`:

```python
async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
```

- [ ] **Step 9: Kiểm tra app import được và test xanh**

Run:

```bash
.venv/Scripts/python.exe -c "from app.main import app; print('ok')"
.venv/Scripts/python.exe -m pytest tests -q
```

Expected: `ok`; tất cả test PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/admin_access.py backend/tests/test_admin_access.py backend/app/services/auth.py backend/app/routers/auth.py backend/app/schemas/auth.py backend/app/deps.py
git commit -m "feat(admin): add admin role bootstrap via ADMIN_EMAILS and require_admin" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Áp policy vào luồng quiz AI

**Files:**
- Modify: `backend/app/schemas/quiz.py` (class `AiStatusOut`)
- Modify: `backend/app/routers/quizzes.py` (xóa `_count_ai_quizzes_today`, `_enforce_daily_ai_limit`; sửa `create_quiz`, `get_ai_status`, `retry_quiz`)
- Test: `backend/tests/test_admin_schemas.py` (tạo mới, phần `AiStatusOut`)

**Interfaces:**
- Consumes: `ai_policy.enforce_can_create`, `ai_policy.enforce_enabled`, `ai_policy.get_policy`, `ai_policy.count_ai_quizzes_24h` (Task 2).
- Produces: `AiStatusOut(available: bool, enabled_for_user: bool, daily_limit: int, used_today: int)`.

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_admin_schemas.py`:

```python
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
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `.venv/Scripts/python.exe -m pytest tests/test_admin_schemas.py -v`
Expected: FAIL — `test_exposes_per_user_policy_fields` lỗi vì `enabled_for_user` không có trong dump; `test_enabled_for_user_is_required` không raise.

- [ ] **Step 3: Sửa `AiStatusOut`**

Trong `backend/app/schemas/quiz.py`, thay class `AiStatusOut` bằng:

```python
class AiStatusOut(BaseModel):
    available: bool
    enabled_for_user: bool
    daily_limit: int
    used_today: int
```

- [ ] **Step 4: Chạy test để thấy qua**

Run: `.venv/Scripts/python.exe -m pytest tests/test_admin_schemas.py -v`
Expected: PASS

- [ ] **Step 5: Sửa router quizzes**

Trong `backend/app/routers/quizzes.py`:

(a) Thêm import dưới `from app.services.ai import ai_available, get_provider`:

```python
from app.services import ai_policy
```

(b) Xóa nguyên hai hàm `_count_ai_quizzes_today` và `_enforce_daily_ai_limit` (khoảng dòng 209–218 và 238–247).

(c) Trong `create_quiz`, thay:

```python
    if ai_types:
        await _enforce_daily_ai_limit(db, current_user.id)
```

bằng:

```python
    if ai_types:
        await ai_policy.enforce_can_create(db, current_user.id)
```

(d) Thay thân `get_ai_status` bằng:

```python
    """Cho frontend biết có nên hiện hai dạng câu hỏi AI cho user này hay không."""
    policy = await ai_policy.get_policy(db, current_user.id)
    return AiStatusOut(
        available=ai_available(),
        enabled_for_user=policy.enabled,
        daily_limit=policy.limit,
        used_today=await ai_policy.count_ai_quizzes_24h(db, current_user.id),
    )
```

(e) Trong `retry_quiz`, ngay sau khối kiểm tra `if quiz.retry_count >= 3: ...` và trước `quiz.retry_count += 1`, thêm:

```python
    await ai_policy.enforce_enabled(db, current_user.id)
```

- [ ] **Step 6: Dọn import không còn dùng**

Run (trong `backend/`):

```bash
.venv/Scripts/python.exe -c "import re,io; s=io.open('app/routers/quizzes.py',encoding='utf-8').read(); print('settings uses:', len(re.findall(r'\bsettings\.', s)), '| _count/_enforce left:', len(re.findall(r'_count_ai_quizzes_today|_enforce_daily_ai_limit', s)))"
```

Expected: `_count/_enforce left: 0`. Nếu `settings uses: 0` thì xóa dòng `from app.config import settings` trong `quizzes.py`; nếu lớn hơn 0 thì giữ nguyên.

Kiểm tra không còn nơi nào khác gọi hàm đã xóa:

```bash
git grep -n "_count_ai_quizzes_today\|_enforce_daily_ai_limit" -- backend
```

Expected: không có kết quả.

- [ ] **Step 7: App import được và test xanh**

Run:

```bash
.venv/Scripts/python.exe -c "from app.main import app; print('ok')"
.venv/Scripts/python.exe -m pytest tests -q
```

Expected: `ok`; tất cả PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/quiz.py backend/app/routers/quizzes.py backend/tests/test_admin_schemas.py
git commit -m "feat(quiz): enforce per-user AI policy on create, retry and ai-status" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Schema admin và thống kê thuần

**Files:**
- Create: `backend/app/schemas/admin.py`
- Create: `backend/app/services/admin_stats.py`
- Test: `backend/tests/test_admin_stats.py`
- Modify: `backend/tests/test_admin_schemas.py` (thêm test `AdminUserUpdate`)

**Interfaces:**
- Consumes: `MAX_DAILY_LIMIT` (Task 2).
- Produces:
  - `schemas.admin`: `AdminOverviewOut`, `AdminUserRow`, `AdminUserListOut`, `ActivityDayOut`, `AiUsageOut`, `RecentAiQuizOut`, `AdminUserDetailOut`, `AdminUserUpdate` (trường xem code bên dưới)
  - `admin_stats.ActivityDay(date: date, count: int)` (frozen dataclass)
  - `admin_stats.build_activity_7d(timestamps: Iterable[datetime], today: date, days: int = 7) -> list[ActivityDay]`
  - `admin_stats.latest_timestamp(values: Iterable[datetime | None]) -> datetime | None`

- [ ] **Step 1: Viết test thất bại cho thống kê**

Create `backend/tests/test_admin_stats.py`:

```python
"""Unit test thống kê thuần cho trang chi tiết user."""
from datetime import date, datetime, timezone

from app.services.admin_stats import ActivityDay, build_activity_7d, latest_timestamp


class TestBuildActivity7d:
    TODAY = date(2026, 9, 15)

    def test_returns_seven_days_oldest_first_with_zeros(self):
        result = build_activity_7d([], self.TODAY)
        assert [day.date for day in result] == [date(2026, 9, d) for d in range(9, 16)]
        assert all(day.count == 0 for day in result)

    def test_counts_events_per_utc_day_and_ignores_older_ones(self):
        timestamps = [
            datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc),
            datetime(2026, 9, 15, 23, 59, tzinfo=timezone.utc),
            datetime(2026, 9, 9, 0, 1, tzinfo=timezone.utc),
            datetime(2026, 9, 8, 23, 59, tzinfo=timezone.utc),
        ]
        result = build_activity_7d(timestamps, self.TODAY)
        assert result[0] == ActivityDay(date=date(2026, 9, 9), count=1)
        assert result[-1] == ActivityDay(date=date(2026, 9, 15), count=2)
        assert sum(day.count for day in result) == 3

    def test_naive_timestamps_are_treated_as_utc(self):
        result = build_activity_7d([datetime(2026, 9, 14, 12, 0)], self.TODAY)
        assert result[-2] == ActivityDay(date=date(2026, 9, 14), count=1)

    def test_non_utc_timestamps_are_bucketed_by_utc_date(self):
        from datetime import timedelta

        plus7 = timezone(timedelta(hours=7))
        # 2026-09-15 03:00 +07:00 == 2026-09-14 20:00 UTC
        result = build_activity_7d([datetime(2026, 9, 15, 3, 0, tzinfo=plus7)], self.TODAY)
        assert result[-2].count == 1
        assert result[-1].count == 0


class TestLatestTimestamp:
    def test_all_none_returns_none(self):
        assert latest_timestamp([None, None]) is None

    def test_picks_latest_and_normalizes_naive_to_utc(self):
        aware = datetime(2026, 9, 14, 8, 0, tzinfo=timezone.utc)
        naive = datetime(2026, 9, 15, 8, 0)
        assert latest_timestamp([aware, None, naive]) == datetime(2026, 9, 15, 8, 0, tzinfo=timezone.utc)
```

- [ ] **Step 2: Thêm test thất bại cho `AdminUserUpdate`**

Append vào `backend/tests/test_admin_schemas.py`:

```python
from app.schemas.admin import AdminUserUpdate


class TestAdminUserUpdate:
    def test_empty_body_sets_no_fields(self):
        assert AdminUserUpdate.model_validate({}).model_fields_set == set()

    def test_explicit_null_limit_is_distinguishable_from_missing(self):
        update = AdminUserUpdate.model_validate({"ai_daily_limit": None})
        assert "ai_daily_limit" in update.model_fields_set
        assert update.ai_daily_limit is None

    def test_limit_bounds_are_enforced(self):
        assert AdminUserUpdate.model_validate({"ai_daily_limit": 0}).ai_daily_limit == 0
        assert AdminUserUpdate.model_validate({"ai_daily_limit": 1000}).ai_daily_limit == 1000
        with pytest.raises(ValidationError):
            AdminUserUpdate.model_validate({"ai_daily_limit": 1001})
        with pytest.raises(ValidationError):
            AdminUserUpdate.model_validate({"ai_daily_limit": -1})

    def test_unknown_role_is_rejected(self):
        with pytest.raises(ValidationError):
            AdminUserUpdate.model_validate({"role": "owner"})
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `.venv/Scripts/python.exe -m pytest tests/test_admin_stats.py tests/test_admin_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError` cho `app.services.admin_stats` và `app.schemas.admin`.

- [ ] **Step 4: Viết `admin_stats`**

Create `backend/app/services/admin_stats.py`:

```python
"""Thống kê thuần cho admin: không chạm DB để unit test được."""
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone


@dataclass(frozen=True)
class ActivityDay:
    date: date
    count: int


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def build_activity_7d(timestamps: Iterable[datetime], today: date, days: int = 7) -> list[ActivityDay]:
    """Đếm hoạt động theo ngày UTC cho `days` ngày kết thúc ở `today`, cũ trước mới sau."""
    start = today - timedelta(days=days - 1)
    counts = Counter(_as_utc(ts).date() for ts in timestamps)
    return [
        ActivityDay(date=start + timedelta(days=offset), count=counts.get(start + timedelta(days=offset), 0))
        for offset in range(days)
    ]


def latest_timestamp(values: Iterable[datetime | None]) -> datetime | None:
    present = [_as_utc(value) for value in values if value is not None]
    return max(present) if present else None
```

- [ ] **Step 5: Viết schema admin**

Create `backend/app/schemas/admin.py`:

```python
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.ai_policy import MAX_DAILY_LIMIT

Role = Literal["user", "admin"]


class AdminOverviewOut(BaseModel):
    total_users: int
    active_users_7d: int
    total_cards: int
    ai_quizzes_24h: int


class AdminUserRow(BaseModel):
    id: str
    email: str
    display_name: str
    role: Role
    created_at: datetime
    is_config_admin: bool
    session_count: int
    card_count: int
    quizzes_taken: int
    avg_accuracy: float | None
    ai_enabled: bool
    ai_daily_limit: int
    ai_limit_is_custom: bool
    ai_used_24h: int


class AdminUserListOut(BaseModel):
    items: list[AdminUserRow]
    total: int
    page: int
    page_size: int


class ActivityDayOut(BaseModel):
    date: date
    count: int


class AiUsageOut(BaseModel):
    used: int
    limit: int
    resets_at: datetime | None


class RecentAiQuizOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    status: str
    ai_question_count: int
    requested_count: int


class AdminUserDetailOut(AdminUserRow):
    learned_cards: int
    last_active_at: datetime | None
    activity_7d: list[ActivityDayOut]
    ai_usage: AiUsageOut
    ai_system_default_limit: int
    recent_ai_quizzes: list[RecentAiQuizOut]


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    ai_enabled: bool | None = None
    # null = về mặc định hệ thống; phân biệt với "không gửi" qua model_fields_set
    ai_daily_limit: int | None = Field(default=None, ge=0, le=MAX_DAILY_LIMIT)
```

- [ ] **Step 6: Chạy test để thấy qua**

Run: `.venv/Scripts/python.exe -m pytest tests/test_admin_stats.py tests/test_admin_schemas.py -v`
Expected: PASS

- [ ] **Step 7: Toàn bộ test**

Run: `.venv/Scripts/python.exe -m pytest tests -q`
Expected: tất cả PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/admin.py backend/app/services/admin_stats.py backend/tests/test_admin_stats.py backend/tests/test_admin_schemas.py
git commit -m "feat(admin): add admin schemas and activity stats helpers" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Admin router

**Files:**
- Create: `backend/app/routers/admin.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `require_admin` (Task 3); `check_role_change`, `is_config_admin`, `ADMIN_ROLE` (Task 3); `ai_policy.resolve_policy`, `get_usage`, `upsert_policy`, `window_start` (Task 2); `build_activity_7d`, `latest_timestamp` (Task 5); schema admin (Task 5).
- Produces: HTTP `GET /admin/overview`, `GET /admin/users`, `GET /admin/users/{user_id}`, `PATCH /admin/users/{user_id}` — shape đúng schema Task 5.

Router chỉ là query + ghép hàm đã unit test; theo quyết định chỉ unit test, task này được kiểm bằng import app, liệt kê route và chạy tay ở Task 10.

- [ ] **Step 1: Viết router**

Create `backend/app/routers/admin.py`:

```python
"""Admin API: tổng quan, danh sách user, chi tiết, đổi role và policy AI."""
from datetime import datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Float, case, cast, func, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import require_admin
from app.models.ai_policy import UserAiPolicy
from app.models.card import Card, CardLearnEvent
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt
from app.models.session import Session
from app.models.user import User
from app.schemas.admin import (
    ActivityDayOut,
    AdminOverviewOut,
    AdminUserDetailOut,
    AdminUserListOut,
    AdminUserRow,
    AdminUserUpdate,
    AiUsageOut,
    RecentAiQuizOut,
)
from app.services import ai_policy
from app.services.admin_access import ADMIN_ROLE, check_role_change, is_config_admin
from app.services.admin_stats import build_activity_7d, latest_timestamp

router = APIRouter(dependencies=[Depends(require_admin)])

ACTIVE_WINDOW = timedelta(days=7)
ACTIVITY_DAYS = 7
RECENT_AI_QUIZ_LIMIT = 10


def _user_row_query():
    """SELECT User, UserAiPolicy và các số đếm tổng hợp — một query, không N+1."""
    sessions_sq = (
        select(Session.user_id.label("user_id"), func.count(Session.id).label("session_count"))
        .group_by(Session.user_id)
        .subquery()
    )
    cards_sq = (
        select(
            Session.user_id.label("user_id"),
            func.count(Card.id).label("card_count"),
            func.sum(case((Card.is_learned.is_(True), 1), else_=0)).label("learned_cards"),
        )
        .join(Card, Card.session_id == Session.id)
        .group_by(Session.user_id)
        .subquery()
    )
    attempts_sq = (
        select(
            QuizAttempt.user_id.label("user_id"),
            func.count(QuizAttempt.id).label("quizzes_taken"),
            func.avg(
                case(
                    (QuizAttempt.total_questions > 0, cast(QuizAttempt.score, Float) / QuizAttempt.total_questions),
                    else_=None,
                )
            ).label("avg_accuracy"),
        )
        .where(QuizAttempt.submitted_at.is_not(None))
        .group_by(QuizAttempt.user_id)
        .subquery()
    )
    ai_sq = (
        select(Quiz.user_id.label("user_id"), func.count(Quiz.id).label("ai_used"))
        .where(Quiz.uses_ai.is_(True), Quiz.created_at >= ai_policy.window_start())
        .group_by(Quiz.user_id)
        .subquery()
    )
    return (
        select(
            User,
            UserAiPolicy,
            func.coalesce(sessions_sq.c.session_count, 0).label("session_count"),
            func.coalesce(cards_sq.c.card_count, 0).label("card_count"),
            func.coalesce(cards_sq.c.learned_cards, 0).label("learned_cards"),
            func.coalesce(attempts_sq.c.quizzes_taken, 0).label("quizzes_taken"),
            attempts_sq.c.avg_accuracy.label("avg_accuracy"),
            func.coalesce(ai_sq.c.ai_used, 0).label("ai_used"),
        )
        .outerjoin(UserAiPolicy, UserAiPolicy.user_id == User.id)
        .outerjoin(sessions_sq, sessions_sq.c.user_id == User.id)
        .outerjoin(cards_sq, cards_sq.c.user_id == User.id)
        .outerjoin(attempts_sq, attempts_sq.c.user_id == User.id)
        .outerjoin(ai_sq, ai_sq.c.user_id == User.id)
    )


def _apply_filters(query, search: str | None, role: str | None, ai: str | None):
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(func.lower(User.email).like(pattern), func.lower(User.display_name).like(pattern))
        )
    if role:
        query = query.where(User.role == role)
    if ai == "disabled":
        query = query.where(UserAiPolicy.ai_enabled.is_(False))
    elif ai == "enabled":
        query = query.where(or_(UserAiPolicy.user_id.is_(None), UserAiPolicy.ai_enabled.is_(True)))
    return query


def _to_row(row) -> AdminUserRow:
    user: User = row[0]
    policy = ai_policy.resolve_policy(row[1], settings.AI_DAILY_QUIZ_LIMIT)
    return AdminUserRow(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        created_at=user.created_at,
        is_config_admin=is_config_admin(user.email),
        session_count=int(row.session_count),
        card_count=int(row.card_count),
        quizzes_taken=int(row.quizzes_taken),
        avg_accuracy=float(row.avg_accuracy) if row.avg_accuracy is not None else None,
        ai_enabled=policy.enabled,
        ai_daily_limit=policy.limit,
        ai_limit_is_custom=policy.is_custom,
        ai_used_24h=int(row.ai_used),
    )


async def _build_detail(db: AsyncSession, user_id: str) -> AdminUserDetailOut:
    result = await db.execute(_user_row_query().where(User.id == user_id))
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    base = _to_row(row)
    policy = ai_policy.resolve_policy(row[1], settings.AI_DAILY_QUIZ_LIMIT)

    today = datetime.now(timezone.utc).date()
    since = datetime.combine(today - timedelta(days=ACTIVITY_DAYS - 1), time.min, tzinfo=timezone.utc)

    learn_times = (
        await db.execute(
            select(CardLearnEvent.occurred_at)
            .join(Card, CardLearnEvent.card_id == Card.id)
            .join(Session, Card.session_id == Session.id)
            .where(Session.user_id == user_id, CardLearnEvent.occurred_at >= since)
        )
    ).scalars().all()
    answer_times = (
        await db.execute(
            select(QuizAnswer.answered_at)
            .join(QuizAttempt, QuizAnswer.attempt_id == QuizAttempt.id)
            .where(QuizAttempt.user_id == user_id, QuizAnswer.answered_at >= since)
        )
    ).scalars().all()

    last_learn = (
        await db.execute(
            select(func.max(CardLearnEvent.occurred_at))
            .join(Card, CardLearnEvent.card_id == Card.id)
            .join(Session, Card.session_id == Session.id)
            .where(Session.user_id == user_id)
        )
    ).scalar()
    last_attempt = (
        await db.execute(select(func.max(QuizAttempt.submitted_at)).where(QuizAttempt.user_id == user_id))
    ).scalar()

    usage = await ai_policy.get_usage(db, user_id, policy)

    recent = (
        await db.execute(
            select(Quiz)
            .where(Quiz.user_id == user_id, Quiz.uses_ai.is_(True))
            .order_by(Quiz.created_at.desc())
            .limit(RECENT_AI_QUIZ_LIMIT)
        )
    ).scalars().all()

    return AdminUserDetailOut(
        **base.model_dump(),
        learned_cards=int(row.learned_cards),
        last_active_at=latest_timestamp([last_learn, last_attempt]),
        activity_7d=[
            ActivityDayOut(date=day.date, count=day.count)
            for day in build_activity_7d([*learn_times, *answer_times], today, ACTIVITY_DAYS)
        ],
        ai_usage=AiUsageOut(used=usage.used, limit=usage.limit, resets_at=usage.resets_at),
        ai_system_default_limit=settings.AI_DAILY_QUIZ_LIMIT,
        recent_ai_quizzes=[
            RecentAiQuizOut(
                id=quiz.id,
                title=quiz.title,
                created_at=quiz.created_at,
                status=quiz.status,
                ai_question_count=quiz.ai_question_count,
                requested_count=quiz.requested_count,
            )
            for quiz in recent
        ],
    )


@router.get("/overview", response_model=AdminOverviewOut)
async def get_overview(db: AsyncSession = Depends(get_db)) -> AdminOverviewOut:
    since = datetime.now(timezone.utc) - ACTIVE_WINDOW

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_cards = (await db.execute(select(func.count(Card.id)))).scalar() or 0

    learn_users = (
        select(Session.user_id.label("user_id"))
        .join(Card, Card.session_id == Session.id)
        .join(CardLearnEvent, CardLearnEvent.card_id == Card.id)
        .where(CardLearnEvent.occurred_at >= since)
    )
    attempt_users = select(QuizAttempt.user_id.label("user_id")).where(QuizAttempt.submitted_at >= since)
    active_sq = union(learn_users, attempt_users).subquery()
    active_users = (await db.execute(select(func.count()).select_from(active_sq))).scalar() or 0

    ai_quizzes = (
        await db.execute(
            select(func.count(Quiz.id)).where(
                Quiz.uses_ai.is_(True), Quiz.created_at >= ai_policy.window_start()
            )
        )
    ).scalar() or 0

    return AdminOverviewOut(
        total_users=total_users,
        active_users_7d=active_users,
        total_cards=total_cards,
        ai_quizzes_24h=ai_quizzes,
    )


@router.get("/users", response_model=AdminUserListOut)
async def list_users(
    search: str | None = Query(default=None, max_length=255),
    role: Literal["user", "admin"] | None = None,
    ai: Literal["enabled", "disabled"] | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListOut:
    count_query = _apply_filters(
        select(func.count(User.id))
        .select_from(User)
        .outerjoin(UserAiPolicy, UserAiPolicy.user_id == User.id),
        search,
        role,
        ai,
    )
    total = (await db.execute(count_query)).scalar() or 0

    rows_query = (
        _apply_filters(_user_row_query(), search, role, ai)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(rows_query)

    return AdminUserListOut(
        items=[_to_row(row) for row in result.all()],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetailOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)) -> AdminUserDetailOut:
    return await _build_detail(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserDetailOut)
async def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserDetailOut:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    fields = payload.model_fields_set

    if "role" in fields and payload.role is not None:
        admin_count = (
            await db.execute(select(func.count(User.id)).where(User.role == ADMIN_ROLE))
        ).scalar() or 0
        error = check_role_change(
            actor_id=admin.id,
            target_id=target.id,
            target_email=target.email,
            current_role=target.role,
            new_role=payload.role,
            admin_count=admin_count,
        )
        if error is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
        target.role = payload.role

    if "ai_enabled" in fields or "ai_daily_limit" in fields:
        await ai_policy.upsert_policy(
            db,
            target.id,
            updated_by=admin.id,
            ai_enabled=payload.ai_enabled,
            daily_limit=payload.ai_daily_limit,
            set_limit="ai_daily_limit" in fields,
        )

    await db.commit()
    return await _build_detail(db, target.id)
```

- [ ] **Step 2: Mount router**

Trong `backend/app/main.py`, đổi dòng import router thành:

```python
from app.routers import admin, auth, sessions, cards, imports, stats, quizzes, attempts
```

và thêm sau dòng `app.include_router(attempts.router, ...)`:

```python
app.include_router(admin.router, prefix="/admin", tags=["admin"])
```

- [ ] **Step 3: Kiểm tra route đã đăng ký**

Run:

```bash
.venv/Scripts/python.exe -c "from app.main import app; print(sorted((r.path, sorted(r.methods)) for r in app.routes if r.path.startswith('/admin')))"
```

Expected:

```
[('/admin/overview', ['GET']), ('/admin/users', ['GET']), ('/admin/users/{user_id}', ['GET']), ('/admin/users/{user_id}', ['PATCH'])]
```

- [ ] **Step 4: Kiểm tra SQL compile được trên dialect Postgres (bắt lỗi query mà không cần DB)**

Run:

```bash
.venv/Scripts/python.exe -c "from sqlalchemy.dialects import postgresql; from app.routers.admin import _user_row_query, _apply_filters; q=_apply_filters(_user_row_query(), 'an', 'admin', 'enabled'); print(str(q.compile(dialect=postgresql.dialect()))[:400])"
```

Expected: in ra câu `SELECT users.id, ...` có `LEFT OUTER JOIN user_ai_policies` và `lower(users.email) LIKE`, không exception.

- [ ] **Step 5: Test xanh**

Run: `.venv/Scripts/python.exe -m pytest tests -q`
Expected: tất cả PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/admin.py backend/app/main.py
git commit -m "feat(admin): add admin users API (overview, list, detail, update)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Nền tảng frontend — type, API, route guard, menu, AI gating

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/types/admin.ts`
- Create: `frontend/src/api/errors.ts`
- Create: `frontend/src/api/admin.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/UserMenu.tsx`
- Modify: `frontend/src/components/quiz/QuizCreateModal.tsx`
- Modify: `frontend/src/pages/QuizzesPage.tsx`

**Interfaces:**
- Consumes: HTTP API Task 4 và Task 6.
- Produces:
  - `UserRole = 'user' | 'admin'`, `User.role: UserRole`, `AiStatus.enabled_for_user: boolean`
  - Types trong `types/admin.ts`: `AiFilter`, `AdminOverview`, `AdminUserRow`, `AdminUserList`, `ActivityDay`, `AiUsage`, `RecentAiQuiz`, `AdminUserDetail`, `AdminUserUpdate`, `AdminUserListParams`
  - `apiErrorMessage(err: unknown, fallback: string): string`
  - `fetchAdminOverview(): Promise<AdminOverview>`, `listAdminUsers(params: AdminUserListParams): Promise<AdminUserList>`, `getAdminUser(id: string): Promise<AdminUserDetail>`, `updateAdminUser(id: string, body: AdminUserUpdate): Promise<AdminUserDetail>`
  - `AdminRoute` trong `App.tsx`; route `/admin/users` → `AdminUsersPage`, `/admin/users/:id` → `AdminUserDetailPage` (hai trang tạo ở Task 8/9 — task này tạo file giữ chỗ tối thiểu để build qua)

- [ ] **Step 1: Cập nhật type `User` và `AiStatus`**

Trong `frontend/src/types/index.ts`, thay type `User` bằng:

```ts
export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
};
```

và thay interface `AiStatus` bằng:

```ts
export interface AiStatus {
  available: boolean;
  enabled_for_user: boolean;
  daily_limit: number;
  used_today: number;
}
```

- [ ] **Step 2: Tạo type admin**

Create `frontend/src/types/admin.ts`:

```ts
import type { UserRole } from './index';

export type AiFilter = '' | 'enabled' | 'disabled';

export type AdminOverview = {
  total_users: number;
  active_users_7d: number;
  total_cards: number;
  ai_quizzes_24h: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  is_config_admin: boolean;
  session_count: number;
  card_count: number;
  quizzes_taken: number;
  avg_accuracy: number | null;
  ai_enabled: boolean;
  ai_daily_limit: number;
  ai_limit_is_custom: boolean;
  ai_used_24h: number;
};

export type AdminUserList = {
  items: AdminUserRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ActivityDay = {
  date: string;
  count: number;
};

export type AiUsage = {
  used: number;
  limit: number;
  resets_at: string | null;
};

export type RecentAiQuiz = {
  id: string;
  title: string;
  created_at: string;
  status: 'pending' | 'ready' | 'failed';
  ai_question_count: number;
  requested_count: number;
};

export type AdminUserDetail = AdminUserRow & {
  learned_cards: number;
  last_active_at: string | null;
  activity_7d: ActivityDay[];
  ai_usage: AiUsage;
  ai_system_default_limit: number;
  recent_ai_quizzes: RecentAiQuiz[];
};

export type AdminUserUpdate = {
  role?: UserRole;
  ai_enabled?: boolean;
  ai_daily_limit?: number | null;
};

export type AdminUserListParams = {
  search?: string;
  role?: UserRole | '';
  ai?: AiFilter;
  page?: number;
  page_size?: number;
};
```

- [ ] **Step 3: Tạo helper lỗi API**

Create `frontend/src/api/errors.ts`:

```ts
import axios from 'axios';

/** Lấy `detail` dạng chuỗi từ response lỗi của FastAPI, nếu không có thì dùng fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}
```

- [ ] **Step 4: Tạo API client admin**

Create `frontend/src/api/admin.ts`:

```ts
import { api } from './client';
import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserList,
  AdminUserListParams,
  AdminUserUpdate,
} from '../types/admin';

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await api.get<AdminOverview>('/admin/overview');
  return response.data;
}

export async function listAdminUsers(params: AdminUserListParams): Promise<AdminUserList> {
  // Bỏ tham số rỗng để backend không nhận role="" / ai="" (422).
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );
  const response = await api.get<AdminUserList>('/admin/users', { params: query });
  return response.data;
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const response = await api.get<AdminUserDetail>(`/admin/users/${id}`);
  return response.data;
}

export async function updateAdminUser(id: string, body: AdminUserUpdate): Promise<AdminUserDetail> {
  const response = await api.patch<AdminUserDetail>(`/admin/users/${id}`, body);
  return response.data;
}
```

- [ ] **Step 5: Tạo hai trang giữ chỗ để build qua**

Create `frontend/src/pages/AdminUsersPage.tsx`:

```tsx
export default function AdminUsersPage() {
  return <div className="page-shell" />;
}
```

Create `frontend/src/pages/AdminUserDetailPage.tsx`:

```tsx
export default function AdminUserDetailPage() {
  return <div className="page-shell" />;
}
```

(Task 8 và Task 9 thay toàn bộ nội dung hai file này.)

- [ ] **Step 6: Thêm `AdminRoute` và route vào `App.tsx`**

Trong `frontend/src/App.tsx`:

Thêm import dưới `import PracticePage from './pages/PracticePage';`:

```tsx
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
```

Thêm component ngay sau function `ProtectedRoute`:

```tsx
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-shell center-block">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

Thêm hai route ngay trước `</Routes>`:

```tsx
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <AdminRoute>
            <AdminUserDetailPage />
          </AdminRoute>
        }
      />
```

- [ ] **Step 7: Thêm mục "User Management" vào `UserMenu`**

Trong `frontend/src/components/UserMenu.tsx`:

Đổi hai dòng import đầu thành:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleUser, LogOut, ShieldCheck } from 'lucide-react';
```

Thêm dòng đầu tiên trong thân component (trước `const [isOpen, ...]`):

```tsx
  const navigate = useNavigate();
```

Thêm ngay trước nút Logout (trước `<button ... onClick={handleLogout}>`):

```tsx
          {user.role === 'admin' && (
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-canvas text-ink transition-colors border-b border-hairline"
              onClick={() => {
                setIsOpen(false);
                navigate('/admin/users');
              }}
            >
              <ShieldCheck size={16} />
              <span>User Management</span>
            </button>
          )}
```

- [ ] **Step 8: Ẩn dạng AI khi user bị tắt AI**

Trong `frontend/src/components/quiz/QuizCreateModal.tsx`, thay:

```tsx
  const availableTypes: QuestionType[] = aiStatus?.available
```

bằng:

```tsx
  const availableTypes: QuestionType[] = aiStatus?.available && aiStatus.enabled_for_user
```

(Modal đã hiện `detail` lỗi backend khi tạo quiz ở khối `catch` dòng ~128, nên 403/429 tự hiển thị — không sửa thêm.)

- [ ] **Step 9: Hiện lỗi khi Retry bị chặn**

Trong `frontend/src/pages/QuizzesPage.tsx`:

Thêm import dưới `import { api } from '../api/client';`:

```tsx
import { apiErrorMessage } from '../api/errors';
```

Thêm state dưới `const [showCreateModal, setShowCreateModal] = useState(false);`:

```tsx
  const [notice, setNotice] = useState<string | null>(null);
```

Thay `handleRetry` bằng:

```tsx
  const handleRetry = async (quizId: string) => {
    setNotice(null);
    try {
      const response = await api.post<Quiz>(`/quizzes/${quizId}/retry`);
      setQuizzes((current) =>
        current.map((quiz) => (quiz.id === quizId ? response.data : quiz)),
      );
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Could not retry this quiz.'));
    }
  };
```

Thêm ngay sau thẻ đóng `</section>` của `section-header`:

```tsx
        {notice && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error"
          >
            {notice}
          </div>
        )}
```

- [ ] **Step 10: Build**

Run (trong `frontend/`): `npm run build`
Expected: `tsc -b` không lỗi, `vite build` in `✓ built in ...`.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/types/admin.ts frontend/src/api/errors.ts frontend/src/api/admin.ts frontend/src/App.tsx frontend/src/components/UserMenu.tsx frontend/src/components/quiz/QuizCreateModal.tsx frontend/src/pages/QuizzesPage.tsx frontend/src/pages/AdminUsersPage.tsx frontend/src/pages/AdminUserDetailPage.tsx
git commit -m "feat(admin-ui): add admin route guard, API client and per-user AI gating" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Trang danh sách user

**Files:**
- Create: `frontend/src/lib/adminFormat.ts`
- Create: `frontend/src/components/admin/AdminKpiCard.tsx`
- Create: `frontend/src/components/admin/RolePill.tsx`
- Create: `frontend/src/components/admin/UserTable.tsx`
- Create: `frontend/src/components/admin/Pagination.tsx`
- Modify (thay toàn bộ): `frontend/src/pages/AdminUsersPage.tsx`

**Interfaces:**
- Consumes: `fetchAdminOverview`, `listAdminUsers`, `apiErrorMessage`, types admin (Task 7); `PageHeader`, `useAuth`.
- Produces:
  - `adminFormat`: `initials(name: string): string`, `formatDate(iso: string): string`, `formatDateTime(iso: string): string`, `formatWeekday(isoDate: string): string`, `formatPercent(ratio: number | null): string`, `plural(count: number, noun: string): string`, `formatResetsIn(resetsAt: string | null, now?: Date): string | null`
  - `<AdminKpiCard label value caption />`, `<RolePill role />`, `<UserTable rows onOpen />`, `<Pagination page pageSize total onChange />`
  - Trang chuyển sang chi tiết bằng `navigate('/admin/users/:id', { state: { from: location.search } })`

- [ ] **Step 1: Tạo helper format**

Create `frontend/src/lib/adminFormat.ts`:

```ts
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `isoDate` dạng YYYY-MM-DD (ngày UTC từ backend). */
export function formatWeekday(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}

export function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatResetsIn(resetsAt: string | null, now: Date = new Date()): string | null {
  if (!resetsAt) return null;
  const ms = new Date(resetsAt).getTime() - now.getTime();
  if (ms <= 0) return 'Resets now';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `Resets in ${hours}h ${minutes}m` : `Resets in ${minutes}m`;
}
```

- [ ] **Step 2: Tạo `AdminKpiCard`**

Create `frontend/src/components/admin/AdminKpiCard.tsx`:

```tsx
type AdminKpiCardProps = {
  label: string;
  value: string;
  caption: string;
};

export default function AdminKpiCard({ label, value, caption }: AdminKpiCardProps) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-card p-5">
      <p className="text-caption-uppercase uppercase text-muted">{label}</p>
      <p className="mt-3 text-headline-lg text-ink">{value}</p>
      <p className="mt-1 font-mono text-code-sm text-muted">{caption}</p>
    </div>
  );
}
```

- [ ] **Step 3: Tạo `RolePill`**

Create `frontend/src/components/admin/RolePill.tsx`:

```tsx
import type { UserRole } from '../../types';

export default function RolePill({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 text-caption-uppercase uppercase text-white">
        Admin
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-surface-card px-2.5 py-0.5 text-caption-uppercase uppercase text-body">
      User
    </span>
  );
}
```

- [ ] **Step 4: Tạo `UserTable`**

Create `frontend/src/components/admin/UserTable.tsx`:

```tsx
import { Ban, Pencil, Zap } from 'lucide-react';
import type { AdminUserRow } from '../../types/admin';
import { formatDate, formatPercent, initials, plural } from '../../lib/adminFormat';
import RolePill from './RolePill';

type UserTableProps = {
  rows: AdminUserRow[];
  onOpen: (id: string) => void;
};

const HEADERS = ['User', 'Role', 'Joined', 'Sessions & Cards', 'Quizzes & Accuracy', 'AI Access & Limit', ''];

function AiCell({ row }: { row: AdminUserRow }) {
  if (!row.ai_enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-body-sm text-muted">
        <Ban size={14} />
        Disabled
      </span>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1.5 text-body-sm text-success">
        <Zap size={14} />
        Enabled
      </span>
      <span className="font-mono text-code-sm text-muted">
        {row.ai_used_24h} / {row.ai_daily_limit} · 24h{row.ai_limit_is_custom ? '' : ' (default)'}
      </span>
    </div>
  );
}

export default function UserTable({ rows, onOpen }: UserTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface-card">
      <table className="w-full min-w-[880px] text-left">
        <thead className="border-b border-hairline bg-canvas-soft">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-4 py-3 text-caption-uppercase uppercase text-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-hairline-soft last:border-0 hover:bg-canvas-soft"
              onClick={() => onOpen(row.id)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hairline-soft text-caption-uppercase text-ink">
                    {initials(row.display_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-title-sm text-ink">{row.display_name}</p>
                    <p className="truncate text-body-sm text-muted">{row.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <RolePill role={row.role} />
              </td>
              <td className="px-4 py-3 font-mono text-code-sm text-body">{formatDate(row.created_at)}</td>
              <td className="px-4 py-3">
                <p className="text-body-sm text-ink">{plural(row.session_count, 'session')}</p>
                <p className="text-body-sm text-muted">{plural(row.card_count, 'card')}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-body-sm text-ink">{row.quizzes_taken} taken</p>
                <p className="font-mono text-code-sm text-muted">{formatPercent(row.avg_accuracy)}</p>
              </td>
              <td className="px-4 py-3">
                <AiCell row={row} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  title="Edit user"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-white text-body transition-colors hover:text-ink"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}
                >
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Tạo `Pagination`**

Create `frontend/src/components/admin/Pagination.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
};

export default function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-body-sm text-muted">
        Showing {from} to {to} of {total.toLocaleString('en-US')} users
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <span className="font-mono text-code-sm text-body">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Viết trang danh sách**

Thay toàn bộ `frontend/src/pages/AdminUsersPage.tsx` bằng:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RotateCcw, Search, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import AdminKpiCard from '../components/admin/AdminKpiCard';
import UserTable from '../components/admin/UserTable';
import Pagination from '../components/admin/Pagination';
import { fetchAdminOverview, listAdminUsers } from '../api/admin';
import { apiErrorMessage } from '../api/errors';
import type { UserRole } from '../types';
import type { AdminOverview, AdminUserList, AiFilter } from '../types/admin';

const PAGE_SIZE = 20;
const SELECT_CLASS =
  'h-[42px] rounded-lg border border-hairline-strong bg-white px-3 text-body-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const role = (searchParams.get('role') ?? '') as UserRole | '';
  const ai = (searchParams.get('ai') ?? '') as AiFilter;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [list, setList] = useState<AdminUserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateParams = useCallback(
    (next: Record<string, string>) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          Object.entries(next).forEach(([key, value]) => {
            if (value) params.set(key, value);
            else params.delete(key);
          });
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = window.setTimeout(() => updateParams({ search: searchInput.trim(), page: '' }), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, updateParams]);

  useEffect(() => {
    fetchAdminOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listAdminUsers({ search, role, ai, page, page_size: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load users.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, role, ai, page]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openUser = (id: string) => {
    navigate(`/admin/users/${id}`, { state: { from: location.search } });
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const kpi = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString('en-US'));

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <main className="page-container">
        <section>
          <p className="flex items-center gap-2 text-caption-uppercase uppercase">
            <span className="text-muted">Administration</span>
            <span className="text-muted">/</span>
            <span className="text-primary">Directory</span>
          </p>
          <h1 className="mt-2 text-headline-lg text-ink">User Management</h1>
          <p className="mt-2 max-w-2xl text-body-sm text-body">
            Review learners, promote admins, and control who can use AI quiz generation and how often.
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <AdminKpiCard label="Total Users" value={kpi(overview?.total_users)} caption="registered" />
          <AdminKpiCard label="Active Learners" value={kpi(overview?.active_users_7d)} caption="last 7 days" />
          <AdminKpiCard label="Total Vocab Cards" value={kpi(overview?.total_cards)} caption="in circulation" />
          <AdminKpiCard label="AI Quizzes" value={kpi(overview?.ai_quizzes_24h)} caption="last 24 hours" />
        </section>

        <section className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or email"
              className="h-[42px] w-full rounded-lg border border-hairline-strong bg-white pl-9 pr-3 text-body-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </label>
          <select
            value={role}
            onChange={(event) => updateParams({ role: event.target.value, page: '' })}
            className={SELECT_CLASS}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <select
            value={ai}
            onChange={(event) => updateParams({ ai: event.target.value, page: '' })}
            className={SELECT_CLASS}
          >
            <option value="">All AI Access</option>
            <option value="enabled">AI Enabled</option>
            <option value="disabled">AI Disabled</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={resetFilters} title="Reset filters">
            <RotateCcw size={15} />
            Reset
          </button>
        </section>

        <section className="mt-4">
          {error ? (
            <div role="alert" className="rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
              {error}
            </div>
          ) : !list ? (
            <div className="empty-state">Loading users…</div>
          ) : list.items.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <h3>No users match these filters</h3>
            </div>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <UserTable rows={list.items} onOpen={openUser} />
              <Pagination
                page={list.page}
                pageSize={list.page_size}
                total={list.total}
                onChange={(next) => updateParams({ page: next > 1 ? String(next) : '' })}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Build**

Run (trong `frontend/`): `npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/adminFormat.ts frontend/src/components/admin/AdminKpiCard.tsx frontend/src/components/admin/RolePill.tsx frontend/src/components/admin/UserTable.tsx frontend/src/components/admin/Pagination.tsx frontend/src/pages/AdminUsersPage.tsx
git commit -m "feat(admin-ui): add user management list page" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Trang chi tiết user

**Files:**
- Create: `frontend/src/lib/adminDraft.ts`
- Create: `frontend/src/components/admin/ActivityBars.tsx`
- Create: `frontend/src/components/admin/AiAccessCard.tsx`
- Create: `frontend/src/components/admin/RateLimitCard.tsx`
- Create: `frontend/src/components/admin/RecentAiQuizzes.tsx`
- Modify (thay toàn bộ): `frontend/src/pages/AdminUserDetailPage.tsx`

**Interfaces:**
- Consumes: `getAdminUser`, `updateAdminUser`, `apiErrorMessage` (Task 7); `adminFormat` helpers, `AdminKpiCard` (Task 8).
- Produces:
  - `adminDraft`: `MAX_AI_DAILY_LIMIT = 1000`, `type AdminUserDraft = { role: UserRole; ai_enabled: boolean; ai_daily_limit: number | null }`, `draftFromDetail(detail: AdminUserDetail): AdminUserDraft`, `buildAdminUpdate(original: AdminUserDraft, draft: AdminUserDraft): AdminUserUpdate`, `hasChanges(original, draft): boolean`, `isValidLimit(text: string): boolean`
  - `<ActivityBars days />`, `<AiAccessCard enabled disabled onChange />`, `<RateLimitCard usage value systemDefault aiEnabled onChange />`, `<RecentAiQuizzes quizzes />`

- [ ] **Step 1: Tạo `adminDraft`**

Create `frontend/src/lib/adminDraft.ts`:

```ts
import type { UserRole } from '../types';
import type { AdminUserDetail, AdminUserUpdate } from '../types/admin';

export const MAX_AI_DAILY_LIMIT = 1000;

export type AdminUserDraft = {
  role: UserRole;
  ai_enabled: boolean;
  /** null = dùng mặc định hệ thống */
  ai_daily_limit: number | null;
};

export function draftFromDetail(detail: AdminUserDetail): AdminUserDraft {
  return {
    role: detail.role,
    ai_enabled: detail.ai_enabled,
    ai_daily_limit: detail.ai_limit_is_custom ? detail.ai_daily_limit : null,
  };
}

/** Chỉ gửi các trường đã đổi để PATCH không ghi đè ngoài ý muốn. */
export function buildAdminUpdate(original: AdminUserDraft, draft: AdminUserDraft): AdminUserUpdate {
  const body: AdminUserUpdate = {};
  if (draft.role !== original.role) body.role = draft.role;
  if (draft.ai_enabled !== original.ai_enabled) body.ai_enabled = draft.ai_enabled;
  if (draft.ai_daily_limit !== original.ai_daily_limit) body.ai_daily_limit = draft.ai_daily_limit;
  return body;
}

export function hasChanges(original: AdminUserDraft, draft: AdminUserDraft): boolean {
  return Object.keys(buildAdminUpdate(original, draft)).length > 0;
}

export function isValidLimit(text: string): boolean {
  return /^\d+$/.test(text) && Number(text) <= MAX_AI_DAILY_LIMIT;
}
```

- [ ] **Step 2: Tạo `ActivityBars`**

Create `frontend/src/components/admin/ActivityBars.tsx`:

```tsx
import type { ActivityDay } from '../../types/admin';
import { formatWeekday } from '../../lib/adminFormat';

type ActivityBarsProps = {
  days: ActivityDay[];
};

export default function ActivityBars({ days }: ActivityBarsProps) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;

  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-caption-uppercase uppercase text-muted">Learning Rhythm</p>
          <h2 className="mt-1 text-title-md text-ink">Last 7 days</h2>
        </div>
        <span className="font-mono text-code-sm text-muted">
          {activeDays}/{days.length} active days · {total} actions
        </span>
      </div>

      <div className="mt-6 flex h-40 items-stretch gap-3">
        {days.map((day, index) => {
          const isToday = index === days.length - 1;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-code-sm text-muted">{day.count}</span>
              <div className="flex w-full flex-1 items-end rounded-md bg-hairline-soft">
                <div
                  className={`w-full rounded-md ${isToday ? 'bg-success' : 'bg-ink/70'}`}
                  style={{ height: `${(day.count / max) * 100}%` }}
                />
              </div>
              <span className="text-caption-uppercase uppercase text-muted">
                {isToday ? 'Today' : formatWeekday(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Tạo `AiAccessCard`**

Create `frontend/src/components/admin/AiAccessCard.tsx`:

```tsx
import { Sparkles } from 'lucide-react';

type AiAccessCardProps = {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
};

export default function AiAccessCard({ enabled, disabled = false, onChange }: AiAccessCardProps) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-6">
      <p className="flex items-center gap-2 text-caption-uppercase uppercase text-muted">
        <Sparkles size={14} />
        AI Access
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-title-md text-ink">Enable AI quiz generation</h2>
          <p className="mt-1 text-body-sm text-body">
            Lets this user create quizzes with AI question types (fill in the blank, word in context).
            Turning it off does not cancel quizzes that are already being generated.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable AI quiz generation"
          disabled={disabled}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            enabled ? 'bg-success' : 'bg-hairline-strong'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Tạo `RateLimitCard`**

Create `frontend/src/components/admin/RateLimitCard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { AiUsage } from '../../types/admin';
import { formatResetsIn } from '../../lib/adminFormat';
import { MAX_AI_DAILY_LIMIT, isValidLimit } from '../../lib/adminDraft';

const PRESETS = [5, 10, 20, 50];

type RateLimitCardProps = {
  usage: AiUsage;
  value: number | null;
  systemDefault: number;
  aiEnabled: boolean;
  onChange: (value: number | null) => void;
};

function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-body-sm transition-colors ${
    active ? 'border-primary bg-primary-fixed font-semibold text-ink' : 'border-hairline text-body hover:text-ink'
  }`;
}

export default function RateLimitCard({ usage, value, systemDefault, aiEnabled, onChange }: RateLimitCardProps) {
  const [customText, setCustomText] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setCustomText(value === null ? '' : String(value));
  }, [value]);

  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 100;
  const resetsIn = formatResetsIn(usage.resets_at);
  const customInvalid = customText !== '' && !isValidLimit(customText);

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    if (isValidLimit(text)) onChange(Number(text));
  };

  return (
    <section className={`rounded-2xl border border-hairline bg-surface-card p-6 ${aiEnabled ? '' : 'opacity-60'}`}>
      <p className="text-caption-uppercase uppercase text-muted">Rate Limit</p>
      <h2 className="mt-1 text-title-md text-ink">AI quizzes per rolling 24 hours</h2>

      <div className="mt-5 rounded-xl border border-hairline-soft bg-canvas-soft p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-title-sm text-ink">
            {usage.used} / {usage.limit} used ({percent}%)
          </p>
          {resetsIn && <p className="font-mono text-code-sm text-muted">{resetsIn}</p>}
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-hairline-soft">
          <div
            className={`h-1.5 rounded-full ${percent >= 100 ? 'bg-error' : 'bg-ink'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-body-sm text-muted">Usage reflects the saved limit.</p>
      </div>

      <p className="mt-6 text-caption-uppercase uppercase text-muted">Daily limit</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => onChange(preset)} className={pillClass(value === preset)}>
            {preset} / day
          </button>
        ))}
        <label className="flex items-center gap-2 text-body-sm text-body">
          Custom
          <input
            type="number"
            min={0}
            max={MAX_AI_DAILY_LIMIT}
            inputMode="numeric"
            value={customText}
            onChange={(event) => handleCustomChange(event.target.value)}
            className="h-9 w-24 rounded-lg border border-hairline-strong bg-white px-3 font-mono text-code-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
        <button type="button" onClick={() => onChange(null)} className={pillClass(value === null)}>
          Use system default ({systemDefault})
        </button>
      </div>
      {customInvalid && (
        <p className="mt-2 text-body-sm text-error">Enter a whole number from 0 to {MAX_AI_DAILY_LIMIT}.</p>
      )}
      <p className="mt-3 text-body-sm text-muted">A limit of 0 blocks new AI quizzes while keeping AI access on.</p>
    </section>
  );
}
```

- [ ] **Step 5: Tạo `RecentAiQuizzes`**

Create `frontend/src/components/admin/RecentAiQuizzes.tsx`:

```tsx
import type { RecentAiQuiz } from '../../types/admin';
import { formatDateTime } from '../../lib/adminFormat';

type RecentAiQuizzesProps = {
  quizzes: RecentAiQuiz[];
};

const STATUS_CLASS: Record<RecentAiQuiz['status'], string> = {
  ready: 'border-success/30 bg-learned-surface text-success',
  pending: 'border-hairline bg-canvas-soft text-body',
  failed: 'border-error/30 bg-white text-error',
};

export default function RecentAiQuizzes({ quizzes }: RecentAiQuizzesProps) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-6">
      <p className="text-caption-uppercase uppercase text-muted">Recent AI Activity</p>
      <h2 className="mt-1 text-title-md text-ink">Latest AI-generated quizzes</h2>

      {quizzes.length === 0 ? (
        <p className="mt-4 text-body-sm text-muted">No AI quizzes yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b border-hairline">
              <tr>
                {['Created', 'Title', 'Status', 'AI questions'].map((header) => (
                  <th key={header} className="py-2 pr-4 text-caption-uppercase uppercase text-muted">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz.id} className="border-b border-hairline-soft last:border-0">
                  <td className="py-3 pr-4 font-mono text-code-sm text-body">{formatDateTime(quiz.created_at)}</td>
                  <td className="py-3 pr-4 text-body-sm text-ink">{quiz.title}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-caption-uppercase uppercase ${STATUS_CLASS[quiz.status]}`}
                    >
                      {quiz.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-code-sm text-body">
                    {quiz.ai_question_count} / {quiz.requested_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Viết trang chi tiết**

Thay toàn bộ `frontend/src/pages/AdminUserDetailPage.tsx` bằng:

```tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, CircleCheck, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import AdminKpiCard from '../components/admin/AdminKpiCard';
import ActivityBars from '../components/admin/ActivityBars';
import AiAccessCard from '../components/admin/AiAccessCard';
import RateLimitCard from '../components/admin/RateLimitCard';
import RecentAiQuizzes from '../components/admin/RecentAiQuizzes';
import { getAdminUser, updateAdminUser } from '../api/admin';
import { apiErrorMessage } from '../api/errors';
import { buildAdminUpdate, draftFromDetail, hasChanges, type AdminUserDraft } from '../lib/adminDraft';
import { formatDate, formatDateTime, formatPercent, plural } from '../lib/adminFormat';
import type { UserRole } from '../types';
import type { AdminUserDetail } from '../types/admin';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [draft, setDraft] = useState<AdminUserDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(null);
    getAdminUser(id)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setDraft(draftFromDetail(data));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load this user.'));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const backToList = () => {
    const from = (location.state as { from?: string } | null)?.from ?? '';
    navigate(`/admin/users${from}`);
  };

  const handleSave = async () => {
    if (!detail || !draft) return;
    const body = buildAdminUpdate(draftFromDetail(detail), draft);
    if (Object.keys(body).length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const next = await updateAdminUser(detail.id, body);
      setDetail(next);
      setDraft(draftFromDetail(next));
      setToast('User settings saved');
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save changes.'));
    } finally {
      setSaving(false);
    }
  };

  const shell = (content: React.ReactNode) => (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />
      <main className="page-container">{content}</main>
    </div>
  );

  if (loadError) {
    return shell(
      <div role="alert" className="rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
        {loadError}
      </div>,
    );
  }

  if (!detail || !draft) {
    return shell(<div className="empty-state">Loading user…</div>);
  }

  const dirty = hasChanges(draftFromDetail(detail), draft);
  const isSelf = user?.id === detail.id;
  const roleLocked = detail.is_config_admin || isSelf;
  const roleLockReason = detail.is_config_admin
    ? 'Managed by ADMIN_EMAILS'
    : isSelf
      ? 'You cannot change your own role'
      : undefined;
  const learnedPercent = detail.card_count > 0 ? detail.learned_cards / detail.card_count : null;

  return (
    <>
      {shell(
        <>
          <nav className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 text-body transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} />
              Back to Users
            </button>
            <span>/</span>
            <span className="text-caption-uppercase uppercase">Administration</span>
            <span>/</span>
            <span className="text-caption-uppercase uppercase">User Management</span>
          </nav>

          <section className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-headline-lg text-ink">{detail.display_name}</h1>
                <select
                  value={draft.role}
                  disabled={roleLocked || saving}
                  title={roleLockReason}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}
                  className="h-9 rounded-lg border border-hairline-strong bg-white px-3 text-body-sm text-ink disabled:cursor-not-allowed disabled:bg-canvas-soft disabled:text-muted"
                >
                  <option value="user">Role: User</option>
                  <option value="admin">Role: Admin</option>
                </select>
                {detail.is_config_admin && (
                  <span className="rounded-full border border-hairline px-2.5 py-0.5 text-caption-uppercase uppercase text-muted">
                    Managed by config
                  </span>
                )}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-body">
                <Mail size={14} />
                {detail.email}
                <span className="text-muted">•</span>
                <CalendarDays size={14} />
                Joined {formatDate(detail.created_at)}
              </p>
            </div>
            <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={handleSave}>
              <Check size={16} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </section>

          {saveError && (
            <div role="alert" className="mt-4 rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
              {saveError}
            </div>
          )}

          <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AdminKpiCard label="Study Sessions" value={plural(detail.session_count, 'session')} caption="created" />
            <AdminKpiCard
              label="Flashcards"
              value={plural(detail.card_count, 'card')}
              caption={`${detail.learned_cards} learned (${formatPercent(learnedPercent)})`}
            />
            <AdminKpiCard
              label="Quizzes Taken"
              value={String(detail.quizzes_taken)}
              caption={`${formatPercent(detail.avg_accuracy)} avg accuracy`}
            />
            <AdminKpiCard
              label="Last Active"
              value={detail.last_active_at ? formatDate(detail.last_active_at) : 'Never'}
              caption={detail.last_active_at ? formatDateTime(detail.last_active_at) : 'no activity yet'}
            />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ActivityBars days={detail.activity_7d} />
            <AiAccessCard
              enabled={draft.ai_enabled}
              disabled={saving}
              onChange={(enabled) => setDraft({ ...draft, ai_enabled: enabled })}
            />
          </div>

          <div className="mt-6">
            <RateLimitCard
              usage={detail.ai_usage}
              value={draft.ai_daily_limit}
              systemDefault={detail.ai_system_default_limit}
              aiEnabled={draft.ai_enabled}
              onChange={(limit) => setDraft({ ...draft, ai_daily_limit: limit })}
            />
          </div>

          <div className="mt-6">
            <RecentAiQuizzes quizzes={detail.recent_ai_quizzes} />
          </div>
        </>,
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-3 text-body-sm text-ink shadow-lg"
        >
          <CircleCheck size={16} className="text-success" />
          {toast}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 7: Build**

Run (trong `frontend/`): `npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/adminDraft.ts frontend/src/components/admin/ActivityBars.tsx frontend/src/components/admin/AiAccessCard.tsx frontend/src/components/admin/RateLimitCard.tsx frontend/src/components/admin/RecentAiQuizzes.tsx frontend/src/pages/AdminUserDetailPage.tsx
git commit -m "feat(admin-ui): add user detail page with AI access and rate limit controls" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Tài liệu cấu hình và kiểm tra cuối

**Files:**
- Modify: `.env.example`
- Modify: `backend/.env.example`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: toàn bộ task trước.
- Produces: tài liệu cho `ADMIN_EMAILS` và `AI_DAILY_QUIZ_LIMIT`.

- [ ] **Step 1: Cập nhật `.env.example` ở gốc repo**

Trong `.env.example`, thêm ngay sau dòng `JWT_EXPIRE_MINUTES=1440`:

```
# Comma-separated emails that are always admins (promoted on register/login)
ADMIN_EMAILS=
```

và thêm ngay sau dòng `AI_MODEL=gpt-4o-mini`:

```
# Default AI quizzes per user per rolling 24h; admins can override per user
AI_DAILY_QUIZ_LIMIT=20
```

- [ ] **Step 2: Cập nhật `backend/.env.example`**

Append vào cuối `backend/.env.example`:

```
ADMIN_EMAILS=
AI_DAILY_QUIZ_LIMIT=20
```

- [ ] **Step 3: Cập nhật `DEPLOYMENT.md`**

Trong `DEPLOYMENT.md`, chèn ngay trước dòng `## Architecture`:

```markdown
## Admin Access

Admins manage users at `/admin/users` (open the user menu → **User Management**).

1. Set `ADMIN_EMAILS` in `.env` to a comma-separated list, e.g. `ADMIN_EMAILS=you@example.com`.
2. Restart the backend and register or log in with that email — the account becomes an admin.
3. Apply the database migration if the container does not run it automatically:
   `docker compose -f docker-compose.prod.yml exec backend alembic upgrade head`

Admins listed in `ADMIN_EMAILS` cannot be demoted from the UI. `AI_DAILY_QUIZ_LIMIT`
is the default number of AI quizzes per user per rolling 24 hours; admins can
override it or disable AI for individual users.

```

- [ ] **Step 4: Toàn bộ unit test backend**

Run (trong `backend/`): `.venv/Scripts/python.exe -m pytest tests -q`
Expected: tất cả PASS (79 test cũ + test mới của Task 2–5).

- [ ] **Step 5: Build frontend**

Run (trong `frontend/`): `npm run build`
Expected: build thành công.

- [ ] **Step 6: Chạy tay end-to-end (cần Postgres đang chạy)**

1. Trong `backend/.env` đặt `ADMIN_EMAILS=<email của bạn>`.
2. `cd backend` → `.venv/Scripts/alembic.exe upgrade head` → `.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`.
3. `cd frontend` → `npm run dev`, đăng nhập bằng email admin.
4. Kiểm lần lượt:
   - User menu có "User Management"; `/admin/users` hiện KPI, bảng, lọc Role/AI, search, phân trang.
   - Mở một user thường → tắt AI → Save → toast "User settings saved"; danh sách hiện "Disabled".
   - Đăng nhập user đó (cửa sổ ẩn danh) → modal tạo quiz không còn dạng "Fill in the blank" / "Choose the word in context".
   - Bật lại AI, đặt limit Custom = 1 → user tạo 1 quiz AI được, quiz AI thứ 2 báo "You have used all 1 AI quiz generations in the last 24 hours".
   - "Use system default (N)" → Save → danh sách hiện "(default)".
   - Trên trang của chính admin: select Role bị khóa, tooltip "Managed by ADMIN_EMAILS".
   - Truy cập `/admin/users` bằng user thường → bị chuyển về `/`.

- [ ] **Step 7: Commit**

```bash
git add .env.example backend/.env.example DEPLOYMENT.md
git commit -m "docs(admin): document ADMIN_EMAILS and per-user AI limits" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Spec Coverage

| Spec | Task |
|---|---|
| §4 `users.role`, `user_ai_policies`, migration, `ADMIN_EMAILS` config | 1 |
| §5 service `ai_policy` | 2 |
| §5 bootstrap admin, §6.1 `UserOut.role`, `require_admin` | 3 |
| §6.2 quiz create/retry/ai-status dùng policy | 4 |
| §7 schema admin, `activity_7d`, `last_active_at` | 5 |
| §7.1–7.4 admin API, quy tắc đổi role | 6 |
| §8.1 type, API client, `AdminRoute`, `UserMenu`, modal, retry error | 7 |
| §8.2 trang danh sách | 8 |
| §8.3 trang chi tiết | 9 |
| §4 `.env.example`, §10 `DEPLOYMENT.md`, §9.4 kiểm tay | 10 |
| §9 unit test (cập nhật: chỉ unit) | 2, 3, 4, 5 |

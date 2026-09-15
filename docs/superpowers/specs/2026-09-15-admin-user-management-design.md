# Thiết kế: User Management cho admin — role, quyền dùng AI và hạn mức theo user

Ngày: 2026-09-15

Mockup tham chiếu: `frontend/docs/admin/user_list.html`, `frontend/docs/admin/user_detail.html`
(design system: `frontend/docs/admin/DESIGN_user_list.md`).

## 1. Mục tiêu

Thêm vai trò `admin` và một khu vực quản trị để admin:

1. Xem danh sách người dùng cùng số liệu học tập cơ bản.
2. Đổi role của một người dùng (`user` ↔ `admin`).
3. Bật/tắt quyền dùng AI của từng người dùng.
4. Đặt hạn mức AI riêng (số quiz AI trong 24 giờ trượt) cho từng người dùng, hoặc
   để họ dùng mặc định hệ thống.

## 2. Phạm vi

Trong phạm vi:

- Cột `role` trên `users`; bootstrap admin qua biến môi trường `ADMIN_EMAILS`.
- Bảng mới `user_ai_policies` (1-1 với `users`).
- Áp policy vào luồng AI hiện có: `POST /quizzes`, `POST /quizzes/{id}/retry`,
  `GET /quizzes/ai-status`.
- Admin API `/admin/*`.
- Hai trang frontend: danh sách user và chi tiết user, theo mockup đã cắt gọn.

Ngoài phạm vi (có trong mockup nhưng **không làm**):

| Khối trong mockup | Lý do bỏ |
|---|---|
| Role "Pro", nâng cấp gói | Chưa có khái niệm gói trả phí. |
| Invite user, Export CSV | Không phục vụ mục tiêu quản lý AI. |
| Khóa / suspend tài khoản, cột Status, bộ lọc Status | Đã quyết định không làm ở bản này. |
| Reset password | Cần luồng email, ngoài phạm vi. |
| Feature-level AI scopes (example sentences, synonyms, voice tutor) | App chỉ có một tính năng AI là sinh quiz. |
| Max tokens/call, burst req/min, monthly soft cap | Không có dữ liệu token; hạn mức 24h đủ kiểm soát chi phí. |
| Policy khi hết quota (throttle, email coupon) | Luôn hard block bằng 429 như hiện tại. |
| Telemetry tokens/latency, audit log | Không có bảng log lượt gọi; thay bằng danh sách quiz AI gần đây. |
| Deck storage, timezone, nickname, mức "Unlimited" | YAGNI. |

## 3. Quyết định thiết kế và lý do

| Quyết định | Lý do |
|---|---|
| `role` nằm trên `users`, cấu hình AI nằm ở bảng riêng `user_ai_policies` | Role là thuộc tính tài khoản; policy AI là cấu hình vận hành có thể mở rộng thêm loại quota về sau mà không phình bảng `users`. |
| Thiếu dòng policy ⟹ dùng mặc định | Migration không cần backfill, user mới đăng ký không phải tạo dòng. Chỉ upsert khi admin lưu. |
| Mọi chỗ đọc policy đi qua `ai_policy.get_policy()` | Trường hợp "chưa có dòng" chỉ được xử lý ở một nơi. |
| Đơn vị hạn mức = số quiz `uses_ai=True` trong 24 giờ trượt | Giữ nguyên cơ chế đang chạy (`_count_ai_quizzes_today`), chỉ thay hằng số chung bằng giá trị theo user. Không cần bảng log. |
| `daily_limit = NULL` nghĩa là theo `AI_DAILY_QUIZ_LIMIT` | Đổi mặc định trong `.env` thì áp cho mọi user chưa bị đặt riêng. |
| Giữ `ai_enabled` tách khỏi `daily_limit` | Admin tắt tạm mà không mất con số limit đã cấu hình. |
| Bootstrap admin qua `ADMIN_EMAILS` | Hợp với docker compose đang đọc `.env`, không cần vào shell. |
| Admin trong `ADMIN_EMAILS` không hạ quyền được qua UI | Nếu cho hạ, lần login sau họ lại thành admin — hành vi khó hiểu. |
| Tắt AI không hủy quiz đang `pending` | Lượt gọi đã tốn; chỉ chặn lần tạo/retry tiếp theo. |

## 4. Mô hình dữ liệu

Một migration Alembic: `20260915_add_roles_and_ai_policies.py`.

Bảng `users` — thêm:

```
role  String(20)  NOT NULL  server_default 'user'   -- user | admin
```

Bảng mới `user_ai_policies`:

```
user_id      String(36)  PK, FK users.id ON DELETE CASCADE
ai_enabled   Boolean     NOT NULL default true
daily_limit  Integer     nullable        -- NULL = AI_DAILY_QUIZ_LIMIT; nếu có thì 0..1000
updated_at   DateTime(tz) NOT NULL
updated_by   String(36)  FK users.id ON DELETE SET NULL, nullable
```

Model: `app/models/ai_policy.py` với class `UserAiPolicy`. Không thêm relationship
lên `User` để tránh lazy-load ngoài ý muốn trong async; truy cập qua service.

Config mới trong `app/config.py`:

```
ADMIN_EMAILS: str = ""   # phân tách bằng dấu phẩy, so khớp không phân biệt hoa thường, bỏ khoảng trắng
```

Thêm `ADMIN_EMAILS` vào `.env.example` (gốc repo) và `backend/.env.example`, kèm chú
thích; docker compose đã đọc `.env` nên không phải sửa file compose.

## 5. Service `app/services/ai_policy.py`

Thuần logic, không phụ thuộc router:

```python
@dataclass(frozen=True)
class EffectivePolicy:
    enabled: bool
    limit: int
    is_custom: bool          # True nếu daily_limit khác NULL

@dataclass(frozen=True)
class AiUsage:
    used: int
    limit: int
    resets_at: datetime | None   # created_at của quiz AI cũ nhất trong cửa sổ + 24h; None nếu used == 0

async def get_policy(db, user_id) -> EffectivePolicy
async def count_ai_quizzes_24h(db, user_id) -> int      # chuyển từ quizzes.py
async def get_usage(db, user_id) -> AiUsage
async def enforce_can_create(db, user_id) -> None       # 403 nếu tắt, 429 nếu used >= limit
async def enforce_enabled(db, user_id) -> None          # 403 nếu tắt (dùng cho retry)
async def upsert_policy(db, user_id, *, ai_enabled, daily_limit, set_limit, updated_by) -> None
```

`upsert_policy` phân biệt "không gửi `ai_daily_limit`" với "gửi `null`" qua cờ
`set_limit` (router dùng `model_fields_set` của Pydantic).

Thông báo lỗi (tiếng Anh, khớp UI đã localize):

- 403: `"AI features are disabled for your account"`
- 429: `"You have used all {limit} AI quiz generations in the last 24 hours"`

Service `app/services/admin_bootstrap.py` (hoặc hàm trong `services/auth.py`):

```python
def is_config_admin(email: str) -> bool
async def sync_config_admin(db, user) -> None   # nếu email thuộc ADMIN_EMAILS và role != 'admin' thì nâng + commit
```

Gọi trong `register_user` và `login_user` trước khi trả `AuthResponse`.

## 6. Thay đổi luồng hiện có

### 6.1 Auth

- `UserOut` thêm `role: Literal['user', 'admin']`.
- `app/deps.py` thêm:

```python
async def require_admin(current_user = Depends(get_current_user)) -> User:
    # 403 "Admin access required" nếu role != 'admin'
```

### 6.2 Quiz

- `POST /quizzes`: khi có dạng AI, thay `_enforce_daily_ai_limit` bằng
  `ai_policy.enforce_can_create`. Thứ tự kiểm tra: `ai_available()` (400) →
  policy (403/429). Quiz chỉ dạng thuật toán **không** đọc policy.
- `POST /quizzes/{id}/retry`: gọi `ai_policy.enforce_enabled` sau các kiểm tra
  hiện có. Retry vẫn không tính thêm lượt (giữ spec AI 2026-09-14).
- `GET /quizzes/ai-status`: `AiStatusOut` thành

```
available: bool          # server có AI_API_KEY
enabled_for_user: bool   # policy của user
daily_limit: int         # limit hiệu lực của user
used_today: int
```

- Xóa `_count_ai_quizzes_today` và `_enforce_daily_ai_limit` khỏi `quizzes.py`
  (chuyển sang service).

## 7. Admin API

Router mới `app/routers/admin.py`, mount `prefix="/admin"`, mọi route
`Depends(require_admin)`. Schema trong `app/schemas/admin.py`.

### 7.1 `GET /admin/overview`

```
{ total_users, active_users_7d, total_cards, ai_quizzes_24h }
```

- `active_users_7d`: số user phân biệt có `CardLearnEvent.occurred_at` hoặc
  `QuizAttempt.submitted_at` trong 7 ngày qua (card → session → user).
- `ai_quizzes_24h`: tổng quiz `uses_ai=True` tạo trong 24 giờ qua, toàn hệ thống.

### 7.2 `GET /admin/users`

Query: `search` (khớp `email` hoặc `display_name`, ILIKE), `role` (`user|admin`),
`ai` (`enabled|disabled`), `page` (≥1, mặc định 1), `page_size` (1–100, mặc định 20).
Sắp xếp `created_at DESC`.

```
{ items: [AdminUserRow], total, page, page_size }

AdminUserRow:
  id, email, display_name, role, created_at
  is_config_admin: bool
  session_count, card_count
  quizzes_taken            # QuizAttempt có submitted_at
  avg_accuracy: float|null # trung bình score/total_questions của attempt đã nộp, 0..1
  ai_enabled: bool         # hiệu lực (thiếu dòng = true)
  ai_daily_limit: int      # hiệu lực
  ai_limit_is_custom: bool
  ai_used_24h: int
```

Một query chính với các subquery tổng hợp (`GROUP BY user_id`) và
`LEFT JOIN user_ai_policies`; lọc `ai=disabled` ⟺ `user_ai_policies.ai_enabled IS FALSE`.
Không có N+1.

### 7.3 `GET /admin/users/{id}`

```
AdminUserDetail = AdminUserRow + {
  learned_cards: int
  last_active_at: datetime|null
  activity_7d: [{ date: 'YYYY-MM-DD', count: int }]   # đúng 7 phần tử, cũ → mới, ngày UTC,
                                                      # count = learn events + quiz answers
  ai_usage: { used, limit, resets_at|null }
  recent_ai_quizzes: [{ id, title, created_at, status, ai_question_count, requested_count }]  # tối đa 10, mới nhất trước
}
```

404 nếu không có user.

### 7.4 `PATCH /admin/users/{id}`

```
body (mọi trường tùy chọn):
  role?: 'user' | 'admin'
  ai_enabled?: bool
  ai_daily_limit?: int | null     # null = về mặc định hệ thống; int phải 0..1000 (422)
-> AdminUserDetail
```

Quy tắc khi đổi `role` sang `user` — trả 400 nếu:

1. Người bị đổi là chính admin đang gọi: `"You cannot change your own role"`.
2. Email thuộc `ADMIN_EMAILS`: `"This admin is managed by ADMIN_EMAILS"`.
3. Đó là admin cuối cùng: `"At least one admin is required"`.

Chỉ tạo/cập nhật dòng `user_ai_policies` khi body có `ai_enabled` hoặc
`ai_daily_limit`. Toàn bộ thay đổi trong một transaction.

## 8. Frontend

### 8.1 Nền tảng

- `types/index.ts`: `User.role`; `AiStatus` thêm `enabled_for_user`; các type
  `AdminOverview`, `AdminUserRow`, `AdminUserList`, `AdminUserDetail`, `AdminUserUpdate`.
- `api/admin.ts`: `getOverview`, `listUsers(params)`, `getUser(id)`, `updateUser(id, body)`
  dùng instance `api` sẵn có.
- `App.tsx`: `AdminRoute` (bọc trong `ProtectedRoute`; `user.role !== 'admin'` ⟹
  `<Navigate to="/" />`); route `/admin/users` và `/admin/users/:id`.
- `UserMenu.tsx`: mục "User Management" chỉ hiện khi `user.role === 'admin'`.
- `QuizCreateModal.tsx`: điều kiện hiện dạng AI thành
  `aiStatus?.available && aiStatus.enabled_for_user`.
- Thẻ quiz `failed`: nút "Try again" nhận 403/429 thì hiện `detail` từ backend.

### 8.2 `AdminUsersPage` — `/admin/users`

Theo `user_list.html`:

- Breadcrumb "Administration / Directory", tiêu đề "User Management", mô tả ngắn.
- 4 thẻ KPI: Total Users, Active Learners (7 ngày), Total Vocab Cards,
  AI Quizzes (24h). Bỏ chỉ số % tăng trưởng/benchmark.
- Toolbar: ô search (debounce 300ms), select Role (All/Admin/User), select AI
  (All/Enabled/Disabled), nút reset.
- Bảng: User (avatar chữ cái đầu + tên + email), Role (pill), Joined, Sessions &
  Cards, Quizzes & Accuracy, AI Access & Limit (`Enabled · 12 / 20 today` hoặc
  `Disabled`), nút edit ⟹ trang chi tiết. Click cả dòng cũng mở chi tiết.
- Phân trang server: "Showing X to Y of Z users", Previous/Next và số trang.
- Trạng thái loading (skeleton dòng), empty ("No users match these filters"), lỗi.
- Filter/page lưu trong query string để back từ trang chi tiết giữ nguyên.

### 8.3 `AdminUserDetailPage` — `/admin/users/:id`

Theo `user_detail.html`:

- Header: "Back to Users", breadcrumb, tên, email, ngày tham gia, select Role
  (disabled kèm tooltip khi `is_config_admin` hoặc là chính mình), nút
  **Save Changes** (primary, disabled khi không có thay đổi).
- **Core Platform Activity**: 4 ô — Study Sessions, Flashcards (kèm learned %),
  Quizzes Taken (kèm avg accuracy), Last Active.
- **Learning Rhythm**: biểu đồ cột 7 ngày từ `activity_7d` (CSS thuần, không thêm
  thư viện).
- **AI Access**: một toggle "Enable AI quiz generation" + mô tả.
- **Rate Limit**: thanh `used / limit` (%), "Resets in Xh Ym" khi có `resets_at`;
  preset pills 5 / 10 / 20 / 50; ô Custom (0–1000); nút
  "Use system default (N)" đặt về `null`. Khối mờ đi khi AI đang tắt nhưng vẫn sửa được.
- **Recent AI Quizzes**: bảng Created, Title, Status (pill), AI questions
  (`ai_question_count / requested_count`); empty state khi chưa có.
- Save gửi PATCH chỉ các trường đã đổi; thành công ⟹ cập nhật state từ response +
  toast "User settings saved"; lỗi 400/422 ⟹ hiện `detail` inline.

Component con đặt trong `frontend/src/components/admin/`
(`AdminKpiCard`, `UserTable`, `ActivityBars`, `AiAccessCard`, `RateLimitCard`,
`RecentAiQuizzes`). Dùng các token Tailwind editorial đã có trong
`tailwind.config.js`; chỉ bổ sung token nếu mockup dùng mà config chưa có.

## 9. Kiểm thử

Theo TDD.

### 9.1 Hạ tầng test API (mới)

Backend hiện chỉ có unit test thuần. Thêm:

- `httpx` vào `backend/requirements.txt`.
- `backend/tests/conftest.py`: engine `sqlite+aiosqlite:///:memory:` (StaticPool),
  `Base.metadata.create_all`, override `get_db`, patch `AsyncSessionLocal` dùng
  trong background task, `httpx.AsyncClient(transport=ASGITransport(app))`,
  fixture `make_user(role=..., email=...)` trả `(user, headers)`, fixture
  `settings` override `ADMIN_EMAILS` / `AI_API_KEY` / `AI_DAILY_QUIZ_LIMIT`, và
  provider giả thay `get_provider`.

### 9.2 Unit — `ai_policy`

- Không có dòng ⟹ `enabled=True`, `limit=AI_DAILY_QUIZ_LIMIT`, `is_custom=False`.
- `daily_limit=5` ⟹ `limit=5`, `is_custom=True`; `daily_limit=0` ⟹ `limit=0`.
- `get_usage`: không quiz ⟹ `resets_at=None`; có quiz ⟹ `resets_at` = quiz cũ nhất + 24h;
  quiz cũ hơn 24h không tính.
- `upsert_policy` phân biệt không gửi limit với gửi `null`.

### 9.3 API

- User thường gọi mọi route `/admin/*` ⟹ 403; không token ⟹ 401.
- Login với email trong `ADMIN_EMAILS` (khác hoa thường) ⟹ `role='admin'` trong response.
- PATCH tự hạ quyền ⟹ 400; hạ admin trong config ⟹ 400; hạ admin cuối ⟹ 400;
  hạ một admin khi còn admin khác ⟹ 200.
- PATCH `ai_daily_limit=7` lần đầu tạo dòng; PATCH `ai_daily_limit=null` ⟹
  `ai_limit_is_custom=false`; `1001` ⟹ 422.
- `GET /admin/users`: search, lọc role, lọc `ai=disabled`, phân trang
  (`total` đúng, `items` đúng trang), số liệu sessions/cards/quizzes/accuracy đúng.
- `GET /admin/users/{id}`: `activity_7d` đủ 7 phần tử; `recent_ai_quizzes` tối đa 10; 404.
- **Hồi quy:** user bị tắt AI tạo quiz chỉ dạng thuật toán ⟹ 200 `ready`.
- User bị tắt AI tạo quiz dạng AI ⟹ 403, không quiz nào được tạo.
- User có limit riêng 2: quiz AI thứ 3 trong 24h ⟹ 429; user khác không bị ảnh hưởng.
- Retry quiz `failed` khi AI đã bị tắt ⟹ 403.
- `ai-status` phản ánh `enabled_for_user` và `daily_limit` riêng.

### 9.4 Frontend

Không thêm framework test. Kiểm bằng `npm run build` (tsc + vite) và chạy tay:
admin thấy menu và hai trang; user thường vào `/admin/users` bị chuyển về `/`;
tắt AI cho một user ⟹ user đó không còn thấy dạng AI trong modal tạo quiz.

## 10. Rủi ro đã biết

| Rủi ro | Giảm thiểu |
|---|---|
| Quên cấu hình `ADMIN_EMAILS` ⟹ không ai vào được trang admin | Ghi rõ trong `DEPLOYMENT.md` và `.env.example`; không có admin thì app vẫn chạy bình thường. |
| JWT không mang role ⟹ mỗi request admin đọc lại user | Đã đọc user sẵn trong `get_current_user`; đổi role có hiệu lực ngay, không cần cấp lại token. |
| Query danh sách chậm khi user nhiều | Subquery tổng hợp + phân trang; quy mô hiện tại nhỏ. Tối ưu thêm khi thật sự cần. |
| Khác biệt SQLite (test) và Postgres (prod) ở ILIKE / date truncation | Dùng `func.lower(...).like(...)` và nhóm ngày trong Python cho `activity_7d` (chỉ 7 ngày của một user). |
| Admin tắt AI khi quiz đang `pending` | Chấp nhận; quiz hoàn tất bình thường, chỉ chặn lần sau. |

# Thiết kế: Đăng nhập bằng Google — xác thực phụ, tài khoản trong DB vẫn là chính

Ngày: 2026-09-16

## 1. Mục tiêu

Cho phép người dùng đăng nhập bằng tài khoản Google, với ba yêu cầu:

1. Tài khoản đăng nhập qua Google có `email_verified = true`.
2. Tài khoản cũ (đăng ký bằng mật khẩu) trùng email với tài khoản Google thì **tự
   động link** vào đúng user đó, không tạo user trùng, không mất dữ liệu học tập.
3. Email chưa có trong hệ thống thì tạo user mới với thông tin lấy từ Google.

## 2. Nguyên tắc chi phối: Google chỉ là lớp phụ

Đây là ràng buộc quan trọng nhất, mọi quyết định bên dưới đều phải phục vụ nó.

Google chỉ đóng vai trò **chứng minh danh tính một lần**. Nó không phải một hệ
thống auth song song:

- `id_token` / `access_token` của Google chỉ sống trong đúng bước callback, dùng
  để đọc ra `sub` + `email`, rồi **vứt đi**. Không lưu DB, không trả về frontend,
  không dùng để gọi bất kỳ API nào.
- Ngay sau khi xác định được user, quay về **flow cũ 100%**:
  `create_access_token(user.id)` → cùng một JWT HS256, cùng `JWT_EXPIRE_MINUTES`,
  cùng response `AuthResponse {user, token}`, cùng `setStoredToken`, cùng header
  `Bearer`, cùng `get_current_user`. Sau khi đăng nhập xong, không request nào
  phân biệt được user vào bằng Google hay bằng mật khẩu.
- DB là nguồn sự thật duy nhất: `role`, `ADMIN_EMAILS`, AI policy, sessions,
  cards, quizzes đều tra theo `users.id` như cũ.
- **Không thêm refresh token.** Hệ thống hiện không có cơ chế refresh nào
  (`services/auth.py` chỉ phát một access token hạn 1440 phút; `refreshUser()` ở
  frontend là gọi lại `/auth/me` chứ không làm mới token). Giữ nguyên.
- Google hỏng không được làm sập đăng nhập mật khẩu: chưa cấu hình client id,
  Google trả `email_verified=false`, state hết hạn — mọi lỗi chỉ dẫn về `/login`
  kèm thông báo.

## 3. Phạm vi

Trong phạm vi:

- Cột `email_verified` và `google_sub` trên `users`; `password_hash` thành nullable.
- Authorization Code flow phía backend: `/auth/google/login`, `/auth/google/callback`,
  `/auth/google/exchange`, `/auth/providers`.
- Logic link/tạo user và quy tắc chỉ link khi Google đã xác thực email.
- Frontend: nút "Continue with Google", trang `/auth/callback`, badge trong admin.

Ngoài phạm vi (**không làm**):

| Việc | Lý do |
|---|---|
| Gửi mail xác thực cho user đăng ký bằng mật khẩu | Là một feature riêng đủ lớn (token, SMTP, endpoint verify). User đăng ký bằng mật khẩu vẫn `email_verified=false`. |
| Dùng `email_verified` để chặn tính năng nào đó | Bản này chỉ lưu và hiển thị. Chặn khi chưa có đường verify cho user mật khẩu sẽ làm họ bị kẹt. |
| Refresh token, xoay token, thu hồi token | Flow hiện tại không có; thêm vào là đổi cả hệ thống auth. |
| Gỡ liên kết Google (unlink) | Chưa có nhu cầu. |
| Lưu `refresh_token` của Google, gọi Google API thay mặt user | Không tính năng nào cần. |
| Đăng nhập Google trên mobile / deep link | Chưa có app mobile. |
| Provider khác (Facebook, GitHub) | YAGNI. Cấu trúc hiện tại thêm sau được. |

## 4. Quyết định thiết kế và lý do

| Quyết định | Lý do |
|---|---|
| Authorization Code flow ở backend, không dùng Google Identity Services ở frontend | `client_secret` không bao giờ rời server; frontend không cần thêm thư viện Google nào. |
| Link theo `google_sub`, chỉ dùng email khi chưa có `sub` | Google cho phép đổi email của tài khoản, `sub` thì bất biến. Tra `sub` trước tránh tạo user trùng khi user đổi email bên Google. |
| Chỉ auto-link khi claim `email_verified` của Google là `true` | Nếu không, người tạo được tài khoản Google Workspace với email tùy ý có thể chiếm tài khoản sẵn có trong hệ thống. Đây là điểm bảo mật then chốt của tính năng. |
| Link xong **giữ nguyên** `password_hash` | User cũ vẫn đăng nhập được bằng cả hai cách; không bị khóa đột ngột nếu mất quyền truy cập Gmail. Giữ nguyên `user.id` nên sessions/cards/quizzes còn nguyên. |
| JWT không đi qua URL; dùng one-time code đổi lấy token | JWT trong query/fragment sẽ lọt vào browser history, log, header `Referer`. One-time code hạn 60 giây, dùng một lần thì lọt cũng vô hại. |
| `state` và one-time code lưu in-memory | Backend chạy **một** process uvicorn (`Dockerfile` không có `--workers`). Mất khi restart chỉ khiến user đăng nhập lại. Phải ghi chú trong code: chạy nhiều worker thì bắt buộc chuyển sang DB/Redis. |
| Đọc claims của `id_token` không verify chữ ký | Token lấy trực tiếp từ token endpoint của Google qua TLS trong cùng request, không qua trung gian — đúng khuyến nghị của Google cho server-side code flow. Tránh thêm phụ thuộc `google-auth`. |
| `GOOGLE_CLIENT_ID` rỗng ⟹ tính năng tắt | Theo đúng pattern AI hiện có: server chưa cấu hình thì endpoint trả 503 và frontend ẩn nút, app vẫn chạy bình thường. |
| Toàn bộ logic quyết định nằm trong hàm thuần | Repo chưa có hạ tầng test API; giữ router mỏng thì unit test phủ được phần quan trọng (xem mục 9). |

## 5. Mô hình dữ liệu

Một migration Alembic: `20260916_add_google_auth.py`
(`revision = "20260916_google"`, `down_revision = "20260915_admin"`).

Bảng `users` — thêm:

```
email_verified  Boolean      NOT NULL  server_default 'false'
google_sub      String(255)  UNIQUE    nullable        -- claim `sub` của Google
```

và sửa:

```
password_hash   String(255)  NOT NULL  ->  nullable
```

User cũ không cần backfill: `email_verified=false`, `google_sub=NULL` là đúng
trạng thái của họ.

**Lưu ý SQLite:** SQLite không hỗ trợ `ALTER COLUMN`, mà dev local đang dùng
`vocabflash.db`. Phần đổi `password_hash` phải viết trong
`op.batch_alter_table("users")` để chạy được trên cả SQLite lẫn Postgres.

Model `app/models/user.py` cập nhật tương ứng; `password_hash` thành
`Mapped[str | None]`.

Config mới trong `app/config.py`:

```
GOOGLE_CLIENT_ID: str = ""
GOOGLE_CLIENT_SECRET: str = ""
GOOGLE_REDIRECT_URI: str = ""      # phải khớp tuyệt đối với khai báo ở Google Console
FRONTEND_URL: str = "http://localhost:5173"
```

Thêm bốn biến này vào `.env.example` ở gốc repo (file mà docker compose đọc) và
`backend/.env.example` (chạy backend trực tiếp khi dev), kèm chú thích. Trong
`docker-compose.yml` và `docker-compose.prod.yml`, khai bốn biến ở service
`backend` theo đúng kiểu `${VAR:-}` đang dùng cho `ADMIN_EMAILS`.

`FRONTEND_URL` khác nhau theo môi trường: dev chạy Vite trực tiếp là
`http://localhost:5173`, chạy qua nginx trong compose là `http://localhost:3000`.

Thêm `httpx` vào `backend/requirements.txt` (hiện chỉ có gián tiếp qua `openai`,
không nên dựa vào phụ thuộc bắc cầu).

## 6. Service

### 6.1 `app/services/oauth_state.py` — hai kho tạm có TTL

```python
class TtlStore:
    """Kho key -> value hết hạn theo thời gian, dùng một lần.

    In-memory: chỉ đúng khi backend chạy một process. Chạy nhiều worker
    thì phải thay bằng bảng DB hoặc Redis.
    """
    def __init__(self, ttl_seconds: int, now: Callable[[], datetime] = ...): ...
    def issue(self, value: str) -> str:      # sinh token urlsafe, lưu, trả token
    def consume(self, token: str) -> str | None:  # trả value và xóa; None nếu sai/hết hạn
    def purge_expired(self) -> None:
```

Hai thể hiện: `state_store` (TTL 600s, value = `""` hoặc `next` path) và
`login_code_store` (TTL 60s, value = `user.id`).

Tham số `now` để test tiêm được đồng hồ giả, không phải `sleep`.

### 6.2 `app/services/google_auth.py` — logic thuần + gọi Google

```python
@dataclass(frozen=True)
class GoogleProfile:
    sub: str
    email: str            # đã lowercase, trim
    display_name: str     # `name` của Google; rỗng thì lấy phần trước @

class GoogleAuthError(Exception):
    """Mang theo mã lỗi để redirect: xem mục 7.5."""
    code: str

# --- Hàm thuần, unit test được ---
def is_configured() -> bool                       # GOOGLE_CLIENT_ID khác rỗng
def build_authorize_url(state: str) -> str        # scope "openid email profile"
def normalize_profile(claims: dict) -> GoogleProfile
    # raise GoogleAuthError("email_unverified") nếu claims["email_verified"] không phải true
    # raise GoogleAuthError("google_error") nếu thiếu sub hoặc email

def decide_link_action(by_sub: User | None, by_email: User | None) -> str
    # "login"  : by_sub có -> dùng luôn
    # "link"   : by_sub None, by_email có -> gắn google_sub vào user cũ
    # "create" : cả hai None -> tạo user mới

# --- Có I/O ---
async def exchange_code_for_claims(code: str) -> dict
    # POST https://oauth2.googleapis.com/token, đọc id_token, trả claims
    # lỗi mạng / Google trả lỗi -> GoogleAuthError("exchange_failed")

async def resolve_user(db, profile: GoogleProfile) -> User
    # thực thi quyết định của decide_link_action, commit, trả User
```

`resolve_user` chi tiết:

```
by_sub   = SELECT users WHERE google_sub = profile.sub
by_email = SELECT users WHERE lower(email) = profile.email

login  -> trả user, không sửa gì
link   -> user.google_sub = profile.sub
          user.email_verified = True
          GIỮ NGUYÊN password_hash, email, display_name, role, id
create -> User(email=profile.email,
               google_sub=profile.sub,
               email_verified=True,
               password_hash=None,
               display_name=profile.display_name,
               role=ADMIN_ROLE nếu is_config_admin(email) else USER_ROLE)
```

Sau đó router gọi `sync_config_admin(db, user)` y như `login_user` hiện tại, để
`ADMIN_EMAILS` vẫn có tác dụng với user vào bằng Google.

### 6.3 Sửa `app/services/auth.py` — chỗ dễ vỡ

`authenticate_user` hiện gọi `verify_password(password, user.password_hash)`.
Với user tạo bằng Google, `password_hash` là `NULL` và `passlib` sẽ ném lỗi
(500 thay vì 401). Sửa thành:

```python
if not user or not user.password_hash or not verify_password(password, user.password_hash):
    raise HTTPException(401, "Invalid credentials")
```

Giữ nguyên thông báo lỗi chung, không tiết lộ tài khoản đó tồn tại nhưng là
Google-only.

## 7. API

Tất cả nằm trong `app/routers/auth.py` (prefix `/auth` sẵn có).

### 7.1 `GET /auth/providers`

```
{ "google": true|false }     # = is_configured()
```

Không cần auth. Frontend dùng để ẩn/hiện nút.

### 7.2 `GET /auth/google/login`

Không phải AJAX — browser điều hướng thẳng tới đây.

- Chưa cấu hình ⟹ 302 về `{FRONTEND_URL}/auth/callback?error=google_disabled`.
- `state = state_store.issue("")` ⟹ 302 (`RedirectResponse`) sang
  `accounts.google.com/o/oauth2/v2/auth` với `client_id`, `redirect_uri`,
  `response_type=code`, `scope=openid email profile`, `state`,
  `prompt=select_account`.

### 7.3 `GET /auth/google/callback?code=&state=&error=`

Google gọi vào. Luôn trả về 302, không bao giờ trả JSON cho người dùng cuối.

```
Google trả error   -> ?error=google_error
state không hợp lệ -> ?error=invalid_state       (chống CSRF; consume một lần)
exchange thất bại  -> ?error=exchange_failed
email chưa verify  -> ?error=email_unverified
thành công         -> ?code=<one-time code>
```

Thành công: `resolve_user` → `sync_config_admin` →
`login_code_store.issue(user.id)` → 302 về `{FRONTEND_URL}/auth/callback?code=...`.

### 7.4 `POST /auth/google/exchange`

```
body: { "code": "<one-time code>" }
-> AuthResponse { user: UserOut, token: str }      # y hệt /auth/login
```

`login_code_store.consume(code)` trả `None` ⟹ 401 `"Invalid or expired code"`.
User không còn trong DB ⟹ 401. Ngược lại `create_access_token(user.id)`.

Code dùng một lần: gọi lại cùng code phải 401.

### 7.5 Bảng mã lỗi (frontend map sang thông báo tiếng Anh)

| Mã | Thông báo hiển thị |
|---|---|
| `google_disabled` | "Google sign-in is not available right now." |
| `invalid_state` | "Your sign-in session expired. Please try again." |
| `exchange_failed` | "Could not sign in with Google. Please try again." |
| `email_unverified` | "Your Google email is not verified." |
| `google_error` | "Google sign-in was cancelled or failed." |

### 7.6 Schema

- `UserOut` (`app/schemas/auth.py`) thêm `email_verified: bool`.
- `GoogleExchangeRequest`: `code: str`.
- `ProvidersOut`: `google: bool`.
- `AdminUserRow` (`app/schemas/admin.py`) thêm `email_verified: bool` và
  `has_google: bool` (= `google_sub IS NOT NULL`); `_user_row_query` và `_to_row`
  trong `app/routers/admin.py` cập nhật theo — hai cột này lấy thẳng từ `users`,
  không thêm join nào.

## 8. Frontend

- `types/index.ts`: `User` thêm `email_verified: boolean`.
  `types/admin.ts`: `AdminUserRow` thêm `email_verified`, `has_google`.
- `contexts/AuthContext.tsx`: thêm
  `loginWithGoogleCode(code: string): Promise<void>` — POST
  `/auth/google/exchange`, rồi `setStoredToken` + `setAuth` giống hệt `login`.
- `pages/AuthPage.tsx`: dưới form, một dải phân cách "or" và nút
  "Continue with Google" (icon từ `lucide-react` đang dùng). Bấm ⟹
  `window.location.assign(`${API_BASE_URL}/auth/google/login`)` — điều hướng thật,
  không phải `api.get`. Nút chỉ render khi `GET /auth/providers` trả `google: true`;
  trong lúc chờ thì chưa hiện. Nút này có ở cả tab Login và Register.
- **Trang mới** `pages/AuthCallbackPage.tsx`, route công khai `/auth/callback`
  trong `App.tsx` (ngoài `ProtectedRoute`):
  - có `?code` ⟹ gọi `loginWithGoogleCode` rồi `navigate('/', { replace: true })`;
  - có `?error` ⟹ `navigate('/login', { replace: true, state: { authError: <message> } })`;
  - trong lúc chạy hiện `<div className="app-shell center-block">Signing you in…</div>`
    theo đúng kiểu loading sẵn có.
  - Phải chống gọi hai lần (React 18 StrictMode chạy effect hai lần trong dev) —
    dùng một `useRef` cờ đã xử lý, nếu không lần thứ hai sẽ nuốt code và báo lỗi giả.
- `AuthPage` đọc `location.state?.authError` để hiện vào ô `.inline-error` sẵn có.
- Admin: `AdminUsersPage` và `AdminUserDetailPage` thêm badge `Verified` (khi
  `email_verified`) và `Google` (khi `has_google`) cạnh email, dùng style pill
  sẵn có của cột Role.

## 9. Kiểm thử

Theo TDD, và theo đúng tiền lệ đã chốt ở spec admin 2026-09-15: **chỉ unit test
logic thuần**, không dựng hạ tầng test API, không thêm `conftest.py`. Mọi lệnh
Python chạy qua `backend/.venv`.

`backend/tests/test_google_auth.py`:

- `normalize_profile`:
  - `email_verified=True` ⟹ trả profile, email đã lowercase và trim.
  - `email_verified=False` / thiếu hẳn / là chuỗi `"true"` ⟹ `GoogleAuthError("email_unverified")`.
  - thiếu `sub` hoặc `email` ⟹ `GoogleAuthError("google_error")`.
  - thiếu `name` ⟹ `display_name` là phần trước `@`.
- `decide_link_action`: ba nhánh `login` / `link` / `create`; có `by_sub` thì
  thắng kể cả khi `by_email` là user khác.
- `build_authorize_url`: chứa đủ `client_id`, `redirect_uri`, `state`,
  `scope=openid email profile`, `response_type=code`.
- `is_configured`: rỗng ⟹ False.

`backend/tests/test_oauth_state.py`:

- `issue` rồi `consume` ⟹ trả đúng value; `consume` lần hai ⟹ `None`.
- Quá TTL (tiêm đồng hồ giả) ⟹ `None`.
- Token sai/bịa ⟹ `None`.
- Hai lần `issue` không bao giờ trùng token.

`backend/tests/test_auth_service.py` (mới, hoặc bổ sung file sẵn có):

- `authenticate_user` với user có `password_hash=None` ⟹ 401, không ném
  exception của passlib.

Frontend: không thêm framework test. Kiểm bằng `npm run build` (tsc + vite) và
chạy tay theo mục 10.

## 10. Kiểm thử tay trước khi merge

1. Tạo OAuth Client ID (Web application) trong Google Cloud Console → APIs &
   Services → Credentials. Authorized redirect URI phải khớp **tuyệt đối** với
   `GOOGLE_REDIRECT_URI` (kể cả dấu `/` cuối), ví dụ chạy qua nginx:
   `http://localhost:3000/api/auth/google/callback`.
2. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
   `FRONTEND_URL` vào `.env`.
3. Kịch bản phải chạy đúng:
   - Email hoàn toàn mới ⟹ tạo user, vào thẳng dashboard, `/auth/me` có
     `email_verified: true`.
   - Email đã đăng ký bằng mật khẩu ⟹ vào **đúng** tài khoản cũ, sessions/cards
     còn nguyên, và **vẫn đăng nhập được bằng mật khẩu cũ** sau đó.
   - Đăng nhập Google lần hai ⟹ không tạo user trùng.
   - Bấm nút Back sau khi callback xong ⟹ báo lỗi hết hạn, không tạo session lạ.
   - Xóa `GOOGLE_CLIENT_ID` rồi khởi động lại ⟹ nút Google biến mất, đăng nhập
     mật khẩu vẫn bình thường.
   - Email trong `ADMIN_EMAILS` đăng nhập bằng Google ⟹ `role: admin`.

Bổ sung hướng dẫn cấu hình Google vào `DEPLOYMENT.md`.

## 11. Rủi ro đã biết

| Rủi ro | Giảm thiểu |
|---|---|
| Chiếm tài khoản qua email giả mạo | Chỉ link khi claim `email_verified` của Google là `true`; kiểm tra bằng `is True`, không dùng truthy (chuỗi `"false"` cũng là truthy). |
| `state`/code mất khi backend restart hoặc chạy nhiều worker | Hiện chỉ một process uvicorn. Ghi chú rõ trong docstring `TtlStore`; hệ quả nhẹ nhất là user đăng nhập lại. Chuyển sang DB/Redis khi scale. |
| `redirect_uri` lệch giữa dev/staging/prod ⟹ Google trả `redirect_uri_mismatch` | Đọc từ env, không hardcode; ghi rõ trong `DEPLOYMENT.md` là phải khai đủ URI cho từng môi trường. |
| `password_hash` nullable làm vỡ chỗ khác | Đã rà: chỉ `authenticate_user` đọc cột này (mục 6.3). `register_user` luôn set giá trị. |
| Migration `ALTER COLUMN` không chạy trên SQLite dev | Dùng `op.batch_alter_table`. |
| React StrictMode gọi exchange hai lần, lần hai 401 | Cờ `useRef` trong `AuthCallbackPage`. |
| User Google-only không đặt được mật khẩu, mất quyền Gmail là mất tài khoản | Chấp nhận ở bản này; luồng "đặt mật khẩu" cần email verification, đã nằm ngoài phạm vi. |
| Dùng email làm khóa link khi user đổi email bên Google | Tra `google_sub` trước nên lần sau vẫn nhận đúng user; chỉ lần đầu mới dựa vào email. |

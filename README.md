# VocabFlash

Webapp học từ vựng tiếng Anh bằng flashcard — hỗ trợ cả **vocab** (từ đơn, có phiên âm + từ đồng nghĩa) và **collocation** (cụm từ), kèm import hàng loạt từ file, thống kê tiến độ và hệ thống quiz trắc nghiệm tự sinh.

---

## Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc & tech stack](#kiến-trúc--tech-stack)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Chạy dự án](#chạy-dự-án)
- [Định dạng file import](#định-dạng-file-import)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Testing](#testing)
- [Biến môi trường](#biến-môi-trường)
- [Bản quyền](#bản-quyền)

---

## Tính năng

### 1. Tài khoản & xác thực

- Đăng ký / đăng nhập bằng email + mật khẩu (hash bằng **argon2** qua passlib).
- JWT lưu ở `localStorage`, tự động gắn vào header `Authorization: Bearer <token>` qua axios interceptor.
- `ProtectedRoute` chặn mọi trang khi chưa đăng nhập; `GET /auth/me` khôi phục phiên khi refresh.
- Menu người dùng (góc phải header) hiển thị tên đầy đủ + nút đăng xuất.

### 2. Sessions (bộ thẻ)

- Mỗi session là một bộ flashcard gom theo chủ đề hoặc ngày học.
- CRUD đầy đủ: tạo (qua modal), xem, đổi tên, xóa (cascade sang cards + synonyms).
- Dashboard hiển thị grid session kèm số thẻ, tiến độ `learned/total` và ngày tạo.

### 3. Cards & synonyms

- Hai loại thẻ:
  - `vocab` — có phiên âm IPA và danh sách từ đồng nghĩa (mỗi synonym có phiên âm riêng).
  - `collocation` — cụm từ, không cần phiên âm/synonym.
- Thêm / sửa / xóa thẻ trong trang Session Detail, form synonym động cho thẻ vocab.
- Toggle `is_learned` ngay trên thẻ với optimistic update (`PATCH /cards/:id/learned`).
- Mỗi lần đổi trạng thái học đều ghi một bản ghi bất biến vào bảng `card_learn_events` — đây là nguồn dữ liệu cho toàn bộ biểu đồ thống kê.

### 4. Chế độ học (Study mode)

Trang toàn màn hình tại `/sessions/:id/study`:

- **Lật thẻ 3D** bằng CSS `preserve-3d` + `rotateY`. Mặt trước: từ tiếng Anh + phiên âm. Mặt sau: nghĩa tiếng Việt, synonyms (hover để xem phiên âm), câu ví dụ.
- **Phát âm** qua Web Speech API, có tùy chọn lưu trong `localStorage`:
  - Giọng: **nam / nữ** (nhận diện qua danh sách hint tên voice).
  - Giọng vùng: **en-US / en-GB**.
  - Nếu không tìm được voice khớp cả hai, hệ thống fallback theo thứ tự ưu tiên *giữ accent → giữ gender → voice tiếng Anh bất kỳ* và hiện toast thông báo.
- **Bộ lọc**: `Tất cả` | `Chưa học` | `Đã học`.
- **Shuffle**: trộn ngẫu nhiên thứ tự thẻ (Fisher–Yates), bấm lại để trộn lại.
- **Tùy biến hiển thị** (menu *Show on card*): bật/tắt riêng `phonetic`, `synonyms`, `example`. Lưu trong `localStorage`.
- **Phím tắt**: `Space` lật thẻ, `←` / `→` chuyển thẻ.
- **Thanh tiến độ** `{learned}/{total}` cập nhật realtime.

### 5. Import hàng loạt

Modal import hỗ trợ `.xlsx` và `.csv`:

- Kéo-thả hoặc chọn file, preview 5 dòng đầu trước khi xác nhận.
- **Tải template CSV mẫu** (`GET /cards/template/download`) đã có sẵn ví dụ vocab và collocation.
- **Copy Prompt** — sinh sẵn một prompt tiếng Việt để nhờ AI tạo nội dung CSV đúng format. Prompt tự điều chỉnh theo lựa chọn của bạn: chỉ vocab, chỉ collocation, hoặc cả hai; có kèm synonyms hay không.
- Backend parse → validate → bulk insert cards + synonyms, trả về số thẻ đã import.
- Tự động suy ra `card_type`: có synonyms → `vocab`, không có → `collocation` (trừ khi cột `card_type` chỉ định rõ).

### 6. Dashboard thống kê

- **KPI tiles**: Total words, Learned, Mastery (%), Streak (ngày).
- **Daily learned words** — biểu đồ số từ học mới mỗi ngày, chuyển đổi khung **7 ngày / 30 ngày** (Chart.js).
- **Per-session progress** — biểu đồ tiến độ từng session, nhãn dài được rút gọn 25 ký tự kèm tooltip.
- **Streak** tính theo ngày liên tiếp có ít nhất một từ được học. Nếu hôm nay chưa học từ nào, streak tính lùi từ hôm qua để không bị "gãy" giữa ngày.
- Mọi truy vấn thống kê nhận `tz_offset_minutes` từ client nên ngày được gom theo **múi giờ local của người dùng**, không phải UTC.

### 7. Quiz trắc nghiệm

Hệ thống quiz tự sinh câu hỏi 4 đáp án từ chính bộ thẻ của bạn.

**Ba loại câu hỏi:**

| Loại | Đề bài | Đáp án |
|------|--------|--------|
| `en_to_vi` | Từ tiếng Anh (+ phiên âm) | Nghĩa tiếng Việt |
| `vi_to_en` | Nghĩa tiếng Việt | Từ tiếng Anh |
| `synonym` | Từ tiếng Anh (+ phiên âm) | Một từ đồng nghĩa của nó |

**Sinh câu hỏi** (`app/services/quiz_generator.py` — thuần hàm pure, không chạm DB):

- Cần tối thiểu **4 thẻ** trong pool (1 đáp án đúng + 3 distractor).
- `compute_capacity()` tính trước số câu tối đa mỗi loại có thể sinh, hiển thị ngay trong wizard tạo quiz.
- Distractor được chọn từ các thẻ khác, loại trừ (case-insensitive) đáp án đúng, `front_text` của thẻ hiện tại, và — với câu synonym — toàn bộ synonym còn lại của thẻ đó. Trùng lặp bị khử trước khi bốc ngẫu nhiên.
- Số câu được chia đều cho các loại đã chọn, phần dư phân bổ ngẫu nhiên trong giới hạn capacity.
- Thứ tự đáp án và thứ tự câu hỏi đều được shuffle.

**Wizard tạo quiz**: chọn nhiều session làm nguồn → chọn loại câu hỏi → hệ thống hiện capacity → chọn số câu (1–100) → đặt tên.

**Làm bài**:

- Phản hồi **ngay sau mỗi câu** — chọn xong là biết đúng/sai và đâu là đáp án đúng.
- Mỗi câu chỉ trả lời một lần (ràng buộc unique `attempt_id + question_id`).
- Nộp bài ghi lại điểm, tổng số câu và thời gian làm bài.
- Payload gửi về client khi đang làm bài **không chứa `correct_index`**.

**Lịch sử & review**:

- Trang chi tiết quiz liệt kê toàn bộ lượt làm: điểm, thời gian, ngày nộp; kèm best score và lần làm gần nhất.
- Trang review hiển thị từng câu: đề bài, lựa chọn của bạn, đáp án đúng, kèm badge màu theo loại câu hỏi và thanh tiến độ.
- Câu hỏi được lưu dạng **snapshot** — sửa hoặc xóa thẻ gốc không làm hỏng các quiz và bài làm cũ (`card_id` chỉ dùng để liên kết ngược, `ON DELETE SET NULL`).

---

## Kiến trúc & tech stack

```
Client
  │
  ▼
Nginx gateway  ──/api/*──▶  Backend (FastAPI + uvicorn)  ──▶  PostgreSQL 16
  │
  └──/*────────────────▶  Frontend (React SPA, static)
```

**Backend**
- Python 3.12 · FastAPI 0.115 · uvicorn
- SQLAlchemy 2.0 (async) + asyncpg · Alembic
- python-jose (JWT) · passlib[argon2] · openpyxl · pydantic-settings

**Frontend**
- React 18 · TypeScript 5.6 · Vite 5
- Tailwind CSS 3.4 · react-router-dom 6 · axios
- chart.js + react-chartjs-2 · lucide-react

**Hạ tầng**
- Docker Compose (db / backend / frontend / nginx)
- Alembic migration chạy tự động khi container backend khởi động

---

## Data model

```
User ─1:N─ Session ─1:N─ Card ─1:N─ Synonym
                           └──1:N─ CardLearnEvent

User ─1:N─ Quiz ─N:M─ Session          (qua quiz_source_sessions)
                 ├─1:N─ QuizQuestion
                 └─1:N─ QuizAttempt ─1:N─ QuizAnswer
```

| Bảng | Vai trò |
|------|---------|
| `users` | id, email (unique), password_hash, display_name, created_at |
| `sessions` | Bộ thẻ của một user |
| `cards` | card_type (`vocab`/`collocation`), front_text, front_phonetic, back_text, example, is_learned, position |
| `synonyms` | word + phonetic, thuộc về một card vocab |
| `card_learn_events` | Log bất biến: `learned` / `unlearned` + `occurred_at` — nguồn dữ liệu thống kê |
| `quizzes` | title, question_types (CSV codes), created_at |
| `quiz_source_sessions` | Bảng nối quiz ↔ sessions nguồn |
| `quiz_questions` | Snapshot: prompt, options (JSON array 4 phần tử), correct_index, position |
| `quiz_attempts` | started_at, submitted_at, score, total_questions, duration_seconds |
| `quiz_answers` | selected_index (NULL = bỏ trống), is_correct — unique theo (attempt, question) |

**Migrations:**

| File | Nội dung |
|------|----------|
| `20260817_initial_schema.py` | users, sessions, cards, synonyms |
| `20260909_add_card_learn_events.py` | card_learn_events + backfill từ `is_learned` hiện có |
| `20260910_add_quiz_tables.py` | quizzes, quiz_source_sessions, quiz_questions, quiz_attempts, quiz_answers |

---

## API reference

Base URL qua gateway: `/api` (nginx strip prefix, backend không tự thêm `/api`).

### Auth

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/auth/register` | `{ email, password, display_name }` → `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` → `{ user, token }` |
| GET | `/auth/me` | Thông tin user hiện tại |

### Sessions

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/sessions` | Danh sách session của user |
| POST | `/sessions` | Tạo session mới |
| GET | `/sessions/{id}` | Chi tiết + cards + synonyms (eager load) |
| PUT | `/sessions/{id}` | Đổi title |
| DELETE | `/sessions/{id}` | Xóa session (cascade) |

### Cards

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/sessions/{id}/cards` | Thêm thẻ (kèm synonyms) |
| PUT | `/cards/{id}` | Sửa thẻ |
| PATCH | `/cards/{id}/learned` | Toggle `is_learned`, ghi learn event |
| DELETE | `/cards/{id}` | Xóa thẻ |
| GET | `/cards/template/download` | Tải CSV template mẫu |

### Import

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/sessions/{id}/import` | Upload `.xlsx` / `.csv` → bulk insert |

### Stats

| Method | Path | Query | Mô tả |
|--------|------|-------|-------|
| GET | `/stats/daily` | `days` (1–365, default 30), `tz_offset_minutes` (−840…840) | Chuỗi số từ học mỗi ngày + current streak |

### Quizzes

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/quizzes/capacity` | Tính số câu tối đa cho các session + loại câu hỏi đã chọn |
| POST | `/quizzes` | Tạo quiz (sinh câu hỏi ngay tại thời điểm tạo) |
| GET | `/quizzes` | Danh sách quiz kèm attempt_count, best_score |
| GET | `/quizzes/{id}` | Chi tiết quiz + lịch sử attempts |
| DELETE | `/quizzes/{id}` | Xóa quiz (cascade attempts + answers) |
| POST | `/quizzes/{id}/attempts` | Bắt đầu một lượt làm bài |

### Attempts

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/attempts/{id}/answers` | Trả lời một câu → `{ is_correct, correct_index }` |
| POST | `/attempts/{id}/submit` | Nộp bài, chốt điểm và thời gian |
| GET | `/attempts/{id}` | Review chi tiết từng câu |

### Health

`GET /health` → `{ "status": "ok" }`

---

## Chạy dự án

### Docker Compose (khuyến nghị)

```bash
docker compose up --build -d
```

- App: http://localhost:3000
- Backend trực tiếp: http://localhost:8000 · API docs: http://localhost:8000/docs
- Postgres: `localhost:5432`

Migration Alembic chạy tự động trước khi uvicorn khởi động.

### Dev mode (không Docker)

```bash
# Terminal 1 — database
docker compose up db

# Terminal 2 — backend
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://vocabflash:changeme_secret_123@localhost:5432/vocabflash
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend
cd frontend
npm install
npm run dev
```

### Production

Xem [DEPLOYMENT.md](DEPLOYMENT.md) — dùng `docker-compose.prod.yml`, nginx gateway ở port 9990, không expose backend/frontend/db ra ngoài.

### Lệnh thường dùng

```bash
docker compose logs -f backend                                  # xem log
docker compose exec backend alembic upgrade head                # chạy migration
docker compose exec backend alembic revision --autogenerate -m "msg"
docker compose restart backend
docker compose down -v                                          # xóa cả data
```

---

## Định dạng file import

Header bắt buộc đúng tên cột (hàng đầu tiên):

| front_text | phonetic | back_text | example | synonyms |
|------------|----------|-----------|---------|----------|
| abundant | `/əˈbʌndənt/` | `"dồi dào, phong phú"` | The region has abundant natural resources. | `plentiful /ˈplentɪfəl/; copious /ˈkoʊpiəs/; ample /ˈæmpəl/` |
| make a decision | | `"đưa ra quyết định"` | We need to make a decision before the deadline. | |

Quy tắc:

- `synonyms` phân cách bằng `;`, mỗi phần tử dạng `word /phiên âm/`.
- Giá trị chứa dấu phẩy phải bọc trong dấu ngoặc kép.
- Cột `card_type` là tùy chọn. Không có → suy ra: có synonyms là `vocab`, không có là `collocation`.
- CSV đọc bằng `utf-8-sig` (chấp nhận BOM từ Excel).

---

## Cấu trúc thư mục

```
vocab_flash/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, health
│   │   ├── config.py                # Settings từ env
│   │   ├── database.py  deps.py     # Async engine, get_db, get_current_user
│   │   ├── models/                  # user, session, card (+CardLearnEvent), quiz
│   │   ├── schemas/                 # Pydantic auth, session, card, stats, quiz
│   │   ├── routers/                 # auth, sessions, cards, imports, stats, quizzes, attempts
│   │   └── services/
│   │       ├── auth.py              # hash, verify, create_token
│   │       ├── import_parser.py     # xlsx/csv → card dicts
│   │       ├── learning.py          # learn events + tính streak
│   │       └── quiz_generator.py    # capacity, distractor, phân bổ câu hỏi
│   ├── alembic/versions/
│   ├── tests/                       # pytest: quiz generator + factories
│   ├── smoke_test.py  smoke_test_quiz.py
│   └── Dockerfile
│
├── frontend/src/
│   ├── api/client.ts                # axios instance + interceptor
│   ├── pages/                       # Auth, Dashboard, SessionDetail, Study,
│   │                                # Quizzes, QuizDetail, TakeQuiz, AttemptReview
│   ├── components/
│   │   ├── dashboard/               # KpiTile, DailyLearnedChart, SessionProgressChart, StatsSection
│   │   ├── quiz/                    # QuizCard, QuizCreateModal, QuizQuestionView, AttemptHistory
│   │   ├── ImportModal.tsx  SessionCreateModal.tsx
│   │   └── PageHeader.tsx  UserMenu.tsx  Footer.tsx  QuestionTypeBadges.tsx
│   ├── contexts/  types/
│   └── App.tsx  main.tsx
│
├── docker-compose.yml  docker-compose.prod.yml  nginx.conf
├── DEPLOYMENT.md  vocab-flashcard-spec.md
└── docs/
```

### Routes frontend

| Route | Trang |
|-------|-------|
| `/login`, `/register` | Đăng nhập / đăng ký |
| `/` | Dashboard — KPI, biểu đồ, danh sách session |
| `/sessions/:id` | Chi tiết session, quản lý thẻ, import |
| `/sessions/:id/study` | Chế độ học flashcard |
| `/quizzes` | Danh sách quiz |
| `/quizzes/:id` | Chi tiết quiz + lịch sử làm bài |
| `/quizzes/:id/attempts/:attemptId` | Làm bài |
| `/attempts/:id/review` | Review chi tiết bài đã nộp |

---

## Testing

```bash
cd backend
pytest                          # unit test quiz generator
python smoke_test.py            # smoke test luồng auth/session/card
python smoke_test_quiz.py       # smoke test end-to-end luồng quiz
```

`tests/test_quiz_generator.py` phủ: tính capacity, sinh câu `en_to_vi` / `vi_to_en` / `synonym`, loại trừ distractor trùng, và phân bổ câu hỏi khi chọn nhiều loại.

Frontend kiểm tra type khi build:

```bash
cd frontend && npm run build     # tsc -b && vite build
```

---

## Biến môi trường

| Biến | Mặc định | Ghi chú |
|------|----------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://vocabflash:changeme_secret_123@localhost:5432/vocabflash` | Async driver |
| `JWT_SECRET` | `change_me_super_secret_key` | **Bắt buộc đổi khi lên production** |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRE_MINUTES` | `1440` | 24 giờ |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `vocabflash` / `changeme_secret_123` / `vocabflash` | **Đổi password khi lên production** |
| `VITE_API_BASE_URL` | `/api` | Build-time, frontend |

---

## Ghi chú kỹ thuật

- **CORS** hiện đang mở `allow_origins=["*"]` — nên giới hạn theo domain thật trước khi public.
- **Phiên âm IPA** nhập thủ công (hoặc qua import). Chưa tích hợp dictionary API.
- **Learn events bất biến**: `apply_learned_state()` chỉ ghi event khi trạng thái thực sự đổi, và dùng `db.add()` thay vì `card.learn_events.append()` — trong async SQLAlchemy, chạm vào collection của object persistent sẽ trigger lazy load và ném `MissingGreenlet`.
- **Quiz snapshot**: câu hỏi lưu nguyên văn prompt/options tại thời điểm tạo, nên không phụ thuộc vào thẻ gốc còn tồn tại hay không.

---

## Bản quyền

Copyright © 2026 Duc Dang. All rights reserved.

Dự án chưa gắn giấy phép mã nguồn mở. Mọi quyền sử dụng, sao chép, chỉnh sửa và phân phối đều cần sự đồng ý của tác giả.

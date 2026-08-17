# VocabFlash — Project Spec & Implementation Plan

## 1. Tổng quan

**VocabFlash** là webapp học từ vựng tiếng Anh qua flashcard, hỗ trợ vocab và collocation, với khả năng import từ file và quản lý theo session.

**Tech stack:**
- Backend: Python FastAPI + PostgreSQL + SQLAlchemy (async) + Alembic
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Auth: JWT simple (email + password, bcrypt)
- File processing: openpyxl (xlsx), csv stdlib

---

## 2. Data Model

### 2.1 Users

| Field         | Type         | Note                  |
|---------------|--------------|-----------------------|
| id            | UUID (PK)    |                       |
| email         | VARCHAR(255) | unique, indexed       |
| password_hash | VARCHAR(255) | bcrypt                |
| display_name  | VARCHAR(100) |                       |
| created_at    | TIMESTAMP    |                       |

### 2.2 Sessions

Một session = một bộ flashcard gom nhóm theo chủ đề / ngày học.

| Field      | Type         | Note                        |
|------------|--------------|-----------------------------|
| id         | UUID (PK)    |                             |
| user_id    | UUID (FK)    | → users.id                  |
| title      | VARCHAR(255) |                             |
| created_at | TIMESTAMP    |                             |
| updated_at | TIMESTAMP    |                             |

### 2.3 Cards

Mỗi card có 1 type: `vocab` hoặc `collocation`.

| Field         | Type          | Note                                    |
|---------------|---------------|-----------------------------------------|
| id            | UUID (PK)     |                                         |
| session_id    | UUID (FK)     | → sessions.id                           |
| card_type     | ENUM          | `vocab` / `collocation`                 |
| front_text    | VARCHAR(500)  | Từ tiếng Anh hoặc collocation           |
| front_phonetic| VARCHAR(200)  | Phiên âm IPA (nullable cho collocation) |
| back_text     | TEXT          | Nghĩa tiếng Việt                        |
| example       | TEXT          | Câu ví dụ (nullable)                    |
| is_learned    | BOOLEAN       | Default `false`                         |
| position      | INTEGER       | Thứ tự trong session                    |
| created_at    | TIMESTAMP     |                                         |

### 2.4 Synonyms

Chỉ áp dụng cho card_type = `vocab`.

| Field    | Type         | Note                    |
|----------|--------------|-------------------------|
| id       | UUID (PK)    |                         |
| card_id  | UUID (FK)    | → cards.id              |
| word     | VARCHAR(200) | Từ synonym tiếng Anh    |
| phonetic | VARCHAR(200) | Phiên âm IPA            |

### ER tóm tắt

```
User 1──N Session 1──N Card 1──N Synonym
```

---

## 3. API Endpoints

### 3.1 Auth

| Method | Path             | Body / Params                        | Response          |
|--------|------------------|--------------------------------------|--------------------|
| POST   | /auth/register   | { email, password, display_name }    | { user, token }    |
| POST   | /auth/login      | { email, password }                  | { user, token }    |
| GET    | /auth/me         | —                                    | { user }           |

### 3.2 Sessions

| Method | Path                  | Note                              |
|--------|-----------------------|-----------------------------------|
| GET    | /sessions             | List sessions của user hiện tại   |
| POST   | /sessions             | Tạo session mới (title)          |
| GET    | /sessions/:id         | Chi tiết session + cards          |
| PUT    | /sessions/:id         | Cập nhật title                    |
| DELETE | /sessions/:id         | Xóa session + cascade cards       |

### 3.3 Cards

| Method | Path                        | Note                                  |
|--------|-----------------------------|---------------------------------------|
| POST   | /sessions/:id/cards         | Thêm 1 card (kèm synonyms nếu vocab) |
| PUT    | /cards/:id                  | Sửa card                              |
| PATCH  | /cards/:id/learned          | Toggle is_learned (body: { is_learned: bool }) |
| DELETE | /cards/:id                  | Xóa card                              |

### 3.4 Import

| Method | Path                        | Note                                        |
|--------|-----------------------------|---------------------------------------------|
| POST   | /sessions/:id/import        | Upload .xlsx hoặc .csv, parse → tạo cards   |

**Import format (xlsx/csv):**

| Column A    | Column B  | Column C   | Column D | Column E   |
|-------------|-----------|------------|----------|------------|
| front_text  | phonetic  | back_text  | example  | synonyms   |

- `synonyms`: chuỗi phân cách bởi `; ` — mỗi synonym có dạng `word /phiên âm/`
  - Ví dụ: `happy /ˈhæpi/; glad /ɡlæd/; joyful /ˈdʒɔɪfəl/`
- Hàng đầu tiên là header, bỏ qua khi parse.
- Cột `card_type` có thể thêm optional; mặc định = `vocab`. Nếu không có synonyms → detect là `collocation`.

---

## 4. Frontend — Screens & Components

### 4.1 Screens

| Screen            | Route              | Mô tả                                          |
|-------------------|--------------------|-------------------------------------------------|
| Login / Register  | /login, /register  | Form đơn giản, chuyển đổi giữa 2 tab           |
| Dashboard         | /                  | Danh sách sessions, nút tạo mới, nút import    |
| Session Detail    | /sessions/:id      | Xem danh sách cards dạng bảng, nút thêm card   |
| Flashcard Study   | /sessions/:id/study| Giao diện lật flashcard toàn màn hình           |

### 4.2 Component chính: FlashCard

```
┌─────────────────────────────────┐
│ ○ Chưa học              [Flip] │  ← toggle trạng thái
│                                 │
│  MẶT TRƯỚC (English)           │
│       "abundant"                │
│     /əˈbʌndənt/                │
│                                 │
└─────────────────────────────────┘

         ↕ click để lật

┌─────────────────────────────────┐
│ ● Đã học ✓              [Flip] │  ← toggle trạng thái
│                                 │
│  MẶT SAU (Vietnamese)          │
│   "dồi dào, phong phú"         │
│                                 │
│  Synonyms:                      │
│   ┌──────────────────────┐      │
│   │ plentiful  ←hover→   │      │
│   │ tooltip: /ˈplentɪfəl/│      │
│   ├──────────────────────┤      │
│   │ ample                │      │
│   │ copious              │      │
│   └──────────────────────┘      │
│                                 │
│  Example:                       │
│  "The region has abundant       │
│   natural resources."           │
│                                 │
│   [← Prev]  3/20  [Next →]     │
└─────────────────────────────────┘
```

**Hành vi:**
- Click/tap card → flip animation (CSS 3D transform)
- Mặt trước: hiển thị `front_text` + `front_phonetic`
- Mặt sau: hiển thị `back_text`, synonyms (hover → tooltip phiên âm), example
- Nút Prev/Next hoặc swipe/arrow keys để chuyển card
- Collocation card: không có synonyms, chỉ front + back + example
- **Learned toggle:** nút ở góc trên-trái mỗi card, hiển thị cả 2 mặt
  - `○ Chưa học` (mặc định) → click → `● Đã học ✓` (xanh lá)
  - Gọi PATCH /cards/:id/learned ngay khi toggle (optimistic update)
  - Trạng thái cập nhật realtime, không cần reload

**Study progress bar:**
- Thanh progress phía trên: `{learned}/{total}` — ví dụ `5/20 đã học`
- Session Detail cũng hiển thị tỉ lệ learned trên mỗi session card

**Filter trong Study mode:**
- Nút filter: `Tất cả` | `Chưa học` | `Đã học` — lọc cards đang hiển thị
- Mặc định: `Tất cả`

### 4.3 Import Modal

- Drag & drop hoặc chọn file (.xlsx, .csv)
- Preview bảng 5 dòng đầu trước khi confirm
- Hiển thị số cards sẽ được import
- Nút confirm → gọi API import

### 4.4 Card Editor

- Form inline hoặc modal để thêm/sửa card
- Fields: front_text, phonetic, back_text, example, card_type (radio)
- Nếu vocab: phần dynamic để thêm/xóa synonyms (word + phonetic mỗi dòng)

---

## 5. Implementation Plan

### Phase 1 — Scaffolding & Auth (Ngày 1)

**Backend:**
1. Khởi tạo project FastAPI (`backend/`)
   - `pyproject.toml` hoặc `requirements.txt`: fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, python-jose, passlib[bcrypt], python-multipart, openpyxl
2. Setup PostgreSQL connection (async SQLAlchemy + asyncpg)
3. Tạo models: `User`
4. Alembic init + migration đầu tiên
5. Implement auth routes: register, login, me
6. JWT middleware (dependency `get_current_user`)

**Frontend:**
1. `npm create vite@latest frontend -- --template react-ts`
2. Install: tailwindcss, react-router-dom, axios, lucide-react (icons)
3. Setup Tailwind, routing, axios instance (baseURL + interceptor gắn token)
4. Tạo AuthContext + ProtectedRoute
5. Màn hình Login / Register

**Deliverable:** User có thể đăng ký, đăng nhập, và được redirect về dashboard trống.

---

### Phase 2 — Sessions CRUD (Ngày 2)

**Backend:**
1. Tạo models: `Session`
2. Migration
3. CRUD endpoints cho sessions (list, create, get, update, delete)

**Frontend:**
1. Dashboard screen: hiển thị danh sách sessions (cards grid)
2. Mỗi session card: title, số cards, tiến độ học (ví dụ `5/20 đã học`), ngày tạo, nút xóa
3. Modal / form tạo session mới
4. Click session → navigate tới Session Detail

**Deliverable:** User tạo, xem, đổi tên, xóa sessions.

---

### Phase 3 — Cards CRUD + Synonyms (Ngày 3)

**Backend:**
1. Tạo models: `Card`, `Synonym`
2. Migration
3. Endpoints: thêm card (kèm synonyms), sửa card, xóa card
4. GET /sessions/:id trả về session + cards + synonyms (eager load)

**Frontend:**
1. Session Detail screen: bảng danh sách cards
2. Card editor form/modal (thêm/sửa)
   - Dynamic synonym fields khi card_type = vocab
3. Nút xóa card (confirm)

**Deliverable:** User thêm/sửa/xóa cards với synonyms trong session.

---

### Phase 4 — Flashcard Study UI (Ngày 4)

**Frontend (phần lớn):**
1. FlashCard component với flip animation (CSS perspective + rotateY)
2. Study screen: full-width, 1 card tại 1 thời điểm
3. Navigation: Prev / Next, keyboard arrows, progress indicator
4. Mặt trước: front_text + phonetic
5. Mặt sau: back_text + synonyms (hover tooltip) + example
6. Phân biệt render vocab vs collocation

**Deliverable:** User học flashcard với đầy đủ thông tin 2 mặt.

---

### Phase 5 — Import từ xlsx/csv (Ngày 5)

**Backend:**
1. Endpoint POST /sessions/:id/import
   - Accept multipart file (.xlsx hoặc .csv)
   - Parse file → validate → bulk insert cards + synonyms
   - Trả về số cards imported + errors (nếu có)

**Frontend:**
1. Import modal (accessible từ Session Detail)
2. File picker (drag & drop optional)
3. Preview table (đọc file client-side với SheetJS/papaparse, hiển thị 5 dòng)
4. Confirm → upload file lên backend
5. Refresh danh sách cards sau khi import thành công

**Deliverable:** User import hàng loạt vocab/collocation từ file.

---

### Phase 6 — Polish & Edge Cases (Ngày 6)

1. Responsive design (mobile-friendly cho study mode)
2. Loading states, error toasts
3. Empty states (chưa có session, chưa có cards)
4. Validation messages cụ thể
5. Keyboard shortcuts trong study mode (Space = flip, ←→ = navigate)
6. Persist study progress trong session (localStorage)

---

## 6. Cấu trúc thư mục

```
vocabflash/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # Settings (DATABASE_URL, JWT_SECRET...)
│   │   ├── database.py          # Async engine + session factory
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   ├── card.py
│   │   │   └── synonym.py
│   │   ├── schemas/             # Pydantic request/response
│   │   │   ├── auth.py
│   │   │   ├── session.py
│   │   │   └── card.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── sessions.py
│   │   │   ├── cards.py
│   │   │   └── imports.py
│   │   ├── services/
│   │   │   ├── auth.py          # Hash, verify, create_token
│   │   │   └── import_parser.py # Parse xlsx/csv → card dicts
│   │   └── deps.py              # get_db, get_current_user
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # Axios instance + endpoints
│   │   ├── components/
│   │   │   ├── FlashCard.tsx
│   │   │   ├── CardEditor.tsx
│   │   │   ├── ImportModal.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   └── SynonymBadge.tsx  # Hover → tooltip phiên âm
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── SessionDetailPage.tsx
│   │   │   └── StudyPage.tsx
│   │   ├── types/
│   │   │   └── index.ts         # Card, Session, Synonym, User
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
│
├── nginx/
│   └── default.conf
│
├── docker-compose.yml
└── .env
```

---

## 7. Chạy & Đóng gói (Docker Compose)

### 7.1 Kiến trúc

```
                    :80
                     │
               ┌─────▼─────┐
               │   nginx    │
               │  (gateway) │
               └──┬──────┬──┘
          /api/*  │      │  /*
        ┌─────────▼┐  ┌──▼──────────┐
        │ backend  │  │  frontend   │
        │ FastAPI  │  │ nginx serve │
        │ :8000    │  │ static :3000│
        └────┬─────┘  └─────────────┘
             │
        ┌────▼─────┐
        │   db     │
        │ postgres │
        │ :5432    │
        └──────────┘
```

- **nginx (gateway):** reverse proxy, route `/api/*` → backend, `/*` → frontend
- **frontend:** multi-stage build (node build → nginx serve static)
- **backend:** FastAPI + uvicorn, chạy Alembic migration khi startup
- **db:** PostgreSQL 16, volume persist data

### 7.2 File chi tiết

#### `.env` (root)

```env
# PostgreSQL
POSTGRES_USER=vocabflash
POSTGRES_PASSWORD=changeme_secret_123
POSTGRES_DB=vocabflash

# Backend
DATABASE_URL=postgresql+asyncpg://vocabflash:changeme_secret_123@db:5432/vocabflash
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# Frontend (build-time)
VITE_API_BASE_URL=/api
```

#### `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    expose:
      - "8000"

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_BASE_URL: /api
    restart: unless-stopped
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
      - frontend

volumes:
  pgdata:
```

#### `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Run alembic migrations then start uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

#### `frontend/Dockerfile`

```dockerfile
# --- Stage 1: Build ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback: mọi route → index.html
RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

#### `nginx/default.conf`

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 10M;  # cho phép upload file xlsx/csv

    # API → FastAPI backend
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API docs (optional, dev)
    location /docs {
        proxy_pass http://backend/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://backend/openapi.json;
        proxy_set_header Host $host;
    }

    # Mọi thứ còn lại → frontend SPA
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
    }
}
```

### 7.3 Lưu ý quan trọng

**Frontend API base URL:**
- Axios instance dùng `VITE_API_BASE_URL` (= `/api`) làm baseURL
- Nginx strip `/api/` prefix khi proxy sang backend (`proxy_pass http://backend/` — có trailing slash)
- Backend routes giữ nguyên không có prefix `/api`, ví dụ: `/auth/login`, `/sessions`

**Alembic trong Docker:**
- `alembic.ini` đọc `DATABASE_URL` từ env (dùng sync driver `postgresql://` cho alembic, hoặc config `env.py` để replace `asyncpg` → `psycopg2`)
- Migration chạy tự động khi container backend start, trước uvicorn

**Dev mode (không Docker):**
```bash
# Terminal 1 — Database
docker compose up db

# Terminal 2 — Backend
cd backend
export DATABASE_URL=postgresql+asyncpg://vocabflash:changeme_secret_123@localhost:5432/vocabflash
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

### 7.4 Commands cheat sheet

```bash
# Build & chạy toàn bộ
docker compose up --build -d

# Xem logs
docker compose logs -f
docker compose logs -f backend   # chỉ backend

# Chạy migration thủ công
docker compose exec backend alembic upgrade head

# Tạo migration mới
docker compose exec backend alembic revision --autogenerate -m "add_is_learned"

# Restart 1 service
docker compose restart backend

# Dọn sạch (xóa cả data)
docker compose down -v

# Chỉ rebuild 1 service
docker compose up --build -d backend
```

---

## 8. Ghi chú kỹ thuật

- **Phiên âm IPA:** Nhập thủ công hoặc tích hợp API phiên âm miễn phí sau (e.g., Free Dictionary API). MVP: user tự nhập.
- **Flip animation:** CSS `transform-style: preserve-3d` + `rotateY(180deg)` trên `.flipped` class. Transition 0.5s.
- **Tooltip synonym:** Tailwind `group/hover` + absolute positioned span, hoặc dùng `@floating-ui/react` nếu cần positioning phức tạp.
- **Import parsing:** Backend xử lý file, không cần client-side parsing nếu muốn đơn giản — nhưng preview trước khi upload thì cần SheetJS ở frontend.
- **Auth token:** Lưu localStorage, gắn header `Authorization: Bearer <token>` qua axios interceptor.

# Dashboard Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm khu vực thống kê tiến độ học (KPI + 2 biểu đồ) vào Dashboard, tách trang thành 2 section "Dashboard" và "Your sessions".

**Architecture:** Thêm bảng `card_learn_events` làm lịch sử học bất biến; mọi thay đổi `is_learned` đi qua một helper duy nhất để ghi event kèm theo. Một endpoint hẹp `GET /stats/daily` trả chuỗi ngày + streak; KPI và bar theo session suy ra từ `GET /sessions` đã có sẵn nên không phát sinh request thừa.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + PostgreSQL 16; React + TypeScript + Vite + Tailwind; Chart.js 4 qua react-chartjs-2.

**Spec:** `docs/superpowers/specs/2026-09-09-dashboard-charts-design.md`

## Global Constraints

- **Không viết test tự động.** Mỗi task kết thúc bằng verification thủ công có lệnh cụ thể. Không thêm `pytest` hay bất kỳ test framework nào.
- Chart.js phải **register thủ công từng component**, cấm dùng `registerables`.
- Không thêm cột `learned_at` vào `cards`. Bảng `card_learn_events` là nguồn duy nhất cho lịch sử.
- `cards.is_learned` giữ nguyên vai trò trạng thái hiện tại, chỉ được đổi qua `apply_learned_state`.
- Màu dùng token có sẵn: primary `#f54e00`, hairline `#e6e5e0`, muted `#807d72`, ink `#26251e`.
- Backend chạy ở `http://localhost:8000` khi dev, hoặc qua nginx `/api` khi chạy Docker.
- **Toàn bộ text hiển thị cho người dùng viết bằng tiếng Anh**, khớp với phần còn lại của app ("Your sessions", "No sessions yet", "Show on card"…). Dùng sentence case, câu ngắn gọn như copy sẵn có.

---

### Task 1: Bảng `card_learn_events` + migration

**Files:**
- Modify: `backend/app/models/card.py`
- Modify: `backend/alembic/env.py:8`
- Create: `backend/alembic/versions/20260909_add_card_learn_events.py`

**Interfaces:**
- Consumes: bảng `cards` sẵn có (`id`, `is_learned`, `created_at`)
- Produces: model `CardLearnEvent` (fields: `id: str`, `card_id: str`, `event_type: str`, `occurred_at: datetime`) và quan hệ `Card.learn_events`

- [ ] **Step 1: Thêm model `CardLearnEvent` vào cuối `backend/app/models/card.py`**

Thêm vào cuối file (sau class `Synonym`):

```python
class CardLearnEvent(Base):
    __tablename__ = "card_learn_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    card: Mapped["Card"] = relationship(back_populates="learn_events")
```

Không cần thêm import mới — `String`, `ForeignKey`, `DateTime`, `datetime`, `timezone`, `uuid4`, `Mapped`, `mapped_column`, `relationship`, `Base` đều đã có sẵn ở đầu file.

- [ ] **Step 2: Thêm quan hệ `learn_events` vào class `Card`**

Trong class `Card`, ngay dưới dòng `synonyms: Mapped[list["Synonym"]] = ...`, thêm:

```python
    learn_events: Mapped[list["CardLearnEvent"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", passive_deletes=True
    )
```

`passive_deletes=True` để khi xoá card, SQLAlchemy giao việc xoá event cho `ON DELETE CASCADE` ở tầng DB thay vì load collection ra (lazy load trong async sẽ nổ `MissingGreenlet`).

- [ ] **Step 3: Đăng ký model trong `backend/alembic/env.py`**

Sửa dòng 8 từ:

```python
from app.models.card import Card, Synonym
```

thành:

```python
from app.models.card import Card, CardLearnEvent, Synonym
```

- [ ] **Step 4: Tạo file migration `backend/alembic/versions/20260909_add_card_learn_events.py`**

```python
"""add card_learn_events

Revision ID: 20260909_events
Revises: 20260817_initial
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260909_events"
down_revision = "20260817_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "card_learn_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("card_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["card_id"], ["cards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_card_learn_events_card_id"), "card_learn_events", ["card_id"]
    )
    op.create_index(
        op.f("ix_card_learn_events_occurred_at"), "card_learn_events", ["occurred_at"]
    )

    op.execute(
        """
        INSERT INTO card_learn_events (id, card_id, event_type, occurred_at)
        SELECT gen_random_uuid()::text, id, 'learned', created_at
        FROM cards
        WHERE is_learned = true
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_card_learn_events_occurred_at"), table_name="card_learn_events")
    op.drop_index(op.f("ix_card_learn_events_card_id"), table_name="card_learn_events")
    op.drop_table("card_learn_events")
```

`gen_random_uuid()` là hàm built-in của Postgres 13+ nên không cần cài extension; image đang dùng là `postgres:16-alpine`.

- [ ] **Step 5: Chạy migration**

Nếu chạy bằng Docker:
```bash
docker compose exec backend alembic upgrade head
```

Nếu chạy dev thuần:
```bash
cd backend && alembic upgrade head
```

Expected: log in ra `Running upgrade 20260817_initial -> 20260909_events`, không có traceback.

- [ ] **Step 6: Verify bảng và dữ liệu backfill**

```bash
docker compose exec db psql -U vocabflash -d vocabflash -c "\d card_learn_events"
```
Expected: thấy 4 cột `id`, `card_id`, `event_type`, `occurred_at`, 2 index, và FK tới `cards` có `ON DELETE CASCADE`.

```bash
docker compose exec db psql -U vocabflash -d vocabflash -c "SELECT (SELECT count(*) FROM cards WHERE is_learned = true) AS learned_cards, (SELECT count(*) FROM card_learn_events WHERE event_type = 'learned') AS events;"
```
Expected: hai con số **bằng nhau**. Nếu lệch thì backfill sai, dừng lại xử lý trước khi đi tiếp.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/card.py backend/alembic/env.py backend/alembic/versions/20260909_add_card_learn_events.py
git commit -m "feat: add card_learn_events table with backfill"
```

---

### Task 2: Helper `apply_learned_state` + nối vào 3 đường ghi

**Files:**
- Create: `backend/app/services/learning.py`
- Modify: `backend/app/routers/cards.py` (hàm `create_card`, `update_card`, `toggle_card_learned`)

**Interfaces:**
- Consumes: `CardLearnEvent` từ Task 1
- Produces: `apply_learned_state(db: AsyncSession, card: Card, is_learned: bool) -> None`

- [ ] **Step 1: Tạo `backend/app/services/learning.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card, CardLearnEvent


def apply_learned_state(db: AsyncSession, card: Card, is_learned: bool) -> None:
    """Đổi trạng thái đã học của card và ghi lại lịch sử.

    Chỉ sinh event khi trạng thái thực sự thay đổi, nên gọi nhiều lần với
    cùng một giá trị sẽ không tạo event rác.

    Dùng db.add(...) chứ không phải card.learn_events.append(...): trong async
    SQLAlchemy, chạm vào collection của object đã persistent sẽ kích hoạt lazy
    load và ném MissingGreenlet.

    Lưu ý: card phải đã có `id` (tức là đã flush) trước khi gọi hàm này.
    """
    if card.is_learned == is_learned:
        return

    card.is_learned = is_learned
    db.add(
        CardLearnEvent(
            card_id=card.id,
            event_type="learned" if is_learned else "unlearned",
        )
    )
```

- [ ] **Step 2: Import helper trong `backend/app/routers/cards.py`**

Ngay dưới dòng `from app.schemas.card import CardCreate, CardOut, CardUpdate, LearnedToggleRequest`, thêm:

```python
from app.services.learning import apply_learned_state
```

- [ ] **Step 3: Sửa `create_card`**

Tìm khối tạo card (hiện ở khoảng dòng 30-41) và thay bằng:

```python
    card = Card(
        session_id=session_id,
        card_type=payload.card_type,
        front_text=payload.front_text,
        front_phonetic=payload.front_phonetic,
        back_text=payload.back_text,
        example=payload.example,
        is_learned=False,
        position=payload.position,
    )
    db.add(card)
    await db.flush()

    apply_learned_state(db, card, payload.is_learned)
```

Hai điểm bắt buộc, sai là hỏng dữ liệu:
1. Constructor gán `is_learned=False` chứ **không** phải `payload.is_learned`. Cột có `default=False` ở mức DB nhưng default đó chỉ áp lúc INSERT — object Python chưa gán sẽ là `None`, làm phép so sánh trong helper sai và sinh event `unlearned` cho card mới toanh.
2. Gọi helper **sau** `await db.flush()`, vì `card.id` chỉ được sinh lúc INSERT; gọi trước flush sẽ tạo event với `card_id = None`.

- [ ] **Step 4: Sửa `update_card`**

Tìm vòng lặp `setattr` (hiện ở khoảng dòng 70-71):

```python
    for field, value in payload.model_dump(exclude_none=True, exclude={"synonyms"}).items():
        setattr(card, field, value)
```

Thay bằng:

```python
    updates = payload.model_dump(exclude_none=True, exclude={"synonyms", "is_learned"})
    for field, value in updates.items():
        setattr(card, field, value)

    if payload.is_learned is not None:
        apply_learned_state(db, card, payload.is_learned)
```

- [ ] **Step 5: Sửa `toggle_card_learned`**

Tìm dòng (hiện ở khoảng dòng 104):

```python
    card.is_learned = payload.is_learned
```

Thay bằng:

```python
    apply_learned_state(db, card, payload.is_learned)
```

- [ ] **Step 6: Khởi động lại backend**

```bash
docker compose restart backend
```
hoặc nếu chạy `uvicorn --reload` thì nó tự nạp lại. Kiểm tra log không có ImportError.

- [ ] **Step 7: Lấy token để verify**

Thay `EMAIL` và `PASSWORD` bằng tài khoản thật của bạn:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"EMAIL","password":"PASSWORD"}' | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo $TOKEN
```
Expected: in ra một chuỗi JWT dài, không rỗng.

- [ ] **Step 8: Verify toggle sinh đúng event**

Lấy một `CARD_ID` bất kỳ từ DB:
```bash
docker compose exec db psql -U vocabflash -d vocabflash -t -c "SELECT id FROM cards LIMIT 1;"
```

Bật rồi tắt rồi bật lại cùng một card:
```bash
for V in true false true; do
  curl -s -X PATCH "http://localhost:8000/cards/CARD_ID/learned" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"is_learned\": $V}" > /dev/null
done

docker compose exec db psql -U vocabflash -d vocabflash \
  -c "SELECT event_type, occurred_at FROM card_learn_events WHERE card_id = 'CARD_ID' ORDER BY occurred_at;"
```
Expected: đúng **3** dòng theo thứ tự `learned`, `unlearned`, `learned` (cộng thêm 1 dòng `learned` cũ nếu card này đã học từ trước lúc backfill).

- [ ] **Step 9: Verify gọi trùng giá trị không sinh event rác**

```bash
curl -s -X PATCH "http://localhost:8000/cards/CARD_ID/learned" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"is_learned": true}' > /dev/null

docker compose exec db psql -U vocabflash -d vocabflash \
  -c "SELECT count(*) FROM card_learn_events WHERE card_id = 'CARD_ID';"
```
Expected: số dòng **không đổi** so với Step 8 (card đang là `true` rồi, PATCH `true` nữa không sinh gì).

- [ ] **Step 10: Verify tạo card mới với `is_learned = true`**

```bash
SESSION_ID=$(docker compose exec -T db psql -U vocabflash -d vocabflash -t -c "SELECT id FROM sessions LIMIT 1;" | tr -d ' \r\n')

curl -s -X POST "http://localhost:8000/sessions/$SESSION_ID/cards" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"front_text":"plan-check","back_text":"kiểm tra","is_learned":true}'

docker compose exec db psql -U vocabflash -d vocabflash \
  -c "SELECT e.event_type, e.card_id FROM card_learn_events e JOIN cards c ON c.id = e.card_id WHERE c.front_text = 'plan-check';"
```
Expected: đúng **1** dòng `learned`, và `card_id` **không** rỗng/null.

Dọn dẹp card thử nghiệm:
```bash
docker compose exec db psql -U vocabflash -d vocabflash -c "DELETE FROM cards WHERE front_text = 'plan-check';"
```
Chạy lại query event ở trên → Expected: **0 dòng** (cascade đã xoá event theo card).

- [ ] **Step 11: Commit**

```bash
git add backend/app/services/learning.py backend/app/routers/cards.py
git commit -m "feat: record learn/unlearn events on every is_learned write"
```

---

### Task 3: Endpoint `GET /stats/daily`

**Files:**
- Create: `backend/app/schemas/stats.py`
- Create: `backend/app/routers/stats.py`
- Modify: `backend/app/services/learning.py` (thêm `calculate_streak`)
- Modify: `backend/app/main.py:4,19`

**Interfaces:**
- Consumes: `CardLearnEvent` (Task 1)
- Produces: `GET /stats/daily?days=<int>&tz_offset_minutes=<int>` → `{ days: int, daily: [{date: str, learned_count: int}], current_streak: int }`

- [ ] **Step 1: Tạo `backend/app/schemas/stats.py`**

```python
from datetime import date

from pydantic import BaseModel


class DailyPoint(BaseModel):
    date: date
    learned_count: int


class DailyStatsOut(BaseModel):
    days: int
    daily: list[DailyPoint]
    current_streak: int
```

- [ ] **Step 2: Thêm `calculate_streak` vào `backend/app/services/learning.py`**

Đổi dòng import đầu file thành:

```python
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card, CardLearnEvent
```

Rồi thêm hàm này vào cuối file:

```python
def calculate_streak(learned_dates: set[date], today: date) -> int:
    """Đếm số ngày liên tiếp có ít nhất 1 từ được học, tính ngược từ today.

    Nếu hôm nay chưa học từ nào thì bắt đầu đếm từ hôm qua, để streak không
    bị mất khi ngày còn chưa kết thúc.
    """
    cursor = today if today in learned_dates else today - timedelta(days=1)
    streak = 0
    while cursor in learned_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
```

- [ ] **Step 3: Tạo `backend/app/routers/stats.py`**

```python
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card, CardLearnEvent
from app.models.session import Session
from app.models.user import User
from app.schemas.stats import DailyPoint, DailyStatsOut
from app.services.learning import calculate_streak

router = APIRouter()


@router.get("/daily", response_model=DailyStatsOut)
async def daily_stats(
    days: int = Query(default=30, ge=1, le=365),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DailyStatsOut:
    offset = timedelta(minutes=tz_offset_minutes)
    local_date = func.date(CardLearnEvent.occurred_at + offset)

    today = (datetime.now(timezone.utc) + offset).date()
    start_date = today - timedelta(days=days - 1)

    base = (
        select(local_date.label("day"))
        .join(Card, CardLearnEvent.card_id == Card.id)
        .join(Session, Card.session_id == Session.id)
        .where(
            Session.user_id == current_user.id,
            CardLearnEvent.event_type == "learned",
        )
    )

    window_result = await db.execute(
        base.add_columns(func.count(distinct(CardLearnEvent.card_id)).label("learned_count"))
        .where(local_date >= start_date)
        .group_by(local_date)
    )
    counts = {row.day: row.learned_count for row in window_result}

    streak_result = await db.execute(base.distinct())
    learned_dates = {row.day for row in streak_result}

    daily = []
    for index in range(days):
        current = start_date + timedelta(days=index)
        daily.append(DailyPoint(date=current, learned_count=counts.get(current, 0)))

    return DailyStatsOut(
        days=days,
        daily=daily,
        current_streak=calculate_streak(learned_dates, today),
    )
```

Ghi chú: dùng `COUNT(DISTINCT card_id)` để một từ bị bật/tắt/bật lại trong cùng một ngày chỉ tính 1. Query streak chạy trên **toàn bộ** lịch sử, không giới hạn trong cửa sổ `days`, nên streak dài hơn 30 ngày vẫn đếm đúng.

- [ ] **Step 4: Đăng ký router trong `backend/app/main.py`**

Sửa dòng 4 thành:

```python
from app.routers import auth, sessions, cards, imports, stats
```

Thêm sau dòng `app.include_router(imports.router, prefix="/sessions", tags=["imports"])`:

```python
app.include_router(stats.router, prefix="/stats", tags=["stats"])
```

- [ ] **Step 5: Khởi động lại backend và gọi thử endpoint**

```bash
docker compose restart backend
```

Lấy lại token nếu shell đã mất biến (xem Task 2 Step 7), rồi:

```bash
curl -s "http://localhost:8000/stats/daily?days=7&tz_offset_minutes=420" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Expected:
- HTTP 200, JSON có đúng 3 key `days`, `daily`, `current_streak`
- `daily` có **đúng 7 phần tử**, ngày tăng dần, phần tử cuối là hôm nay
- Ngày không học có `"learned_count": 0` (chuỗi dense, không thiếu ngày)

- [ ] **Step 6: Verify múi giờ và ràng buộc tham số**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/stats/daily?days=0" -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/stats/daily?days=400" -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/stats/daily?tz_offset_minutes=999" -H "Authorization: Bearer $TOKEN"
```
Expected: cả 3 đều trả `422`.

```bash
curl -s "http://localhost:8000/stats/daily?days=30&tz_offset_minutes=420" -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d['daily']), d['daily'][-1]['date'], d['current_streak'])"
```
Expected: in ra `30`, ngày hôm nay theo giờ VN, và một số streak hợp lý (nếu vừa toggle ở Task 2 thì ≥ 1).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/stats.py backend/app/routers/stats.py backend/app/services/learning.py backend/app/main.py
git commit -m "feat: add GET /stats/daily with daily series and streak"
```

---

### Task 4: Tách 2 section + KPI tiles

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/components/dashboard/KpiTile.tsx`
- Create: `frontend/src/components/dashboard/StatsSection.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `GET /stats/daily` (Task 3); type `Session` sẵn có với `total_cards` và `learned_cards`
- Produces: `<StatsSection sessions={Session[]} />`; types `DailyPoint`, `DailyStats`

- [ ] **Step 1: Thêm types vào `frontend/src/types/index.ts`**

Thêm vào cuối file:

```ts
export type DailyPoint = {
  date: string;
  learned_count: number;
};

export type DailyStats = {
  days: number;
  daily: DailyPoint[];
  current_streak: number;
};
```

- [ ] **Step 2: Tạo `frontend/src/components/dashboard/KpiTile.tsx`**

```tsx
type KpiTileProps = {
  label: string;
  value: number | string;
  suffix?: string;
};

export default function KpiTile({ label, value, suffix }: KpiTileProps) {
  return (
    <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-muted">{label}</span>
      <span className="text-3xl font-light letter-spacing-tight text-ink">
        {value}
        {suffix ? <span className="text-base text-body ml-1">{suffix}</span> : null}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Tạo `frontend/src/components/dashboard/StatsSection.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { DailyStats, Session } from '../../types';
import KpiTile from './KpiTile';

type StatsSectionProps = {
  sessions: Session[];
};

export default function StatsSection({ sessions }: StatsSectionProps) {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    const tzOffsetMinutes = -new Date().getTimezoneOffset();

    setStatsLoading(true);

    api
      .get('/stats/daily', { params: { days, tz_offset_minutes: tzOffsetMinutes } })
      .then((response) => {
        if (!cancelled) {
          setStats(response.data);
          setStatsError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const totals = useMemo(() => {
    const total = sessions.reduce((sum, session) => sum + session.total_cards, 0);
    const learned = sessions.reduce((sum, session) => sum + session.learned_cards, 0);

    return {
      total,
      learned,
      percent: total > 0 ? Math.round((learned / total) * 100) : 0,
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>No study data yet. Create your first session to start tracking progress.</p>
      </div>
    );
  }

  const streakValue = statsError ? '—' : statsLoading ? '…' : (stats?.current_streak ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiTile label="Total words" value={totals.total} />
        <KpiTile label="Learned" value={totals.learned} />
        <KpiTile label="Mastery" value={totals.percent} suffix="%" />
        <KpiTile label="Streak" value={streakValue} suffix="days" />
      </div>

      {statsError && (
        <p className="text-sm text-error m-0">
          Couldn't load daily stats. Your totals are still accurate.
        </p>
      )}
    </div>
  );
}
```

Biến `days` / `setDays` để nguyên ở đây; Task 5 sẽ nối nút toggle vào nó.

- [ ] **Step 4: Nối `StatsSection` vào `frontend/src/pages/DashboardPage.tsx`**

Thêm import cạnh các import sẵn có:

```tsx
import StatsSection from '../components/dashboard/StatsSection';
```

Tìm khối:

```tsx
        <section className="section-header">
          <h2>Your sessions</h2>
          <p>{sessions.length} total</p>
        </section>
```

Chèn **ngay phía trước** nó:

```tsx
        <section className="section-header">
          <h2>Dashboard</h2>
        </section>

        <StatsSection sessions={sessions} />
```

- [ ] **Step 5: Chạy frontend và kiểm tra**

```bash
cd frontend && npm run dev
```

Mở `http://localhost:5173`, đăng nhập, xem Dashboard.

Expected:
- Thấy tiêu đề "Dashboard", dưới đó là 4 ô KPI, rồi tới "Your sessions" và lưới session như cũ
- Tổng số từ và Đã học khớp với tổng cộng dồn trên các thẻ session
- Ô Streak hiện số (không phải `…` mãi)
- Console không có lỗi đỏ

- [ ] **Step 6: Verify degrade gracefully khi stats lỗi**

Tắt backend:
```bash
docker compose stop backend
```
Reload trang. Expected: lưới session có thể trống (vì `/sessions` cũng lỗi) nhưng **không trắng trang, không crash**. Bật lại backend:
```bash
docker compose start backend
```

Để kiểm tra riêng lỗi của stats, tạm đổi trong `StatsSection.tsx` đường dẫn `'/stats/daily'` thành `'/stats/daily-broken'`, reload: Expected KPI tổng/đã học/tỉ lệ **vẫn hiện đúng số**, Streak hiện `—`, và có dòng chữ đỏ báo lỗi. Đổi lại đường dẫn đúng sau khi kiểm tra xong.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/dashboard/KpiTile.tsx frontend/src/components/dashboard/StatsSection.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: split dashboard into Dashboard and Your sessions sections with KPI tiles"
```

---

### Task 5: Biểu đồ số từ học theo ngày

**Files:**
- Modify: `frontend/package.json` (qua `npm install`)
- Create: `frontend/src/lib/chartSetup.ts`
- Create: `frontend/src/components/dashboard/DailyLearnedChart.tsx`
- Modify: `frontend/src/components/dashboard/StatsSection.tsx`

**Interfaces:**
- Consumes: `DailyPoint[]` từ `stats.daily` (Task 4)
- Produces: `<DailyLearnedChart daily={DailyPoint[]} days={number} onDaysChange={(days: number) => void} />`

- [ ] **Step 1: Cài dependency**

```bash
cd frontend && npm install chart.js react-chartjs-2
```

- [ ] **Step 2: Tạo `frontend/src/lib/chartSetup.ts`**

```ts
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
```

Chỉ register đúng những thành phần cần dùng. **Không** import `registerables` — sẽ kéo toàn bộ Chart.js vào bundle.

- [ ] **Step 3: Tạo `frontend/src/components/dashboard/DailyLearnedChart.tsx`**

```tsx
import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import type { DailyPoint } from '../../types';

type DailyLearnedChartProps = {
  daily: DailyPoint[];
  days: number;
  onDaysChange: (days: number) => void;
};

function formatLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(day)}/${Number(month)}`;
}

export default function DailyLearnedChart({ daily, days, onDaysChange }: DailyLearnedChartProps) {
  const isEmpty = daily.every((point) => point.learned_count === 0);

  const data = {
    labels: daily.map((point) => formatLabel(point.date)),
    datasets: [
      {
        label: 'Words learned',
        data: daily.map((point) => point.learned_count),
        backgroundColor: '#f54e00',
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} ${context.parsed.y === 1 ? 'word' : 'words'}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#807d72', autoSkip: true, maxTicksLimit: days === 7 ? 7 : 6 },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#807d72', precision: 0 },
        grid: { color: '#e6e5e0' },
      },
    },
  };

  return (
    <div className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink m-0">Words learned per day</h3>

        <div className="flex items-center gap-1 bg-surface-strong rounded-xl p-1">
          {[7, 30].map((option) => (
            <button
              key={option}
              type="button"
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                days === option ? 'bg-white text-ink' : 'bg-transparent text-muted'
              }`}
              onClick={() => onDaysChange(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        <Bar data={data} options={options} />
      </div>

      {isEmpty && (
        <p className="text-sm text-body m-0">
          No words marked as learned in the last {days} days.
        </p>
      )}
    </div>
  );
}
```

Không dùng `new Date(point.date)` để lấy nhãn: chuỗi `"2026-08-11"` bị parse thành UTC midnight, ở múi giờ âm sẽ lùi mất 1 ngày. Cắt chuỗi trực tiếp là an toàn với mọi múi giờ.

- [ ] **Step 4: Nối chart vào `StatsSection.tsx`**

Thêm import:

```tsx
import DailyLearnedChart from './DailyLearnedChart';
```

Trong phần `return`, chèn ngay **sau** khối `<div className="grid gap-4 grid-cols-2 md:grid-cols-4">…</div>`:

```tsx
      {statsLoading && !stats && (
        <div className="bg-white border border-hairline rounded-2xl p-5 h-72 animate-pulse" />
      )}

      {!statsError && stats && (
        <DailyLearnedChart daily={stats.daily} days={days} onDaysChange={setDays} />
      )}
```

Khối skeleton giữ chỗ đúng chiều cao của chart để trang không nhảy layout lúc đang tải. Điều kiện `!stats` để khi đổi toggle 7 ↔ 30 ngày thì chart cũ vẫn đứng yên thay vì nháy sang skeleton.

- [ ] **Step 5: Verify trên trình duyệt**

Mở lại Dashboard.

Expected:
- Thấy card "Words learned per day" với biểu đồ cột màu cam
- Mặc định 30 cột; bấm "7 days" → còn 7 cột, bấm "30 days" → về 30
- Hover một cột có tooltip dạng `N words`
- Nhãn trục X đúng ngày hôm nay ở cột cuối cùng

- [ ] **Step 6: Verify chart cập nhật khi học từ mới**

Vào một session, bấm học thuộc một từ chưa học, quay lại Dashboard và reload.
Expected: cột của ngày hôm nay tăng thêm 1, KPI "Đã học" tăng 1, Streak ≥ 1.

Sau đó bỏ đánh dấu từ đó, reload lại.
Expected: KPI "Đã học" giảm 1 **nhưng cột chart của hôm nay vẫn giữ nguyên** — đây chính là điểm khác biệt của bảng event so với cột `learned_at`.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/chartSetup.ts frontend/src/components/dashboard/DailyLearnedChart.tsx frontend/src/components/dashboard/StatsSection.tsx
git commit -m "feat: add daily learned words chart with 7/30 day toggle"
```

---

### Task 6: Biểu đồ tiến độ theo session

**Files:**
- Create: `frontend/src/components/dashboard/SessionProgressChart.tsx`
- Modify: `frontend/src/components/dashboard/StatsSection.tsx`

**Interfaces:**
- Consumes: `Session[]` (đã có `total_cards`, `learned_cards`)
- Produces: `<SessionProgressChart sessions={Session[]} />`

- [ ] **Step 1: Tạo `frontend/src/components/dashboard/SessionProgressChart.tsx`**

```tsx
import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import type { Session } from '../../types';

const MAX_BARS = 10;

type SessionProgressChartProps = {
  sessions: Session[];
};

export default function SessionProgressChart({ sessions }: SessionProgressChartProps) {
  const withCards = sessions.filter((session) => session.total_cards > 0);

  const ranked = withCards
    .map((session) => ({
      title: session.title,
      learned: session.learned_cards,
      total: session.total_cards,
      percent: Math.round((session.learned_cards / session.total_cards) * 100),
    }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, MAX_BARS);

  if (ranked.length === 0) {
    return (
      <div className="bg-white border border-hairline rounded-2xl p-5">
        <h3 className="text-base font-semibold text-ink m-0 mb-2">Progress by session</h3>
        <p className="text-sm text-body m-0">No sessions with cards yet.</p>
      </div>
    );
  }

  const data = {
    labels: ranked.map((item) => item.title),
    datasets: [
      {
        label: 'Progress',
        data: ranked.map((item) => item.percent),
        backgroundColor: '#f54e00',
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = ranked[context.dataIndex];
            return `${item.learned}/${item.total} words (${item.percent}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: { color: '#807d72', callback: (value) => `${value}%` },
        grid: { color: '#e6e5e0' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#26251e' },
      },
    },
  };

  return (
    <div className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink m-0">Progress by session</h3>
        {withCards.length > MAX_BARS && (
          <span className="text-xs text-muted">
            {MAX_BARS} of {withCards.length} sessions
          </span>
        )}
      </div>

      <div style={{ height: `${Math.max(160, ranked.length * 36)}px` }}>
        <Bar data={data} options={options} />
      </div>

      <p className="text-xs text-muted m-0">Sorted by least complete first.</p>
    </div>
  );
}
```

- [ ] **Step 2: Nối vào `StatsSection.tsx`**

Thêm import:

```tsx
import SessionProgressChart from './SessionProgressChart';
```

Sửa khối chart đã thêm ở Task 5 thành hai cột:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        {!statsError && stats && (
          <DailyLearnedChart daily={stats.daily} days={days} onDaysChange={setDays} />
        )}
        <SessionProgressChart sessions={sessions} />
      </div>
```

- [ ] **Step 3: Verify trên trình duyệt**

Expected:
- Hai biểu đồ nằm cạnh nhau trên màn hình rộng, xếp dọc trên màn hình hẹp
- Bar theo session nằm ngang, trục X là `0%`–`100%`
- Session có tỉ lệ thấp nhất nằm **trên cùng**
- Hover một thanh → tooltip dạng `12/40 words (30%)`
- Session chưa có thẻ nào **không** xuất hiện trong biểu đồ

- [ ] **Step 4: Verify khi có nhiều session**

Nếu tài khoản có hơn 10 session có thẻ: Expected chỉ vẽ 10 thanh và góc phải hiện `10 of N sessions`.

Nếu chưa đủ 10 session để thử, tạm đổi `const MAX_BARS = 10;` thành `const MAX_BARS = 2;`, reload để xác nhận chú thích `2 of N sessions` hiện đúng, rồi đổi lại thành `10`.

- [ ] **Step 5: Kiểm tra build production**

```bash
cd frontend && npm run build
```
Expected: build thành công, không có lỗi TypeScript.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/SessionProgressChart.tsx frontend/src/components/dashboard/StatsSection.tsx
git commit -m "feat: add per-session progress chart to dashboard"
```

---

## Checklist verification cuối cùng

Chạy sau khi hoàn thành cả 6 task (đối chiếu mục 8 của spec):

- [ ] Mỗi card đang đã học có đúng 1 event `learned` với `occurred_at = created_at` (từ backfill)
- [ ] Đánh dấu 1 từ đã học → cột chart hôm nay tăng 1, streak cập nhật
- [ ] Bỏ đánh dấu → KPI "Đã học" giảm, cột chart của ngày học **giữ nguyên**
- [ ] Bật → tắt → bật cùng 1 từ trong 1 ngày → chart ngày đó vẫn chỉ tính 1
- [ ] Tạo card mới với `is_learned = true` → có sinh event `learned`
- [ ] `PATCH /cards/{id}/learned` hai lần cùng giá trị → chỉ 1 event
- [ ] Toggle 7 ↔ 30 ngày → số cột đổi đúng
- [ ] Xoá session có card đã học → event bị xoá theo, không mồ côi
- [ ] Tài khoản chưa có session → thấy empty state, không lỗi console
- [ ] Tắt backend → KPI/session bar vẫn render, chỉ vùng chart báo lỗi

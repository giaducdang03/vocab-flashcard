# Dashboard Charts — Design Spec

**Ngày:** 2026-09-09
**Trạng thái:** Đã duyệt design, chờ implementation plan

---

## 1. Mục tiêu

Thêm khu vực thống kê tiến độ học vào Dashboard, và tách UI thành 2 section: **Dashboard** (KPI + biểu đồ) và **Your sessions** (danh sách session như hiện tại).

### Trong phạm vi

- KPI tiles: tổng số từ, số từ đã học, tỉ lệ %, streak (chuỗi ngày học liên tiếp)
- Biểu đồ số từ học theo ngày (chọn cửa sổ 7 hoặc 30 ngày)
- Biểu đồ bar so sánh tiến độ giữa các session
- Bảng `card_learn_events` + migration, làm lịch sử học bất biến

### Ngoài phạm vi

- Donut/pie tổng quan đã học vs chưa học (đã cân nhắc và loại)
- Thống kê theo `card_type` (vocab vs collocation)
- Heatmap hoạt động kiểu GitHub
- Màn hình xem lịch sử chi tiết từng từ (dữ liệu có sẵn trong bảng event, nhưng chưa làm UI)

---

## 2. Các quyết định đã chốt

| # | Quyết định | Lựa chọn |
|---|------------|----------|
| 1 | Phạm vi dữ liệu | Snapshot **+** chuỗi thời gian → cần lưu mốc thời gian học |
| 2 | Thành phần hiển thị | KPI tiles + chart theo ngày + bar theo session (**không** donut) |
| 3 | Layout | 2 section xếp dọc trong cùng 1 trang, không thêm route |
| 4 | Backfill dữ liệu cũ | Sinh 1 event `learned` với `occurred_at = cards.created_at` cho mỗi card đang `is_learned = true` |
| 5 | Thư viện chart | `chart.js` + `react-chartjs-2`, register thủ công từng thành phần |
| 6 | Định nghĩa streak | Số ngày liên tiếp có ≥1 từ được học, đếm ngược từ hôm nay; nếu hôm nay chưa học thì bắt đầu từ hôm qua |
| 7 | Lưu lịch sử | Bảng `card_learn_events` bất biến — bỏ đánh dấu **không** xoá lịch sử |
| 8 | Cột `learned_at` | **Không thêm.** Có bảng event rồi thì cột này là dữ liệu thừa phải đồng bộ 2 nơi |

**Lưu ý về quyết định #4:** backfill bằng `created_at` nghĩa là ngày *import file* bị coi là ngày *học thuộc*. Dữ liệu lịch sử trước thời điểm migration sẽ không phản ánh đúng thực tế. Đây là đánh đổi có ý thức để chart có sẵn dữ liệu ngay.

---

## 3. Data model & migration

### 3.1 Model mới

`backend/app/models/card.py` — thêm class mới:

```python
class CardLearnEvent(Base):
    __tablename__ = "card_learn_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'learned' | 'unlearned'
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    card: Mapped["Card"] = relationship(back_populates="learn_events")
```

Và trên `Card` thêm quan hệ:

```python
learn_events: Mapped[list["CardLearnEvent"]] = relationship(
    back_populates="card", cascade="all, delete-orphan"
)
```

`cards.is_learned` **giữ nguyên** làm trạng thái hiện tại (dùng cho filter trong study mode và đếm `learned_cards`). Bảng event là lịch sử. Hai thứ được cập nhật cùng lúc trong một transaction bởi helper ở mục 4.2.

Chuỗi cascade khi xoá: xoá session → cascade xuống cards → cascade xuống events.

### 3.2 Migration

Revision thứ 2 của project, `down_revision = "20260817_initial_schema"`.

**upgrade():**
1. `op.create_table("card_learn_events", ...)` với FK `card_id → cards.id` (`ondelete="CASCADE"`)
2. `op.create_index("ix_card_learn_events_card_id", ...)` và `op.create_index("ix_card_learn_events_occurred_at", ...)`
3. Backfill:
   ```sql
   INSERT INTO card_learn_events (id, card_id, event_type, occurred_at)
   SELECT gen_random_uuid()::text, id, 'learned', created_at
   FROM cards WHERE is_learned = true
   ```
   `gen_random_uuid()` là hàm built-in từ Postgres 13+ (image đang dùng là `postgres:16-alpine`), không cần extension. Cast `::text` cho khớp kiểu `String(36)` của các bảng khác.

**downgrade():** drop table (index đi theo).

---

## 4. Backend — ghi trạng thái và lịch sử

### 4.1 Ba đường ghi `is_learned`

Khảo sát code cho thấy có **3** nơi thay đổi `is_learned`, không phải 1. Bỏ sót bất kỳ nơi nào sẽ làm lịch sử thủng:

| Nơi | File | Ghi chú |
|-----|------|---------|
| `create_card` | `routers/cards.py` | Nhận `payload.is_learned` từ `CardCreate` |
| `update_card` | `routers/cards.py` | Vòng `setattr`; `CardUpdate` có field `is_learned` |
| `toggle_card_learned` | `routers/cards.py` | `PATCH /cards/{id}/learned` |

Import hàng loạt (`routers/imports.py`) luôn tạo card với `is_learned = False` → không sinh event, không cần đụng tới.

### 4.2 Helper dùng chung

File mới `backend/app/services/learning.py`:

```python
def apply_learned_state(card: Card, is_learned: bool) -> None:
    """Đổi trạng thái đã học và ghi lại lịch sử.

    Chỉ sinh event khi trạng thái thực sự thay đổi — PATCH cùng một giá trị
    nhiều lần sẽ không tạo event rác.
    """
    if card.is_learned == is_learned:
        return

    card.is_learned = is_learned
    card.learn_events.append(
        CardLearnEvent(event_type="learned" if is_learned else "unlearned")
    )
```

Dùng `card.learn_events.append(...)` thay vì `db.add(CardLearnEvent(card_id=card.id, ...))` để không phải `flush()` lấy `card.id` trước — quan trọng ở `create_card` khi card còn chưa có id.

Cả 3 đường ghi ở 4.1 gọi hàm này thay vì gán `is_learned` trực tiếp. Riêng `update_card` phải **loại `is_learned` khỏi vòng `setattr`** rồi xử lý riêng qua helper.

Ở `create_card` phải **bỏ `is_learned=payload.is_learned` khỏi constructor `Card(...)`** rồi gọi helper sau đó. Nếu vẫn gán trong constructor, `card.is_learned` đã bằng giá trị đích khi helper chạy → helper early-return → **không sinh event nào**, card đã học mà lịch sử trống.

---

## 5. Backend — endpoint thống kê

### 5.1 Contract

```
GET /stats/daily?days=30&tz_offset_minutes=420
```

| Param | Kiểu | Ràng buộc | Mặc định |
|-------|------|-----------|----------|
| `days` | int | 1..365 | 30 |
| `tz_offset_minutes` | int | −840..840 | 0 |

**Response:**

```json
{
  "days": 30,
  "daily": [
    { "date": "2026-08-11", "learned_count": 0 },
    { "date": "2026-08-12", "learned_count": 5 }
  ],
  "current_streak": 7
}
```

- `daily` là chuỗi **dense**: đủ `days` phần tử, ngày không học có `learned_count = 0`. Frontend không phải vá lỗ hổng.
- Cửa sổ: từ `today − (days − 1)` đến `today`, tính theo **ngày local của client**.

### 5.2 Xử lý múi giờ

Backend lưu UTC. Frontend gửi `tz_offset_minutes = -new Date().getTimezoneOffset()` (Việt Nam → `420`). Backend gom nhóm theo ngày local:

```python
offset = timedelta(minutes=tz_offset_minutes)
local_date = func.date(CardLearnEvent.occurred_at + offset)
```

SQLAlchemy render `timedelta` thành tham số `INTERVAL` của Postgres. Nếu không làm bước này, học lúc 0–7h sáng (giờ VN) sẽ bị tính sang ngày hôm trước.

### 5.3 Truy vấn

Hai query, đều join `cards → sessions` để lọc theo `user_id`, và chỉ lấy `event_type = 'learned'`:

1. **Chuỗi ngày** — lọc `local_date >= start_date`, `GROUP BY local_date`, giá trị là **`COUNT(DISTINCT card_id)`**
2. **Streak** — `SELECT DISTINCT local_date` trên **toàn bộ lịch sử** (không giới hạn cửa sổ `days`, để streak dài hơn 30 ngày vẫn đếm đúng)

Sau đó Python dựng chuỗi dense từ dict `{date: count}`.

**Vì sao `COUNT(DISTINCT card_id)`:** nếu trong cùng một ngày bạn bật → tắt → bật lại một từ, sẽ có 2 event `learned`. Đếm distinct để ngày đó chỉ tính 1 từ. Cùng một từ học lại ở ngày khác thì vẫn tính cho từng ngày — đúng với ý nghĩa "hôm đó học được bao nhiêu từ".

### 5.4 Hàm tính streak

Tách thành pure function trong `backend/app/services/learning.py` để test được không cần DB:

```python
def calculate_streak(learned_dates: set[date], today: date) -> int:
    cursor = today if today in learned_dates else today - timedelta(days=1)
    streak = 0
    while cursor in learned_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
```

### 5.5 File

- `backend/app/routers/stats.py` (mới) — router, đăng ký trong `main.py` với `prefix="/stats"`
- `backend/app/schemas/stats.py` (mới) — `DailyPoint`, `DailyStatsOut`

---

## 6. Frontend

### 6.1 Dependency

Thêm `chart.js` và `react-chartjs-2`. Register thủ công để tree-shake, **không** dùng `registerables`:

`src/lib/chartSetup.ts`
```ts
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
```

### 6.2 Cấu trúc component

```
src/lib/chartSetup.ts               register Chart.js 1 lần
src/components/dashboard/
  StatsSection.tsx                  container: fetch /stats/daily, ghép KPI + 2 chart
  KpiTile.tsx                       presentational: label + value + đơn vị
  DailyLearnedChart.tsx             Bar dọc, props: daily[], days, onDaysChange
  SessionProgressChart.tsx          Bar ngang, props: sessions[]
```

Mỗi component một nhiệm vụ, nhận dữ liệu qua props; chỉ `StatsSection` biết tới API.

### 6.3 Luồng dữ liệu

`DashboardPage` đã fetch `/sessions` (đã có `total_cards` / `learned_cards`). Truyền xuống `StatsSection`:

| Số liệu | Nguồn |
|---------|-------|
| Tổng từ | `sum(session.total_cards)` |
| Đã học | `sum(session.learned_cards)` |
| Tỉ lệ % | `round(đã học / tổng × 100)`, tổng = 0 → `0` |
| Streak | `/stats/daily` → `current_streak` |
| Chart theo ngày | `/stats/daily` → `daily` |
| Bar theo session | `sessions` (không gọi thêm API) |

Chỉ phát sinh **1 request mới** cho toàn bộ khu vực stats.

### 6.4 Layout `DashboardPage.tsx`

```
topbar                          (giữ nguyên)
hero-card                       (giữ nguyên: tiêu đề + form tạo session)
── section "Dashboard"          <StatsSection sessions={sessions} />
── section "Your sessions"      session-grid (giữ nguyên)
```

Dùng lại class `section-header` sẵn có trong `index.css` cho cả hai tiêu đề để đồng nhất.

### 6.5 Chi tiết biểu đồ

**DailyLearnedChart** — bar dọc, trục X là ngày, trục Y là số từ.
- Toggle `7 ngày` / `30 ngày` đặt ở header của chart, đổi → refetch
- Ở chế độ 30 ngày chỉ hiện nhãn trục X thưa (mỗi 5 ngày) để không chồng chữ

**SessionProgressChart** — bar ngang (`indexAxis: 'y'`), mỗi session một thanh.
- Encode theo **phần trăm** (so sánh được giữa các session to nhỏ khác nhau); số lượng thô đưa vào tooltip
- Sắp xếp **tăng dần theo %** — session bỏ dở nhiều nhất lên đầu
- Hiển thị tối đa **10 session**, kèm chú thích `10/N session` nếu bị cắt (tránh chart vỡ khi có quá nhiều session)

**Màu sắc:** dùng token có sẵn (`primary #f54e00`, `hairline #e6e5e0`, `muted #807d72`). Khi implement sẽ load skill `dataviz` để chốt palette, trục và tooltip.

### 6.6 Types

`src/types/index.ts` thêm:

```ts
export type DailyPoint = { date: string; learned_count: number };
export type DailyStats = { days: number; daily: DailyPoint[]; current_streak: number };
```

`Card` và `CardOut` **không đổi** — không có cột `learned_at`.

---

## 7. Empty / error / loading states

| Tình huống | Hành vi |
|------------|---------|
| Chưa có session nào | `StatsSection` hiện 1 empty state gọn, không render chart |
| Có session nhưng 0 card | KPI = 0, chart hiện "Chưa có dữ liệu" |
| `daily` toàn số 0 | Vẫn vẽ trục, kèm chú thích "Chưa có từ nào được đánh dấu đã học trong N ngày qua" |
| `/stats/daily` lỗi | **Chỉ** chart theo ngày + tile streak báo lỗi; KPI và bar theo session vẫn chạy bình thường (vì lấy từ `/sessions`) |
| Đang tải | Skeleton cho vùng stats; `session-grid` hiển thị độc lập, không chờ stats |

Nguyên tắc: hỏng phần thống kê không được làm hỏng danh sách session.

---

## 8. Testing

Project hiện **chưa có test infra** (chỉ có test của thư viện trong `.venv`). Không dựng harness DB đầy đủ trong phạm vi này.

**Có test tự động** — thêm `pytest` vào `requirements.txt`:

- `calculate_streak` (pure function, không cần DB): tập rỗng; đúng 1 ngày; chuỗi liên tiếp; chuỗi đứt quãng; hôm nay chưa học nhưng hôm qua có; hôm nay và hôm qua đều không có
- `apply_learned_state` (chỉ cần object `Card` trong bộ nhớ, không cần DB): `False → True` sinh 1 event `learned`; `True → False` sinh 1 event `unlearned`; gọi lại cùng giá trị **không** sinh event nào; trạng thái `is_learned` đổi đúng

**Verification thủ công:**
1. Chạy migration → mỗi card đang đã học có đúng 1 event `learned` với `occurred_at = created_at`
2. Đánh dấu 1 từ đã học → chart hôm nay tăng 1, streak cập nhật
3. Bỏ đánh dấu → KPI "đã học" giảm, **nhưng cột chart của ngày học vẫn giữ nguyên** (đây là điểm khác biệt chính so với phương án cột `learned_at`)
4. Bật → tắt → bật cùng 1 từ trong 1 ngày → chart ngày đó vẫn chỉ tính 1
5. Đổi toggle 7 ↔ 30 ngày → số cột đổi đúng
6. Xoá 1 session có card đã học → events bị xoá theo, không còn mồ côi
7. Tài khoản chưa có session → thấy empty state, không lỗi console
8. Tắt backend → KPI/session bar vẫn render, chỉ vùng chart báo lỗi

---

## 9. Files touched

**Backend**
- `app/models/card.py` — thêm `CardLearnEvent` + quan hệ `Card.learn_events`
- `app/schemas/stats.py` — **mới**
- `app/services/learning.py` — **mới** (`apply_learned_state`, `calculate_streak`)
- `app/routers/cards.py` — 3 đường ghi dùng helper
- `app/routers/stats.py` — **mới**
- `app/main.py` — đăng ký router
- `alembic/versions/<new>.py` — **mới**
- `requirements.txt` — thêm `pytest`
- `tests/test_learning.py` — **mới**

**Frontend**
- `package.json` — `chart.js`, `react-chartjs-2`
- `src/types/index.ts`
- `src/lib/chartSetup.ts` — **mới**
- `src/components/dashboard/StatsSection.tsx` — **mới**
- `src/components/dashboard/KpiTile.tsx` — **mới**
- `src/components/dashboard/DailyLearnedChart.tsx` — **mới**
- `src/components/dashboard/SessionProgressChart.tsx` — **mới**
- `src/pages/DashboardPage.tsx` — tách 2 section

---

## 10. Rủi ro đã biết

| Rủi ro | Giảm thiểu |
|--------|------------|
| Backfill `created_at` làm lịch sử sai lệch | Đã chấp nhận có ý thức; chỉ ảnh hưởng dữ liệu trước migration |
| `is_learned` và bảng event lệch nhau | Chỉ đổi trạng thái qua `apply_learned_state`, cùng 1 transaction; có test cho helper |
| Bảng event phình theo thời gian | Mỗi lần toggle 1 dòng, quy mô cá nhân không đáng kể; có index `occurred_at` |
| Query `func.date(...)` không dùng được index | Quy mô cá nhân nên không đáng kể; nếu cần, thêm điều kiện chặn theo `occurred_at` UTC để sargable |
| Quá nhiều session làm vỡ bar chart | Cắt còn 10 session, sắp xếp tăng dần theo % |
| Bundle phình vì Chart.js | Register thủ công từng controller thay vì `registerables` |

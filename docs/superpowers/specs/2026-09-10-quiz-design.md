# Quiz (Bài kiểm tra) — Design Spec

**Date:** 2026-09-10
**Status:** Approved

## 1. Mục tiêu

Thêm chức năng tạo và làm bài kiểm tra trắc nghiệm 4 lựa chọn dựa trên card có sẵn trong các session của user, lưu lại kết quả từng lượt làm bài.

**Flow người dùng:**

1. Vào trang Bài kiểm tra → bấm "Tạo bài kiểm tra"
2. Chọn một hoặc nhiều session làm nguồn (tối thiểu 1)
3. Chọn số lượng câu hỏi
4. Chọn dạng câu hỏi (một hoặc nhiều)
5. Đặt tên đề → xác nhận → đề được sinh và lưu
6. Bấm vào đề để làm bài; mỗi câu trả lời xong hiện đúng/sai ngay
7. Nộp bài → xem điểm và review từng câu
8. Lịch sử tất cả các lượt làm được lưu lại và xem được

## 2. Quyết định thiết kế đã chốt

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Mô hình đề | Đề cố định, sinh câu hỏi một lần lúc tạo, làm lại nhiều lượt | So sánh điểm giữa các lượt trên cùng bộ câu hỏi |
| Phản hồi | Ngay sau mỗi câu, không quay lại sửa | Học nhanh, thấy sai ở đâu ngay |
| Nguồn đáp án nhiễu | Chỉ từ các session đã chọn | Nhiễu cùng chủ đề nên đủ khó |
| Liên kết `is_learned` | Không. Quiz tách riêng hoàn toàn | Không làm nhiễu streak/daily stats đang chạy |
| Trộn dạng câu hỏi | Chia đều rồi xáo trộn toàn bài | Đa dạng trong một lượt làm |
| Timer | Không có giới hạn thời gian | Chỉ ghi `duration_seconds` để hiển thị |
| Entry point | Trang `/quizzes` riêng | Tách khỏi Dashboard đang khá đầy |

## 3. Dạng câu hỏi

Ba dạng, định danh nội bộ:

| Mã | Đề bài hiển thị | 4 lựa chọn | Card hợp lệ |
|---|---|---|---|
| `en_to_vi` | `front_text` + `front_phonetic` | `back_text` | Mọi card |
| `vi_to_en` | `back_text` | `front_text` | Mọi card |
| `synonym` | `front_text` + `front_phonetic` | Từ tiếng Anh | `card_type = 'vocab'` và có ≥ 1 synonym |

## 4. Data model

Năm bảng mới. Theo đúng convention hiện có: PK `String(36)` chứa UUID sinh ở tầng Python, `DateTime(timezone=True)` với default `datetime.now(timezone.utc)`, không dùng SQL ENUM (dùng `String` + `Literal` ở Pydantic).

### 4.1 `quizzes`

| Field | Type | Note |
|---|---|---|
| `id` | String(36) PK | |
| `user_id` | String(36) FK → `users.id` | indexed |
| `title` | String(255) | |
| `question_types` | String(100) | Chuỗi phân cách dấu phẩy, ví dụ `"en_to_vi,synonym"` |
| `created_at` | DateTime(tz) | |

Relationship: `source_sessions`, `questions`, `attempts` — tất cả `cascade="all, delete-orphan"`.

### 4.2 `quiz_source_sessions`

Ghi lại đề được sinh từ những session nào (N-N). Chỉ mang tính hiển thị/truy vết — câu hỏi đã snapshot nên không phụ thuộc bảng này.

| Field | Type | Note |
|---|---|---|
| `quiz_id` | String(36) FK → `quizzes.id` ON DELETE CASCADE | PK ghép |
| `session_id` | String(36) FK → `sessions.id` ON DELETE CASCADE | PK ghép |

### 4.3 `quiz_questions`

Câu hỏi được **snapshot** đầy đủ lúc tạo đề: nếu sau này card bị sửa hoặc xoá, đề cũ vẫn nguyên vẹn và điểm giữa các lượt vẫn so sánh được.

| Field | Type | Note |
|---|---|---|
| `id` | String(36) PK | |
| `quiz_id` | String(36) FK → `quizzes.id` ON DELETE CASCADE | indexed |
| `card_id` | String(36) FK → `cards.id` ON DELETE SET NULL, nullable | Chỉ để link về card khi review |
| `question_type` | String(20) | `en_to_vi` / `vi_to_en` / `synonym` |
| `prompt_text` | Text | Snapshot đề bài |
| `prompt_phonetic` | String(200) nullable | Snapshot phiên âm (chỉ dạng `en_to_vi`, `synonym`) |
| `options` | Text | JSON array đúng 4 chuỗi |
| `correct_index` | Integer | 0–3 |
| `position` | Integer | Thứ tự trong đề |

`options` lưu JSON string qua `json.dumps` / `json.loads` trong service, không dùng kiểu JSON của Postgres (giữ tương thích với SQLite dùng cho dev/smoke test).

### 4.4 `quiz_attempts`

| Field | Type | Note |
|---|---|---|
| `id` | String(36) PK | |
| `quiz_id` | String(36) FK → `quizzes.id` ON DELETE CASCADE | indexed |
| `user_id` | String(36) FK → `users.id` | |
| `started_at` | DateTime(tz) | |
| `submitted_at` | DateTime(tz) nullable | `NULL` = đang làm dở |
| `score` | Integer, default 0 | Số câu đúng |
| `total_questions` | Integer | Snapshot số câu lúc bắt đầu lượt |
| `duration_seconds` | Integer nullable | Tính ở server: `submitted_at - started_at` |

### 4.5 `quiz_answers`

| Field | Type | Note |
|---|---|---|
| `id` | String(36) PK | |
| `attempt_id` | String(36) FK → `quiz_attempts.id` ON DELETE CASCADE | indexed |
| `question_id` | String(36) FK → `quiz_questions.id` ON DELETE CASCADE | |
| `selected_index` | Integer nullable | `NULL` = bỏ qua, không trả lời |
| `is_correct` | Boolean | |
| `answered_at` | DateTime(tz) | |

Unique constraint `(attempt_id, question_id)` — mỗi câu chỉ trả lời một lần trong một lượt.

### 4.6 ER

```
User 1──N Quiz 1──N QuizQuestion
              │           │
              │ 1──N QuizSourceSession N──1 Session
              │           │
              1──N QuizAttempt 1──N QuizAnswer ──1 QuizQuestion
```

## 5. API

Router mới `app/routers/quizzes.py` (prefix `/quizzes`) và `app/routers/attempts.py` (prefix `/attempts`). Mọi endpoint yêu cầu `get_current_user` và lọc theo `user_id` như các router hiện có.

### 5.1 `POST /quizzes/capacity`

Cho wizard biết tối đa sinh được bao nhiêu câu trước khi user chọn số câu.

Request:
```json
{ "session_ids": ["..."], "question_types": ["en_to_vi", "synonym"] }
```

Response:
```json
{
  "total_cards": 42,
  "per_type": { "en_to_vi": 42, "synonym": 17 },
  "max_questions": 59
}
```

`max_questions` = tổng capacity của các dạng đã chọn. Nếu `total_cards < 4` → trả `max_questions: 0`; frontend chặn bước tiếp theo với thông báo tương ứng.

### 5.2 `POST /quizzes`

Request:
```json
{
  "title": "Unit 1 + 2",
  "session_ids": ["..."],
  "question_count": 20,
  "question_types": ["en_to_vi", "vi_to_en", "synonym"]
}
```

Validate:
- `session_ids` ≥ 1 phần tử, tất cả phải thuộc user hiện tại (nếu không → 404)
- `question_types` ≥ 1 phần tử, mỗi phần tử thuộc 3 giá trị hợp lệ
- `question_count` trong khoảng 1–100
- Pool card của các session đã chọn phải ≥ 4 card, nếu không → 400 `"Cần ít nhất 4 thẻ để tạo bài kiểm tra"`

Sinh câu hỏi ngay, lưu `quizzes` + `quiz_source_sessions` + `quiz_questions` trong một transaction. Response là `QuizListItem` (mục 5.3). Nếu capacity thực tế nhỏ hơn `question_count`, đề được sinh với số câu bằng capacity — `question_count` trong response phản ánh số thực tế.

### 5.3 `GET /quizzes`

List đề của user, mới nhất trước. Mỗi phần tử là `QuizListItem`:

```json
{
  "id": "...",
  "title": "Unit 1 + 2",
  "question_types": ["en_to_vi", "synonym"],
  "question_count": 20,
  "source_session_titles": ["Unit 1", "Unit 2"],
  "attempt_count": 3,
  "best_score": 18,
  "last_attempt_at": "2026-09-10T10:00:00Z",
  "created_at": "2026-09-10T09:00:00Z"
}
```

`attempt_count` / `best_score` / `last_attempt_at` chỉ tính trên attempt đã submit (`submitted_at IS NOT NULL`). Không có attempt nào → `attempt_count: 0`, `best_score: null`, `last_attempt_at: null`.

### 5.4 `GET /quizzes/{id}`

`QuizListItem` + danh sách attempt đã submit (`AttemptSummary`: `id`, `submitted_at`, `score`, `total_questions`, `duration_seconds`), mới nhất trước. **Không** trả câu hỏi và không trả `correct_index`.

### 5.5 `DELETE /quizzes/{id}`

204. Cascade xoá source sessions, questions, attempts, answers.

### 5.6 `POST /quizzes/{id}/attempts`

Bắt đầu một lượt làm. Tạo `quiz_attempts` với `started_at = now`, `total_questions` = số câu của đề.

Response:
```json
{
  "attempt_id": "...",
  "quiz_title": "Unit 1 + 2",
  "questions": [
    {
      "id": "...",
      "question_type": "en_to_vi",
      "prompt_text": "abundant",
      "prompt_phonetic": "/əˈbʌndənt/",
      "options": ["dồi dào", "khan hiếm", "chậm chạp", "bền bỉ"],
      "position": 0
    }
  ]
}
```

**Không bao giờ trả `correct_index`.** Đây là ràng buộc bắt buộc: vì phản hồi hiện ngay sau mỗi câu, đáp án phải được chấm ở server từng câu một, client không được biết trước.

Nếu user có sẵn một attempt dở dang (`submitted_at IS NULL`) trên cùng đề, attempt cũ bị đánh dấu bỏ (xoá) và tạo attempt mới — tránh tích tụ attempt rác khi user thoát giữa chừng.

### 5.7 `POST /attempts/{id}/answers`

Request: `{ "question_id": "...", "selected_index": 2 }`
(`selected_index` `null` = bỏ qua câu này.)

Validate: attempt thuộc user hiện tại, chưa submit; `question_id` thuộc đúng quiz của attempt; chưa có answer cho cặp `(attempt, question)` — nếu đã có → 409.

Response: `{ "is_correct": false, "correct_index": 0 }`

Ghi `quiz_answers`, và tăng `quiz_attempts.score` nếu đúng.

### 5.8 `POST /attempts/{id}/submit`

Chốt lượt làm: set `submitted_at = now`, `duration_seconds = submitted_at - started_at`. Các câu chưa trả lời được ghi thành `quiz_answers` với `selected_index = NULL`, `is_correct = false`.

Response: `{ "attempt_id": "...", "score": 17, "total_questions": 20, "duration_seconds": 245 }`

Submit lần hai trên cùng attempt → 409.

### 5.9 `GET /attempts/{id}`

Review đầy đủ, **chỉ khi attempt đã submit** (chưa submit → 409). Trả về điểm, thời lượng, và từng câu kèm `options`, `correct_index`, `selected_index`, `is_correct`, `card_id` (để link về card nếu còn tồn tại).

### 5.10 Pydantic schemas

`app/schemas/quiz.py`:

```
QuestionType = Literal["en_to_vi", "vi_to_en", "synonym"]

CapacityRequest, CapacityResponse
QuizCreate, QuizListItem, QuizDetailOut
QuestionOut            # không có correct_index
AttemptStartOut, AttemptSummary
AnswerSubmitRequest, AnswerSubmitResponse
AttemptSubmitResponse
AttemptReviewOut, ReviewQuestionOut   # có correct_index
```

Tách rõ `QuestionOut` (lúc làm bài) và `ReviewQuestionOut` (sau khi submit) ở tầng schema là cách khiến việc lộ đáp án trở thành lỗi khó xảy ra chứ không phải lỗi dễ quên.

## 6. Service sinh đề — `app/services/quiz_generator.py`

Hàm thuần, **không chạm DB**: nhận list `Card` đã eager-load `synonyms`, trả list dict câu hỏi. Đây là phần logic dễ sai nhất nên được tách ra để unit-test độc lập.

```python
def compute_capacity(cards, question_types) -> dict[str, int]
def generate_questions(cards, question_types, question_count, rng) -> list[dict]
```

`rng` là `random.Random` được inject để test deterministic.

### 6.1 Pool hợp lệ

- `en_to_vi`, `vi_to_en`: mọi card trong pool
- `synonym`: card có `card_type == "vocab"` và `len(synonyms) >= 1`

### 6.2 Thuật toán

1. Nếu tổng số card < 4 → raise `ValueError` (router chuyển thành 400). Cần ≥ 4 card phân biệt để có 1 đáp án đúng + 3 nhiễu.
2. Chia `question_count` đều cho các dạng đã chọn (phần dư rải cho các dạng đầu theo thứ tự ngẫu nhiên).
3. Dạng nào có capacity nhỏ hơn phần được chia → chỉ lấy tối đa capacity, phần thiếu bù sang các dạng còn dư capacity. Nếu tổng capacity vẫn nhỏ hơn `question_count` → sinh đúng bằng tổng capacity.
4. Với mỗi dạng, chọn ngẫu nhiên các card chưa dùng cho dạng đó. Một card có thể xuất hiện ở nhiều dạng khác nhau, nhưng cặp `(card, dạng)` không lặp trong cùng một đề.
5. Sinh 3 đáp án nhiễu (chi tiết 6.3), xáo trộn 4 lựa chọn, ghi lại `correct_index`.
6. Xáo trộn thứ tự toàn bộ câu hỏi, gán `position` 0..n-1.

### 6.3 Sinh đáp án nhiễu

| Dạng | Đáp án đúng | Nhiễu |
|---|---|---|
| `en_to_vi` | `back_text` của card | `back_text` của 3 card khác |
| `vi_to_en` | `front_text` của card | `front_text` của 3 card khác |
| `synonym` | 1 synonym ngẫu nhiên của card | `front_text` của 3 card khác |

Ràng buộc chung: 4 lựa chọn phải phân biệt nhau theo so sánh chuỗi đã `strip()` và lowercase — pool có thể chứa card trùng nghĩa. Nếu không tìm đủ 3 nhiễu phân biệt cho một card cụ thể, bỏ card đó và thử card khác.

Ràng buộc riêng dạng `synonym`: nhiễu không được là `front_text` của chính card đó, cũng không được trùng bất kỳ synonym nào của card đó — nếu không, "nhiễu" sẽ thực ra cũng là đáp án đúng.

## 7. Frontend

### 7.1 Routes

| Route | Màn hình |
|---|---|
| `/quizzes` | Danh sách đề + nút tạo mới |
| `/quizzes/:id` | Chi tiết đề: thông tin + lịch sử các lượt làm + nút "Làm bài" |
| `/quizzes/:id/take` | Làm bài |
| `/attempts/:id` | Kết quả + review từng câu |

Tất cả bọc trong `ProtectedRoute` như route hiện có. Áp dụng scroll-to-top khi điều hướng, theo pattern đã có ở commit e52b115.

### 7.2 Components

| Component | Vai trò |
|---|---|
| `QuizCreateModal.tsx` | Wizard 4 bước: chọn session (checkbox, ≥1) → số câu (input, hiện max từ `/quizzes/capacity`) → dạng câu hỏi (checkbox, ≥1) → tên đề + xác nhận. Gọi `capacity` khi sang bước 2. |
| `QuizCard.tsx` | Thẻ đề trong danh sách: tên, số câu, badge dạng, số lượt làm, điểm cao nhất, nút xoá |
| `QuizQuestionView.tsx` | Một câu: prompt (+ phiên âm), 4 nút lựa chọn. Chọn xong → khoá lựa chọn, tô xanh đáp án đúng / đỏ đáp án sai đã chọn → nút "Câu tiếp" (câu cuối: "Nộp bài") |
| `AttemptResultView.tsx` | Điểm, phần trăm, thời lượng, danh sách review từng câu |
| `AttemptHistory.tsx` | Bảng lịch sử: thời điểm, điểm, thời lượng, link tới review |

### 7.3 Types

Bổ sung vào `frontend/src/types/index.ts`: `QuestionType`, `Quiz`, `QuizDetail`, `QuizQuestion`, `QuizAttempt`, `AttemptSummary`, `AttemptReview`, `ReviewQuestion`, `QuizCapacity`.

### 7.4 State khi làm bài

`TakeQuizPage` giữ state cục bộ: `questions`, `currentIndex`, `answers` (map `question_id` → `{selected_index, is_correct, correct_index}`). Mỗi lần chọn đáp án gọi `POST /attempts/:id/answers`, chờ response rồi mới hiển thị đúng/sai. Hết câu → gọi `submit` → điều hướng sang `/attempts/:id`.

Không persist state ra localStorage: rời trang giữa chừng nghĩa là bỏ lượt, và lượt dở dang sẽ bị dọn khi bắt đầu lượt mới (mục 5.6).

### 7.5 Entry point

Dashboard thêm nút/link "Bài kiểm tra" điều hướng sang `/quizzes`, đặt cạnh header của section "Your sessions", dùng lại style `icon-button` sẵn có.

## 8. Migration

Một file `backend/alembic/versions/20260910_add_quiz_tables.py`, `revision = "20260910_quiz"`, `down_revision = "20260909_events"`. Tạo 5 bảng và các index/constraint đã nêu ở mục 4. `downgrade()` drop theo thứ tự ngược.

Không backfill dữ liệu.

## 9. Testing

Repo hiện chưa có test suite tự động (chỉ `backend/smoke_test.py`).

- **Thêm pytest cho `quiz_generator`** (`backend/tests/test_quiz_generator.py`): 4 lựa chọn luôn phân biệt; `correct_index` trỏ đúng đáp án; dạng `synonym` chỉ dùng card vocab có synonym và nhiễu không trùng synonym của chính card; chia câu giữa nhiều dạng; capacity thiếu → giảm số câu; pool < 4 card → `ValueError`. Dùng `random.Random(seed)` để deterministic.
- **Mở rộng `smoke_test.py`**: luồng end-to-end tạo đề → bắt đầu lượt → trả lời → nộp → đọc review; kiểm tra endpoint lấy câu hỏi không trả `correct_index`.
- Không dựng test framework cho frontend trong phạm vi này.

## 10. Ngoài phạm vi

- Timer / giới hạn thời gian
- Cập nhật `is_learned` từ kết quả quiz
- Sửa đề sau khi tạo (chỉ tạo mới và xoá)
- Chia sẻ đề giữa các user
- Dạng câu hỏi điền từ hoặc nghe

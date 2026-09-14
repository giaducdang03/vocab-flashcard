# Thiết kế: Tạo quiz bằng AI với nhiều dạng câu hỏi hơn

Ngày: 2026-09-14

## 1. Mục tiêu

Cho phép người dùng chọn "sinh đề bằng AI" khi tạo quiz. Một LLM đọc các card
trong session người dùng đã chọn rồi viết ra câu hỏi, mở ra hai dạng mà bộ sinh
thuật toán hiện tại không làm được, và kèm phần giải thích cho mỗi đáp án đúng.

Nguồn kiến thức vẫn là bộ card của người dùng. AI **không** tự nghĩ ra từ vựng
mới hay chủ đề mới — điều đó nằm ngoài phạm vi bản thiết kế này.

## 2. Phạm vi

Trong phạm vi:

- Hai dạng câu hỏi mới: `cloze` (điền từ vào chỗ trống) và `context` (chọn từ
  đúng theo ngữ cảnh). Cả hai đều là trắc nghiệm 4 đáp án.
- Bắt buộc có `explanation` cho mọi câu do AI sinh.
- AI là tính năng bổ sung, **chỉ** phụ trách hai dạng mới. Ba dạng cũ
  (`en_to_vi`, `vi_to_en`, `synonym`) vẫn sinh bằng thuật toán như hiện tại,
  không đụng tới.
- Sinh đề chạy nền, frontend poll trạng thái.
- Tầng provider OpenAI-compatible, key đặt ở server.

Ngoài phạm vi:

- Dạng câu hỏi trả lời tự do (gõ chữ). Mọi dạng vẫn là MCQ 4 đáp án, nên chấm
  điểm và luồng làm bài không đổi.
- Dạng Đúng/Sai.
- Sinh card hoặc từ vựng mới từ chủ đề tự do.
- Người dùng tự nhập API key riêng.

## 3. Quyết định thiết kế và lý do

| Quyết định | Lý do |
|---|---|
| Giữ mọi dạng ở MCQ 4 đáp án | Không phải đụng vào `QuizAnswer.selected_index`, chấm điểm, `AnswerSubmitRequest`, hay luồng làm bài — phần đã chạy ổn định và có test. |
| AI chỉ phụ trách hai dạng mới | Ba dạng cũ đã có bộ sinh nhanh, miễn phí, và được test kỹ — không có lý do gì thay nó bằng một đường chậm hơn, tốn tiền hơn, và kém chắc chắn hơn. AI chỉ làm phần thuật toán không làm được. |
| Không có toggle AI riêng | Chọn `cloze`/`context` **chính là** bật AI. Một công tắc nữa chỉ tạo ra trạng thái mâu thuẫn (bật AI nhưng không chọn dạng AI nào) mà không thêm quyền lực gì cho người dùng. |
| Một lần gọi LLM cho cả đề | Rẻ nhất, đề nhất quán, LLM tự tránh trùng ý giữa các câu. Đổi lại phải lấy mẫu card khi session quá lớn. |
| Job nền + polling | Sinh đề mất 10–40 giây; giữ kết nối HTTP mở lâu như vậy phụ thuộc vào timeout của nginx và dễ vỡ. |
| Trạng thái nằm ở DB, không ở RAM | Nhiều uvicorn worker vẫn poll đúng, vì request poll có thể rơi vào worker khác với worker đang sinh đề. |
| Lọc câu hỏng rồi bù bằng thuật toán | Người dùng luôn nhận đủ số câu đã yêu cầu, kể cả khi LLM trả về kết quả kém. |
| Tầng provider trừu tượng | Đổi endpoint/model sau này chỉ là thêm một file, và test dùng provider giả không cần mạng. |

## 4. Dạng câu hỏi mới

| Mã | Tên | Prompt | Options |
|---|---|---|---|
| `cloze` | Điền từ vào chỗ trống | Câu tiếng Anh chứa `___`, dựa trên `example` của card hoặc AI tự đặt | 4 từ tiếng Anh, đúng 1 |
| `context` | Chọn từ đúng theo ngữ cảnh | Tình huống/câu mô tả ngữ cảnh dùng từ | 4 từ tiếng Anh gần nghĩa, đúng 1 |

`QuestionType` mở rộng từ 3 lên 5 giá trị ở `app/schemas/quiz.py` và
`frontend/src/types/index.ts`, kèm nhãn tiếng Việt trong `QUESTION_TYPE_LABELS`.

Hai dạng này **chỉ** sinh được bằng AI, và AI **chỉ** sinh hai dạng này. Ba dạng
cũ luôn đi qua `generate_questions()` như hiện tại, kể cả trong một quiz có dùng
AI.

Hệ quả là một quiz rơi vào một trong ba nhóm:

| Dạng đã chọn | Đường sinh | Trạng thái ban đầu |
|---|---|---|
| Chỉ dạng cũ | Thuật toán, đồng bộ | `ready` ngay — **không đổi gì so với hiện tại** |
| Chỉ dạng mới | AI, chạy nền | `pending` |
| Trộn cũ + mới | Phần cũ sinh ngay bằng thuật toán, phần mới sinh nền bằng AI | `pending` |

Ở nhóm thứ ba, câu thuật toán được ghi vào DB ngay lúc tạo quiz; task nền chỉ
thêm phần AI rồi chuyển `ready`. Nghĩa là nếu AI hỏng hoàn toàn, quiz vẫn còn
phần câu hỏi thuật toán dùng được.

Khi chưa cấu hình `AI_API_KEY`, hai dạng mới không hiện trong danh sách chọn, và
backend từ chối request có chúng bằng 400.

## 5. Thay đổi mô hình dữ liệu

Mọi cột mới đều có default hoặc nullable, nên migration không cần backfill và
quiz cũ chạy nguyên vẹn.

Bảng `quizzes`:

```
status            String(20)  NOT NULL default 'ready'   -- pending | ready | failed
uses_ai           Boolean     NOT NULL default False     -- quiz có chọn dạng cần AI không
error_message     Text        nullable                   -- lý do failed, hiện cho user
ai_question_count Integer     NOT NULL default 0         -- số câu thực sự do AI viết
retry_count       Integer     NOT NULL default 0         -- số lần đã bấm Thử lại, tối đa 3
```

Bảng `quiz_questions`:

```
source       String(10)  NOT NULL default 'algo'   -- algo | ai
explanation  Text        nullable                  -- NULL với câu thuật toán
```

Bất biến: `source = 'ai'` ⟹ `explanation` khác NULL và khác rỗng. Câu AI thiếu
explanation bị loại ở bước validate, nên không bao giờ ghi được vào DB.

Không có bảng mới. Hạn mức theo ngày đếm trực tiếp từ `quizzes`.

## 6. Nơi giải thích được lộ ra

| Schema | Có `explanation`? | Lý do |
|---|---|---|
| `QuestionOut` (đang làm bài) | Không | Giải thích nói thẳng đáp án đúng. Giữ đúng nguyên tắc sẵn có là `QuestionOut` không gửi `correct_index`. |
| `AnswerSubmitResponse` | Có (`str \| None`) | Backend đã trả `is_correct` + `correct_index` ngay sau mỗi câu; đây là lúc giải thích có tác dụng học nhất. |
| `ReviewQuestionOut` | Có (`str \| None`) | Hiện dưới đáp án đúng ở trang xem lại bài. |

## 7. Tầng AI

Thư mục mới `app/services/ai/`:

```
ai/provider.py       Protocol LLMProvider:
                       async def complete_json(system, user, max_tokens) -> str
ai/openai_compat.py  OpenAICompatProvider — SDK `openai` (AsyncOpenAI), base_url cấu hình được
ai/quiz_prompt.py    build_prompt() và parse_and_validate() — thuần, không chạm DB
ai/__init__.py       get_provider() — trả None khi chưa cấu hình key
```

Interface cố tình hẹp: "gửi prompt, nhận chuỗi JSON". Đổi sang provider khác là
thêm một file; test dùng provider giả trả chuỗi JSON cố định.

Dependency mới: `openai>=1.40` trong `backend/requirements.txt`.

### 7.1 Cấu hình

Thêm vào `app/config.py`:

```
AI_BASE_URL: str = "https://api.openai.com/v1"
AI_API_KEY: str = ""            # rỗng = tính năng AI tắt
AI_MODEL: str = "gpt-4o-mini"
AI_MAX_CARDS_PER_PROMPT: int = 120
AI_DAILY_QUIZ_LIMIT: int = 20   # mỗi user
AI_TIMEOUT_SECONDS: int = 90
```

`AI_API_KEY` rỗng thì `GET /quizzes/ai-status` trả `available: false`, frontend
ẩn hai dạng mới khỏi danh sách chọn, và app chạy y như trước khi có tính năng
này.

Endpoint OpenAI-compatible nghĩa là cấu hình này dùng được cho OpenAI,
OpenRouter, Groq, DeepSeek, hay LLM chạy nội bộ — chỉ khác `AI_BASE_URL` và
`AI_MODEL`.

### 7.2 Dựng prompt

`build_prompt(cards, ai_types, ai_question_count)` serialize mỗi card gọn lại:
`front_text`, `front_phonetic`, `back_text`, `example`, `synonyms`. Nếu số card
vượt `AI_MAX_CARDS_PER_PROMPT` thì lấy mẫu ngẫu nhiên đúng ngưỡng — số câu tối
đa là 100 nên hiếm khi cần nhiều card hơn thế.

`ai_types` chỉ có thể chứa `cloze` và `context`; hàm raise `ValueError` nếu gặp
dạng khác. Đây là chỗ ràng buộc "AI chỉ làm hai dạng mới" được ép ở mức code chứ
không chỉ ở mức quy ước.

Prompt yêu cầu trả về một JSON object chứa mảng câu hỏi, mỗi phần tử có
`card_id`, `question_type`, `prompt_text`, `options` (4 chuỗi), `correct_index`,
`explanation`.

Request gửi kèm `response_format={"type": "json_object"}`, nhưng **không** dựa
vào nó: nhiều endpoint tương thích bỏ qua tham số này. Không dùng structured
outputs (`json_schema`) vì còn kén endpoint hơn nữa.

### 7.3 Parse và validate

`parse_and_validate(raw, cards, ai_types)` trả về
`(list[GeneratedQuestion] hợp lệ, list[str] lý do bị loại)`.

Bóc ```` ```json ```` fence và cắt từ `{` đầu tiên tới `}` cuối trước khi
`json.loads`, để chịu được chữ thừa quanh JSON.

Một câu bị loại nếu:

- JSON sai hình dạng hoặc thiếu trường bắt buộc.
- `question_type` không nằm trong danh sách đã yêu cầu.
- `options` không đúng 4 phần tử, hoặc có hai phần tử trùng nhau sau khi chuẩn
  hóa (dùng lại `_normalize` trong `quiz_generator.py`).
- `correct_index` không nằm trong 0–3.
- `explanation` thiếu hoặc rỗng sau khi strip.
- `card_id` không thuộc bộ card đã gửi trong prompt.
- `question_type == 'cloze'` mà `prompt_text` không chứa `___`.

Đây là ranh giới tin cậy của tính năng: **không dữ liệu nào từ LLM đi vào DB mà
không qua `parse_and_validate`.**

### 7.4 Bù câu thiếu

Số câu người dùng xin được chia cho các dạng đã chọn bằng `_distribute()` sẵn có,
nên biết trước cần bao nhiêu câu AI (`N_ai`, phần của `cloze` + `context`) và bao
nhiêu câu thuật toán. Phần thuật toán sinh ngay lúc tạo quiz và không phụ thuộc
vào AI.

Nếu sau validate chỉ còn `n < N_ai` câu AI hợp lệ:

1. Gọi `generate_questions()` sẵn có để bù `N_ai - n` câu bằng các dạng cũ **mà
   người dùng đã chọn**, loại trừ card đã dùng để không hỏi trùng một card.
2. Câu bù mang `source='algo'` và `explanation=NULL`.
3. `ai_question_count` ghi lại đúng `n`, để giao diện nói được là đề có trộn câu
   thường.

Nếu người dùng **chỉ** chọn dạng AI thì không có dạng cũ nào để bù. Khi đó:

- `n > 0`: quiz `ready` với `n` câu, giao diện nói rõ là ít hơn số đã yêu cầu.
- `n = 0`: quiz `failed` kèm `error_message`, người dùng bấm Thử lại.

Nếu quiz trộn cả hai nhóm dạng và AI hỏng hoàn toàn, quiz vẫn `ready` với phần
câu hỏi thuật toán — không bao giờ mất trắng.

## 8. Luồng API

### 8.1 `POST /quizzes` phân nhánh theo dạng câu hỏi đã chọn

Không có trường mới trong request. Endpoint tự nhìn `question_types`: có
`cloze`/`context` hay không quyết định quiz đi đường nào. Client cũ chỉ gửi ba
dạng cũ nên tự động đi đúng nhánh đồng bộ.

**Không có dạng AI** — y hệt hiện tại: sinh đồng bộ, trả quiz `status='ready'`,
`uses_ai=False`. Hành vi cũ không đổi một dòng nào.

**Có dạng AI:**

1. Validate quyền sở hữu session và số card tối thiểu như hiện tại.
2. Từ chối bằng 400 nếu `AI_API_KEY` chưa cấu hình.
3. Kiểm tra hạn mức ngày; vượt thì trả 429.
4. `_distribute()` chia số câu cho các dạng đã chọn, tách ra `N_ai` và phần
   thuật toán.
5. Tạo `Quiz(status='pending', uses_ai=True)`, các `QuizSourceSession`, và **các
   câu hỏi thuật toán** (nếu có), rồi **commit**.
6. Đăng ký một `BackgroundTasks`.
7. Trả về ngay `QuizListItem` với `status='pending'` và `question_count` bằng số
   câu thuật toán đã ghi.

Background task **tự mở session DB riêng** qua sessionmaker, không dùng lại `db`
của request — session đó đã đóng khi response trả xong. Task đọc card, gọi
provider, validate, bù thiếu, ghi thêm `quiz_questions` nối tiếp `position` sẵn
có, xáo lại thứ tự câu, rồi đặt `status='ready'` — hoặc `status='failed'` +
`error_message` trong trường hợp duy nhất mô tả ở mục 7.4.

### 8.2 Endpoint mới

```
GET  /quizzes/ai-status      -> { available, daily_limit, used_today }
GET  /quizzes/{id}/status    -> { status, question_count, error_message }
POST /quizzes/{id}/retry     -> sinh lại một quiz đang 'failed', giữ nguyên id
```

`retry` giữ nguyên id để không sinh ra quiz rác mỗi lần thử lại.

`QuizListItem` thêm `status`, `uses_ai`, `error_message`, `ai_question_count`.

### 8.3 Hạn mức

Đếm `Quiz` của user có `uses_ai=True` và `created_at` trong 24 giờ qua, so với
`AI_DAILY_QUIZ_LIMIT`. Vượt thì 429 kèm thông báo rõ ràng. Không cần bảng mới.

Hai điểm chốt rõ để tránh hiểu hai nghĩa:

- Quiz `failed` **vẫn tính** vào hạn mức, vì nó đã tiêu tốn một lần gọi API.
- `retry` **không tính** thêm một lần nữa, vì quiz đó đã được đếm lúc tạo. Đổi
  lại, `retry` bị giới hạn tối đa 3 lần cho mỗi quiz để một quiz hỏng không thể
  gọi API vô hạn; lần thứ 4 trả 429.

### 8.4 Quiz mồ côi

Background task là asyncio in-process, nên backend restart giữa chừng sẽ để lại
quiz kẹt `pending` vĩnh viễn. Xử lý: khi đọc status, quiz `pending` có
`created_at` cũ hơn 10 phút được coi là `failed` với thông báo "quá trình sinh
đề bị gián đoạn", và người dùng bấm retry.

Đây là cách rẻ nhất mà không phải thêm Redis/Celery vào hạ tầng hiện tại
(`db + backend + frontend + nginx`). Nếu sau này cần đảm bảo chắc chắn hơn thì
mới thay bằng worker thật.

## 9. Frontend

### 9.1 Modal tạo quiz

`QuizCreateModal.tsx` là wizard 4 bước (session → số câu → dạng câu hỏi →
tiêu đề). **Không thêm toggle nào.** Thay đổi duy nhất ở bước 2 (dạng câu hỏi):

- Khi `GET /quizzes/ai-status` trả `available: true`, danh sách dạng có thêm
  `cloze` và `context`, mỗi cái mang một chip "AI".
- Chọn ít nhất một trong hai ⟹ hiện một dòng ghi chú ngay dưới danh sách: đề sẽ
  được soạn nền và mất chút thời gian.
- Khi `available: false`, hai dạng này không render. Bước 2 trông y như hiện tại.

Các bước còn lại của wizard không đổi.

### 9.2 Capacity

`POST /quizzes/capacity` hiện tính cho mọi dạng. Với `cloze`/`context` thì
capacity không xác định trước được — AI tự đặt câu nên mọi card đều dùng được.
Quy ước: hai dạng này có capacity bằng số card, và `compute_capacity` ở backend
trả đúng như vậy, để endpoint giữ một ý nghĩa nhất quán thay vì để frontend đoán.

### 9.3 Danh sách quiz

`QuizzesPage.tsx` và `QuizCard.tsx`:

- Quiz `pending`: skeleton với nhãn "AI đang soạn đề", không bấm vào làm bài được.
- Quiz `failed`: hiện `error_message` và nút "Thử lại".
- Hook `useQuizPolling` gom logic poll một chỗ: poll `/status` mỗi 2 giây cho
  từng quiz `pending`, tự dừng khi không còn quiz `pending` nào.

### 9.4 Làm bài và xem lại

- `QuizQuestionView.tsx`: dạng `cloze` tách `prompt_text` tại `___` để chỗ trống
  nổi bật; dạng `context` dùng layout prompt sẵn có.
- Sau khi trả lời, `explanation` từ `AnswerSubmitResponse` hiện trong khối
  feedback.
- `AttemptReviewPage.tsx`: hiện `explanation` dưới đáp án đúng, kèm nhãn nhỏ
  "AI soạn" cho câu có `source='ai'`.

## 10. Kiểm thử

Theo TDD, dùng pattern sẵn có trong `backend/tests/`.

Unit thuần cho `parse_and_validate` — mỗi luật loại câu hỏng một test, không cần
mạng:

- JSON hỏng / bọc trong code fence / có chữ thừa quanh JSON.
- `options` trùng nhau sau chuẩn hóa.
- `correct_index` ngoài 0–3.
- `explanation` thiếu hoặc rỗng.
- `cloze` thiếu `___`.
- `card_id` không thuộc bộ card đã gửi.
- `question_type` không được yêu cầu.

Unit cho `build_prompt`:

- Lấy mẫu đúng `AI_MAX_CARDS_PER_PROMPT` khi số card vượt ngưỡng.
- Raise `ValueError` khi `ai_types` chứa một dạng cũ — ép ràng buộc "AI chỉ làm
  hai dạng mới" ở mức code.

Test bù thiếu: quiz trộn, xin 10 câu (5 AI + 5 thuật toán), provider giả trả 3
câu AI hợp lệ ⟹ quiz có 10 câu, 3 câu `source='ai'` có explanation, 7 câu
`source='algo'`, không câu nào trùng card.

Test luồng:

- Chỉ dạng cũ ⟹ `ready` ngay, `uses_ai=False`, **provider không được gọi lần
  nào**. Đây là test hồi quy quan trọng nhất.
- Chỉ dạng AI ⟹ `pending`; chạy xong task ⟹ `ready` với toàn câu `source='ai'`.
- Trộn hai nhóm ⟹ response đầu tiên đã có sẵn số câu thuật toán; sau task thì đủ
  số câu.
- Chỉ dạng AI + provider ném lỗi ⟹ `failed` kèm `error_message`.
- Trộn + provider ném lỗi ⟹ `ready`, chỉ còn câu thuật toán, không `failed`.
- Chọn dạng AI khi `AI_API_KEY` rỗng ⟹ 400.
- Vượt hạn mức ⟹ 429.
- `retry` trên quiz `failed` ⟹ quay lại `pending`, giữ nguyên id; lần thứ 4 ⟹ 429.
- Quiz `pending` quá 10 phút ⟹ đọc status thấy `failed`.

## 11. Rủi ro đã biết

| Rủi ro | Giảm thiểu |
|---|---|
| LLM viết câu sai ngữ pháp hoặc đáp án gây tranh cãi | Validate chỉ bắt được lỗi cấu trúc, không bắt được chất lượng ngôn ngữ. Chấp nhận, và explanation giúp người học tự đánh giá. |
| Chi phí API chạy loạn | `AI_DAILY_QUIZ_LIMIT` mỗi user, và một lần gọi cho cả đề thay vì một lần mỗi câu. |
| Backend restart làm kẹt quiz | Luật quá 10 phút ở mục 8.4. |
| Endpoint tương thích không hỗ trợ `response_format` | Parse chịu được fence và chữ thừa; không dựa vào structured outputs. |
| Session rất lớn vượt context | Lấy mẫu card theo `AI_MAX_CARDS_PER_PROMPT`. Nếu sau này thành vấn đề thật thì chuyển sang chia lô theo card. |
| Tính năng AI làm hỏng luồng quiz đang chạy tốt | AI nằm hoàn toàn ở nhánh riêng: không chọn dạng mới thì không một dòng code AI nào chạy. Test hồi quy ở mục 10 canh đúng điều này. |

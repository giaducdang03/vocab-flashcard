# Release Notes — VocabFlash

Lịch sử phát hành, mới nhất ở trên cùng.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/). Số phiên bản được đánh theo mốc tính năng; repo hiện chưa gắn git tag tương ứng.

---

## [0.4.0] — 2026-09-10 · Quiz trắc nghiệm

Bản phát hành lớn nhất từ trước tới nay: VocabFlash không chỉ là công cụ lật thẻ nữa, mà đã có hệ thống **kiểm tra kiến thức** hoàn chỉnh — tự sinh đề trắc nghiệm từ chính bộ thẻ của bạn, chấm điểm và lưu lịch sử.

### Thêm mới

**Bộ sinh câu hỏi** (`app/services/quiz_generator.py`)

- Ba loại câu hỏi 4 đáp án: `en_to_vi` (Anh → Việt), `vi_to_en` (Việt → Anh), `synonym` (chọn từ đồng nghĩa).
- `compute_capacity()` — tính trước số câu tối đa mỗi loại có thể sinh từ pool thẻ đã chọn, để wizard hiển thị giới hạn thật thay vì để người dùng đoán.
- Chọn distractor thông minh: loại trừ không phân biệt hoa thường đáp án đúng, `front_text` của thẻ hiện tại, và toàn bộ synonym còn lại của thẻ đó (với câu synonym); khử trùng lặp trước khi bốc ngẫu nhiên 3 phương án sai.
- Phân bổ số câu đều cho các loại đã chọn, phần dư rải ngẫu nhiên trong giới hạn capacity.
- Yêu cầu tối thiểu **4 thẻ** trong pool. Toàn bộ module là pure function, không chạm DB — nên unit test được trọn vẹn.

**Schema & API**

- 5 bảng mới: `quizzes`, `quiz_source_sessions`, `quiz_questions`, `quiz_attempts`, `quiz_answers` (migration `20260910_add_quiz_tables.py`).
- Router `/quizzes`: `POST /capacity`, `POST ""`, `GET ""`, `GET /{id}`, `DELETE /{id}`, `POST /{id}/attempts`.
- Router `/attempts`: `POST /{id}/answers`, `POST /{id}/submit`, `GET /{id}`.
- Quiz có thể lấy nguồn từ **nhiều session cùng lúc** (quan hệ N:M).

**Giao diện**

- **Quiz creation wizard** — chọn session nguồn → chọn loại câu hỏi → xem capacity → chọn số câu (1–100) → đặt tên.
- **Trang danh sách quiz** (`/quizzes`) với lối vào từ dashboard, hiển thị số lượt làm và điểm cao nhất.
- **Trang chi tiết quiz** kèm lịch sử toàn bộ lượt làm: điểm, thời gian làm bài, ngày nộp.
- **Trang làm bài** — phản hồi **ngay sau mỗi câu**: chọn xong là biết đúng/sai và đâu là đáp án đúng.
- **Trang review** — bảng phân tích từng câu: đề bài, lựa chọn của bạn, đáp án đúng, kèm thanh tiến độ.
- **Badge màu theo loại câu hỏi** để phân biệt nhanh en→vi / vi→en / synonym.
- Badge **NEW** trên dashboard giới thiệu tính năng quiz.

### Thiết kế đáng chú ý

- **Câu hỏi là snapshot.** Prompt và options được lưu nguyên văn tại thời điểm tạo quiz; `card_id` chỉ giữ để review liên kết ngược lại thẻ, với `ON DELETE SET NULL`. Sửa hoặc xóa thẻ gốc không làm hỏng quiz và bài làm cũ.
- **Không rò rỉ đáp án.** Payload gửi về client khi đang làm bài (`QuestionOut`) cố ý không chứa `correct_index`. Đáp án đúng chỉ trả về sau khi đã chọn.
- **Chống trả lời lại.** Ràng buộc unique `(attempt_id, question_id)` ở tầng DB, cộng kiểm tra 409 ở tầng API; nộp bài rồi thì không ghi thêm câu trả lời nào.

### Thay đổi khác

- Tách `PageHeader` dùng chung cho mọi trang, logo bấm được để về dashboard.
- Thêm favicon.
- Tên session trong trang quiz trở thành link bấm được.
- Tinh chỉnh typography: giảm cỡ chữ tiêu đề quiz ở trang danh sách, trang chi tiết và trang review; in đậm tiêu đề quiz.
- Thêm thanh tiến độ ở trang review.

### Sửa lỗi

- Nút **Review** trong lịch sử làm bài giờ điều hướng đúng chỗ (trước đó không có handler).
- Sửa lỗi TypeScript ở `PageHeader` khi `onLogout` không được truyền vào.
- Badge NEW được đặt ra ngoài nút để không đè lên chữ.

### Kiểm thử

- `tests/test_quiz_generator.py` — phủ tính capacity, sinh cả ba loại câu, loại trừ distractor, phân bổ đa loại.
- `smoke_test_quiz.py` — smoke test end-to-end toàn bộ luồng tạo quiz → làm bài → nộp → review.

---

## [0.3.0] — 2026-09-09 · Dashboard thống kê & theo dõi tiến độ

Trả lời câu hỏi "mình học được bao nhiêu rồi?" bằng dữ liệu thật thay vì cảm giác.

### Thêm mới

**Nền tảng dữ liệu**

- Bảng `card_learn_events` — log **bất biến** ghi lại mọi lần `learned` / `unlearned` kèm timestamp (migration `20260909_add_card_learn_events.py`, có backfill từ cột `is_learned` đang có).
- Mọi thao tác ghi `is_learned` đều đi qua `apply_learned_state()`, chỉ sinh event khi trạng thái thực sự đổi — gọi lặp cùng giá trị không tạo event trùng.
- `GET /stats/daily` trả về chuỗi số từ học theo ngày + streak hiện tại, nhận `days` (1–365) và `tz_offset_minutes` (−840…840).

**Giao diện**

- Dashboard tách thành hai khu vực rõ ràng: **Dashboard** (thống kê) và **Your sessions**.
- **KPI tiles**: Total words, Learned, Mastery (%), Streak (ngày).
- **Biểu đồ Daily learned words** với nút chuyển khung **7 ngày / 30 ngày** (Chart.js).
- **Biểu đồ Per-session progress** — tiến độ từng bộ thẻ.
- Lời chào cá nhân hóa "Welcome back" trên dashboard.
- Menu người dùng dạng dropdown với tên đầy đủ và nút đăng xuất.
- Footer kèm thông tin bản quyền.

### Thiết kế đáng chú ý

- **Gom ngày theo múi giờ local.** Client gửi `tz_offset_minutes`, backend cộng offset trước khi `date()` — nên "hôm nay" của người dùng đúng là hôm nay, không phải theo UTC.
- **Streak không gãy giữa ngày.** Nếu hôm nay chưa học từ nào, streak được tính lùi từ hôm qua thay vì tụt về 0.
- **Đếm theo thẻ riêng biệt.** Số từ học mỗi ngày dùng `COUNT(DISTINCT card_id)`, nên bật/tắt learned nhiều lần trong ngày không thổi phồng con số.
- Dùng `db.add()` thay vì `card.learn_events.append()`: trong async SQLAlchemy, chạm vào collection của object persistent sẽ trigger lazy load và ném `MissingGreenlet`.

### Thay đổi khác

- Chuyển toàn bộ UI copy của biểu đồ dashboard sang tiếng Anh cho nhất quán.
- Tạo session chuyển từ form inline sang modal.
- Tự cuộn lên đầu trang khi điều hướng sang chi tiết session hoặc chế độ học.

### Sửa lỗi

- Tiêu đề session dài trong biểu đồ tiến độ giờ được rút gọn còn 25 ký tự kèm tooltip khi hover, thay vì phá vỡ layout.
- Sửa căn chỉnh nút icon (flexbox) và trạng thái hover.
- Sửa căn lề nút đóng modal.

---

## [0.2.0] — 2026-09-08 · Phát âm & tùy biến chế độ học

### Thêm mới

- **Phát âm trong chế độ học** qua Web Speech API — bấm loa để nghe từ.
  - Chọn giọng **nam / nữ** và giọng vùng **en-US / en-GB**, lưu trong `localStorage`.
  - Fallback theo thứ tự ưu tiên: giữ accent → giữ gender → voice tiếng Anh bất kỳ; kèm toast báo khi không khớp chính xác (ví dụ máy chỉ có giọng nữ UK trong khi bạn chọn nam UK).
- **Tùy biến hiển thị thẻ** — menu *Show on card* bật/tắt riêng `phonetic`, `synonyms`, `example`. Lưu trong `localStorage`.
- **Shuffle** thứ tự thẻ (Fisher–Yates), bấm lại để trộn lại.
- **Copy Prompt** trong modal import — sinh sẵn prompt tiếng Việt để nhờ AI tạo nội dung CSV đúng format; prompt tự điều chỉnh theo lựa chọn chỉ vocab / chỉ collocation / cả hai, có synonyms hay không.
- **Tải template CSV** (`GET /cards/template/download`) với ví dụ sẵn cho cả vocab và collocation.

### Sửa lỗi

- Sửa lỗi khớp giới tính giọng đọc — trước đó chọn "nam" vẫn có thể ra giọng nữ mà không báo gì.
- Sửa bug preview và copy trong modal import.
- Sửa layout modal import bị vỡ khi hệ điều hành đặt display scaling cao.
- Sửa hiển thị tiến độ học trên dashboard.
- Copy prompt có đường lui bằng `document.execCommand` khi trang không chạy trong secure context (Clipboard API không khả dụng).

---

## [0.1.0] — 2026-08-17 · Bản đầu tiên

MVP hoàn chỉnh theo [vocab-flashcard-spec.md](vocab-flashcard-spec.md).

### Thêm mới

**Xác thực**
- Đăng ký / đăng nhập bằng email + mật khẩu (argon2), JWT hết hạn sau 24 giờ.
- `GET /auth/me`, `ProtectedRoute`, axios interceptor tự gắn token.

**Sessions & cards**
- CRUD session đầy đủ, xóa cascade sang cards và synonyms.
- CRUD card với hai loại: `vocab` (phiên âm IPA + synonyms) và `collocation`.
- Toggle `is_learned` với optimistic update.
- `GET /sessions/{id}` eager load cards + synonyms trong một lượt.

**Chế độ học**
- Lật thẻ 3D bằng CSS `preserve-3d` + `rotateY`.
- Mặt trước: từ + phiên âm. Mặt sau: nghĩa, synonyms (hover xem phiên âm), câu ví dụ.
- Bộ lọc `Tất cả` / `Chưa học` / `Đã học`; thanh tiến độ `{learned}/{total}`.
- Phím tắt: `Space` lật thẻ, `←` `→` chuyển thẻ.

**Import**
- `POST /sessions/{id}/import` nhận `.xlsx` (openpyxl) và `.csv`.
- Modal kéo-thả kèm preview 5 dòng đầu trước khi xác nhận.
- Parse synonyms dạng `word /phiên âm/; word2 /phiên âm/`.
- Tự suy `card_type` khi file không có cột này.
- CSV đọc bằng `utf-8-sig` để chấp nhận BOM do Excel sinh ra.

**Hạ tầng**
- Docker Compose: postgres 16 + backend FastAPI + frontend static + nginx gateway (port 3000).
- Compose production riêng (`docker-compose.prod.yml`, gateway port 9990, không expose db/backend/frontend) — xem [DEPLOYMENT.md](DEPLOYMENT.md).
- Alembic migration chạy tự động khi container backend khởi động.

---

## Việc cần làm trước khi lên production

Những mục dưới đây **chưa** được xử lý và nên làm trước khi mở ra ngoài:

- [ ] Đổi `JWT_SECRET` và `POSTGRES_PASSWORD` — giá trị mặc định đang nằm trong repo.
- [ ] Siết CORS: `app/main.py` hiện để `allow_origins=["*"]`.
- [ ] Bật HTTPS (chứng chỉ đặt ở `ssl/`, đã có sẵn cấu hình trong nginx production).
- [ ] Gắn git tag cho từng phiên bản.

## Hướng phát triển

Ý tưởng chưa triển khai:

- Tích hợp dictionary API để tự điền phiên âm IPA (hiện đang nhập thủ công).
- Lặp lại ngắt quãng (spaced repetition) dựa trên dữ liệu `card_learn_events` đã có sẵn.
- Quiz nhập tay đáp án thay vì chỉ trắc nghiệm.
- Xuất session ra file.

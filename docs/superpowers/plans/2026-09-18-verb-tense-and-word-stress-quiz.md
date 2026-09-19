# Verb Tense & Word Stress Quiz Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm hai dạng câu hỏi AI mới — `verb_tense` (chia thì động từ) và `word_stress` (nhấn âm) — vào luồng tạo quiz bằng AI đã có.

**Architecture:** Hai dạng mới đi trọn vẹn qua đường ống AI hiện tại (`routers/quizzes.py` → `quiz_ai.generate_ai_questions` → `quiz_prompt.build_prompt` / `parse_and_validate`), nên phần lớn công việc nằm trong một file duy nhất: `quiz_prompt.py`. File này đang là một system prompt liền khối cộng một validator liền khối, luôn gửi toàn bộ luật cho model dù người dùng chỉ chọn một dạng. Hai task đầu tách nó thành block-theo-dạng (prompt) và checker-theo-dạng (validator) mà **không đổi hành vi**, hai task sau mới cắm dạng mới vào. Không có migration: `quiz_questions.question_type` là `String(20)`, hai mã mới đều vừa.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Pydantic v2, pytest (asyncio_mode=auto), React 18 + Vite + TypeScript, Tailwind.

**Spec:** Không có file spec riêng — đây là bounded change, thiết kế được chốt trong hội thoại. Toàn bộ quyết định thiết kế được chép lại nguyên văn ở mục **Design Decisions** bên dưới; executor đọc mục đó thay cho spec.

## Global Constraints

- **Không migration, không đổi API contract.** `question_type` là `String(20)`; `verb_tense` (10 ký tự) và `word_stress` (11 ký tự) đều vừa. Không thêm cột, không sửa `routers/quizzes.py`.
- **Lệnh chạy test backend:** `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
  (chạy `pytest` trần sẽ hỏng vì `backend/smoke_test.py` cố kết nối server thật — luôn giới hạn vào thư mục `tests/`). Baseline hiện tại: **156 passed**.
- **Lệnh build frontend:** `cd frontend && npm run build` (chạy `tsc -b && vite build`). Frontend **không có test runner** — `tsc` là lưới an toàn duy nhất, và nó sẽ bắt mọi `Record<QuestionType, …>` thiếu key.
- **Chỉ unit test logic thuần.** Repo không có hạ tầng test API. Mọi thứ trong plan này đều test được không cần DB, dùng `tests/factories.make_pool`.
- **Số phương án tối đa vẫn là 4.** `AnswerSubmitRequest.selected_index` có `le=3` và plan này không đụng vào nó, nên không dạng nào được sinh quá 4 phương án.
- **`prompt_phonetic` của câu AI luôn là `None`.** `parse_and_validate` đang hardcode như vậy và phải giữ nguyên — đây chính là thứ ngăn phiên âm (chứa dấu `ˈ`) làm lộ đáp án của `word_stress`.
- **Mọi chuỗi trong prompt và lý do loại câu viết bằng tiếng Việt**, khớp văn phong file hiện tại. Nhãn hiển thị trên frontend viết bằng tiếng Anh, khớp các nhãn đang có.

---

## Design Decisions

Những quyết định này đã được chốt; executor không cần suy diễn lại.

1. **`verb_tense` ra đề kiểu "điền dạng đúng của động từ".** Câu có một chỗ trống `___` và động từ nguyên thể trong ngoặc ngay sau; 4 phương án là 4 dạng chia khác nhau của **cùng** động từ đó.
2. **`word_stress` ra đề kiểu "chọn âm tiết mang trọng âm".** `prompt_text` là từ đã tách âm tiết; phương án là các âm tiết có đánh số.
3. **`word_stress` được phép có 2–4 phương án**, đúng bằng số âm tiết của từ. Đây là ngoại lệ duy nhất của quy tắc "đúng 4 phương án". Lý do: nếu ép đúng 4 phương án thì chỉ từ ≥4 âm tiết mới ra đề được, mà ở trình độ B1–B2 phần lớn từ chỉ có 2–3 âm tiết.
4. **Thẻ không phù hợp thì AI bỏ qua.** Không thêm trường `part_of_speech` vào `Card`, không lọc ở backend. Đề có thể ngắn hơn số câu yêu cầu; phần thiếu được bù bằng dạng thuật toán qua cơ chế `fallback_types` sẵn có trong `quiz_ai.generate_ai_questions`.
5. **`compute_capacity` giữ nguyên.** Nó vẫn đếm mọi thẻ là "dùng được" cho dạng AI (`_is_eligible` trả `True` cho mọi dạng AI). Con số đó là cận trên, không phải cam kết — đúng như hành vi hiện tại của `cloze`/`context`.
6. **Định dạng cố định, do validator ép:**
   - `word_stress` → `prompt_text`: `"com · for · ta · ble"` (dấu `·` U+00B7, có khoảng trắng hai bên)
   - `word_stress` → `options`: `["1 — com", "2 — for", "3 — ta", "4 — ble"]` (dấu `—` U+2014, có khoảng trắng hai bên). Có số phía trước nên phương án không bao giờ trùng nhau, kể cả từ như `ba · na · na`.
   - `verb_tense` → `prompt_text`: `"By the time we arrived, the meeting ___ (finish) already."`
7. **Không sửa `AttemptReviewPage.tsx`.** Trang review đang hiển thị `___` ở dạng thô cho `cloze`; `verb_tense` hiển thị giống hệt là nhất quán. Không mở rộng phạm vi.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `backend/app/services/ai/quiz_prompt.py` | **Thay đổi chính.** System prompt tách theo dạng, validator tách theo dạng, luật riêng của hai dạng mới. | 1, 2, 3, 4 |
| `backend/app/services/quiz_generator.py` | Đăng ký hai mã mới vào `AI_QUESTION_TYPES`. | 3, 4 |
| `backend/app/schemas/quiz.py` | Thêm hai mã vào `QuestionType` literal. | 3, 4 |
| `backend/tests/test_ai_quiz_prompt.py` | Toàn bộ test của plan này. | 1, 2, 3, 4 |
| `frontend/src/types/index.ts` | Union `QuestionType`, mảng `AI_QUESTION_TYPES`, nhãn hiển thị. | 5 |
| `frontend/src/components/QuestionTypeBadges.tsx` | Màu badge cho hai dạng mới. | 5 |
| `frontend/src/components/session/PracticeSummary.tsx` | Thêm key vào `typeBreakdown` (bắt buộc — `tsc` sẽ lỗi nếu thiếu). | 5 |
| `frontend/src/components/quiz/QuizCreateModal.tsx` | Thêm hai dạng vào danh sách chọn được. | 5 |
| `frontend/src/components/quiz/QuizQuestionView.tsx` | Vẽ ô trống cho `verb_tense` giống `cloze`. | 5 |
| `frontend/src/components/admin/AiAccessCard.tsx` | Cập nhật câu mô tả quyền AI. | 5 |
| `RELEASE_NOTES.md` | Ghi mục cho tính năng. | 6 |

**Router không đổi:** `routers/quizzes.py` lọc dạng AI bằng `t in AI_QUESTION_TYPES` (dòng 246, 303) nên tự nhận hai mã mới.

---

## Task 1: Tách system prompt thành block theo dạng

Không đổi hành vi với `cloze`/`context` — chỉ đổi cách lắp chuỗi, và chỉ gửi block của dạng được yêu cầu.

**Files:**
- Modify: `backend/app/services/ai/quiz_prompt.py:17-64` (thay hằng `SYSTEM_PROMPT`), `:113-118` (chỗ `build_prompt` dựng chuỗi trả về)
- Test: `backend/tests/test_ai_quiz_prompt.py`

**Interfaces:**
- Consumes: `AI_QUESTION_TYPES` từ `app.services.quiz_generator` (đã import sẵn ở dòng 12)
- Produces:
  - `TYPE_RULES: dict[str, str]` — khối luật của từng dạng, key là mã dạng
  - `build_system_prompt(ai_types: Sequence[str]) -> str`
  - `build_prompt(...)` giữ nguyên chữ ký và vẫn trả `tuple[str, str]`, nhưng phần tử đầu nay do `build_system_prompt` sinh ra
  - Hằng `SYSTEM_PROMPT` **bị xoá** — không task nào sau đây được tham chiếu tới nó

- [ ] **Step 1: Viết test cho việc lắp prompt**

Thêm vào cuối `class TestBuildPrompt` trong `backend/tests/test_ai_quiz_prompt.py`:

```python
    def test_system_prompt_only_describes_the_requested_types(self):
        cards = make_pool(4)

        system, _ = quiz_prompt.build_prompt(cards, ["cloze"], 2, max_cards=10)

        assert "Điền từ vào chỗ trống" in system
        assert "Chọn từ phù hợp tình huống" not in system

    def test_system_prompt_describes_every_requested_type(self):
        cards = make_pool(4)

        system, _ = quiz_prompt.build_prompt(cards, ["cloze", "context"], 2, max_cards=10)

        assert "Điền từ vào chỗ trống" in system
        assert "Chọn từ phù hợp tình huống" in system

    def test_type_blocks_follow_a_stable_order_not_the_caller_order(self):
        cards = make_pool(4)

        system_a, _ = quiz_prompt.build_prompt(cards, ["cloze", "context"], 2, max_cards=10)
        system_b, _ = quiz_prompt.build_prompt(cards, ["context", "cloze"], 2, max_cards=10)

        assert system_a == system_b

    def test_system_prompt_always_carries_the_shared_sections(self):
        cards = make_pool(4)

        system, _ = quiz_prompt.build_prompt(cards, ["cloze"], 2, max_cards=10)

        assert "QUY TẮC GIẢI THÍCH" in system
        assert "RÀNG BUỘC KỸ THUẬT" in system
        assert "ĐỊNH DẠNG" in system
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_ai_quiz_prompt.py -q`
Expected: FAIL — `test_system_prompt_only_describes_the_requested_types` fail ở `assert "Chọn từ phù hợp tình huống" not in system`, vì prompt hiện tại luôn chứa cả hai dạng. Ba test còn lại pass.

- [ ] **Step 3: Thay `SYSTEM_PROMPT` bằng các block ghép được**

Trong `backend/app/services/ai/quiz_prompt.py`, **xoá toàn bộ** hằng `SYSTEM_PROMPT` (dòng 17–64) và thay bằng:

```python
SYSTEM_HEADER = """\
Bạn là giáo viên tiếng Anh giàu kinh nghiệm, chuyên soạn đề trắc nghiệm từ vựng cho người Việt trình độ B1–B2.

Bạn nhận một danh sách thẻ từ vựng (mỗi thẻ gồm card_id, front_text, back_text, example, synonyms). Nhiệm vụ: soạn câu hỏi CHỈ dựa trên các thẻ đó."""

TYPE_RULES: dict[str, str] = {
    "cloze": """\
"cloze" — Điền từ vào chỗ trống
   • Viết MỘT câu tiếng Anh tự nhiên 10–20 từ, chứa đúng một chỗ trống kí hiệu ___ (ba dấu gạch dưới liền, không thêm không bớt).
   • Câu phải cung cấp đủ ngữ cảnh để chỉ có MỘT đáp án đúng; tránh câu quá chung chung mà đáp án nào cũng lắp vào được.
   • Đáp án đúng là front_text của thẻ.
   • Nếu thẻ có trường example, KHÔNG được sao chép nguyên câu example; hãy viết câu mới khác ngữ cảnh.
   • Đúng 4 phương án.""",
    "context": """\
"context" — Chọn từ phù hợp tình huống
   • Mô tả một tình huống cụ thể bằng tiếng Anh (2–3 câu), rồi hỏi từ nào phù hợp nhất.
   • Tình huống phải đủ chi tiết để phân biệt rõ đáp án đúng với các phương án gần nghĩa.
   • Đáp án đúng là front_text của thẻ.
   • Đúng 4 phương án.""",
}

WORD_DISTRACTOR_RULES = """\
═══ QUY TẮC PHƯƠNG ÁN SAI (DISTRACTORS) — áp dụng cho dạng cloze và context ═══

- Không phương án nào trùng nhau (kể cả khác hoa/thường).
- Ba phương án sai phải:
  ─ Cùng từ loại (part of speech) với đáp án đúng.
  ─ KHÁC NGHĨA RÕ RỆT với nhau — không chọn hai từ gần đồng nghĩa làm distractor cùng lúc.
    Ví dụ xấu: đáp án "delighted", distractors ["happy", "glad", "joyful"] ← cả ba gần nghĩa nhau.
    Ví dụ tốt:  đáp án "delighted", distractors ["exhausted", "reluctant", "confused"] ← ba hướng nghĩa khác nhau.
  ─ Có vẻ hợp lý ở mức bề mặt (cùng chủ đề hoặc cùng mức độ phổ biến) để câu hỏi không quá dễ, nhưng SAI rõ ràng khi đọc kỹ ngữ cảnh.
  ─ Không lấy từ trường synonyms của thẻ làm distractor (vì synonym có thể cũng đúng)."""

EXPLANATION_RULES = """\
═══ QUY TẮC GIẢI THÍCH (explanation) ═══

Viết bằng tiếng Việt, 2–4 câu, theo cấu trúc:
1. Nêu đáp án đúng và giải thích TẠI SAO nó đúng.
2. Chọn 1–2 phương án sai dễ nhầm nhất, giải thích ngắn gọn vì sao chúng không phù hợp.
Không viết chung chung kiểu "các phương án kia không đúng". Phải chỉ ra điểm sai cụ thể."""

TECHNICAL_RULES = """\
═══ RÀNG BUỘC KỸ THUẬT ═══

- card_id phải là một trong các card_id đã cho — không bịa ra.
- Không dùng cùng một card_id cho hai câu hỏi.
- question_type phải nằm trong danh sách question_types được yêu cầu.
- correct_index là số nguyên từ 0 đến (số phương án trừ 1), trỏ đúng vào phương án đúng trong mảng options.
- Không phương án nào được rỗng hay trùng nhau.
- Vị trí đáp án đúng nên phân bố đều giữa các câu, không luôn đặt ở vị trí 0."""

OUTPUT_FORMAT = """\
═══ ĐỊNH DẠNG ═══

Trả về DUY NHẤT một JSON object, không kèm markdown, không kèm chữ giải thích bên ngoài:
{"questions": [{"card_id": "...", "question_type": "cloze", "prompt_text": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}]}"""

# Dạng có luật distractor dùng chung ở WORD_DISTRACTOR_RULES.
WORD_CHOICE_TYPES = ("cloze", "context")


def build_system_prompt(ai_types: Sequence[str]) -> str:
    """Ghép system prompt chỉ từ block của những dạng được yêu cầu.

    Thứ tự block bám theo `AI_QUESTION_TYPES` chứ không theo thứ tự người gọi
    truyền vào, để cùng một tập dạng luôn sinh ra đúng một chuỗi.
    """
    requested = set(ai_types)
    ordered = [t for t in AI_QUESTION_TYPES if t in requested]

    blocks = [
        f"{number}. {TYPE_RULES[question_type]}"
        for number, question_type in enumerate(ordered, start=1)
    ]

    parts = [SYSTEM_HEADER, "═══ DẠNG CÂU HỎI ═══\n\n" + "\n\n".join(blocks)]
    if any(question_type in WORD_CHOICE_TYPES for question_type in ordered):
        parts.append(WORD_DISTRACTOR_RULES)
    parts.extend([EXPLANATION_RULES, TECHNICAL_RULES, OUTPUT_FORMAT])

    return "\n\n".join(parts)
```

Rồi sửa dòng cuối của `build_prompt` (dòng 118) từ:

```python
    return SYSTEM_PROMPT, user
```

thành:

```python
    return build_system_prompt(ai_types), user
```

- [ ] **Step 4: Chạy toàn bộ test để xác nhận pass**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS — 160 passed (156 baseline + 4 test mới).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai/quiz_prompt.py backend/tests/test_ai_quiz_prompt.py
git commit -m "refactor(ai): compose the quiz system prompt from per-type blocks

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Tách validator thành checker theo dạng

Vẫn không đổi hành vi. Task này chỉ mở đường cho hai dạng mới có luật riêng và số phương án riêng.

**Files:**
- Modify: `backend/app/services/ai/quiz_prompt.py` — hằng `REQUIRED_OPTION_COUNT` và hàm `_reject_reason`
- Test: `backend/tests/test_ai_quiz_prompt.py`

**Interfaces:**
- Consumes: `build_system_prompt`, `TYPE_RULES` từ Task 1
- Produces:
  - `MIN_OPTION_COUNT = 2`, `MAX_OPTION_COUNT = 4`
  - `OPTION_COUNT: dict[str, int]` — số phương án bắt buộc của từng dạng; dạng không có mặt trong dict thì số phương án do checker của dạng đó tự ép
  - `TYPE_CHECKS: dict[str, Callable[[dict[str, Any]], str | None]]` — checker riêng từng dạng, trả `None` nếu đạt, hoặc một câu tiếng Việt nêu lý do loại
  - `_check_cloze(item: dict[str, Any]) -> str | None`
  - Hằng `REQUIRED_OPTION_COUNT` **bị xoá**

- [ ] **Step 1: Viết test cho ràng buộc số phương án**

Thêm vào cuối `class TestParseAndValidate` trong `backend/tests/test_ai_quiz_prompt.py`:

```python
    def test_rejects_more_options_than_the_maximum(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "word1", "word2", "word3", "word4"]

        questions, rejected = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []
        assert len(rejected) == 1

    def test_rejects_fewer_options_than_the_minimum(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0"]

        questions, rejected = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []
        assert len(rejected) == 1

    def test_cloze_still_needs_exactly_four_options(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "word1", "word2"]

        questions, rejected = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []
        assert "4 phương án" in rejected[0]
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_ai_quiz_prompt.py -q`
Expected: FAIL — `test_rejects_more_options_than_the_maximum` và `test_rejects_fewer_options_than_the_minimum` fail. Validator hiện tại chỉ từ chối khi `len(options) != 4`, nên 5 phương án và 1 phương án **cũng** bị từ chối đúng — hai test này thực ra sẽ pass. `test_cloze_still_needs_exactly_four_options` cũng pass. Nếu cả ba pass ngay, đó là kỳ vọng: task này là refactor thuần, ba test trên là lưới an toàn ghim lại hành vi trước khi đổi cấu trúc. Ghi nhận "3 passed" rồi đi tiếp Step 3.

- [ ] **Step 3: Viết lại `_reject_reason` thành phần chung + dispatch**

Trong `backend/app/services/ai/quiz_prompt.py`, đổi dòng import ở đầu file:

```python
from collections.abc import Sequence
```

thành:

```python
from collections.abc import Callable, Sequence
```

Xoá hằng `REQUIRED_OPTION_COUNT = 4` (dòng 15) và thay bằng:

```python
MIN_OPTION_COUNT = 2
MAX_OPTION_COUNT = 4

# Dạng nào có số phương án cố định thì khai ở đây. Dạng vắng mặt tự ép số
# phương án trong checker của nó.
OPTION_COUNT: dict[str, int] = {
    "cloze": 4,
    "context": 4,
}
```

Thay **toàn bộ** hàm `_reject_reason` (dòng 146–190) bằng:

```python
def _check_cloze(item: dict[str, Any]) -> str | None:
    if CLOZE_BLANK not in item["prompt_text"]:
        return "câu cloze không có chỗ trống ___"
    return None


TYPE_CHECKS: dict[str, Callable[[dict[str, Any]], str | None]] = {
    "cloze": _check_cloze,
}


def _reject_reason(
    item: Any,
    cards_by_id: dict[str, Any],
    allowed_types: set[str],
    used_card_ids: set[str],
) -> str | None:
    """Lý do loại câu này, hoặc None nếu câu dùng được."""
    if not isinstance(item, dict):
        return "không phải object"

    card_id = item.get("card_id")
    if card_id not in cards_by_id:
        return f"card_id không hợp lệ: {card_id!r}"
    if card_id in used_card_ids:
        return f"thẻ {card_id} đã được dùng cho câu trước"

    question_type = item.get("question_type")
    if question_type not in allowed_types:
        return f"dạng câu hỏi không được yêu cầu: {question_type!r}"

    prompt_text = item.get("prompt_text")
    if not isinstance(prompt_text, str) or not prompt_text.strip():
        return "prompt_text rỗng"

    options = item.get("options")
    if not isinstance(options, list):
        return "options không phải mảng"
    if not MIN_OPTION_COUNT <= len(options) <= MAX_OPTION_COUNT:
        return f"số phương án phải từ {MIN_OPTION_COUNT} đến {MAX_OPTION_COUNT}"
    if not all(isinstance(option, str) and option.strip() for option in options):
        return "có phương án rỗng"
    if len({_normalize(option) for option in options}) != len(options):
        return "có phương án trùng nhau"

    expected_count = OPTION_COUNT.get(question_type)
    if expected_count is not None and len(options) != expected_count:
        return f"cần đúng {expected_count} phương án"

    correct_index = item.get("correct_index")
    if not isinstance(correct_index, int) or isinstance(correct_index, bool):
        return "correct_index không phải số nguyên"
    if not 0 <= correct_index < len(options):
        return f"correct_index ngoài khoảng: {correct_index}"

    explanation = item.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        return "thiếu explanation"

    check = TYPE_CHECKS.get(question_type)
    if check is not None:
        return check(item)

    return None
```

- [ ] **Step 4: Chạy toàn bộ test để xác nhận pass**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS — 163 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai/quiz_prompt.py backend/tests/test_ai_quiz_prompt.py
git commit -m "refactor(ai): dispatch quiz validation to per-type checkers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Dạng `verb_tense` — chia thì

**Files:**
- Modify: `backend/app/services/quiz_generator.py:12`
- Modify: `backend/app/schemas/quiz.py:6`
- Modify: `backend/app/services/ai/quiz_prompt.py` — thêm block vào `TYPE_RULES`, thêm `OPTION_COUNT["verb_tense"]`, thêm `_check_verb_tense` vào `TYPE_CHECKS`
- Test: `backend/tests/test_ai_quiz_prompt.py`

**Interfaces:**
- Consumes: `OPTION_COUNT`, `TYPE_CHECKS`, `TYPE_RULES`, `CLOZE_BLANK` từ Task 1 và 2
- Produces:
  - `AI_QUESTION_TYPES` nay là `("cloze", "context", "verb_tense")` với annotation `tuple[str, ...]`
  - `VERB_HINT_RE: re.Pattern[str]` — khớp động từ nguyên thể trong ngoặc
  - `_check_verb_tense(item: dict[str, Any]) -> str | None`

- [ ] **Step 1: Viết test cho `verb_tense`**

Thêm helper này ngay sau hàm `_good_question` trong `backend/tests/test_ai_quiz_prompt.py`:

```python
def _verb_tense_question(card_id: str = "card-0") -> dict:
    return {
        "card_id": card_id,
        "question_type": "verb_tense",
        "prompt_text": "By the time we arrived, the meeting ___ (finish) already.",
        "options": ["finished", "had finished", "has finished", "was finishing"],
        "correct_index": 1,
        "explanation": "Hành động kết thúc trước một mốc quá khứ nên dùng past perfect.",
    }
```

Thêm class test mới vào cuối file:

```python
class TestVerbTense:
    def test_accepts_a_well_formed_question(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_verb_tense_question()]), cards, ["verb_tense"]
        )

        assert rejected == []
        assert len(questions) == 1
        assert questions[0].question_type == "verb_tense"
        assert questions[0].correct_index == 1

    def test_rejects_a_prompt_without_a_blank(self):
        cards = make_pool(4)
        bad = _verb_tense_question()
        bad["prompt_text"] = "By the time we arrived, the meeting had finished (finish)."

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["verb_tense"]
        )

        assert questions == []
        assert "___" in rejected[0]

    def test_rejects_a_prompt_without_the_base_verb_in_parentheses(self):
        cards = make_pool(4)
        bad = _verb_tense_question()
        bad["prompt_text"] = "By the time we arrived, the meeting ___ already."

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["verb_tense"]
        )

        assert questions == []
        assert "ngoặc" in rejected[0]

    def test_rejects_non_letter_content_in_the_parentheses(self):
        cards = make_pool(4)
        bad = _verb_tense_question()
        bad["prompt_text"] = "By the time we arrived, the meeting ___ (1999) already."

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["verb_tense"])

        assert questions == []

    def test_needs_exactly_four_options(self):
        cards = make_pool(4)
        bad = _verb_tense_question()
        bad["options"] = ["finished", "had finished", "has finished"]

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["verb_tense"]
        )

        assert questions == []
        assert "4 phương án" in rejected[0]

    def test_carries_no_phonetic(self):
        cards = make_pool(4)

        questions, _ = quiz_prompt.parse_and_validate(
            _raw([_verb_tense_question()]), cards, ["verb_tense"]
        )

        assert questions[0].prompt_phonetic is None

    def test_build_prompt_accepts_it_as_an_ai_type(self):
        cards = make_pool(4)

        system, _ = quiz_prompt.build_prompt(cards, ["verb_tense"], 2, max_cards=10)

        assert "Chia thì động từ" in system
        assert "Điền từ vào chỗ trống" not in system
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_ai_quiz_prompt.py::TestVerbTense -q`
Expected: FAIL — `test_build_prompt_accepts_it_as_an_ai_type` fail với `ValueError: AI chỉ sinh cloze, context; không nhận: verb_tense`; các test còn lại fail vì câu bị loại với lý do `dạng câu hỏi không được yêu cầu`.

- [ ] **Step 3: Đăng ký mã dạng ở backend**

Trong `backend/app/services/quiz_generator.py`, sửa dòng 12:

```python
AI_QUESTION_TYPES: tuple[str, ...] = ("cloze", "context", "verb_tense")
```

Trong `backend/app/schemas/quiz.py`, sửa dòng 6:

```python
QuestionType = Literal["en_to_vi", "vi_to_en", "synonym", "cloze", "context", "verb_tense"]
```

- [ ] **Step 4: Thêm luật prompt và checker cho `verb_tense`**

Trong `backend/app/services/ai/quiz_prompt.py`, thêm `import re` vào khối import đầu file (ngay dưới `import json`).

Thêm mục này vào `dict` `TYPE_RULES`, sau mục `"context"`:

```python
    "verb_tense": """\
"verb_tense" — Chia thì động từ
   • CHỈ dùng thẻ mà front_text là một ĐỘNG TỪ. Thẻ không phải động từ thì bỏ qua hoàn toàn, không ép ra đề.
   • Viết MỘT câu tiếng Anh 12–25 từ, chứa đúng một chỗ trống kí hiệu ___ (ba dấu gạch dưới liền), và ngay sau chỗ trống là động từ nguyên thể đặt trong ngoặc đơn.
     Ví dụ: "By the time we arrived, the meeting ___ (finish) already."
   • Trong ngoặc CHỈ được chứa động từ nguyên thể viết bằng chữ cái, không thêm số hay dấu câu.
   • Câu BẮT BUỘC có dấu hiệu thời gian rõ ràng (by the time, since 2010, while, every morning, this time next year, ...) để chỉ có ĐÚNG MỘT thì đúng.
   • Đúng 4 phương án, đều là các dạng chia KHÁC NHAU của CHÍNH động từ đó. Không đổi sang động từ khác.
   • Ba phương án sai phải là những thì mà người học Việt hay nhầm trong đúng ngữ cảnh này (ví dụ present perfect và past simple), không phải dạng vô nghĩa.
   • explanation phải nêu rõ dấu hiệu thời gian nào quyết định thì đúng.""",
```

Thêm vào `dict` `OPTION_COUNT`:

```python
    "verb_tense": 4,
```

Thêm regex và checker ngay dưới `_check_cloze`:

```python
# Động từ nguyên thể trong ngoặc, ví dụ "(finish)" hay "(look after)".
VERB_HINT_RE = re.compile(r"\(\s*[A-Za-z][A-Za-z ]{0,30}\)")


def _check_verb_tense(item: dict[str, Any]) -> str | None:
    prompt_text = item["prompt_text"]
    if CLOZE_BLANK not in prompt_text:
        return "câu chia thì không có chỗ trống ___"
    if VERB_HINT_RE.search(prompt_text) is None:
        return "câu chia thì thiếu động từ nguyên thể trong ngoặc"
    return None
```

Thêm vào `dict` `TYPE_CHECKS`:

```python
    "verb_tense": _check_verb_tense,
```

- [ ] **Step 5: Chạy toàn bộ test để xác nhận pass**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS — 170 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ai/quiz_prompt.py backend/app/services/quiz_generator.py backend/app/schemas/quiz.py backend/tests/test_ai_quiz_prompt.py
git commit -m "feat(ai): add the verb_tense quiz question type

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Dạng `word_stress` — nhấn âm

Đây là dạng duy nhất có số phương án thay đổi (2–4, đúng bằng số âm tiết), nên checker của nó vừa ép định dạng vừa ép số phương án.

**Files:**
- Modify: `backend/app/services/quiz_generator.py:12`
- Modify: `backend/app/schemas/quiz.py:6`
- Modify: `backend/app/services/ai/quiz_prompt.py` — thêm block `TYPE_RULES`, thêm `_check_word_stress` vào `TYPE_CHECKS` (**không** thêm vào `OPTION_COUNT`)
- Test: `backend/tests/test_ai_quiz_prompt.py`

**Interfaces:**
- Consumes: `MIN_OPTION_COUNT`, `MAX_OPTION_COUNT`, `TYPE_CHECKS`, `TYPE_RULES` từ Task 2
- Produces:
  - `AI_QUESTION_TYPES` nay là `("cloze", "context", "verb_tense", "word_stress")`
  - `SYLLABLE_SEPARATOR = "·"`, `STRESS_MARKS = ("ˈ", "ˌ")`, `STRESS_OPTION_RE: re.Pattern[str]`
  - `_check_word_stress(item: dict[str, Any]) -> str | None`

- [ ] **Step 1: Viết test cho `word_stress`**

Thêm helper này ngay sau `_verb_tense_question` trong `backend/tests/test_ai_quiz_prompt.py`:

```python
def _word_stress_question(card_id: str = "card-0") -> dict:
    return {
        "card_id": card_id,
        "question_type": "word_stress",
        "prompt_text": "com · for · ta · ble",
        "options": ["1 — com", "2 — for", "3 — ta", "4 — ble"],
        "correct_index": 0,
        "explanation": "Hậu tố -able không làm đổi trọng âm, nên trọng âm giữ ở âm tiết đầu.",
    }
```

Thêm class test mới vào cuối file:

```python
class TestWordStress:
    def test_accepts_a_four_syllable_question(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_word_stress_question()]), cards, ["word_stress"]
        )

        assert rejected == []
        assert len(questions) == 1
        assert questions[0].question_type == "word_stress"
        assert questions[0].correct_index == 0

    def test_accepts_a_two_syllable_question(self):
        cards = make_pool(4)
        item = _word_stress_question()
        item["prompt_text"] = "re · cord"
        item["options"] = ["1 — re", "2 — cord"]
        item["correct_index"] = 1

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([item]), cards, ["word_stress"]
        )

        assert rejected == []
        assert len(questions) == 1
        assert questions[0].options == ["1 — re", "2 — cord"]

    def test_accepts_a_word_with_repeated_syllables(self):
        cards = make_pool(4)
        item = _word_stress_question()
        item["prompt_text"] = "ba · na · na"
        item["options"] = ["1 — ba", "2 — na", "3 — na"]
        item["correct_index"] = 1

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([item]), cards, ["word_stress"]
        )

        assert rejected == []
        assert len(questions) == 1

    def test_rejects_an_ipa_stress_mark_in_the_prompt(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["prompt_text"] = "ˈcom · for · ta · ble"

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["word_stress"]
        )

        assert questions == []
        assert "lộ đáp án" in rejected[0]

    def test_rejects_an_uppercased_syllable(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["prompt_text"] = "COM · for · ta · ble"

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["word_stress"]
        )

        assert questions == []
        assert "lộ đáp án" in rejected[0]

    def test_rejects_a_single_syllable_word(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["prompt_text"] = "book"
        bad["options"] = ["1 — book", "2 — book "]
        bad["correct_index"] = 0

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["word_stress"])

        assert questions == []

    def test_rejects_more_syllables_than_options(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["options"] = ["1 — com", "2 — for", "3 — ta"]

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["word_stress"]
        )

        assert questions == []
        assert "âm tiết" in rejected[0]

    def test_rejects_an_option_without_the_number_prefix(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["options"] = ["com", "2 — for", "3 — ta", "4 — ble"]

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["word_stress"]
        )

        assert questions == []
        assert "định dạng" in rejected[0]

    def test_rejects_an_option_that_does_not_match_its_syllable(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["options"] = ["1 — com", "2 — fur", "3 — ta", "4 — ble"]

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([bad]), cards, ["word_stress"]
        )

        assert questions == []
        assert "không khớp" in rejected[0]

    def test_rejects_options_numbered_out_of_order(self):
        cards = make_pool(4)
        bad = _word_stress_question()
        bad["options"] = ["2 — com", "1 — for", "3 — ta", "4 — ble"]

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["word_stress"])

        assert questions == []

    def test_carries_no_phonetic(self):
        cards = make_pool(4)

        questions, _ = quiz_prompt.parse_and_validate(
            _raw([_word_stress_question()]), cards, ["word_stress"]
        )

        assert questions[0].prompt_phonetic is None

    def test_build_prompt_accepts_it_as_an_ai_type(self):
        cards = make_pool(4)

        system, _ = quiz_prompt.build_prompt(cards, ["word_stress"], 2, max_cards=10)

        assert "Trọng âm từ" in system
        assert "Chia thì động từ" not in system
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_ai_quiz_prompt.py::TestWordStress -q`
Expected: FAIL — `test_build_prompt_accepts_it_as_an_ai_type` fail với `ValueError: ... không nhận: word_stress`; các test còn lại fail vì câu bị loại với lý do `dạng câu hỏi không được yêu cầu`.

- [ ] **Step 3: Đăng ký mã dạng ở backend**

Trong `backend/app/services/quiz_generator.py`, sửa dòng 12:

```python
AI_QUESTION_TYPES: tuple[str, ...] = ("cloze", "context", "verb_tense", "word_stress")
```

Trong `backend/app/schemas/quiz.py`, sửa dòng 6:

```python
QuestionType = Literal[
    "en_to_vi", "vi_to_en", "synonym", "cloze", "context", "verb_tense", "word_stress"
]
```

- [ ] **Step 4: Thêm luật prompt và checker cho `word_stress`**

Trong `backend/app/services/ai/quiz_prompt.py`, thêm mục này vào `dict` `TYPE_RULES`, sau mục `"verb_tense"`:

```python
    "word_stress": """\
"word_stress" — Trọng âm từ
   • CHỈ dùng thẻ mà front_text là MỘT từ đơn có 2–4 âm tiết. Thẻ một âm tiết, trên 4 âm tiết, hoặc là cụm nhiều từ thì bỏ qua hoàn toàn.
   • prompt_text là chính từ đó đã tách âm tiết, nối bằng " · " (dấu chấm giữa, có một khoảng trắng ở mỗi bên).
     Ví dụ: "com · for · ta · ble"
   • TUYỆT ĐỐI KHÔNG đánh dấu trọng âm trong prompt_text: không dùng ˈ, không dùng ˌ, không viết hoa âm tiết nào. prompt_text viết thường hoàn toàn.
   • Số phương án đúng bằng số âm tiết (2, 3 hoặc 4) — đây là ngoại lệ duy nhất của quy tắc 4 phương án.
   • Phương án thứ i có dạng "i — âm tiết thứ i", nối bằng " — " (dấu gạch dài, có một khoảng trắng ở mỗi bên), và phải liệt kê theo đúng thứ tự âm tiết.
     Ví dụ với "com · for · ta · ble": ["1 — com", "2 — for", "3 — ta", "4 — ble"]
   • correct_index trỏ vào âm tiết mang TRỌNG ÂM CHÍNH.
   • explanation phải nêu quy tắc trọng âm áp dụng được (ví dụ: hậu tố -able không làm đổi trọng âm; từ kết thúc bằng -tion nhấn vào âm tiết ngay trước nó).""",
```

**Không** thêm gì vào `OPTION_COUNT` — số phương án của dạng này do checker ép.

Thêm các hằng và checker ngay dưới `_check_verb_tense`:

```python
SYLLABLE_SEPARATOR = "·"
# Dấu trọng âm IPA: xuất hiện trong prompt_text là lộ đáp án.
STRESS_MARKS = ("ˈ", "ˌ")
STRESS_OPTION_RE = re.compile(r"^(\d+) — (.+)$")


def _check_word_stress(item: dict[str, Any]) -> str | None:
    prompt_text = item["prompt_text"]

    if any(mark in prompt_text for mark in STRESS_MARKS):
        return "prompt_text chứa dấu trọng âm, lộ đáp án"

    syllables = [part.strip() for part in prompt_text.split(SYLLABLE_SEPARATOR)]

    if not all(syllables):
        return "có âm tiết rỗng"
    if any(syllable.isupper() and len(syllable) > 1 for syllable in syllables):
        return "âm tiết viết hoa, lộ đáp án"
    if not MIN_OPTION_COUNT <= len(syllables) <= MAX_OPTION_COUNT:
        return (
            f"cần {MIN_OPTION_COUNT}–{MAX_OPTION_COUNT} âm tiết, "
            f"nhận được {len(syllables)}"
        )

    options = item["options"]
    if len(options) != len(syllables):
        return f"cần đúng {len(syllables)} phương án, bằng số âm tiết"

    for number, (option, syllable) in enumerate(zip(options, syllables), start=1):
        match = STRESS_OPTION_RE.match(option.strip())
        if match is None:
            return f"phương án {number} sai định dạng 'N — âm tiết'"
        if match.group(1) != str(number):
            return f"phương án {number} đánh số sai"
        if match.group(2).strip() != syllable:
            return f"phương án {number} không khớp âm tiết thứ {number}"

    return None
```

Thêm vào `dict` `TYPE_CHECKS`:

```python
    "word_stress": _check_word_stress,
```

- [ ] **Step 5: Chạy toàn bộ test để xác nhận pass**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS — 182 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ai/quiz_prompt.py backend/app/services/quiz_generator.py backend/app/schemas/quiz.py backend/tests/test_ai_quiz_prompt.py
git commit -m "feat(ai): add the word_stress quiz question type

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — hiển thị và cho chọn hai dạng mới

Frontend không có test runner, nên `tsc` là lưới an toàn: `Record<QuestionType, …>` trong `QuestionTypeBadges.tsx`, `PracticeSummary.tsx` và `types/index.ts` sẽ báo lỗi nếu thiếu key. Bước 1 cố tình chạy build trước để thấy `tsc` chỉ ra đúng những chỗ phải sửa.

**Files:**
- Modify: `frontend/src/types/index.ts:59-69`
- Modify: `frontend/src/components/QuestionTypeBadges.tsx:9-15`
- Modify: `frontend/src/components/session/PracticeSummary.tsx:35-41`
- Modify: `frontend/src/components/quiz/QuizCreateModal.tsx:150-152`
- Modify: `frontend/src/components/quiz/QuizQuestionView.tsx:31-45`
- Modify: `frontend/src/components/admin/AiAccessCard.tsx:20`

**Interfaces:**
- Consumes: hai mã `'verb_tense'` và `'word_stress'`, giống hệt chuỗi backend dùng ở Task 3 và 4
- Produces: `QuestionType` union đủ 7 giá trị; `AI_QUESTION_TYPES` đủ 4 giá trị

- [ ] **Step 1: Mở rộng union và chạy build để `tsc` chỉ ra chỗ hỏng**

Trong `frontend/src/types/index.ts`, thay dòng 59–69 bằng:

```ts
export type QuestionType =
  | 'en_to_vi'
  | 'vi_to_en'
  | 'synonym'
  | 'cloze'
  | 'context'
  | 'verb_tense'
  | 'word_stress';

export const AI_QUESTION_TYPES: QuestionType[] = [
  'cloze',
  'context',
  'verb_tense',
  'word_stress',
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  en_to_vi: 'English → Vietnamese',
  vi_to_en: 'Vietnamese → English',
  synonym: 'Synonym',
  cloze: 'Fill in the blank',
  context: 'Choose the word in context',
  verb_tense: 'Verb tense',
  word_stress: 'Word stress',
};
```

Run: `cd frontend && npm run build`
Expected: FAIL — `tsc` báo lỗi `Property 'verb_tense' is missing in type ...` tại `QuestionTypeBadges.tsx` và `PracticeSummary.tsx`.

- [ ] **Step 2: Thêm màu badge cho hai dạng mới**

Trong `frontend/src/components/QuestionTypeBadges.tsx`, thay khối `typeColors` (dòng 9–15) bằng:

```ts
const typeColors: Record<QuestionType, { bg: string; text: string }> = {
  en_to_vi: { bg: 'bg-blue-50', text: 'text-blue-700' },
  vi_to_en: { bg: 'bg-purple-50', text: 'text-purple-700' },
  synonym: { bg: 'bg-orange-50', text: 'text-orange-700' },
  cloze: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  context: { bg: 'bg-pink-50', text: 'text-pink-700' },
  verb_tense: { bg: 'bg-amber-50', text: 'text-amber-700' },
  word_stress: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
};
```

- [ ] **Step 3: Thêm key vào bảng thống kê của phiên luyện tập**

Trong `frontend/src/components/session/PracticeSummary.tsx`, thay khối `typeBreakdown` (dòng 35–41) bằng:

```ts
  const typeBreakdown: Record<QuestionType, { correct: number; total: number }> = {
    en_to_vi: { correct: 0, total: 0 },
    vi_to_en: { correct: 0, total: 0 },
    synonym: { correct: 0, total: 0 },
    cloze: { correct: 0, total: 0 },
    context: { correct: 0, total: 0 },
    verb_tense: { correct: 0, total: 0 },
    word_stress: { correct: 0, total: 0 },
  };
```

Hai dòng mới luôn có `total: 0` trong phiên luyện tập (luyện tập chỉ dùng dạng thuật toán) và bị `.filter((row) => row.total > 0)` ở dòng 57 loại đi, nên không hiện ra giao diện. Chúng có mặt chỉ để thoả `Record<QuestionType, …>`.

- [ ] **Step 4: Cho chọn hai dạng mới khi tạo quiz**

Trong `frontend/src/components/quiz/QuizCreateModal.tsx`, thay dòng 150–152 bằng:

```tsx
  const availableTypes: QuestionType[] = aiStatus?.available && aiStatus.enabled_for_user
    ? ([
        'en_to_vi',
        'vi_to_en',
        'synonym',
        'cloze',
        'context',
        'verb_tense',
        'word_stress',
      ] as QuestionType[])
    : (['en_to_vi', 'vi_to_en', 'synonym'] as QuestionType[]);
```

- [ ] **Step 5: Vẽ ô trống cho câu `verb_tense`**

Trong `frontend/src/components/quiz/QuizQuestionView.tsx`, thay hàm `renderPrompt` (dòng 31–45) bằng:

```tsx
  const BLANK_TYPES = ['cloze', 'verb_tense'];

  const renderPrompt = (text: string, questionType: string) => {
    if (!BLANK_TYPES.includes(questionType) || !text.includes('___')) {
      return text;
    }

    const [before, ...rest] = text.split('___');

    return (
      <>
        {before}
        <span className="cloze-blank" aria-label="blank" />
        {rest.join('___')}
      </>
    );
  };
```

Không cần xử lý riêng cho `word_stress`: `prompt_phonetic` của mọi câu AI luôn là `null` (xem Global Constraints), nên dòng 97–99 không bao giờ làm lộ dấu trọng âm.

- [ ] **Step 6: Cập nhật mô tả quyền AI trong trang admin**

Trong `frontend/src/components/admin/AiAccessCard.tsx`, thay dòng 20 bằng:

```tsx
            Lets this user create quizzes with AI question types (fill in the blank, word in
            context, verb tense, word stress).
```

- [ ] **Step 7: Chạy build để xác nhận pass**

Run: `cd frontend && npm run build`
Expected: PASS — `tsc -b` không lỗi, `vite build` ghi ra `dist/`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/QuestionTypeBadges.tsx frontend/src/components/session/PracticeSummary.tsx frontend/src/components/quiz/QuizCreateModal.tsx frontend/src/components/quiz/QuizQuestionView.tsx frontend/src/components/admin/AiAccessCard.tsx
git commit -m "feat(frontend): offer the verb tense and word stress quiz types

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Kiểm chứng thủ công và ghi release notes

Hai task backend chỉ chứng minh validator từ chối đúng thứ cần từ chối. Chúng **không** chứng minh model thật sinh ra được câu đúng định dạng. Task này đóng khoảng trống đó.

**Files:**
- Modify: `RELEASE_NOTES.md`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–5
- Produces: không có mã mới

- [ ] **Step 1: Chạy toàn bộ test lần cuối**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/ -q`
Expected: PASS — 182 passed.

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 2: Tạo quiz thật với hai dạng mới**

Khởi động app (`docker compose up` hoặc cách chạy dev quen dùng của repo). Đăng nhập bằng tài khoản đã được bật quyền AI, rồi:

1. Tạo một session có ít nhất 8 thẻ, trong đó có **ít nhất 3 động từ** (`arrive`, `finish`, `develop`) và **ít nhất 3 từ đa âm tiết** (`comfortable`, `important`, `photography`).
2. Tạo quiz, chọn dạng `Verb tense` và `Word stress`, đặt 6 câu.
3. Đợi trạng thái chuyển từ `pending` sang `ready`.

Quan sát và ghi lại:
- Câu `verb_tense` có hiện ô trống (không phải ba dấu `___` thô) và giữ được phần `(finish)` không?
- Câu `word_stress` có hiện dạng `com · for · ta · ble`, phương án đánh số, và **không** hiện phiên âm không?
- Quiz 2–3 phương án có bấm chọn và chấm điểm đúng không?

Nếu quiz về trạng thái `failed`, hoặc số câu ít hơn nhiều so với yêu cầu, đọc log backend tìm dòng `Bỏ %d câu AI không hợp lệ` — lý do bị loại nằm ngay đó và chỉ thẳng ra luật nào trong `TYPE_RULES` cần diễn đạt rõ hơn. Sửa lời trong `TYPE_RULES`, **không** nới lỏng validator.

- [ ] **Step 3: Ghi mục release notes**

Thêm vào đầu phần mục mới nhất của `RELEASE_NOTES.md`, khớp định dạng các mục đang có trong file:

```markdown
- Thêm hai dạng câu hỏi AI: **Verb tense** (điền dạng chia đúng của động từ vào câu có mốc thời gian rõ ràng) và **Word stress** (chọn âm tiết mang trọng âm). Cả hai chỉ hiện với tài khoản đã được bật quyền AI. Dạng Word stress có số phương án bằng số âm tiết của từ (2–4), nên là dạng đầu tiên không cố định 4 phương án.
```

- [ ] **Step 4: Commit**

```bash
git add RELEASE_NOTES.md
git commit -m "docs: note the verb tense and word stress quiz types

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Ghi chú cho người review

- **Task 1 và 2 cố ý không đổi hành vi.** Nếu review thấy đầu ra prompt cho riêng `["cloze", "context"]` khác về mặt ngữ nghĩa so với `SYSTEM_PROMPT` cũ (không tính thay đổi có chủ đích ở `TECHNICAL_RULES` về `correct_index` và ở tiêu đề mục distractor), đó là lỗi.
- **`word_stress` là dạng duy nhất vắng mặt trong `OPTION_COUNT`.** Đó là chủ ý, không phải sót — số phương án của nó phải bằng số âm tiết, và `_check_word_stress` ép điều đó.
- **Nếu model hay sinh sai định dạng,** sửa lời trong `TYPE_RULES` chứ đừng nới validator. Validator là ranh giới tin cậy của tính năng; đó là lý do file `quiz_prompt.py` có docstring nói rõ điều này ở đầu.

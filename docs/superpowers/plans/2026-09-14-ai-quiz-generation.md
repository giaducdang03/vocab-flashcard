# AI Quiz Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép quiz chứa hai dạng câu hỏi mới `cloze` và `context` do LLM soạn kèm giải thích, sinh nền và poll trạng thái, trong khi ba dạng cũ giữ nguyên đường thuật toán đồng bộ.

**Architecture:** AI nằm ở một nhánh riêng biệt hoàn toàn. `POST /quizzes` nhìn `question_types`: không có `cloze`/`context` thì chạy y như hiện tại và không chạm một dòng code AI nào. Có thì phần câu hỏi thuật toán được ghi ngay, quiz để `status='pending'`, và một FastAPI background task gọi LLM qua provider OpenAI-compatible, validate từng câu trả về, bù phần thiếu bằng bộ sinh thuật toán, rồi chuyển `ready`.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0 async, Alembic, Pydantic v2, SDK `openai` (AsyncOpenAI trỏ base_url tùy cấu hình), React + TypeScript + axios.

**Spec:** `docs/superpowers/specs/2026-09-14-ai-quiz-generation-design.md`

## Về kiểm thử

Theo yêu cầu: **có unit test cho hàm thuần, không có test API.**

- Mọi logic đáng sai đều nằm ở hàm thuần và được test: `split_question_count`, `build_prompt`, `parse_and_validate`, `generate_ai_questions`. Các test này dùng `tests/factories.py` sẵn có và một provider giả, không chạm DB và không gọi mạng.
- Không dựng `conftest.py`, `TestClient`, hay DB test. Phần HTTP — phân nhánh router, background task, polling, retry — được xác nhận bằng vòng kiểm thử tay ở Task 10.
- Sau mỗi task backend chạy `python -m pytest` để bắt hồi quy.

Rủi ro còn lại: luồng ghép các mảnh với nhau (router → background task → DB) không có test tự động, nên Task 10 là bắt buộc, không phải tùy chọn.

## Global Constraints

- Ba dạng cũ (`en_to_vi`, `vi_to_en`, `synonym`) **không đổi hành vi**. Quiz chỉ chọn dạng cũ phải trả `status='ready'` ngay và không gọi provider lần nào.
- AI **chỉ** sinh `cloze` và `context`. `build_prompt` raise `ValueError` nếu nhận dạng cũ; `generate_questions` raise `ValueError` nếu nhận dạng AI.
- Mọi câu hỏi vẫn là MCQ đúng 4 đáp án với `correct_index` trong 0–3. Không đụng vào `QuizAnswer.selected_index`, `AnswerSubmitRequest`, hay logic chấm điểm.
- Bất biến: `quiz_questions.source == 'ai'` ⟹ `explanation` khác NULL và khác rỗng.
- Không dữ liệu nào từ LLM được ghi vào DB mà không qua `parse_and_validate`.
- `QuestionOut` (lúc đang làm bài) **không bao giờ** chứa `explanation` hay `correct_index`.
- Mọi cột DB mới đều NOT NULL có default, hoặc nullable. Migration không backfill.
- Config mới, giá trị mặc định chính xác: `AI_BASE_URL="https://api.openai.com/v1"`, `AI_API_KEY=""`, `AI_MODEL="gpt-4o-mini"`, `AI_MAX_CARDS_PER_PROMPT=120`, `AI_DAILY_QUIZ_LIMIT=20`, `AI_TIMEOUT_SECONDS=90`.
- `AI_API_KEY` rỗng ⟹ tính năng tắt hoàn toàn: `ai-status.available=false`, chọn dạng AI trả 400.
- Lệnh kiểm tra hồi quy backend, chạy từ thư mục `backend/`: `python -m pytest`.

---

### Task 1: Cột DB mới và migration

**Files:**
- Modify: `backend/app/models/quiz.py:11-31` (class `Quiz`), `backend/app/models/quiz.py:48-68` (class `QuizQuestion`)
- Modify: `backend/app/schemas/quiz.py:27-37` (class `QuizListItem`)
- Modify: `backend/app/routers/quizzes.py:125-135` (hàm `_quiz_list_item`)
- Create: `backend/alembic/versions/20260914_add_ai_quiz_columns.py`

**Interfaces:**
- Consumes: không có (task đầu tiên).
- Produces: `Quiz.status`, `Quiz.uses_ai`, `Quiz.error_message`, `Quiz.ai_question_count`, `Quiz.retry_count`, `Quiz.requested_count`, `QuizQuestion.source`, `QuizQuestion.explanation`, và bốn trường tương ứng trên `QuizListItem`.

- [ ] **Step 1: Thêm cột vào model Quiz**

Trong `backend/app/models/quiz.py`, thêm vào class `Quiz` ngay sau `question_types`:

```python
    # pending | ready | failed. Chỉ quiz có dạng AI mới từng ở 'pending'.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ready")
    uses_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Số câu thực sự do AI viết, sau khi đã loại câu hỏng.
    ai_question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Số câu người dùng yêu cầu. Task nền cần nó để chia lại phần AI.
    requested_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
```

- [ ] **Step 2: Thêm cột vào model QuizQuestion**

Trong cùng file, thêm vào class `QuizQuestion` ngay sau `correct_index`:

```python
    # algo | ai. Bất biến: source == 'ai' ⟹ explanation không rỗng.
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="algo")
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 3: Thêm trường vào QuizListItem**

Trong `backend/app/schemas/quiz.py`, thêm vào class `QuizListItem`:

```python
    status: str = "ready"
    uses_ai: bool = False
    error_message: str | None = None
    ai_question_count: int = 0
```

Có default nên response của quiz cũ vẫn dựng được.

- [ ] **Step 4: Trả các trường mới trong `_quiz_list_item`**

Trong `backend/app/routers/quizzes.py`, thêm vào lệnh `return QuizListItem(...)` của hàm `_quiz_list_item`:

```python
        status=quiz.status,
        uses_ai=quiz.uses_ai,
        error_message=quiz.error_message,
        ai_question_count=quiz.ai_question_count,
```

- [ ] **Step 5: Xác định `down_revision` đúng**

Run: `cd backend && python -c "import re,pathlib; p=pathlib.Path('alembic/versions/20260910_add_quiz_tables.py'); print(re.search(r'^revision = .*', p.read_text(encoding='utf-8'), re.M).group())"`
Expected: in ra `revision = "20260910_quiz"`. Dùng đúng chuỗi in ra làm `down_revision` ở step sau.

- [ ] **Step 6: Viết migration**

Create `backend/alembic/versions/20260914_add_ai_quiz_columns.py`:

```python
"""add AI columns to quizzes and quiz_questions

Revision ID: 20260914_ai_quiz
Revises: 20260910_quiz
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260914_ai_quiz"
down_revision = "20260910_quiz"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quizzes",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ready"),
    )
    op.add_column(
        "quizzes",
        sa.Column("uses_ai", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("quizzes", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column(
        "quizzes",
        sa.Column("ai_question_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "quizzes",
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "quizzes",
        sa.Column("requested_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "quiz_questions",
        sa.Column("source", sa.String(length=10), nullable=False, server_default="algo"),
    )
    op.add_column("quiz_questions", sa.Column("explanation", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("quiz_questions", "explanation")
    op.drop_column("quiz_questions", "source")
    op.drop_column("quizzes", "requested_count")
    op.drop_column("quizzes", "retry_count")
    op.drop_column("quizzes", "ai_question_count")
    op.drop_column("quizzes", "error_message")
    op.drop_column("quizzes", "uses_ai")
    op.drop_column("quizzes", "status")
```

- [ ] **Step 7: Kiểm tra app vẫn import được**

Run: `cd backend && python -c "from app.main import app; print('ok')"`
Expected: in ra `ok`. Lỗi ở đây gần như luôn là thiếu import `Boolean`/`Integer`/`Text` trong `models/quiz.py` — file đã import sẵn cả ba, nhưng kiểm tra lại nếu gặp `NameError`.

- [ ] **Step 8: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ.

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/quiz.py backend/app/schemas/quiz.py backend/app/routers/quizzes.py backend/alembic/versions/20260914_add_ai_quiz_columns.py
git commit -m "feat(quiz): add status, uses_ai and explanation columns"
```

---

### Task 2: Mở rộng QuestionType và chia số câu theo dạng

**Files:**
- Modify: `backend/app/services/quiz_generator.py:11-18`, `:21-30`, `:32-36`, `:169-196`
- Modify: `backend/app/schemas/quiz.py:6`

**Interfaces:**
- Consumes: `compute_capacity`, `_distribute`, `generate_questions` sẵn có.
- Produces:
  - `quiz_generator.AI_QUESTION_TYPES: tuple[str, str]` = `("cloze", "context")`
  - `quiz_generator.split_question_count(cards, question_types, question_count, rng=None) -> dict[str, int]`
  - `GeneratedQuestion` có thêm `explanation: str | None = None` và `source: str = "algo"`
  - `generate_questions` raise `ValueError` khi gặp dạng AI
  - `QuestionType` Literal 5 giá trị

- [ ] **Step 1: Khai báo dạng AI**

Trong `backend/app/services/quiz_generator.py`, ngay dưới dòng `QUESTION_TYPES = ...`:

```python
# Hai dạng chỉ LLM sinh được. Cố ý KHÔNG gộp vào QUESTION_TYPES, vì
# generate_practice_questions validate theo hằng đó và practice không dùng AI.
AI_QUESTION_TYPES: tuple[str, str] = ("cloze", "context")
```

- [ ] **Step 2: Thêm trường vào GeneratedQuestion**

Sửa dataclass `GeneratedQuestion` trong cùng file:

```python
@dataclass(frozen=True)
class GeneratedQuestion:
    """A generated multiple-choice question."""
    card_id: str
    question_type: str
    prompt_text: str
    prompt_phonetic: str | None
    options: list[str]
    correct_index: int
    # Chỉ câu do AI sinh mới có. Câu thuật toán chỉ ghép sẵn từ thẻ nên không
    # có gì để giải thích.
    explanation: str | None = None
    source: str = "algo"
```

Cả hai trường có default nên mọi chỗ đang dựng `GeneratedQuestion` không phải sửa.

- [ ] **Step 3: Cho `_is_eligible` biết dạng AI**

Sửa hàm `_is_eligible`:

```python
def _is_eligible(card: Any, question_type: str) -> bool:
    if question_type in AI_QUESTION_TYPES:
        # LLM tự đặt câu nên card nào cũng dùng được.
        return True
    if question_type == "synonym":
        return card.card_type == "vocab" and len(card.synonyms) > 0
    return True
```

Nhờ vậy `compute_capacity` tự trả `len(cards)` cho `cloze`/`context` mà không cần nhánh riêng.

- [ ] **Step 4: Chặn dạng AI trong `generate_questions`**

Trong `generate_questions`, ngay sau khối `if not question_types: raise ...`:

```python
    ai_types = [t for t in question_types if t in AI_QUESTION_TYPES]
    if ai_types:
        raise ValueError(
            f"generate_questions không sinh được dạng AI: {', '.join(ai_types)}"
        )
```

- [ ] **Step 5: Viết `split_question_count`**

Thêm vào cuối `backend/app/services/quiz_generator.py`:

```python
def split_question_count(
    cards: Sequence[Any],
    question_types: Sequence[str],
    question_count: int,
    rng: Random | None = None,
) -> dict[str, int]:
    """Chia số câu cho các dạng đã chọn, không vượt sức chứa của từng dạng.

    Router cần biết trước bao nhiêu câu giao cho AI và bao nhiêu câu giao cho
    thuật toán, nên phần chia này được tách ra khỏi `generate_questions`.
    """
    if rng is None:
        rng = Random()

    capacity = compute_capacity(cards, question_types)
    total_capacity = sum(capacity.values())

    return _distribute(min(question_count, total_capacity), capacity, rng)
```

- [ ] **Step 6: Mở rộng Literal QuestionType**

Trong `backend/app/schemas/quiz.py`, sửa dòng 6:

```python
QuestionType = Literal["en_to_vi", "vi_to_en", "synonym", "cloze", "context"]
```

- [ ] **Step 7: Viết unit test**

Thêm vào cuối `backend/tests/test_quiz_generator.py` (file đã import sẵn `random`, `pytest`, `qg`, `make_pool`):

```python
class TestAiQuestionTypes:
    def test_ai_types_have_capacity_of_the_whole_pool(self):
        cards = make_pool(6)

        capacity = qg.compute_capacity(cards, ["cloze", "context"])

        assert capacity == {"cloze": 6, "context": 6}

    def test_ai_types_ignore_the_synonym_requirement(self):
        cards = make_pool(6, synonyms_for=set())

        capacity = qg.compute_capacity(cards, ["cloze"])

        assert capacity == {"cloze": 6}

    def test_generate_questions_refuses_ai_types(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="cloze"):
            qg.generate_questions(cards, ["en_to_vi", "cloze"], 4)


class TestSplitQuestionCount:
    def test_split_covers_every_requested_type(self):
        cards = make_pool(20)

        split = qg.split_question_count(
            cards, ["en_to_vi", "cloze"], 10, random.Random(1)
        )

        assert set(split) == {"en_to_vi", "cloze"}
        assert sum(split.values()) == 10

    def test_split_never_exceeds_capacity(self):
        cards = make_pool(6, synonyms_for={0, 1})

        split = qg.split_question_count(
            cards, ["synonym", "cloze"], 20, random.Random(1)
        )

        assert split["synonym"] <= 2
        assert split["cloze"] <= 6

    def test_split_caps_at_total_capacity(self):
        cards = make_pool(5, synonyms_for={0})

        split = qg.split_question_count(cards, ["synonym"], 99, random.Random(1))

        assert split == {"synonym": 1}
```

- [ ] **Step 8: Chạy test**

Run: `cd backend && python -m pytest tests/test_quiz_generator.py -v`
Expected: PASS toàn bộ, kể cả các test cũ của file.

- [ ] **Step 9: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ — đặc biệt `test_quiz_generator.py`, để chắc việc thêm trường vào `GeneratedQuestion` không phá gì.

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/quiz_generator.py backend/app/schemas/quiz.py backend/tests/test_quiz_generator.py
git commit -m "feat(quiz): add cloze and context question types with count splitting"
```

---

### Task 3: Tầng provider OpenAI-compatible

**Files:**
- Create: `backend/app/services/ai/__init__.py`
- Create: `backend/app/services/ai/provider.py`
- Create: `backend/app/services/ai/openai_compat.py`
- Modify: `backend/app/config.py`
- Modify: `backend/requirements.txt`

**Interfaces:**
- Consumes: `app.config.settings`.
- Produces:
  - `LLMProvider` Protocol với `async def complete_json(self, system: str, user: str, max_tokens: int = 4096) -> str`
  - `OpenAICompatProvider(base_url, api_key, model, timeout)`
  - `get_provider() -> LLMProvider | None` — trả `None` khi `AI_API_KEY` rỗng
  - `ai_available() -> bool`

- [ ] **Step 1: Thêm dependency**

Thêm vào cuối `backend/requirements.txt`:

```
openai==1.51.0
```

Cài: `cd backend && python -m pip install openai==1.51.0`

- [ ] **Step 2: Thêm config**

Trong `backend/app/config.py`, thêm vào class `Settings` ngay trước `model_config`:

```python
    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"
    AI_MAX_CARDS_PER_PROMPT: int = 120
    AI_DAILY_QUIZ_LIMIT: int = 20
    AI_TIMEOUT_SECONDS: int = 90
```

- [ ] **Step 3: Viết Protocol**

Create `backend/app/services/ai/provider.py`:

```python
"""Ranh giới giữa app và nhà cung cấp LLM.

Interface cố ý chỉ có một hàm: gửi prompt, nhận lại chuỗi. Nhờ vậy đổi nhà
cung cấp chỉ là thêm một file trong thư mục này, và chỗ gọi không phải biết
gì về SDK bên dưới.
"""
from typing import Protocol


class LLMProvider(Protocol):
    model: str

    async def complete_json(self, system: str, user: str, max_tokens: int = 4096) -> str:
        """Trả về nội dung text thô của model. Việc parse là của lớp trên."""
        ...
```

- [ ] **Step 4: Viết provider**

Create `backend/app/services/ai/openai_compat.py`:

```python
"""Provider nói giao thức OpenAI Chat Completions.

Dùng được với OpenAI, OpenRouter, Groq, DeepSeek, hay LLM chạy nội bộ — chỉ
khác base_url và tên model.
"""
from openai import AsyncOpenAI


class OpenAICompatProvider:
    def __init__(self, base_url: str, api_key: str, model: str, timeout: int) -> None:
        self.model = model
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=timeout)

    async def complete_json(self, system: str, user: str, max_tokens: int = 4096) -> str:
        response = await self._client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=0.7,
            # Chuẩn OpenAI, nhưng nhiều endpoint tương thích lờ đi. Lớp parse
            # vẫn phải chịu được code fence và chữ thừa quanh JSON.
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content or ""
```

- [ ] **Step 5: Viết factory**

Create `backend/app/services/ai/__init__.py`:

```python
from app.config import settings
from app.services.ai.openai_compat import OpenAICompatProvider
from app.services.ai.provider import LLMProvider

__all__ = ["LLMProvider", "OpenAICompatProvider", "ai_available", "get_provider", "settings"]


def ai_available() -> bool:
    return bool(settings.AI_API_KEY)


def get_provider() -> LLMProvider | None:
    """Provider đã cấu hình, hoặc None khi tính năng AI đang tắt."""
    if not ai_available():
        return None

    return OpenAICompatProvider(
        base_url=settings.AI_BASE_URL,
        api_key=settings.AI_API_KEY,
        model=settings.AI_MODEL,
        timeout=settings.AI_TIMEOUT_SECONDS,
    )
```

- [ ] **Step 6: Viết unit test**

Create `backend/tests/test_ai_provider.py`:

```python
from app.services import ai


class TestGetProvider:
    def test_no_provider_when_key_is_empty(self, monkeypatch):
        monkeypatch.setattr(ai.settings, "AI_API_KEY", "")

        assert ai.get_provider() is None
        assert ai.ai_available() is False

    def test_provider_built_when_key_is_set(self, monkeypatch):
        monkeypatch.setattr(ai.settings, "AI_API_KEY", "sk-test")
        monkeypatch.setattr(ai.settings, "AI_MODEL", "some-model")

        provider = ai.get_provider()

        assert provider is not None
        assert provider.model == "some-model"
        assert ai.ai_available() is True
```

`monkeypatch` tự hoàn tác sau mỗi test, nên không test nào để lại key cho test kế tiếp.

- [ ] **Step 7: Chạy test**

Run: `cd backend && python -m pytest tests/test_ai_provider.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/ai backend/app/config.py backend/requirements.txt backend/tests/test_ai_provider.py
git commit -m "feat(ai): add OpenAI-compatible provider layer"
```

---

### Task 4: Dựng prompt và validate kết quả LLM

Đây là ranh giới tin cậy của toàn bộ tính năng: mọi thứ model trả ra đi qua đây trước khi tới database.

**Files:**
- Create: `backend/app/services/ai/quiz_prompt.py`

**Interfaces:**
- Consumes: `AI_QUESTION_TYPES`, `GeneratedQuestion`, `_normalize` từ `quiz_generator` (Task 2).
- Produces:
  - `build_prompt(cards, ai_types, ai_question_count, max_cards, rng=None) -> tuple[str, str]`
  - `parse_and_validate(raw, cards, ai_types) -> tuple[list[GeneratedQuestion], list[str]]`

- [ ] **Step 1: Viết `build_prompt`**

Create `backend/app/services/ai/quiz_prompt.py`:

```python
"""Dựng prompt và kiểm tra kết quả LLM trả về.

Thuần: không chạm DB, không gọi mạng. Mọi thứ model trả ra đi qua
`parse_and_validate` trước khi tới database — đây là ranh giới tin cậy của
tính năng, nên phần kiểm tra ở đây cố tình chi tiết và bảo thủ.
"""
import json
from collections.abc import Sequence
from random import Random
from typing import Any

from app.services.quiz_generator import AI_QUESTION_TYPES, GeneratedQuestion, _normalize

CLOZE_BLANK = "___"
REQUIRED_OPTION_COUNT = 4

SYSTEM_PROMPT = """Bạn là giáo viên tiếng Anh soạn câu hỏi trắc nghiệm cho người học Việt Nam.

Bạn nhận một danh sách thẻ từ vựng và phải soạn câu hỏi CHỈ dựa trên các thẻ đó.

Dạng câu hỏi:
- "cloze": một câu tiếng Anh tự nhiên có chỗ trống viết đúng ba dấu gạch dưới (___). Đáp án đúng là từ ở front_text của thẻ. Ba phương án còn lại là từ tiếng Anh khác, sai về nghĩa trong ngữ cảnh đó nhưng cùng loại từ.
- "context": mô tả một tình huống bằng tiếng Anh rồi hỏi từ nào hợp nhất. Đáp án đúng là front_text của thẻ. Ba phương án còn lại là từ tiếng Anh gần nghĩa nhưng sai sắc thái.

Quy tắc bắt buộc:
- Mỗi câu có ĐÚNG 4 phương án, không phương án nào trùng nhau.
- correct_index là chỉ số của đáp án đúng trong mảng options, từ 0 đến 3.
- explanation viết bằng tiếng Việt, một tới hai câu, giải thích vì sao đáp án đúng và vì sao các phương án kia sai.
- card_id phải là một trong các card_id đã cho.
- Không lặp lại cùng một thẻ hai lần.

Chỉ trả về một JSON object đúng dạng sau, không kèm chữ nào khác:
{"questions": [{"card_id": "...", "question_type": "cloze", "prompt_text": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}]}"""


def _card_payload(card: Any) -> dict[str, Any]:
    return {
        "card_id": card.id,
        "front_text": card.front_text,
        "front_phonetic": getattr(card, "front_phonetic", None),
        "back_text": card.back_text,
        "example": getattr(card, "example", None),
        "synonyms": [synonym.word for synonym in card.synonyms],
    }


def build_prompt(
    cards: Sequence[Any],
    ai_types: Sequence[str],
    ai_question_count: int,
    max_cards: int,
    rng: Random | None = None,
) -> tuple[str, str]:
    """Trả về `(system, user)` cho một lần gọi sinh cả phần AI của đề.

    Raises:
        ValueError: Nếu `ai_types` rỗng hoặc chứa dạng mà thuật toán phụ trách.
    """
    if not ai_types:
        raise ValueError("Cần ít nhất một dạng câu hỏi AI")

    unsupported = [t for t in ai_types if t not in AI_QUESTION_TYPES]
    if unsupported:
        raise ValueError(
            f"AI chỉ sinh {', '.join(AI_QUESTION_TYPES)}; không nhận: "
            f"{', '.join(unsupported)}"
        )

    if rng is None:
        rng = Random()

    selected = list(cards)
    if len(selected) > max_cards:
        selected = rng.sample(selected, max_cards)

    payload = {
        "question_count": ai_question_count,
        "question_types": list(ai_types),
        "cards": [_card_payload(card) for card in selected],
    }

    user = (
        f"Soạn đúng {ai_question_count} câu hỏi từ dữ liệu sau:\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )

    return SYSTEM_PROMPT, user
```

- [ ] **Step 2: Viết bộ bóc JSON**

Thêm vào cùng file:

```python
def _extract_json(raw: str) -> dict[str, Any]:
    """Bóc JSON ra khỏi code fence hoặc chữ thừa quanh nó.

    Không dựa vào `response_format` của endpoint, vì nhiều server tương thích
    lờ tham số đó đi và trả về JSON bọc trong ```json.

    Raises:
        ValueError: Nếu không tìm thấy JSON object nào đọc được.
    """
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Không tìm thấy JSON object trong kết quả")

    try:
        parsed = json.loads(raw[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON hỏng: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Kết quả không phải JSON object")

    return parsed
```

- [ ] **Step 3: Viết bộ luật loại câu hỏng**

Thêm vào cùng file:

```python
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
    if question_type == "cloze" and CLOZE_BLANK not in prompt_text:
        return "câu cloze không có chỗ trống ___"

    options = item.get("options")
    if not isinstance(options, list) or len(options) != REQUIRED_OPTION_COUNT:
        return f"cần đúng {REQUIRED_OPTION_COUNT} phương án"
    if not all(isinstance(option, str) and option.strip() for option in options):
        return "có phương án rỗng"
    if len({_normalize(option) for option in options}) != REQUIRED_OPTION_COUNT:
        return "có phương án trùng nhau"

    correct_index = item.get("correct_index")
    if not isinstance(correct_index, int) or isinstance(correct_index, bool):
        return "correct_index không phải số nguyên"
    if not 0 <= correct_index < REQUIRED_OPTION_COUNT:
        return f"correct_index ngoài khoảng: {correct_index}"

    explanation = item.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        return "thiếu explanation"

    return None
```

- [ ] **Step 4: Viết `parse_and_validate`**

Thêm vào cùng file:

```python
def parse_and_validate(
    raw: str,
    cards: Sequence[Any],
    ai_types: Sequence[str],
) -> tuple[list[GeneratedQuestion], list[str]]:
    """Lọc lấy những câu hỏi dùng được từ kết quả thô của LLM.

    Câu nào không đạt thì bị bỏ, kèm một dòng lý do để ghi log. Một câu hỏng
    không làm hỏng cả đề.

    Returns:
        `(câu hợp lệ, lý do các câu bị loại)`.
    """
    try:
        payload = _extract_json(raw)
    except ValueError as exc:
        return [], [str(exc)]

    items = payload.get("questions")
    if not isinstance(items, list):
        return [], ["Kết quả thiếu mảng 'questions'"]

    cards_by_id = {card.id: card for card in cards}
    allowed_types = set(ai_types)
    accepted: list[GeneratedQuestion] = []
    rejected: list[str] = []
    used_card_ids: set[str] = set()

    for index, item in enumerate(items):
        reason = _reject_reason(item, cards_by_id, allowed_types, used_card_ids)
        if reason is not None:
            rejected.append(f"Câu {index}: {reason}")
            continue

        used_card_ids.add(item["card_id"])
        accepted.append(
            GeneratedQuestion(
                card_id=item["card_id"],
                question_type=item["question_type"],
                prompt_text=item["prompt_text"].strip(),
                prompt_phonetic=None,
                options=[str(option) for option in item["options"]],
                correct_index=int(item["correct_index"]),
                explanation=item["explanation"].strip(),
                source="ai",
            )
        )

    return accepted, rejected
```

- [ ] **Step 5: Viết unit test cho `build_prompt`**

Create `backend/tests/test_ai_quiz_prompt.py`:

```python
import json
import random

import pytest

from app.services.ai import quiz_prompt
from tests.factories import make_pool


def _payload_of(user: str) -> dict:
    """Bóc lại JSON đã nhúng trong user prompt."""
    return json.loads(user[user.index("{") : user.rindex("}") + 1])


class TestBuildPrompt:
    def test_rejects_legacy_question_types(self):
        cards = make_pool(5)

        with pytest.raises(ValueError, match="en_to_vi"):
            quiz_prompt.build_prompt(cards, ["cloze", "en_to_vi"], 4, max_cards=10)

    def test_rejects_empty_type_list(self):
        cards = make_pool(5)

        with pytest.raises(ValueError):
            quiz_prompt.build_prompt(cards, [], 4, max_cards=10)

    def test_samples_cards_down_to_the_limit(self):
        cards = make_pool(50)

        _, user = quiz_prompt.build_prompt(
            cards, ["cloze"], 4, max_cards=10, rng=random.Random(1)
        )

        assert len(_payload_of(user)["cards"]) == 10

    def test_keeps_every_card_when_under_the_limit(self):
        cards = make_pool(6)

        _, user = quiz_prompt.build_prompt(cards, ["cloze"], 4, max_cards=10)

        payload = _payload_of(user)
        assert len(payload["cards"]) == 6
        assert payload["question_count"] == 4
        assert payload["question_types"] == ["cloze"]

    def test_card_payload_carries_the_fields_the_model_needs(self):
        cards = make_pool(4, synonyms_for={0})

        _, user = quiz_prompt.build_prompt(cards, ["context"], 2, max_cards=10)

        first = _payload_of(user)["cards"][0]
        assert set(first) == {
            "card_id",
            "front_text",
            "front_phonetic",
            "back_text",
            "example",
            "synonyms",
        }
```

- [ ] **Step 6: Viết unit test cho `parse_and_validate`**

Mỗi luật loại câu hỏng một test — đây là ranh giới tin cậy nên không gộp.

Thêm vào `backend/tests/test_ai_quiz_prompt.py`:

```python
def _raw(questions: list[dict]) -> str:
    return json.dumps({"questions": questions}, ensure_ascii=False)


def _good_question(card_id: str = "card-0") -> dict:
    return {
        "card_id": card_id,
        "question_type": "cloze",
        "prompt_text": "The harvest was ___ this year.",
        "options": ["word0", "word1", "word2", "word3"],
        "correct_index": 0,
        "explanation": "word0 nghĩa là dồi dào, hợp với vụ mùa bội thu.",
    }


class TestParseAndValidate:
    def test_accepts_a_well_formed_question(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_good_question()]), cards, ["cloze"]
        )

        assert rejected == []
        assert len(questions) == 1
        assert questions[0].card_id == "card-0"
        assert questions[0].correct_index == 0
        assert questions[0].source == "ai"
        assert questions[0].explanation.startswith("word0")

    def test_tolerates_code_fence_and_surrounding_prose(self):
        cards = make_pool(4)
        raw = "Đây là đề của bạn:\n```json\n" + _raw([_good_question()]) + "\n```\nHết."

        questions, _ = quiz_prompt.parse_and_validate(raw, cards, ["cloze"])

        assert len(questions) == 1

    def test_broken_json_yields_no_questions(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate("not json", cards, ["cloze"])

        assert questions == []
        assert len(rejected) == 1

    def test_missing_questions_array_yields_no_questions(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate('{"data": []}', cards, ["cloze"])

        assert questions == []
        assert len(rejected) == 1

    def test_rejects_duplicate_options(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "Word0", "word2", "word3"]

        questions, rejected = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []
        assert "trùng" in rejected[0]

    def test_rejects_wrong_option_count(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "word1", "word2"]

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_empty_option(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "  ", "word2", "word3"]

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_correct_index_out_of_range(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["correct_index"] = 4

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_boolean_correct_index(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["correct_index"] = True

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_empty_explanation(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["explanation"] = "   "

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_cloze_without_a_blank(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["prompt_text"] = "The harvest was good this year."

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_context_question_needs_no_blank(self):
        cards = make_pool(4)
        item = _good_question()
        item["question_type"] = "context"
        item["prompt_text"] = "Which word fits a plentiful harvest?"

        questions, _ = quiz_prompt.parse_and_validate(_raw([item]), cards, ["context"])

        assert len(questions) == 1

    def test_rejects_unknown_card_id(self):
        cards = make_pool(4)

        questions, _ = quiz_prompt.parse_and_validate(
            _raw([_good_question(card_id="card-999")]), cards, ["cloze"]
        )

        assert questions == []

    def test_rejects_question_type_that_was_not_requested(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["question_type"] = "context"

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_the_same_card_twice(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_good_question(), _good_question()]), cards, ["cloze"]
        )

        assert len(questions) == 1
        assert len(rejected) == 1

    def test_keeps_good_questions_and_drops_bad_ones(self):
        cards = make_pool(4)
        bad = _good_question(card_id="card-1")
        bad["correct_index"] = 9

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_good_question(), bad]), cards, ["cloze"]
        )

        assert len(questions) == 1
        assert len(rejected) == 1
```

- [ ] **Step 7: Chạy test**

Run: `cd backend && python -m pytest tests/test_ai_quiz_prompt.py -v`
Expected: PASS toàn bộ.

- [ ] **Step 8: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ.

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/ai/quiz_prompt.py backend/tests/test_ai_quiz_prompt.py
git commit -m "feat(ai): build prompt and validate LLM questions before storage"
```

---

### Task 5: Điều phối sinh câu AI kèm bù thiếu

**Files:**
- Create: `backend/app/services/ai/quiz_ai.py`

**Interfaces:**
- Consumes: `build_prompt`, `parse_and_validate` (Task 4), `generate_questions` (Task 2), `settings.AI_MAX_CARDS_PER_PROMPT` (Task 3).
- Produces: `async def generate_ai_questions(provider, cards, ai_types, ai_count, fallback_types, rng=None) -> AiGenerationResult`, với `AiGenerationResult(questions: list[GeneratedQuestion], ai_count: int, rejected: list[str], error: str | None)`.

- [ ] **Step 1: Viết service**

Create `backend/app/services/ai/quiz_ai.py`:

```python
"""Một lần gọi LLM sinh cả phần AI của đề, rồi bù phần thiếu bằng thuật toán.

Hàm ở đây không chạm DB: nó nhận card, trả câu hỏi. Router lo phần ghi.
"""
import logging
from collections.abc import Sequence
from dataclasses import dataclass, field
from random import Random
from typing import Any

from app.config import settings
from app.services.ai.provider import LLMProvider
from app.services.ai.quiz_prompt import build_prompt, parse_and_validate
from app.services.quiz_generator import GeneratedQuestion, generate_questions

logger = logging.getLogger(__name__)


@dataclass
class AiGenerationResult:
    questions: list[GeneratedQuestion] = field(default_factory=list)
    ai_count: int = 0
    rejected: list[str] = field(default_factory=list)
    # Chỉ đặt khi bản thân lời gọi LLM hỏng. Câu bị loại lẻ tẻ không tính là lỗi.
    error: str | None = None


async def generate_ai_questions(
    provider: LLMProvider,
    cards: Sequence[Any],
    ai_types: Sequence[str],
    ai_count: int,
    fallback_types: Sequence[str],
    rng: Random | None = None,
) -> AiGenerationResult:
    """Sinh `ai_count` câu cho các dạng AI, bù phần thiếu bằng thuật toán.

    Args:
        provider: Nhà cung cấp LLM đã cấu hình.
        cards: Toàn bộ card của các session nguồn.
        ai_types: Chỉ gồm dạng AI; `build_prompt` sẽ raise nếu không phải.
        ai_count: Số câu người dùng đã phân cho các dạng AI.
        fallback_types: Các dạng thuật toán người dùng đã chọn, dùng để bù.
            Rỗng nghĩa là người dùng chỉ chọn dạng AI, khi đó đề chấp nhận
            ngắn hơn yêu cầu.
        rng: Random number generator.

    Lỗi của provider được trả về trong `error` chứ không ném ra ngoài, vì hàm
    này chạy trong background task và người gọi cần ghi lý do vào DB.
    """
    if rng is None:
        rng = Random()

    result = AiGenerationResult()

    try:
        system, user = build_prompt(
            cards, ai_types, ai_count, settings.AI_MAX_CARDS_PER_PROMPT, rng
        )
        raw = await provider.complete_json(system, user)
        accepted, rejected = parse_and_validate(raw, cards, ai_types)
        result.questions = list(accepted)
        result.ai_count = len(accepted)
        result.rejected = rejected
        if rejected:
            logger.warning("Bỏ %d câu AI không hợp lệ: %s", len(rejected), rejected)
    except Exception as exc:  # noqa: BLE001 — lỗi nào cũng phải thành error text
        logger.exception("Gọi LLM thất bại")
        result.error = str(exc) or exc.__class__.__name__

    missing = ai_count - len(result.questions)
    if missing > 0 and fallback_types:
        used_card_ids = {question.card_id for question in result.questions}
        remaining = [card for card in cards if card.id not in used_card_ids]
        try:
            result.questions.extend(
                generate_questions(remaining, list(fallback_types), missing, rng)
            )
        except ValueError:
            # Pool còn lại quá nhỏ để bù. Đề ngắn hơn vẫn tốt hơn là không có đề.
            logger.warning("Không đủ thẻ để bù %d câu thuật toán", missing)

    return result
```

- [ ] **Step 2: Viết unit test**

Create `backend/tests/test_ai_quiz_service.py`:

```python
import json

import pytest

from app.services.ai import quiz_ai
from tests.factories import make_pool


class FakeProvider:
    """Provider giả: trả chuỗi dựng sẵn, hoặc ném lỗi. Không chạm mạng."""

    model = "fake"

    def __init__(self, raw: str | None = None, error: Exception | None = None) -> None:
        self._raw = raw
        self._error = error
        self.calls = 0

    async def complete_json(self, system: str, user: str, max_tokens: int = 4096) -> str:
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._raw or ""


def _raw_questions(card_ids: list[str]) -> str:
    return json.dumps(
        {
            "questions": [
                {
                    "card_id": card_id,
                    "question_type": "cloze",
                    "prompt_text": f"Use ___ here for {card_id}.",
                    "options": ["alpha", "beta", "gamma", "delta"],
                    "correct_index": 0,
                    "explanation": "Giải thích hợp lệ.",
                }
                for card_id in card_ids
            ]
        },
        ensure_ascii=False,
    )


@pytest.mark.asyncio
class TestGenerateAiQuestions:
    async def test_returns_every_valid_ai_question(self):
        cards = make_pool(8)
        provider = FakeProvider(_raw_questions(["card-0", "card-1", "card-2"]))

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 3, fallback_types=["en_to_vi"]
        )

        assert result.error is None
        assert result.ai_count == 3
        assert len(result.questions) == 3
        assert all(question.source == "ai" for question in result.questions)
        assert all(question.explanation for question in result.questions)

    async def test_backfills_with_algorithmic_questions(self):
        cards = make_pool(8)
        provider = FakeProvider(_raw_questions(["card-0"]))

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 4, fallback_types=["en_to_vi"]
        )

        assert result.ai_count == 1
        assert len(result.questions) == 4
        assert sum(1 for q in result.questions if q.source == "algo") == 3

    async def test_backfill_never_reuses_a_card_the_ai_used(self):
        cards = make_pool(8)
        provider = FakeProvider(_raw_questions(["card-0", "card-1"]))

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 6, fallback_types=["en_to_vi"]
        )

        card_ids = [question.card_id for question in result.questions]
        assert len(card_ids) == len(set(card_ids))

    async def test_without_fallback_types_it_returns_fewer_questions(self):
        cards = make_pool(8)
        provider = FakeProvider(_raw_questions(["card-0"]))

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 5, fallback_types=[]
        )

        assert result.error is None
        assert len(result.questions) == 1

    async def test_provider_failure_is_reported_not_raised(self):
        cards = make_pool(8)
        provider = FakeProvider(error=RuntimeError("upstream down"))

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 4, fallback_types=[]
        )

        assert result.questions == []
        assert result.ai_count == 0
        assert "upstream down" in result.error

    async def test_provider_failure_still_backfills_when_possible(self):
        cards = make_pool(8)
        provider = FakeProvider(error=RuntimeError("upstream down"))

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 4, fallback_types=["en_to_vi"]
        )

        assert len(result.questions) == 4
        assert all(question.source == "algo" for question in result.questions)

    async def test_garbage_output_is_not_an_error_but_yields_nothing(self):
        cards = make_pool(8)
        provider = FakeProvider("hoàn toàn không phải JSON")

        result = await quiz_ai.generate_ai_questions(
            provider, cards, ["cloze"], 3, fallback_types=[]
        )

        assert result.error is None
        assert result.questions == []
        assert len(result.rejected) == 1
```

- [ ] **Step 3: Bật chế độ asyncio cho pytest**

`@pytest.mark.asyncio` cần `pytest-asyncio` biết chạy ở mode nào. Thêm vào `backend/pyproject.toml`, trong khối `[tool.pytest.ini_options]` đã có:

```toml
asyncio_mode = "auto"
```

- [ ] **Step 4: Chạy test**

Run: `cd backend && python -m pytest tests/test_ai_quiz_service.py -v`
Expected: PASS toàn bộ. Nếu báo `async def functions are not natively supported`, `asyncio_mode` chưa được đọc — kiểm tra lại khối `[tool.pytest.ini_options]` ở Step 3.

- [ ] **Step 5: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ai/quiz_ai.py backend/tests/test_ai_quiz_service.py backend/pyproject.toml
git commit -m "feat(ai): orchestrate AI generation with algorithmic backfill"
```

---

### Task 6: Phân nhánh `POST /quizzes` và background task

**Files:**
- Modify: `backend/app/routers/quizzes.py:1-27` (imports), `:170-233` (`create_quiz`)

**Interfaces:**
- Consumes: `split_question_count` (Task 2), `ai_available`/`get_provider` (Task 3), `generate_ai_questions` (Task 5), `AsyncSessionLocal` từ `app.database`.
- Produces: `run_ai_generation(quiz_id: str) -> None`, `_add_questions(db, quiz_id, generated, start_position) -> int`, `_enforce_daily_ai_limit(db, user_id) -> None`.

- [ ] **Step 1: Cập nhật imports**

Trong `backend/app/routers/quizzes.py`, sửa khối import đầu file:

```python
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.config import settings
from app.database import AsyncSessionLocal, get_db
from app.services.ai import ai_available, get_provider
from app.services.ai.quiz_ai import generate_ai_questions
from app.services.quiz_generator import (
    AI_QUESTION_TYPES,
    MIN_POOL_SIZE,
    compute_capacity,
    generate_questions,
    split_question_count,
)
```

Giữ nguyên các import sẵn có khác của file.

- [ ] **Step 2: Viết helper ghi câu hỏi**

Thêm vào `backend/app/routers/quizzes.py`, ngay trên `create_quiz`:

```python
def _add_questions(db: AsyncSession, quiz_id: str, generated, start_position: int) -> int:
    """Ghi các câu hỏi sinh ra vào DB. Trả về vị trí kế tiếp còn trống."""
    position = start_position
    for gen_question in generated:
        db.add(
            QuizQuestion(
                quiz_id=quiz_id,
                card_id=gen_question.card_id,
                question_type=gen_question.question_type,
                prompt_text=gen_question.prompt_text,
                prompt_phonetic=gen_question.prompt_phonetic,
                options=json.dumps(gen_question.options),
                correct_index=gen_question.correct_index,
                explanation=gen_question.explanation,
                source=gen_question.source,
                position=position,
            )
        )
        position += 1
    return position
```

- [ ] **Step 3: Viết hàm hạn mức**

Thêm ngay dưới:

```python
async def _enforce_daily_ai_limit(db: AsyncSession, user_id: str) -> None:
    """Chặn khi user đã dùng hết lượt sinh đề AI trong 24 giờ qua."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(func.count(Quiz.id)).where(
            Quiz.user_id == user_id,
            Quiz.uses_ai.is_(True),
            Quiz.created_at >= since,
        )
    )
    used_today = result.scalar() or 0

    if used_today >= settings.AI_DAILY_QUIZ_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Bạn đã dùng hết {settings.AI_DAILY_QUIZ_LIMIT} lượt soạn đề bằng AI "
                "trong 24 giờ qua"
            ),
        )
```

- [ ] **Step 4: Viết background task**

Thêm ngay dưới:

```python
async def run_ai_generation(quiz_id: str) -> None:
    """Sinh phần câu hỏi AI của một quiz đang 'pending'.

    Chạy sau khi response đã trả, nên tự mở session DB riêng: session của
    request đã đóng ở thời điểm này.
    """
    async with AsyncSessionLocal() as db:
        quiz = await db.get(Quiz, quiz_id)
        if quiz is None or quiz.status != "pending":
            return

        source_result = await db.execute(
            select(QuizSourceSession.session_id).where(
                QuizSourceSession.quiz_id == quiz_id
            )
        )
        session_ids = list(source_result.scalars().all())
        cards = await _load_user_cards(db, quiz.user_id, session_ids)

        selected_types = quiz.question_types.split(",")
        ai_types = [t for t in selected_types if t in AI_QUESTION_TYPES]
        fallback_types = [t for t in selected_types if t not in AI_QUESTION_TYPES]

        existing = await db.execute(
            select(func.count(QuizQuestion.id)).where(QuizQuestion.quiz_id == quiz_id)
        )
        algo_count = existing.scalar() or 0

        split = split_question_count(cards, selected_types, quiz.requested_count)
        ai_count = sum(split.get(question_type, 0) for question_type in ai_types)

        provider = get_provider()
        if provider is None:
            quiz.status = "ready" if algo_count else "failed"
            quiz.error_message = None if algo_count else "Tính năng AI chưa được cấu hình"
            await db.commit()
            return

        result = await generate_ai_questions(
            provider, cards, ai_types, ai_count, fallback_types
        )

        _add_questions(db, quiz_id, result.questions, algo_count)
        quiz.ai_question_count = result.ai_count

        if not result.questions and algo_count == 0:
            quiz.status = "failed"
            quiz.error_message = result.error or "AI không soạn được câu hỏi nào hợp lệ"
        else:
            quiz.status = "ready"
            quiz.error_message = None

        await db.commit()
```

- [ ] **Step 5: Viết lại `create_quiz`**

Thay toàn bộ hàm `create_quiz`:

```python
@router.post("", response_model=QuizListItem)
async def create_quiz(
    payload: QuizCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizListItem:
    """Tạo quiz mới.

    Chỉ dạng cũ thì sinh đồng bộ như trước. Có dạng AI thì phần thuật toán
    được ghi ngay, quiz để 'pending', và phần AI sinh ở background task — nhờ
    vậy AI hỏng cũng không làm mất phần câu hỏi đã có.
    """
    sessions = await _load_user_sessions(db, current_user.id, payload.session_ids)
    cards = await _load_user_cards(db, current_user.id, payload.session_ids)

    if len(cards) < MIN_POOL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {MIN_POOL_SIZE} cards to generate questions",
        )

    ai_types = [t for t in payload.question_types if t in AI_QUESTION_TYPES]
    algo_types = [t for t in payload.question_types if t not in AI_QUESTION_TYPES]

    if ai_types and not ai_available():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tính năng soạn đề bằng AI chưa được bật trên máy chủ",
        )

    if ai_types:
        await _enforce_daily_ai_limit(db, current_user.id)

    split = split_question_count(cards, payload.question_types, payload.question_count)
    algo_count = sum(split.get(question_type, 0) for question_type in algo_types)

    generated = []
    if algo_count > 0:
        generated = generate_questions(cards, algo_types, algo_count)

    if not ai_types and not generated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not generate questions with given parameters",
        )

    quiz = Quiz(
        user_id=current_user.id,
        title=payload.title,
        question_types=",".join(payload.question_types),
        requested_count=payload.question_count,
        uses_ai=bool(ai_types),
        status="pending" if ai_types else "ready",
    )
    db.add(quiz)
    await db.flush()

    for session in sessions:
        db.add(QuizSourceSession(quiz_id=quiz.id, session_id=session.id))

    _add_questions(db, quiz.id, generated, 0)

    await db.commit()
    await db.refresh(quiz)

    if ai_types:
        background_tasks.add_task(run_ai_generation, quiz.id)

    return await _quiz_list_item(db, quiz)
```

- [ ] **Step 6: Kiểm tra app import được**

Run: `cd backend && python -c "from app.main import app; print('ok')"`
Expected: in ra `ok`.

- [ ] **Step 7: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/quizzes.py
git commit -m "feat(quiz): generate AI questions in a background task"
```

---

### Task 7: Endpoint trạng thái, ai-status, retry, và quiz mồ côi

**Files:**
- Modify: `backend/app/schemas/quiz.py`
- Modify: `backend/app/routers/quizzes.py`

**Interfaces:**
- Consumes: `run_ai_generation` (Task 6).
- Produces:
  - `GET /quizzes/ai-status` → `AiStatusOut(available, daily_limit, used_today)`
  - `GET /quizzes/{quiz_id}/status` → `QuizStatusOut(status, question_count, error_message)`
  - `POST /quizzes/{quiz_id}/retry` → `QuizListItem`
  - `PENDING_TIMEOUT_MINUTES = 10`

- [ ] **Step 1: Thêm schema**

Thêm vào `backend/app/schemas/quiz.py`:

```python
class AiStatusOut(BaseModel):
    available: bool
    daily_limit: int
    used_today: int


class QuizStatusOut(BaseModel):
    status: str
    question_count: int
    error_message: str | None = None
```

Thêm `AiStatusOut, QuizStatusOut` vào khối import schema trong `backend/app/routers/quizzes.py`.

- [ ] **Step 2: Viết helper hạn mức và dọn quiz mồ côi**

Thêm vào `backend/app/routers/quizzes.py`:

```python
# Quiz kẹt 'pending' lâu hơn ngưỡng này coi như đã chết cùng tiến trình sinh nó.
PENDING_TIMEOUT_MINUTES = 10


async def _count_ai_quizzes_today(db: AsyncSession, user_id: str) -> int:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    result = await db.execute(
        select(func.count(Quiz.id)).where(
            Quiz.user_id == user_id,
            Quiz.uses_ai.is_(True),
            Quiz.created_at >= since,
        )
    )
    return result.scalar() or 0


async def _expire_if_stale(db: AsyncSession, quiz: Quiz) -> None:
    """Chuyển quiz 'pending' quá hạn sang 'failed'.

    Background task là asyncio in-process, nên một lần restart giữa chừng để
    lại quiz kẹt pending vĩnh viễn. Đây là chỗ dọn.
    """
    if quiz.status != "pending":
        return

    created_at = quiz.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) - created_at <= timedelta(minutes=PENDING_TIMEOUT_MINUTES):
        return

    quiz.status = "failed"
    quiz.error_message = "Quá trình soạn đề bị gián đoạn. Hãy thử lại."
    await db.commit()
```

Sửa `_enforce_daily_ai_limit` (Task 6) để dùng lại `_count_ai_quizzes_today` thay vì đếm lặp:

```python
async def _enforce_daily_ai_limit(db: AsyncSession, user_id: str) -> None:
    """Chặn khi user đã dùng hết lượt sinh đề AI trong 24 giờ qua."""
    if await _count_ai_quizzes_today(db, user_id) >= settings.AI_DAILY_QUIZ_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Bạn đã dùng hết {settings.AI_DAILY_QUIZ_LIMIT} lượt soạn đề bằng AI "
                "trong 24 giờ qua"
            ),
        )
```

- [ ] **Step 3: Viết endpoint `ai-status`**

**Đặt nó TRƯỚC route `@router.get("/{quiz_id}")` trong file**, nếu không FastAPI sẽ khớp chuỗi `"ai-status"` thành một `quiz_id`:

```python
@router.get("/ai-status", response_model=AiStatusOut)
async def get_ai_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AiStatusOut:
    """Cho frontend biết có nên hiện hai dạng câu hỏi AI hay không."""
    return AiStatusOut(
        available=ai_available(),
        daily_limit=settings.AI_DAILY_QUIZ_LIMIT,
        used_today=await _count_ai_quizzes_today(db, current_user.id),
    )
```

- [ ] **Step 4: Viết endpoint status và retry**

Thêm vào cuối `backend/app/routers/quizzes.py`:

```python
@router.get("/{quiz_id}/status", response_model=QuizStatusOut)
async def get_quiz_status(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizStatusOut:
    """Endpoint nhẹ để frontend poll trong lúc AI soạn đề."""
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)
    await _expire_if_stale(db, quiz)

    result = await db.execute(
        select(func.count(QuizQuestion.id)).where(QuizQuestion.quiz_id == quiz_id)
    )

    return QuizStatusOut(
        status=quiz.status,
        question_count=result.scalar() or 0,
        error_message=quiz.error_message,
    )


@router.post("/{quiz_id}/retry", response_model=QuizListItem)
async def retry_quiz(
    quiz_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizListItem:
    """Soạn lại một quiz AI đã hỏng, giữ nguyên id để không đẻ ra quiz rác."""
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)

    if not quiz.uses_ai:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ đề có phần AI mới soạn lại được",
        )

    if quiz.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đề đang được soạn",
        )

    # Lượt tạo đã tính vào hạn mức ngày lúc tạo quiz, nên retry không tính thêm.
    # Đổi lại nó bị chặn riêng, để một quiz hỏng không gọi API vô hạn.
    if quiz.retry_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Đề này đã thử lại quá 3 lần",
        )

    quiz.retry_count += 1
    quiz.status = "pending"
    quiz.error_message = None
    await db.commit()
    await db.refresh(quiz)

    background_tasks.add_task(run_ai_generation, quiz.id)

    return await _quiz_list_item(db, quiz)
```

- [ ] **Step 5: Kiểm tra thứ tự route**

Run: `cd backend && python -c "from app.main import app; [print(r.path) for r in app.routes if 'quiz' in r.path]"`
Expected: `/quizzes/ai-status` xuất hiện **trước** `/quizzes/{quiz_id}` trong danh sách in ra. Nếu sau, di chuyển hàm `get_ai_status` lên trên `get_quiz`.

- [ ] **Step 6: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/quizzes.py backend/app/schemas/quiz.py
git commit -m "feat(quiz): add AI status, quiz status polling and retry endpoints"
```

---

### Task 8: Trả giải thích qua API làm bài và xem lại

**Files:**
- Modify: `backend/app/schemas/quiz.py:75-99` (`AnswerSubmitResponse`, `ReviewQuestionOut`)
- Modify: `backend/app/routers/attempts.py:111-115`, `:224-236`

**Interfaces:**
- Consumes: `QuizQuestion.explanation`, `QuizQuestion.source` (Task 1).
- Produces: `AnswerSubmitResponse.explanation`, `ReviewQuestionOut.explanation`, `ReviewQuestionOut.source`.

- [ ] **Step 1: Thêm trường vào schema**

Trong `backend/app/schemas/quiz.py`, thêm vào `AnswerSubmitResponse`:

```python
    # Chỉ câu do AI soạn mới có. Chỉ lộ ra SAU khi người học đã trả lời.
    explanation: str | None = None
```

và vào `ReviewQuestionOut`:

```python
    explanation: str | None = None
    source: str = "algo"
```

`QuestionOut` **giữ nguyên** — thêm gì vào đó là lộ đáp án trong lúc đang làm bài.

- [ ] **Step 2: Trả explanation khi chấm câu trả lời**

Trong `backend/app/routers/attempts.py`, sửa lệnh return của `submit_answer`:

```python
    return AnswerSubmitResponse(
        is_correct=is_correct,
        correct_index=question.correct_index,
        explanation=question.explanation,
    )
```

- [ ] **Step 3: Trả explanation và source khi xem lại**

Trong cùng file, thêm vào lệnh dựng `ReviewQuestionOut`:

```python
            explanation=question.explanation,
            source=question.source,
```

- [ ] **Step 4: Kiểm tra app import được**

Run: `cd backend && python -c "from app.main import app; print('ok')"`
Expected: in ra `ok`.

- [ ] **Step 5: Chạy hồi quy**

Run: `cd backend && python -m pytest`
Expected: PASS toàn bộ. Đây là lần chạy cuối trước khi sang frontend.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/quiz.py backend/app/routers/attempts.py
git commit -m "feat(quiz): return AI explanations after answering and in review"
```

---

### Task 9: Frontend

**Files:**
- Modify: `frontend/src/types/index.ts:54-70` và các interface quiz phía dưới
- Modify: `frontend/src/components/quiz/QuizCreateModal.tsx:23-31`, `:46-66`, `:292-330`
- Create: `frontend/src/hooks/useQuizPolling.ts`
- Modify: `frontend/src/pages/QuizzesPage.tsx`
- Modify: `frontend/src/components/quiz/QuizCard.tsx`
- Modify: `frontend/src/components/quiz/QuizQuestionView.tsx`
- Modify: `frontend/src/pages/TakeQuizPage.tsx`
- Modify: `frontend/src/pages/AttemptReviewPage.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `GET /quizzes/ai-status`, `GET /quizzes/{id}/status`, `POST /quizzes/{id}/retry` (Task 7); `QuizListItem` mở rộng (Task 1); `explanation` (Task 8).
- Produces: `useQuizPolling(quizzes, onUpdate)`.

- [ ] **Step 1: Mở rộng kiểu**

Trong `frontend/src/types/index.ts`, sửa dòng 54 và bảng nhãn:

```ts
export type QuestionType = 'en_to_vi' | 'vi_to_en' | 'synonym' | 'cloze' | 'context';

export const AI_QUESTION_TYPES: QuestionType[] = ['cloze', 'context'];
```

Thêm hai dòng vào `QUESTION_TYPE_LABELS`, giữ nguyên ba nhãn cũ đúng như đang có:

```ts
  cloze: 'Điền từ vào chỗ trống',
  context: 'Chọn từ theo ngữ cảnh',
```

- [ ] **Step 2: Thêm trường vào interface Quiz và hai interface mới**

Trong cùng file, thêm vào interface `Quiz` (nơi có `question_types: QuestionType[]`):

```ts
  status: 'pending' | 'ready' | 'failed';
  uses_ai: boolean;
  error_message: string | null;
  ai_question_count: number;
```

và thêm:

```ts
export interface AiStatus {
  available: boolean;
  daily_limit: number;
  used_today: number;
}

export interface QuizStatus {
  status: 'pending' | 'ready' | 'failed';
  question_count: number;
  error_message: string | null;
}
```

Thêm `explanation?: string | null;` vào interface của `AnswerSubmitResponse`, và `explanation?: string | null; source?: string;` vào interface của `ReviewQuestion` (interface có `correct_index` và `selected_index`).

- [ ] **Step 3: Nạp ai-status trong modal**

Trong `frontend/src/components/quiz/QuizCreateModal.tsx`, thêm state cạnh các state ở dòng 23-31:

```tsx
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
```

và một effect ngay sau effect nạp capacity:

```tsx
  useEffect(() => {
    if (!isOpen) return;

    api
      .get<AiStatus>('/quizzes/ai-status')
      .then((response) => setAiStatus(response.data))
      .catch(() => setAiStatus(null));
  }, [isOpen]);
```

Thêm `AiStatus`, `AI_QUESTION_TYPES`, `QuestionType` vào import từ `../../types`, và `api` từ `../../api/client` nếu file chưa import.

- [ ] **Step 4: Hiện hai dạng mới ở bước 2**

Đặt ngay trên `return` của component:

```tsx
const availableTypes: QuestionType[] = aiStatus?.available
  ? (['en_to_vi', 'vi_to_en', 'synonym', 'cloze', 'context'] as QuestionType[])
  : (['en_to_vi', 'vi_to_en', 'synonym'] as QuestionType[]);
```

Trong khối `{step === 2 && ( ... )}`, đổi nguồn danh sách dạng sang `availableTypes`, và thêm chip vào nút chọn của mỗi dạng:

```tsx
{AI_QUESTION_TYPES.includes(type) && <span className="type-chip">AI</span>}
```

Ngay dưới danh sách dạng:

```tsx
{types.some((type) => AI_QUESTION_TYPES.includes(type)) && (
  <p className="ai-note">
    Đề sẽ được AI soạn trong nền và mất khoảng 10–40 giây. Bạn có thể đóng cửa
    sổ này, đề sẽ tự hiện trong danh sách khi xong.
  </p>
)}
```

- [ ] **Step 5: Viết hook polling**

Create `frontend/src/hooks/useQuizPolling.ts`:

```ts
import { useEffect, useRef } from 'react';

import { api } from '../api/client';
import type { Quiz, QuizStatus } from '../types';

const POLL_INTERVAL_MS = 2000;

/**
 * Poll trạng thái của các quiz đang được AI soạn.
 *
 * Tự dừng khi không còn quiz `pending` nào, nên không có timer chạy vô ích
 * trên màn hình chỉ có đề thường.
 */
export function useQuizPolling(
  quizzes: Quiz[],
  onUpdate: (id: string, status: QuizStatus) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const pendingIds = quizzes
    .filter((quiz) => quiz.status === 'pending')
    .map((quiz) => quiz.id)
    .join(',');

  useEffect(() => {
    if (!pendingIds) return;

    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        pendingIds.split(',').map(async (id) => {
          try {
            const response = await api.get<QuizStatus>(`/quizzes/${id}/status`);
            if (!cancelled) {
              onUpdateRef.current(id, response.data);
            }
          } catch {
            // Một lần poll hỏng không đáng để dừng cả vòng; lần sau thử lại.
          }
        }),
      );
    };

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingIds]);
}
```

- [ ] **Step 6: Dùng hook và thêm retry trong QuizzesPage**

Trong `frontend/src/pages/QuizzesPage.tsx`, sau chỗ khai báo state `quizzes`:

```tsx
  useQuizPolling(quizzes, (id, status) => {
    setQuizzes((current) =>
      current.map((quiz) =>
        quiz.id === id
          ? {
              ...quiz,
              status: status.status,
              question_count: status.question_count,
              error_message: status.error_message,
            }
          : quiz,
      ),
    );
  });

  const handleRetry = async (quizId: string) => {
    const response = await api.post<Quiz>(`/quizzes/${quizId}/retry`);
    setQuizzes((current) =>
      current.map((quiz) => (quiz.id === quizId ? response.data : quiz)),
    );
  };
```

Thêm import `import { useQuizPolling } from '../hooks/useQuizPolling';` và truyền `onRetry={handleRetry}` xuống `QuizCard`.

- [ ] **Step 7: Render pending/failed trong QuizCard**

Trong `frontend/src/components/quiz/QuizCard.tsx`, thêm `onRetry: (quizId: string) => void` vào props, và đặt hai nhánh này **trước** phần render bình thường để quiz `pending` không bấm vào làm bài được:

```tsx
if (quiz.status === 'pending') {
  return (
    <article className="quiz-card quiz-card--pending">
      <h3 className="quiz-card__title">{quiz.title}</h3>
      <p className="quiz-card__note">AI đang soạn đề…</p>
      <div className="quiz-card__skeleton" />
    </article>
  );
}

if (quiz.status === 'failed') {
  return (
    <article className="quiz-card quiz-card--failed">
      <h3 className="quiz-card__title">{quiz.title}</h3>
      <p className="quiz-card__error">{quiz.error_message ?? 'Soạn đề thất bại.'}</p>
      <button type="button" onClick={() => onRetry(quiz.id)}>
        Thử lại
      </button>
    </article>
  );
}
```

- [ ] **Step 8: Render chỗ trống của câu cloze**

Trong `frontend/src/components/quiz/QuizQuestionView.tsx`, thêm trên phần render:

```tsx
const renderPrompt = (text: string, questionType: string) => {
  if (questionType !== 'cloze' || !text.includes('___')) {
    return text;
  }

  const [before, ...rest] = text.split('___');

  return (
    <>
      {before}
      <span className="cloze-blank" aria-label="chỗ trống" />
      {rest.join('___')}
    </>
  );
};
```

Thay chỗ đang in thẳng `question.prompt_text` bằng `{renderPrompt(question.prompt_text, question.question_type)}`.

- [ ] **Step 9: Hiện giải thích**

Trong `frontend/src/pages/TakeQuizPage.tsx`, nơi đang lưu kết quả của `POST /attempts/{id}/answers`, giữ thêm `explanation` vào state feedback rồi render trong khối feedback:

```tsx
{feedback?.explanation && (
  <p className="answer-explanation">{feedback.explanation}</p>
)}
```

Trong `frontend/src/pages/AttemptReviewPage.tsx`, dưới chỗ hiển thị đáp án đúng của từng câu:

```tsx
{question.explanation && (
  <div className="review-explanation">
    {question.source === 'ai' && <span className="type-chip">AI soạn</span>}
    <p>{question.explanation}</p>
  </div>
)}
```

- [ ] **Step 10: Thêm style**

Thêm vào cuối `frontend/src/index.css`:

```css
.quiz-card--pending .quiz-card__note,
.quiz-card--failed .quiz-card__error {
  font-size: 0.875rem;
  opacity: 0.75;
}

.quiz-card__skeleton {
  height: 3rem;
  border-radius: 0.5rem;
  background: linear-gradient(90deg, transparent, rgb(0 0 0 / 6%), transparent);
  background-size: 200% 100%;
  animation: quiz-card-shimmer 1.4s linear infinite;
}

@keyframes quiz-card-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.type-chip {
  margin-left: 0.4rem;
  padding: 0.05rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  border: 1px solid currentcolor;
  opacity: 0.7;
}

.ai-note {
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  opacity: 0.75;
}

.cloze-blank {
  display: inline-block;
  min-width: 4.5rem;
  border-bottom: 2px solid currentcolor;
  margin: 0 0.25rem;
  vertical-align: baseline;
}

.answer-explanation,
.review-explanation {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
  opacity: 0.85;
}

.review-explanation .type-chip {
  margin: 0 0 0.35rem;
}
```

- [ ] **Step 11: Kiểm tra biên dịch và build**

Run: `cd frontend && npx tsc --noEmit`
Expected: không lỗi. Lỗi thường gặp là chỗ nào đó dựng object `Quiz` thủ công mà thiếu bốn trường mới — bổ sung ở đó.

Run: `cd frontend && npm run build`
Expected: build thành công.

- [ ] **Step 12: Commit**

```bash
git add frontend/src
git commit -m "feat(quiz-ui): AI question types, pending state and explanations"
```

---

### Task 10: Kiểm thử tay

Unit test đã phủ các hàm thuần, nhưng phần ghép chúng lại — router phân nhánh, background task, polling, retry — không có test tự động. Vòng này là lần xác nhận duy nhất rằng luồng đó chạy thật. Làm đủ cả 8 kịch bản trước khi coi là xong.

**Files:** không sửa file nào. Nếu phát hiện lỗi, sửa ở task tương ứng rồi chạy lại vòng này.

- [ ] **Step 1: Chạy migration**

Run: `cd backend && alembic upgrade head`
Expected: không lỗi. Kiểm tra: `python -c "import sqlite3; print([r[1] for r in sqlite3.connect('vocabflash.db').execute('PRAGMA table_info(quizzes)')])"` — phải thấy `status`, `uses_ai`, `error_message`, `ai_question_count`, `retry_count`, `requested_count`.

- [ ] **Step 2: Khởi động backend không có key AI**

Run: `cd backend && python -m uvicorn app.main:app --reload --port 8000`
Để chạy ở một terminal riêng suốt các bước sau.

- [ ] **Step 3: Kịch bản 1 — hồi quy, đề chỉ dạng cũ**

Chạy script sẵn có: `cd backend && python smoke_test_quiz.py`
Expected: chạy hết không assert nào fail. Đây là bằng chứng ba dạng cũ không bị ảnh hưởng.

- [ ] **Step 4: Kịch bản 2 — tính năng AI tắt**

Mở frontend (`cd frontend && npm run dev`), đăng nhập, mở modal tạo quiz, sang bước chọn dạng.
Expected: **không** thấy "Điền từ vào chỗ trống" và "Chọn từ theo ngữ cảnh". Màn hình giống hệt trước khi làm tính năng.

- [ ] **Step 5: Bật key AI**

Tạo hoặc sửa `backend/.env`:

```
AI_API_KEY=<key thật>
AI_BASE_URL=<base url của provider, bỏ qua nếu dùng OpenAI>
AI_MODEL=<tên model>
```

Khởi động lại backend.

- [ ] **Step 6: Kịch bản 3 — đề chỉ dạng AI**

Tạo quiz với dạng "Điền từ vào chỗ trống", 6 câu.
Expected: card hiện ngay với "AI đang soạn đề…" và skeleton; sau 10–40 giây tự chuyển thành đề bình thường **mà không cần F5**. Số câu bằng 6.

- [ ] **Step 7: Kịch bản 4 — làm bài và xem giải thích**

Làm đề vừa tạo.
Expected: câu cloze hiện chỗ trống có gạch chân rõ ràng; sau khi chọn đáp án thì phần giải thích tiếng Việt hiện ra ngay; trang xem lại bài hiện giải thích kèm chip "AI soạn".

- [ ] **Step 8: Kịch bản 5 — đề trộn**

Tạo quiz với cả "Anh → Việt" và "Chọn từ theo ngữ cảnh", 10 câu.
Expected: đề hoàn thành với đủ 10 câu, trộn cả hai loại.

- [ ] **Step 9: Kịch bản 6 — AI hỏng**

Đổi `AI_BASE_URL` thành một địa chỉ không tồn tại (ví dụ `https://localhost:9/v1`), khởi động lại backend, rồi tạo quiz **chỉ** dạng AI.
Expected: sau ít giây card chuyển sang trạng thái lỗi, hiện thông báo và nút "Thử lại".

- [ ] **Step 10: Kịch bản 7 — đề trộn khi AI hỏng**

Vẫn giữ base_url hỏng, tạo quiz trộn "Anh → Việt" + "Điền từ vào chỗ trống", 8 câu.
Expected: đề vẫn `ready` với 8 câu, toàn bộ là câu thuật toán. **Không** rơi vào trạng thái lỗi — đây là điểm quan trọng nhất của thiết kế.

- [ ] **Step 11: Kịch bản 8 — retry**

Trả `AI_BASE_URL` về giá trị đúng, khởi động lại backend, rồi bấm "Thử lại" trên đề hỏng ở kịch bản 6.
Expected: đề chuyển về "AI đang soạn đề…" rồi hoàn thành. URL/id của đề không đổi.

- [ ] **Step 12: Ghi lại kết quả**

Nếu cả 8 kịch bản đạt, tính năng xong. Nếu có kịch bản nào fail, ghi rõ kịch bản nào và triệu chứng gì trước khi sửa — bắt đầu từ `parse_and_validate` nếu triệu chứng là câu hỏi sai/thiếu, từ `run_ai_generation` nếu triệu chứng là trạng thái sai.

---

## Ghi chú vận hành

Để bật tính năng trên môi trường thật:

1. Chạy migration: `cd backend && alembic upgrade head`.
2. Đặt `AI_API_KEY` (và `AI_BASE_URL`, `AI_MODEL` nếu không dùng OpenAI) vào biến môi trường của service `backend` trong `docker-compose.prod.yml`.
3. Không đặt key thì tính năng tự tắt và app chạy y như trước.

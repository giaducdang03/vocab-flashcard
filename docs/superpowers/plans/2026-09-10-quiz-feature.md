# Quiz Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user tạo bài kiểm tra trắc nghiệm 4 lựa chọn từ các session đã có, làm bài với phản hồi ngay sau mỗi câu, và lưu lại lịch sử điểm của từng lượt làm.

**Architecture:** Câu hỏi được sinh một lần lúc tạo đề bởi một service thuần (`quiz_generator`, không chạm DB) và **snapshot** vào bảng `quiz_questions`, nên đề cố định qua nhiều lượt làm kể cả khi card gốc bị sửa/xoá. Vì phản hồi hiện ngay sau mỗi câu, việc chấm điểm nằm ở server từng câu một — endpoint lấy câu hỏi không bao giờ trả `correct_index`. Frontend thêm 4 route mới dưới `/quizzes` và `/attempts`, dùng lại `api` client và các class CSS sẵn có.

**Tech Stack:** FastAPI · SQLAlchemy 2.0 async · Alembic · Pydantic v2 · pytest · React 18 + TypeScript + Vite · react-router-dom · axios · lucide-react

**Spec:** `docs/superpowers/specs/2026-09-10-quiz-design.md`

## Global Constraints

- **Mã dạng câu hỏi** dùng đúng 3 giá trị: `en_to_vi`, `vi_to_en`, `synonym`. Không đổi tên.
- **Primary key** là `String(36)` chứa UUID sinh ở Python: `default=lambda: str(uuid4())`. Không dùng kiểu UUID native của Postgres.
- **Timestamp** dùng `DateTime(timezone=True)` với `default=lambda: datetime.now(timezone.utc)`.
- **Không dùng SQL ENUM.** Dùng `String` ở model + `Literal` ở Pydantic, theo đúng pattern của `card_type`.
- **`options` lưu dưới dạng JSON string** qua `json.dumps`/`json.loads` trong cột `Text` — giữ tương thích SQLite (dev) lẫn Postgres (prod).
- **Mọi endpoint** yêu cầu `current_user: User = Depends(get_current_user)` và lọc theo `user_id`. Không tìm thấy → 404.
- **`correct_index` KHÔNG BAO GIỜ** xuất hiện trong response của `POST /quizzes/{id}/attempts`. Chỉ có ở `POST /attempts/{id}/answers` (sau khi user đã chọn) và `GET /attempts/{id}` (sau khi submit).
- **Copy hiển thị cho user viết bằng tiếng Anh**, khớp với UI hiện tại ("Your sessions", "Create new session", "Welcome back"). Error `detail` của backend cũng tiếng Anh, khớp `"Session not found"`.
- **Quiz không được chạm** `Card.is_learned` hay bảng `card_learn_events`.
- Không thêm dependency frontend mới.

---

### Task 1: Test harness + `compute_capacity`

Tạo bộ khung pytest cho backend (repo hiện chưa có) và hàm đầu tiên của quiz generator: đếm xem mỗi dạng câu hỏi sinh được tối đa bao nhiêu câu.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/factories.py`
- Create: `backend/tests/test_quiz_generator.py`
- Create: `backend/app/services/quiz_generator.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `app.services.quiz_generator.QUESTION_TYPES: tuple[str, str, str]`
  - `app.services.quiz_generator.MIN_POOL_SIZE: int`
  - `app.services.quiz_generator.compute_capacity(cards: Sequence[Any], question_types: Sequence[str]) -> dict[str, int]`
  - `tests.factories.make_card(...) -> FakeCard` — dùng lại ở Task 2 và 3

- [ ] **Step 1: Thêm pytest vào requirements**

Thêm 2 dòng cuối `backend/requirements.txt`:

```
pytest==8.3.3
pytest-asyncio==0.24.0
```

Cài: `cd backend && .venv/Scripts/python -m pip install pytest==8.3.3 pytest-asyncio==0.24.0`

- [ ] **Step 2: Tạo test factory**

`backend/tests/__init__.py` — để trống.

`backend/tests/factories.py`:

```python
"""Lightweight stand-ins for SQLAlchemy Card/Synonym.

quiz_generator is a pure function that only reads attributes, so tests do not
need a database.
"""
from dataclasses import dataclass, field


@dataclass
class FakeSynonym:
    word: str
    phonetic: str | None = None


@dataclass
class FakeCard:
    id: str
    front_text: str
    back_text: str
    card_type: str = "vocab"
    front_phonetic: str | None = None
    synonyms: list[FakeSynonym] = field(default_factory=list)


def make_card(
    index: int,
    card_type: str = "vocab",
    synonyms: list[str] | None = None,
) -> FakeCard:
    """Build a card with predictable, mutually distinct text."""
    return FakeCard(
        id=f"card-{index}",
        front_text=f"word{index}",
        back_text=f"nghia{index}",
        card_type=card_type,
        front_phonetic=f"/w{index}/",
        synonyms=[FakeSynonym(word=word) for word in (synonyms or [])],
    )


def make_pool(size: int, synonyms_for: set[int] | None = None) -> list[FakeCard]:
    """Build `size` distinct cards; those whose index is in `synonyms_for`
    get one synonym each."""
    synonyms_for = synonyms_for or set()
    return [
        make_card(index, synonyms=[f"syn{index}"] if index in synonyms_for else None)
        for index in range(size)
    ]
```

- [ ] **Step 3: Viết test cho `compute_capacity`**

`backend/tests/test_quiz_generator.py`:

```python
import pytest

from app.services import quiz_generator as qg
from tests.factories import make_card, make_pool


class TestComputeCapacity:
    def test_translation_types_can_use_every_card(self):
        cards = make_pool(6)

        capacity = qg.compute_capacity(cards, ["en_to_vi", "vi_to_en"])

        assert capacity == {"en_to_vi": 6, "vi_to_en": 6}

    def test_synonym_type_only_counts_vocab_cards_with_synonyms(self):
        cards = make_pool(6, synonyms_for={0, 1, 2})

        capacity = qg.compute_capacity(cards, ["synonym"])

        assert capacity == {"synonym": 3}

    def test_collocation_never_counts_for_synonym_even_with_synonyms(self):
        cards = make_pool(4)
        cards.append(make_card(9, card_type="collocation", synonyms=["syn9"]))

        capacity = qg.compute_capacity(cards, ["synonym"])

        assert capacity == {"synonym": 0}

    def test_pool_below_minimum_has_zero_capacity(self):
        cards = make_pool(3)

        capacity = qg.compute_capacity(cards, ["en_to_vi"])

        assert capacity == {"en_to_vi": 0}
```

- [ ] **Step 4: Chạy test để xác nhận FAIL**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_quiz_generator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.quiz_generator'`

- [ ] **Step 5: Implement `compute_capacity`**

`backend/app/services/quiz_generator.py`:

```python
"""Generate multiple-choice quiz questions from a pool of cards.

Pure functions only — no database access — so the tricky parts (distractor
selection, splitting a question count across types) can be unit tested.
"""
from collections.abc import Sequence
from typing import Any

QUESTION_TYPES: tuple[str, str, str] = ("en_to_vi", "vi_to_en", "synonym")

# One correct answer plus three distractors means a question needs four
# distinct cards to draw from.
MIN_POOL_SIZE = 4


def _is_eligible(card: Any, question_type: str) -> bool:
    if question_type == "synonym":
        return card.card_type == "vocab" and len(card.synonyms) > 0
    return True


def compute_capacity(cards: Sequence[Any], question_types: Sequence[str]) -> dict[str, int]:
    """Max questions each type can produce from this pool."""
    if len(cards) < MIN_POOL_SIZE:
        return {question_type: 0 for question_type in question_types}

    return {
        question_type: sum(1 for card in cards if _is_eligible(card, question_type))
        for question_type in question_types
    }
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_quiz_generator.py -v`
Expected: 4 passed

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/tests backend/app/services/quiz_generator.py
git commit -m "feat: add quiz generator capacity calculation with pytest harness"
```

---

### Task 2: Sinh câu hỏi dạng dịch (`en_to_vi`, `vi_to_en`)

**Files:**
- Modify: `backend/app/services/quiz_generator.py`
- Modify: `backend/tests/test_quiz_generator.py`

**Interfaces:**
- Consumes: `compute_capacity`, `_is_eligible`, `MIN_POOL_SIZE`, `QUESTION_TYPES` (Task 1)
- Produces:
  - `GeneratedQuestion` dataclass với các field: `card_id: str`, `question_type: str`, `prompt_text: str`, `prompt_phonetic: str | None`, `options: list[str]`, `correct_index: int`
  - `generate_questions(cards, question_types, question_count, rng=None) -> list[GeneratedQuestion]`

- [ ] **Step 1: Viết test**

Thêm vào `backend/tests/test_quiz_generator.py`:

```python
class TestGenerateTranslationQuestions:
    def test_returns_requested_number_of_questions(self):
        questions = qg.generate_questions(
            make_pool(10), ["en_to_vi"], 5, rng=random.Random(1)
        )

        assert len(questions) == 5

    def test_every_question_has_four_distinct_options(self):
        questions = qg.generate_questions(
            make_pool(10), ["en_to_vi"], 5, rng=random.Random(2)
        )

        for question in questions:
            assert len(question.options) == 4
            assert len({option.lower() for option in question.options}) == 4

    def test_correct_index_points_at_the_card_meaning(self):
        cards = make_pool(10)
        by_id = {card.id: card for card in cards}

        questions = qg.generate_questions(
            cards, ["en_to_vi"], 10, rng=random.Random(3)
        )

        for question in questions:
            card = by_id[question.card_id]
            assert question.options[question.correct_index] == card.back_text
            assert question.prompt_text == card.front_text
            assert question.prompt_phonetic == card.front_phonetic

    def test_vi_to_en_reverses_prompt_and_answer(self):
        cards = make_pool(10)
        by_id = {card.id: card for card in cards}

        questions = qg.generate_questions(
            cards, ["vi_to_en"], 10, rng=random.Random(4)
        )

        for question in questions:
            card = by_id[question.card_id]
            assert question.prompt_text == card.back_text
            assert question.prompt_phonetic is None
            assert question.options[question.correct_index] == card.front_text

    def test_no_card_is_reused_within_one_type(self):
        questions = qg.generate_questions(
            make_pool(8), ["en_to_vi"], 8, rng=random.Random(5)
        )

        card_ids = [question.card_id for question in questions]
        assert len(card_ids) == len(set(card_ids))

    def test_request_larger_than_capacity_is_capped(self):
        questions = qg.generate_questions(
            make_pool(6), ["en_to_vi"], 50, rng=random.Random(6)
        )

        assert len(questions) == 6

    def test_pool_below_four_cards_is_rejected(self):
        with pytest.raises(ValueError, match="at least 4 cards"):
            qg.generate_questions(make_pool(3), ["en_to_vi"], 2, rng=random.Random(7))

    def test_no_question_type_selected_is_rejected(self):
        with pytest.raises(ValueError, match="at least one question type"):
            qg.generate_questions(make_pool(8), [], 2, rng=random.Random(8))

    def test_cards_with_duplicate_meanings_do_not_produce_ambiguous_options(self):
        cards = make_pool(6)
        # Two cards now share the same Vietnamese meaning.
        cards[1].back_text = cards[0].back_text

        questions = qg.generate_questions(
            cards, ["en_to_vi"], 6, rng=random.Random(9)
        )

        for question in questions:
            assert len({option.lower() for option in question.options}) == 4
```

Thêm `import random` vào đầu file test (cạnh `import pytest`).

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_quiz_generator.py -v`
Expected: FAIL — `AttributeError: module 'app.services.quiz_generator' has no attribute 'generate_questions'`

- [ ] **Step 3: Implement**

Thêm vào `backend/app/services/quiz_generator.py` (giữ nguyên phần Task 1):

```python
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class GeneratedQuestion:
    card_id: str
    question_type: str
    prompt_text: str
    prompt_phonetic: str | None
    options: list[str]
    correct_index: int


def _normalize(text: str) -> str:
    return text.strip().lower()


def _distractor_field(question_type: str) -> str:
    # en_to_vi asks for a meaning, so wrong answers are other meanings.
    # The other two types ask for an English word.
    return "back_text" if question_type == "en_to_vi" else "front_text"


def _answer_of(card: Any, question_type: str, rng: random.Random) -> str | None:
    if question_type == "en_to_vi":
        return card.back_text
    if question_type == "vi_to_en":
        return card.front_text
    if not card.synonyms:
        return None
    return rng.choice([synonym.word for synonym in card.synonyms])


def _banned_values(card: Any, question_type: str, answer: str) -> set[str]:
    banned = {_normalize(answer)}
    if question_type == "synonym":
        # A synonym of the same card would be a second correct answer.
        banned.add(_normalize(card.front_text))
        banned.update(_normalize(synonym.word) for synonym in card.synonyms)
    return banned


def _build_options(
    card: Any,
    question_type: str,
    pool: Sequence[Any],
    rng: random.Random,
) -> tuple[list[str], int] | None:
    """Return (four shuffled options, index of the correct one), or None when
    this card cannot yield three distinct distractors."""
    answer = _answer_of(card, question_type, rng)
    if not answer or not answer.strip():
        return None

    seen = _banned_values(card, question_type, answer)
    field_name = _distractor_field(question_type)

    others = [other for other in pool if other.id != card.id]
    rng.shuffle(others)

    distractors: list[str] = []
    for other in others:
        value = getattr(other, field_name)
        if not value or not value.strip():
            continue
        key = _normalize(value)
        if key in seen:
            continue
        seen.add(key)
        distractors.append(value)
        if len(distractors) == 3:
            break

    if len(distractors) < 3:
        return None

    options = [answer, *distractors]
    rng.shuffle(options)
    return options, options.index(answer)


def _prompt_of(card: Any, question_type: str) -> tuple[str, str | None]:
    if question_type == "vi_to_en":
        return card.back_text, None
    return card.front_text, card.front_phonetic


def _distribute(question_count: int, capacity: dict[str, int], rng: random.Random) -> dict[str, int]:
    """Split question_count across types round-robin, so types share the load
    evenly and a type that runs out of cards spills over to the others."""
    types = [question_type for question_type, count in capacity.items() if count > 0]
    if not types:
        return {}

    rng.shuffle(types)
    quota = {question_type: 0 for question_type in types}
    remaining = min(question_count, sum(capacity[question_type] for question_type in types))

    while remaining > 0:
        progressed = False
        for question_type in types:
            if remaining == 0:
                break
            if quota[question_type] < capacity[question_type]:
                quota[question_type] += 1
                remaining -= 1
                progressed = True
        if not progressed:
            break

    return {question_type: count for question_type, count in quota.items() if count > 0}


def generate_questions(
    cards: Sequence[Any],
    question_types: Sequence[str],
    question_count: int,
    rng: random.Random | None = None,
) -> list[GeneratedQuestion]:
    rng = rng or random.Random()

    if len(cards) < MIN_POOL_SIZE:
        raise ValueError("Need at least 4 cards to create a quiz")

    selected = [question_type for question_type in QUESTION_TYPES if question_type in set(question_types)]
    if not selected:
        raise ValueError("Select at least one question type")

    quota = _distribute(question_count, compute_capacity(cards, selected), rng)

    questions: list[GeneratedQuestion] = []
    for question_type, wanted in quota.items():
        eligible = [card for card in cards if _is_eligible(card, question_type)]
        rng.shuffle(eligible)

        taken = 0
        for card in eligible:
            if taken == wanted:
                break
            built = _build_options(card, question_type, cards, rng)
            if built is None:
                continue
            options, correct_index = built
            prompt_text, prompt_phonetic = _prompt_of(card, question_type)
            questions.append(
                GeneratedQuestion(
                    card_id=card.id,
                    question_type=question_type,
                    prompt_text=prompt_text,
                    prompt_phonetic=prompt_phonetic,
                    options=options,
                    correct_index=correct_index,
                )
            )
            taken += 1

    rng.shuffle(questions)
    return questions
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_quiz_generator.py -v`
Expected: tất cả pass (4 từ Task 1 + 9 mới = 13 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/quiz_generator.py backend/tests/test_quiz_generator.py
git commit -m "feat: generate en_to_vi and vi_to_en quiz questions"
```

---

### Task 3: Dạng `synonym` + trộn nhiều dạng

Dạng `synonym` là chỗ dễ sai nhất: một đáp án "nhiễu" vô tình lại là synonym của chính card đó thì câu hỏi có hai đáp án đúng. Code ở Task 2 đã xử lý qua `_banned_values`; task này khoá hành vi đó bằng test và bổ sung test cho việc chia câu giữa nhiều dạng.

**Files:**
- Modify: `backend/tests/test_quiz_generator.py`

**Interfaces:**
- Consumes: `generate_questions`, `GeneratedQuestion` (Task 2); `make_pool`, `make_card`, `FakeSynonym` (Task 1)
- Produces: nothing new — chỉ test

- [ ] **Step 1: Viết test**

Thêm vào `backend/tests/test_quiz_generator.py`:

```python
from tests.factories import FakeSynonym  # thêm vào import sẵn có ở đầu file


class TestGenerateSynonymQuestions:
    def test_correct_answer_is_a_synonym_of_the_prompt_card(self):
        cards = make_pool(8, synonyms_for={0, 1, 2, 3})
        by_id = {card.id: card for card in cards}

        questions = qg.generate_questions(
            cards, ["synonym"], 4, rng=random.Random(11)
        )

        assert len(questions) == 4
        for question in questions:
            card = by_id[question.card_id]
            assert question.prompt_text == card.front_text
            answer = question.options[question.correct_index]
            assert answer in {synonym.word for synonym in card.synonyms}

    def test_distractors_are_never_synonyms_of_the_same_card(self):
        # card-0 has three synonyms; none may show up as a wrong answer.
        cards = make_pool(8)
        cards[0].synonyms = [
            FakeSynonym(word="alpha"),
            FakeSynonym(word="beta"),
            FakeSynonym(word="gamma"),
        ]

        questions = qg.generate_questions(
            cards, ["synonym"], 1, rng=random.Random(12)
        )

        question = questions[0]
        wrong = [
            option
            for index, option in enumerate(question.options)
            if index != question.correct_index
        ]
        assert not ({"alpha", "beta", "gamma"} & set(wrong))
        assert cards[0].front_text not in wrong

    def test_cards_without_synonyms_are_skipped(self):
        cards = make_pool(8, synonyms_for={0, 1})

        questions = qg.generate_questions(
            cards, ["synonym"], 8, rng=random.Random(13)
        )

        assert len(questions) == 2
        assert {question.card_id for question in questions} == {"card-0", "card-1"}


class TestMixingQuestionTypes:
    def test_question_count_is_split_across_selected_types(self):
        cards = make_pool(12, synonyms_for=set(range(12)))

        questions = qg.generate_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], 9, rng=random.Random(21)
        )

        assert len(questions) == 9
        counts = Counter(question.question_type for question in questions)
        assert counts == {"en_to_vi": 3, "vi_to_en": 3, "synonym": 3}

    def test_a_starved_type_spills_over_to_the_others(self):
        # Only two cards can produce synonym questions, so the remaining
        # questions must come from the translation types.
        cards = make_pool(12, synonyms_for={0, 1})

        questions = qg.generate_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], 9, rng=random.Random(22)
        )

        assert len(questions) == 9
        counts = Counter(question.question_type for question in questions)
        assert counts["synonym"] == 2
        assert counts["en_to_vi"] + counts["vi_to_en"] == 7

    def test_same_card_may_appear_under_different_types(self):
        cards = make_pool(5, synonyms_for=set(range(5)))

        questions = qg.generate_questions(
            cards, ["en_to_vi", "vi_to_en"], 10, rng=random.Random(23)
        )

        assert len(questions) == 10
        pairs = {(question.card_id, question.question_type) for question in questions}
        assert len(pairs) == 10  # no (card, type) pair repeats

    def test_generation_is_deterministic_for_a_given_seed(self):
        cards = make_pool(10, synonyms_for={0, 1, 2})

        first = qg.generate_questions(
            cards, ["en_to_vi", "synonym"], 6, rng=random.Random(99)
        )
        second = qg.generate_questions(
            cards, ["en_to_vi", "synonym"], 6, rng=random.Random(99)
        )

        assert first == second
```

Thêm `from collections import Counter` vào đầu file test.

- [ ] **Step 2: Chạy test**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_quiz_generator.py -v`
Expected: tất cả pass (20 tests). Nếu `test_distractors_are_never_synonyms_of_the_same_card` fail, sửa `_banned_values` trong `quiz_generator.py` — không sửa test.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_quiz_generator.py
git commit -m "test: cover synonym questions and multi-type distribution"
```

---

### Task 4: Models + migration

**Files:**
- Create: `backend/app/models/quiz.py`
- Create: `backend/alembic/versions/20260910_add_quiz_tables.py`
- Modify: `backend/app/models/session.py`
- Modify: `backend/app/models/user.py`

**Interfaces:**
- Consumes: `app.models.base.Base`
- Produces: `Quiz`, `QuizSourceSession`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer` — dùng ở Task 6, 7

- [ ] **Step 1: Tạo models**

`backend/app/models/quiz.py`:

```python
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Comma-separated question type codes, e.g. "en_to_vi,synonym".
    question_types: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    source_sessions: Mapped[list["QuizSourceSession"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )
    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", passive_deletes=True
    )


class QuizSourceSession(Base):
    __tablename__ = "quiz_source_sessions"

    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )

    quiz: Mapped[Quiz] = relationship(back_populates="source_sessions")
    session: Mapped["Session"] = relationship()


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Kept only so review can link back to the card. Questions are snapshots,
    # so the quiz survives the card being edited or deleted.
    card_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    question_type: Mapped[str] = mapped_column(String(20), nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_phonetic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # JSON array of exactly four strings.
    options: Mapped[str] = mapped_column(Text, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    answers: Mapped[list["QuizAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", passive_deletes=True
    )


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answer_attempt_question"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    attempt_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    # NULL means the question was left unanswered.
    selected_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")
    question: Mapped[QuizQuestion] = relationship()
```

- [ ] **Step 2: Resolve relationship + đăng ký models với Alembic**

`app/models/session.py` chỉ import `base`, nên `quiz.py` import ngược lại `session.py` là an toàn (không có vòng). Trong `backend/app/models/quiz.py`, thêm import ở đầu file:

```python
from app.models.session import Session
```

và đổi relationship trong `QuizSourceSession` từ chuỗi sang class thật:

```python
    session: Mapped[Session] = relationship()
```

Không sửa `app/models/session.py`.

`backend/alembic/env.py` (dòng 8–10) import models theo danh sách tường minh. Thêm sau dòng `from app.models.user import User`:

```python
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizQuestion, QuizSourceSession  # noqa: F401
```

- [ ] **Step 3: Viết migration**

`backend/alembic/versions/20260910_add_quiz_tables.py`:

```python
"""add quiz tables

Revision ID: 20260910_quiz
Revises: 20260909_events
Create Date: 2026-09-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260910_quiz"
down_revision = "20260909_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quizzes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("question_types", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quizzes_user_id"), "quizzes", ["user_id"])

    op.create_table(
        "quiz_source_sessions",
        sa.Column("quiz_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("quiz_id", "session_id"),
    )

    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("quiz_id", sa.String(length=36), nullable=False),
        sa.Column("card_id", sa.String(length=36), nullable=True),
        sa.Column("question_type", sa.String(length=20), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("prompt_phonetic", sa.String(length=200), nullable=True),
        sa.Column("options", sa.Text(), nullable=False),
        sa.Column("correct_index", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["card_id"], ["cards.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quiz_questions_quiz_id"), "quiz_questions", ["quiz_id"])

    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("quiz_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quiz_attempts_quiz_id"), "quiz_attempts", ["quiz_id"])
    op.create_index(op.f("ix_quiz_attempts_user_id"), "quiz_attempts", ["user_id"])

    op.create_table(
        "quiz_answers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("attempt_id", sa.String(length=36), nullable=False),
        sa.Column("question_id", sa.String(length=36), nullable=False),
        sa.Column("selected_index", sa.Integer(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["quiz_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["quiz_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_quiz_answer_attempt_question"),
    )
    op.create_index(op.f("ix_quiz_answers_attempt_id"), "quiz_answers", ["attempt_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_quiz_answers_attempt_id"), table_name="quiz_answers")
    op.drop_table("quiz_answers")
    op.drop_index(op.f("ix_quiz_attempts_user_id"), table_name="quiz_attempts")
    op.drop_index(op.f("ix_quiz_attempts_quiz_id"), table_name="quiz_attempts")
    op.drop_table("quiz_attempts")
    op.drop_index(op.f("ix_quiz_questions_quiz_id"), table_name="quiz_questions")
    op.drop_table("quiz_questions")
    op.drop_table("quiz_source_sessions")
    op.drop_index(op.f("ix_quizzes_user_id"), table_name="quizzes")
    op.drop_table("quizzes")
```

- [ ] **Step 4: Chạy migration và kiểm tra**

```bash
cd backend
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -c "from app.models.quiz import Quiz, QuizQuestion, QuizAttempt, QuizAnswer, QuizSourceSession; print('models ok')"
```

Expected: alembic chạy tới `20260910_quiz` không lỗi; in ra `models ok`.

Kiểm tra downgrade rồi upgrade lại:
```bash
.venv/Scripts/python -m alembic downgrade 20260909_events
.venv/Scripts/python -m alembic upgrade head
```
Expected: cả hai chiều đều sạch.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/quiz.py backend/app/models/session.py backend/alembic/versions/20260910_add_quiz_tables.py backend/alembic/env.py
git commit -m "feat: add quiz, question, attempt and answer tables"
```

---

### Task 5: Pydantic schemas

Tách `QuestionOut` (lúc làm bài, **không** có `correct_index`) khỏi `ReviewQuestionOut` (sau khi submit, có `correct_index`). Tách ở tầng schema khiến việc lộ đáp án thành lỗi khó xảy ra chứ không phải lỗi dễ quên.

**Files:**
- Create: `backend/app/schemas/quiz.py`

**Interfaces:**
- Consumes: nothing
- Produces: các class dưới đây, dùng ở Task 6 và 7

- [ ] **Step 1: Viết schemas**

`backend/app/schemas/quiz.py`:

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["en_to_vi", "vi_to_en", "synonym"]


class CapacityRequest(BaseModel):
    session_ids: list[str] = Field(min_length=1)
    question_types: list[QuestionType] = Field(min_length=1)


class CapacityResponse(BaseModel):
    total_cards: int
    per_type: dict[str, int]
    max_questions: int


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    session_ids: list[str] = Field(min_length=1)
    question_count: int = Field(ge=1, le=100)
    question_types: list[QuestionType] = Field(min_length=1)


class QuizListItem(BaseModel):
    id: str
    title: str
    question_types: list[QuestionType]
    question_count: int
    source_session_titles: list[str]
    attempt_count: int
    best_score: int | None = None
    last_attempt_at: datetime | None = None
    created_at: datetime


class AttemptSummary(BaseModel):
    id: str
    submitted_at: datetime
    score: int
    total_questions: int
    duration_seconds: int | None = None


class QuizDetailOut(BaseModel):
    quiz: QuizListItem
    attempts: list[AttemptSummary]


class QuestionOut(BaseModel):
    """Sent while taking the quiz. Deliberately has no correct_index."""

    id: str
    question_type: QuestionType
    prompt_text: str
    prompt_phonetic: str | None = None
    options: list[str]
    position: int


class AttemptStartOut(BaseModel):
    attempt_id: str
    quiz_id: str
    quiz_title: str
    questions: list[QuestionOut]


class AnswerSubmitRequest(BaseModel):
    question_id: str
    selected_index: int | None = Field(default=None, ge=0, le=3)


class AnswerSubmitResponse(BaseModel):
    is_correct: bool
    correct_index: int


class AttemptSubmitResponse(BaseModel):
    attempt_id: str
    score: int
    total_questions: int
    duration_seconds: int


class ReviewQuestionOut(BaseModel):
    """Sent only after the attempt is submitted."""

    id: str
    question_type: QuestionType
    prompt_text: str
    prompt_phonetic: str | None = None
    options: list[str]
    position: int
    correct_index: int
    selected_index: int | None = None
    is_correct: bool
    card_id: str | None = None


class AttemptReviewOut(BaseModel):
    attempt_id: str
    quiz_id: str
    quiz_title: str
    score: int
    total_questions: int
    duration_seconds: int | None = None
    submitted_at: datetime
    questions: list[ReviewQuestionOut]
```

- [ ] **Step 2: Kiểm tra schemas import được**

Run: `cd backend && .venv/Scripts/python -c "from app.schemas.quiz import QuizCreate, AttemptReviewOut, QuestionOut; print(QuestionOut.model_fields.keys())"`
Expected: in ra danh sách field **không chứa** `correct_index`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/quiz.py
git commit -m "feat: add quiz pydantic schemas"
```

---

### Task 6: Router `/quizzes`

**Files:**
- Create: `backend/app/routers/quizzes.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: models (Task 4), schemas (Task 5), `generate_questions`/`compute_capacity`/`MIN_POOL_SIZE` (Task 1–2)
- Produces:
  - `router` mount tại prefix `/quizzes`
  - helper `_load_user_cards(db, user_id, session_ids) -> list[Card]` và `_quiz_list_item(...)` — dùng lại ở Task 7

- [ ] **Step 1: Viết router**

`backend/app/routers/quizzes.py`:

```python
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models.card import Card
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion, QuizSourceSession
from app.models.session import Session
from app.models.user import User
from app.schemas.quiz import (
    AttemptSummary,
    CapacityRequest,
    CapacityResponse,
    QuizCreate,
    QuizDetailOut,
    QuizListItem,
)
from app.services.quiz_generator import MIN_POOL_SIZE, compute_capacity, generate_questions

router = APIRouter()


async def _load_user_sessions(db: AsyncSession, user_id: str, session_ids: list[str]) -> list[Session]:
    """Every requested session must belong to the caller."""
    unique_ids = list(dict.fromkeys(session_ids))
    result = await db.execute(
        select(Session).where(Session.id.in_(unique_ids), Session.user_id == user_id)
    )
    sessions = list(result.scalars().all())
    if len(sessions) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return sessions


async def _load_user_cards(db: AsyncSession, user_id: str, session_ids: list[str]) -> list[Card]:
    await _load_user_sessions(db, user_id, session_ids)
    result = await db.execute(
        select(Card)
        .options(selectinload(Card.synonyms))
        .where(Card.session_id.in_(list(dict.fromkeys(session_ids))))
    )
    return list(result.scalars().all())


async def _quiz_list_item(db: AsyncSession, quiz: Quiz) -> QuizListItem:
    stats = await db.execute(
        select(
            func.count(QuizAttempt.id),
            func.max(QuizAttempt.score),
            func.max(QuizAttempt.submitted_at),
        ).where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.submitted_at.is_not(None))
    )
    attempt_count, best_score, last_attempt_at = stats.one()

    titles = await db.execute(
        select(Session.title)
        .join(QuizSourceSession, QuizSourceSession.session_id == Session.id)
        .where(QuizSourceSession.quiz_id == quiz.id)
        .order_by(Session.created_at)
    )

    question_count = await db.scalar(
        select(func.count(QuizQuestion.id)).where(QuizQuestion.quiz_id == quiz.id)
    )

    return QuizListItem(
        id=quiz.id,
        title=quiz.title,
        question_types=quiz.question_types.split(","),
        question_count=question_count or 0,
        source_session_titles=[row[0] for row in titles],
        attempt_count=attempt_count or 0,
        best_score=best_score,
        last_attempt_at=last_attempt_at,
        created_at=quiz.created_at,
    )


@router.post("/capacity", response_model=CapacityResponse)
async def quiz_capacity(
    payload: CapacityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CapacityResponse:
    cards = await _load_user_cards(db, current_user.id, payload.session_ids)
    per_type = compute_capacity(cards, payload.question_types)
    return CapacityResponse(
        total_cards=len(cards),
        per_type=per_type,
        max_questions=sum(per_type.values()),
    )


@router.post("", response_model=QuizListItem)
async def create_quiz(
    payload: QuizCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizListItem:
    cards = await _load_user_cards(db, current_user.id, payload.session_ids)

    if len(cards) < MIN_POOL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 4 cards to create a quiz",
        )

    try:
        generated = generate_questions(cards, payload.question_types, payload.question_count)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not generated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected sessions cannot produce any question of these types",
        )

    quiz = Quiz(
        user_id=current_user.id,
        title=payload.title.strip(),
        question_types=",".join(payload.question_types),
    )
    db.add(quiz)
    await db.flush()

    for session_id in dict.fromkeys(payload.session_ids):
        db.add(QuizSourceSession(quiz_id=quiz.id, session_id=session_id))

    for position, question in enumerate(generated):
        db.add(
            QuizQuestion(
                quiz_id=quiz.id,
                card_id=question.card_id,
                question_type=question.question_type,
                prompt_text=question.prompt_text,
                prompt_phonetic=question.prompt_phonetic,
                options=json.dumps(question.options, ensure_ascii=False),
                correct_index=question.correct_index,
                position=position,
            )
        )

    await db.commit()
    await db.refresh(quiz)
    return await _quiz_list_item(db, quiz)


@router.get("", response_model=list[QuizListItem])
async def list_quizzes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[QuizListItem]:
    result = await db.execute(
        select(Quiz).where(Quiz.user_id == current_user.id).order_by(Quiz.created_at.desc())
    )
    return [await _quiz_list_item(db, quiz) for quiz in result.scalars().all()]


async def _get_owned_quiz(db: AsyncSession, quiz_id: str, user_id: str) -> Quiz:
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id, Quiz.user_id == user_id))
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return quiz


@router.get("/{quiz_id}", response_model=QuizDetailOut)
async def get_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizDetailOut:
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)

    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz.id, QuizAttempt.submitted_at.is_not(None))
        .order_by(QuizAttempt.submitted_at.desc())
    )
    attempts = [
        AttemptSummary(
            id=attempt.id,
            submitted_at=attempt.submitted_at,
            score=attempt.score,
            total_questions=attempt.total_questions,
            duration_seconds=attempt.duration_seconds,
        )
        for attempt in result.scalars().all()
    ]

    return QuizDetailOut(quiz=await _quiz_list_item(db, quiz), attempts=attempts)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)
    await db.delete(quiz)
    await db.commit()
```

- [ ] **Step 2: Mount router**

Sửa `backend/app/main.py`:

```python
from app.routers import auth, sessions, cards, imports, stats, quizzes
```

và thêm sau dòng mount `stats`:

```python
app.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
```

- [ ] **Step 3: Kiểm tra app khởi động và routes có mặt**

Run:
```bash
cd backend && .venv/Scripts/python -c "from app.main import app; print([r.path for r in app.routes if '/quizzes' in r.path])"
```
Expected: liệt kê `/quizzes/capacity`, `/quizzes`, `/quizzes/{quiz_id}`.

> Lưu ý thứ tự route: `POST /quizzes/capacity` phải được khai báo **trước** `GET /quizzes/{quiz_id}`. Trong file trên nó đã đúng thứ tự — giữ nguyên.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/quizzes.py backend/app/main.py
git commit -m "feat: add quizzes router with capacity, create, list and delete"
```

---

### Task 7: Router `/attempts`

**Files:**
- Create: `backend/app/routers/attempts.py`
- Modify: `backend/app/routers/quizzes.py` (thêm endpoint start attempt)
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: models (Task 4), schemas (Task 5), `_get_owned_quiz` (Task 6)
- Produces: `POST /quizzes/{id}/attempts`, `POST /attempts/{id}/answers`, `POST /attempts/{id}/submit`, `GET /attempts/{id}`

- [ ] **Step 1: Thêm endpoint start attempt vào `quizzes.py`**

Ở đầu `backend/app/routers/quizzes.py`, đổi dòng `from sqlalchemy import func, select` thành:

```python
from sqlalchemy import delete, func, select
```

và thêm `AttemptStartOut`, `QuestionOut` vào block import sẵn có từ `app.schemas.quiz`.

Thêm endpoint vào cuối file:

```python
@router.post("/{quiz_id}/attempts", response_model=AttemptStartOut)
async def start_attempt(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartOut:
    quiz = await _get_owned_quiz(db, quiz_id, current_user.id)

    questions_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id).order_by(QuizQuestion.position)
    )
    questions = list(questions_result.scalars().all())
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This quiz has no questions"
        )

    # Leaving mid-quiz abandons the attempt; drop any stale one so unfinished
    # attempts do not pile up.
    await db.execute(
        delete(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == current_user.id,
            QuizAttempt.submitted_at.is_(None),
        )
    )

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        total_questions=len(questions),
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    return AttemptStartOut(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        questions=[
            QuestionOut(
                id=question.id,
                question_type=question.question_type,
                prompt_text=question.prompt_text,
                prompt_phonetic=question.prompt_phonetic,
                options=json.loads(question.options),
                position=question.position,
            )
            for question in questions
        ],
    )
```

- [ ] **Step 2: Viết router attempts**

`backend/app/routers/attempts.py`:

```python
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizQuestion
from app.models.user import User
from app.schemas.quiz import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    AttemptReviewOut,
    AttemptSubmitResponse,
    ReviewQuestionOut,
)

router = APIRouter()


async def _get_owned_attempt(db: AsyncSession, attempt_id: str, user_id: str) -> QuizAttempt:
    result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id)
    )
    attempt = result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    return attempt


@router.post("/{attempt_id}/answers", response_model=AnswerSubmitResponse)
async def submit_answer(
    attempt_id: str,
    payload: AnswerSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerSubmitResponse:
    attempt = await _get_owned_attempt(db, attempt_id, current_user.id)
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This attempt is already submitted"
        )

    question_result = await db.execute(
        select(QuizQuestion).where(
            QuizQuestion.id == payload.question_id, QuizQuestion.quiz_id == attempt.quiz_id
        )
    )
    question = question_result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    existing = await db.execute(
        select(QuizAnswer).where(
            QuizAnswer.attempt_id == attempt.id, QuizAnswer.question_id == question.id
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This question is already answered"
        )

    is_correct = payload.selected_index is not None and payload.selected_index == question.correct_index

    db.add(
        QuizAnswer(
            attempt_id=attempt.id,
            question_id=question.id,
            selected_index=payload.selected_index,
            is_correct=is_correct,
        )
    )
    if is_correct:
        attempt.score += 1

    await db.commit()

    return AnswerSubmitResponse(is_correct=is_correct, correct_index=question.correct_index)


@router.post("/{attempt_id}/submit", response_model=AttemptSubmitResponse)
async def submit_attempt(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptSubmitResponse:
    attempt = await _get_owned_attempt(db, attempt_id, current_user.id)
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This attempt is already submitted"
        )

    answered = await db.execute(
        select(QuizAnswer.question_id).where(QuizAnswer.attempt_id == attempt.id)
    )
    answered_ids = {row[0] for row in answered}

    all_questions = await db.execute(
        select(QuizQuestion.id).where(QuizQuestion.quiz_id == attempt.quiz_id)
    )
    # Questions the user skipped are recorded as unanswered and wrong.
    for (question_id,) in all_questions:
        if question_id not in answered_ids:
            db.add(
                QuizAnswer(
                    attempt_id=attempt.id,
                    question_id=question_id,
                    selected_index=None,
                    is_correct=False,
                )
            )

    submitted_at = datetime.now(timezone.utc)
    started_at = attempt.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    attempt.submitted_at = submitted_at
    attempt.duration_seconds = max(0, int((submitted_at - started_at).total_seconds()))

    await db.commit()
    await db.refresh(attempt)

    return AttemptSubmitResponse(
        attempt_id=attempt.id,
        score=attempt.score,
        total_questions=attempt.total_questions,
        duration_seconds=attempt.duration_seconds,
    )


@router.get("/{attempt_id}", response_model=AttemptReviewOut)
async def review_attempt(
    attempt_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptReviewOut:
    attempt = await _get_owned_attempt(db, attempt_id, current_user.id)
    if attempt.submitted_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This attempt is not submitted yet"
        )

    quiz = await db.get(Quiz, attempt.quiz_id)

    rows = await db.execute(
        select(QuizQuestion, QuizAnswer)
        .join(
            QuizAnswer,
            (QuizAnswer.question_id == QuizQuestion.id) & (QuizAnswer.attempt_id == attempt.id),
            isouter=True,
        )
        .where(QuizQuestion.quiz_id == attempt.quiz_id)
        .order_by(QuizQuestion.position)
    )

    questions = [
        ReviewQuestionOut(
            id=question.id,
            question_type=question.question_type,
            prompt_text=question.prompt_text,
            prompt_phonetic=question.prompt_phonetic,
            options=json.loads(question.options),
            position=question.position,
            correct_index=question.correct_index,
            selected_index=answer.selected_index if answer else None,
            is_correct=bool(answer.is_correct) if answer else False,
            card_id=question.card_id,
        )
        for question, answer in rows
    ]

    return AttemptReviewOut(
        attempt_id=attempt.id,
        quiz_id=attempt.quiz_id,
        quiz_title=quiz.title if quiz else "",
        score=attempt.score,
        total_questions=attempt.total_questions,
        duration_seconds=attempt.duration_seconds,
        submitted_at=attempt.submitted_at,
        questions=questions,
    )
```

- [ ] **Step 3: Mount router**

Sửa `backend/app/main.py`:

```python
from app.routers import auth, sessions, cards, imports, stats, quizzes, attempts
```

thêm:

```python
app.include_router(attempts.router, prefix="/attempts", tags=["attempts"])
```

- [ ] **Step 4: Kiểm tra routes**

Run:
```bash
cd backend && .venv/Scripts/python -c "from app.main import app; print([r.path for r in app.routes if 'attempt' in r.path])"
```
Expected: `/quizzes/{quiz_id}/attempts`, `/attempts/{attempt_id}/answers`, `/attempts/{attempt_id}/submit`, `/attempts/{attempt_id}`

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/attempts.py backend/app/routers/quizzes.py backend/app/main.py
git commit -m "feat: add quiz attempt start, answer, submit and review endpoints"
```

---

### Task 8: End-to-end smoke test

**Files:**
- Create: `backend/smoke_test_quiz.py`

**Interfaces:**
- Consumes: toàn bộ API từ Task 6 và 7
- Produces: nothing — chỉ verification

- [ ] **Step 1: Viết smoke test**

`backend/smoke_test_quiz.py` (theo đúng style của `smoke_test.py` sẵn có — script chạy thẳng, assert + print):

```python
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

email = f"quiz-{uuid.uuid4().hex[:8]}@test.com"
register = client.post(
    "/auth/register",
    json={"email": email, "password": "123456", "display_name": "Quiz Tester"},
)
assert register.status_code == 200, register.text
headers = {"Authorization": f"Bearer {register.json()['token']}"}

session = client.post("/sessions", json={"title": "Quiz Source"}, headers=headers)
assert session.status_code == 200, session.text
session_id = session.json()["id"]

WORDS = [
    ("abundant", "doi dao", "plentiful"),
    ("scarce", "khan hiem", "rare"),
    ("swift", "nhanh nhen", "rapid"),
    ("sturdy", "ben bi", "robust"),
    ("gloomy", "u am", "dismal"),
    ("vivid", "song dong", "vibrant"),
]
for index, (front, back, synonym) in enumerate(WORDS):
    response = client.post(
        f"/sessions/{session_id}/cards",
        json={
            "card_type": "vocab",
            "front_text": front,
            "front_phonetic": f"/{front}/",
            "back_text": back,
            "position": index,
            "synonyms": [{"word": synonym, "phonetic": f"/{synonym}/"}],
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text

capacity = client.post(
    "/quizzes/capacity",
    json={"session_ids": [session_id], "question_types": ["en_to_vi", "vi_to_en", "synonym"]},
    headers=headers,
)
print("CAPACITY", capacity.status_code, capacity.json())
assert capacity.status_code == 200, capacity.text
assert capacity.json()["max_questions"] == 18

create = client.post(
    "/quizzes",
    json={
        "title": "Smoke Quiz",
        "session_ids": [session_id],
        "question_count": 6,
        "question_types": ["en_to_vi", "vi_to_en", "synonym"],
    },
    headers=headers,
)
print("QUIZ_CREATE", create.status_code, create.json())
assert create.status_code == 200, create.text
quiz_id = create.json()["id"]
assert create.json()["question_count"] == 6
assert create.json()["attempt_count"] == 0
assert create.json()["best_score"] is None

listing = client.get("/quizzes", headers=headers)
assert listing.status_code == 200, listing.text
assert len(listing.json()) == 1

start = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
print("ATTEMPT_START", start.status_code)
assert start.status_code == 200, start.text
payload = start.json()
attempt_id = payload["attempt_id"]
questions = payload["questions"]
assert len(questions) == 6

# The answer must never be leaked before the user picks an option.
for question in questions:
    assert "correct_index" not in question, question
    assert len(question["options"]) == 4
    assert len({option.lower() for option in question["options"]}) == 4

# Answer the first half correctly, the second half wrongly.
expected_score = 0
for index, question in enumerate(questions):
    probe = client.post(
        f"/attempts/{attempt_id}/answers",
        json={"question_id": question["id"], "selected_index": 0},
        headers=headers,
    )
    assert probe.status_code == 200, probe.text
    if probe.json()["is_correct"]:
        expected_score += 1

    duplicate = client.post(
        f"/attempts/{attempt_id}/answers",
        json={"question_id": question["id"], "selected_index": 1},
        headers=headers,
    )
    assert duplicate.status_code == 409, duplicate.text

submit = client.post(f"/attempts/{attempt_id}/submit", headers=headers)
print("ATTEMPT_SUBMIT", submit.status_code, submit.json())
assert submit.status_code == 200, submit.text
assert submit.json()["score"] == expected_score
assert submit.json()["total_questions"] == 6

resubmit = client.post(f"/attempts/{attempt_id}/submit", headers=headers)
assert resubmit.status_code == 409, resubmit.text

review = client.get(f"/attempts/{attempt_id}", headers=headers)
print("ATTEMPT_REVIEW", review.status_code)
assert review.status_code == 200, review.text
assert len(review.json()["questions"]) == 6
for question in review.json()["questions"]:
    assert 0 <= question["correct_index"] <= 3
    assert question["is_correct"] == (question["selected_index"] == question["correct_index"])

detail = client.get(f"/quizzes/{quiz_id}", headers=headers)
print("QUIZ_DETAIL", detail.status_code, detail.json()["quiz"])
assert detail.status_code == 200, detail.text
assert detail.json()["quiz"]["attempt_count"] == 1
assert detail.json()["quiz"]["best_score"] == expected_score
assert len(detail.json()["attempts"]) == 1

# A second attempt on the same quiz reuses the same fixed questions.
second = client.post(f"/quizzes/{quiz_id}/attempts", headers=headers)
assert second.status_code == 200, second.text
assert [q["id"] for q in second.json()["questions"]] == [q["id"] for q in questions]

deleted = client.delete(f"/quizzes/{quiz_id}", headers=headers)
assert deleted.status_code == 204, deleted.text
assert client.get(f"/quizzes/{quiz_id}", headers=headers).status_code == 404

print("QUIZ_SMOKE_OK")
```

- [ ] **Step 2: Chạy smoke test**

Run: `cd backend && .venv/Scripts/python smoke_test_quiz.py`
Expected: in ra các dòng CAPACITY/QUIZ_CREATE/… và kết thúc bằng `QUIZ_SMOKE_OK`

- [ ] **Step 3: Chạy lại toàn bộ unit test**

Run: `cd backend && .venv/Scripts/python -m pytest tests/ -v`
Expected: 20 passed

- [ ] **Step 4: Commit**

```bash
git add backend/smoke_test_quiz.py
git commit -m "test: add end-to-end smoke test for quiz flow"
```

---

### Task 9: Frontend types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: shape của API response (Task 5)
- Produces: `QuestionType`, `Quiz`, `QuizDetail`, `QuizAttemptSummary`, `QuizCapacity`, `QuizQuestion`, `AttemptStart`, `AnswerResult`, `AttemptSubmitResult`, `ReviewQuestion`, `AttemptReview` — dùng ở Task 10–14

- [ ] **Step 1: Thêm types**

Thêm vào cuối `frontend/src/types/index.ts`:

```typescript
export type QuestionType = 'en_to_vi' | 'vi_to_en' | 'synonym';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  en_to_vi: 'English → Vietnamese',
  vi_to_en: 'Vietnamese → English',
  synonym: 'Synonym',
};

export type Quiz = {
  id: string;
  title: string;
  question_types: QuestionType[];
  question_count: number;
  source_session_titles: string[];
  attempt_count: number;
  best_score: number | null;
  last_attempt_at: string | null;
  created_at: string;
};

export type QuizAttemptSummary = {
  id: string;
  submitted_at: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
};

export type QuizDetail = {
  quiz: Quiz;
  attempts: QuizAttemptSummary[];
};

export type QuizCapacity = {
  total_cards: number;
  per_type: Partial<Record<QuestionType, number>>;
  max_questions: number;
};

export type QuizQuestion = {
  id: string;
  question_type: QuestionType;
  prompt_text: string;
  prompt_phonetic?: string | null;
  options: string[];
  position: number;
};

export type AttemptStart = {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  questions: QuizQuestion[];
};

export type AnswerResult = {
  is_correct: boolean;
  correct_index: number;
};

export type AttemptSubmitResult = {
  attempt_id: string;
  score: number;
  total_questions: number;
  duration_seconds: number;
};

export type ReviewQuestion = QuizQuestion & {
  correct_index: number;
  selected_index: number | null;
  is_correct: boolean;
  card_id: string | null;
};

export type AttemptReview = {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
  submitted_at: string;
  questions: ReviewQuestion[];
};
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: không lỗi

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: add quiz types to frontend"
```

---

### Task 10: `QuizCreateModal` — wizard 4 bước

**Files:**
- Create: `frontend/src/components/quiz/QuizCreateModal.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `api` (`frontend/src/api/client.ts`); types `Session`, `QuestionType`, `QuizCapacity`, `Quiz`, `QUESTION_TYPE_LABELS` (Task 9); API `POST /quizzes/capacity`, `POST /quizzes` (Task 6)
- Produces: `QuizCreateModal` với props `{ isOpen: boolean; sessions: Session[]; onClose: () => void; onCreated: (quiz: Quiz) => void }`

- [ ] **Step 1: Thêm CSS**

Thêm vào cuối `frontend/src/index.css`:

```css
/* ---------- Quiz ---------- */
.wizard-steps {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.wizard-step {
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f4f6;
}

.wizard-step.active {
  background: #111827;
  color: #fff;
}

.choice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.choice-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
}

.choice-row.selected {
  border-color: #111827;
  background: #f9fafb;
}

.choice-row input {
  width: auto;
  margin: 0;
}

.choice-row-meta {
  margin-left: auto;
  font-size: 12px;
  color: #6b7280;
}

.quiz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.quiz-card {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 18px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quiz-card-meta {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: #6b7280;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-button {
  text-align: left;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  font-size: 15px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.option-button:hover:not(:disabled) {
  border-color: #111827;
}

.option-button:disabled {
  cursor: default;
}

.option-button.correct {
  border-color: #16a34a;
  background: #f0fdf4;
}

.option-button.wrong {
  border-color: #dc2626;
  background: #fef2f2;
}

.quiz-prompt {
  font-size: 28px;
  font-weight: 300;
  letter-spacing: -0.02em;
}

.quiz-prompt-phonetic {
  color: #6b7280;
  font-size: 15px;
}

.attempt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.attempt-table th,
.attempt-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.review-item {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

- [ ] **Step 2: Viết modal**

`frontend/src/components/quiz/QuizCreateModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../../api/client';
import { QUESTION_TYPE_LABELS } from '../../types';
import type { QuestionType, Quiz, QuizCapacity, Session } from '../../types';

const ALL_TYPES: QuestionType[] = ['en_to_vi', 'vi_to_en', 'synonym'];
const STEP_LABELS = ['Sessions', 'Questions', 'Types', 'Name'];

type QuizCreateModalProps = {
  isOpen: boolean;
  sessions: Session[];
  onClose: () => void;
  onCreated: (quiz: Quiz) => void;
};

export default function QuizCreateModal({
  isOpen,
  sessions,
  onClose,
  onCreated,
}: QuizCreateModalProps) {
  const [step, setStep] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(['en_to_vi']);
  const [questionCount, setQuestionCount] = useState(10);
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState<QuizCapacity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset every time the modal is reopened.
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setSessionIds([]);
    setTypes(['en_to_vi']);
    setQuestionCount(10);
    setTitle('');
    setCapacity(null);
    setError(null);
  }, [isOpen]);

  // Capacity depends on both the sessions and the chosen types, so refetch
  // whenever either changes while the wizard is past step 1.
  useEffect(() => {
    if (!isOpen || step === 0 || sessionIds.length === 0 || types.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await api.post<QuizCapacity>('/quizzes/capacity', {
          session_ids: sessionIds,
          question_types: types,
        });
        if (!cancelled) setCapacity(response.data);
      } catch {
        if (!cancelled) setCapacity(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, sessionIds, types]);

  if (!isOpen) return null;

  const maxQuestions = capacity?.max_questions ?? 0;

  const toggleSession = (id: string) => {
    setSessionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleType = (type: QuestionType) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type],
    );
  };

  const canGoNext = () => {
    if (step === 0) return sessionIds.length > 0;
    if (step === 1) return questionCount >= 1 && (maxQuestions === 0 || questionCount <= maxQuestions);
    if (step === 2) return types.length > 0;
    return title.trim().length > 0;
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await api.post<Quiz>('/quizzes', {
        title: title.trim(),
        session_ids: sessionIds,
        question_count: Math.min(questionCount, maxQuestions || questionCount),
        question_types: types,
      });
      onCreated(response.data);
      onClose();
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data
        ?.detail;
      setError(detail ?? 'Could not create the quiz. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Create quiz</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-7">
          <div className="wizard-steps">
            {STEP_LABELS.map((label, index) => (
              <span key={label} className={`wizard-step ${index === step ? 'active' : ''}`}>
                {index + 1}. {label}
              </span>
            ))}
          </div>

          {step === 0 && (
            <div className="field-group">
              <span>Pick at least one session</span>
              <div className="choice-list">
                {sessions.map((session) => (
                  <label
                    key={session.id}
                    className={`choice-row ${sessionIds.includes(session.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={sessionIds.includes(session.id)}
                      onChange={() => toggleSession(session.id)}
                    />
                    <span>{session.title}</span>
                    <span className="choice-row-meta">{session.total_cards} cards</span>
                  </label>
                ))}
              </div>
              {sessions.length === 0 && (
                <p className="inline-error">Create a session with cards first.</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="field-group">
              <label>
                <span>How many questions?</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(maxQuestions, 1)}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value))}
                />
              </label>
              <p className="quiz-card-meta">
                {capacity
                  ? `${capacity.total_cards} cards available · up to ${maxQuestions} questions`
                  : 'Checking how many questions are available…'}
              </p>
              {capacity && maxQuestions === 0 && (
                <p className="inline-error">
                  The selected sessions need at least 4 cards to build a quiz.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="field-group">
              <span>Question types</span>
              <div className="choice-list">
                {ALL_TYPES.map((type) => (
                  <label
                    key={type}
                    className={`choice-row ${types.includes(type) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={types.includes(type)}
                      onChange={() => toggleType(type)}
                    />
                    <span>{QUESTION_TYPE_LABELS[type]}</span>
                    <span className="choice-row-meta">
                      {capacity?.per_type?.[type] ?? 0} available
                    </span>
                  </label>
                ))}
              </div>
              {types.length === 0 && <p className="inline-error">Pick at least one type.</p>}
            </div>
          )}

          {step === 3 && (
            <div className="field-group">
              <label>
                <span>Quiz name</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g., Unit 1 + 2 review"
                  autoFocus
                />
              </label>
              <p className="quiz-card-meta">
                {Math.min(questionCount, maxQuestions || questionCount)} questions ·{' '}
                {types.map((type) => QUESTION_TYPE_LABELS[type]).join(', ')} ·{' '}
                {sessionIds.length} session{sessionIds.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {error && <p className="inline-error">{error}</p>}

          <div className="flex gap-3 justify-end">
            {step > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep((current) => current - 1)}
                disabled={creating}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep((current) => current + 1)}
                disabled={!canGoNext()}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleCreate()}
                disabled={creating || !canGoNext()}
              >
                <Check size={16} />
                {creating ? 'Creating…' : 'Create quiz'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: không lỗi

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/quiz/QuizCreateModal.tsx frontend/src/index.css
git commit -m "feat: add quiz creation wizard modal"
```

---

### Task 11: `QuizzesPage` + route + entry point từ Dashboard

**Files:**
- Create: `frontend/src/components/quiz/QuizCard.tsx`
- Create: `frontend/src/pages/QuizzesPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `QuizCreateModal` (Task 10), types (Task 9), API `GET /quizzes`, `DELETE /quizzes/{id}` (Task 6)
- Produces: route `/quizzes`; `QuizCard` với props `{ quiz: Quiz; onOpen: () => void; onDelete: () => void }`

- [ ] **Step 1: Viết `QuizCard`**

`frontend/src/components/quiz/QuizCard.tsx`:

```tsx
import { Trash2 } from 'lucide-react';
import { QUESTION_TYPE_LABELS } from '../../types';
import type { Quiz } from '../../types';

type QuizCardProps = {
  quiz: Quiz;
  onOpen: () => void;
  onDelete: () => void;
};

export default function QuizCard({ quiz, onOpen, onDelete }: QuizCardProps) {
  return (
    <div className="quiz-card">
      <div className="session-card-header">
        <h3 className="session-card-title">{quiz.title}</h3>
        <button
          type="button"
          className="icon-button"
          onClick={onDelete}
          aria-label={`Delete ${quiz.title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {quiz.question_types.map((type) => (
          <span key={type} className="badge">
            {QUESTION_TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      <div className="quiz-card-meta">
        <span>{quiz.question_count} questions</span>
        <span>{quiz.attempt_count} attempts</span>
        <span>
          Best: {quiz.best_score === null ? '—' : `${quiz.best_score}/${quiz.question_count}`}
        </span>
      </div>

      <p className="quiz-card-meta">From: {quiz.source_session_titles.join(', ') || '—'}</p>

      <button type="button" className="btn btn-primary wide" onClick={onOpen}>
        Open quiz
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Viết `QuizzesPage`**

`frontend/src/pages/QuizzesPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import QuizCard from '../components/quiz/QuizCard';
import QuizCreateModal from '../components/quiz/QuizCreateModal';
import type { Quiz, Session } from '../types';

export default function QuizzesPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    void (async () => {
      const [quizResponse, sessionResponse] = await Promise.all([
        api.get<Quiz[]>('/quizzes'),
        api.get<Session[]>('/sessions'),
      ]);
      setQuizzes(quizResponse.data);
      setSessions(sessionResponse.data);
      setLoading(false);
    })();
  }, []);

  const handleDelete = async (quizId: string) => {
    await api.delete(`/quizzes/${quizId}`);
    setQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <Link to="/" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </header>

      <main className="page-container">
        <section className="section-header">
          <h2>Quizzes ({quizzes.length})</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create quiz
          </button>
        </section>

        {loading ? (
          <div className="empty-state">Loading quizzes…</div>
        ) : quizzes.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={36} />
            <h3>No quizzes yet</h3>
            <p>Build a quiz from one or more sessions to test what you have learned.</p>
          </div>
        ) : (
          <div className="quiz-grid">
            {quizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onOpen={() => navigate(`/quizzes/${quiz.id}`)}
                onDelete={() => void handleDelete(quiz.id)}
              />
            ))}
          </div>
        )}
      </main>

      <QuizCreateModal
        isOpen={showCreateModal}
        sessions={sessions}
        onClose={() => setShowCreateModal(false)}
        onCreated={(quiz) => setQuizzes((current) => [quiz, ...current])}
      />
    </div>
  );
}
```

- [ ] **Step 3: Thêm route**

Sửa `frontend/src/App.tsx` — thêm import:

```tsx
import QuizzesPage from './pages/QuizzesPage';
```

và thêm route trong `<Routes>` (sau route `/sessions/:id/study`):

```tsx
      <Route
        path="/quizzes"
        element={
          <ProtectedRoute>
            <QuizzesPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 4: Thêm entry point ở Dashboard**

Sửa `frontend/src/pages/DashboardPage.tsx` — thêm `ClipboardList` vào import từ `lucide-react`:

```tsx
import { BookOpenText, ClipboardList, Plus, Search, Trash2 } from 'lucide-react';
```

Thay section header "Your sessions" (dòng ~90–100) để có thêm nút Quizzes:

```tsx
        <section className="section-header">
          <h2>Your sessions ({sessions.length})</h2>
          <div className="flex gap-3">
            <Link to="/quizzes" className="btn btn-secondary">
              <ClipboardList size={16} />
              Quizzes
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} />
              Add session
            </button>
          </div>
        </section>
```

(`Link` đã có sẵn trong import react-router-dom của file này.)

- [ ] **Step 5: Type-check và build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build thành công, không lỗi type

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/quiz/QuizCard.tsx frontend/src/pages/QuizzesPage.tsx frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add quizzes list page with dashboard entry point"
```

---

### Task 12: `QuizDetailPage` + `AttemptHistory`

**Files:**
- Create: `frontend/src/components/quiz/AttemptHistory.tsx`
- Create: `frontend/src/pages/QuizDetailPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: types (Task 9), API `GET /quizzes/{id}` (Task 6)
- Produces: route `/quizzes/:id`; `AttemptHistory` với props `{ attempts: QuizAttemptSummary[] }`

- [ ] **Step 1: Viết `AttemptHistory`**

`frontend/src/components/quiz/AttemptHistory.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { QuizAttemptSummary } from '../../types';

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

type AttemptHistoryProps = {
  attempts: QuizAttemptSummary[];
};

export default function AttemptHistory({ attempts }: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return <div className="empty-state">No attempts yet. Take the quiz to see your score here.</div>;
  }

  return (
    <table className="attempt-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Score</th>
          <th>Percent</th>
          <th>Duration</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {attempts.map((attempt) => (
          <tr key={attempt.id}>
            <td>{new Date(attempt.submitted_at).toLocaleString()}</td>
            <td>
              {attempt.score}/{attempt.total_questions}
            </td>
            <td>
              {attempt.total_questions > 0
                ? `${Math.round((attempt.score / attempt.total_questions) * 100)}%`
                : '—'}
            </td>
            <td>{formatDuration(attempt.duration_seconds)}</td>
            <td>
              <Link to={`/attempts/${attempt.id}`} className="btn btn-secondary small">
                Review
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Viết `QuizDetailPage`**

`frontend/src/pages/QuizDetailPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AttemptHistory from '../components/quiz/AttemptHistory';
import { QUESTION_TYPE_LABELS } from '../types';
import type { QuizDetail } from '../types';

export default function QuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const response = await api.get<QuizDetail>(`/quizzes/${id}`);
      setDetail(response.data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">Loading quiz…</div>;
  }

  if (!detail) {
    return <div className="app-shell center-block">Quiz not found.</div>;
  }

  const { quiz, attempts } = detail;

  return (
    <div className="page-shell">
      <header className="topbar">
        <Link to="/quizzes" className="btn btn-secondary">
          <ArrowLeft size={16} />
          Quizzes
        </Link>
      </header>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Quiz</p>
            <h1 className="text-2xl font-light letter-spacing-tight">{quiz.title}</h1>
            <p className="quiz-card-meta">
              {quiz.question_count} questions ·{' '}
              {quiz.question_types.map((type) => QUESTION_TYPE_LABELS[type]).join(', ')} · from{' '}
              {quiz.source_session_titles.join(', ') || '—'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/quizzes/${quiz.id}/take`)}
          >
            <Play size={16} />
            {attempts.length === 0 ? 'Start quiz' : 'Retake quiz'}
          </button>
        </section>

        <section className="section-header">
          <h2>Attempt history ({attempts.length})</h2>
        </section>

        <AttemptHistory attempts={attempts} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Thêm route**

Sửa `frontend/src/App.tsx` — thêm import `import QuizDetailPage from './pages/QuizDetailPage';` và route:

```tsx
      <Route
        path="/quizzes/:id"
        element={
          <ProtectedRoute>
            <QuizDetailPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 4: Type-check và build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: thành công

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quiz/AttemptHistory.tsx frontend/src/pages/QuizDetailPage.tsx frontend/src/App.tsx
git commit -m "feat: add quiz detail page with attempt history"
```

---

### Task 13: `TakeQuizPage` + `QuizQuestionView`

Màn hình làm bài. Sau khi chọn đáp án, gọi API chấm rồi mới hiện xanh/đỏ — client không giữ đáp án đúng trước đó.

**Files:**
- Create: `frontend/src/components/quiz/QuizQuestionView.tsx`
- Create: `frontend/src/pages/TakeQuizPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: types (Task 9), API `POST /quizzes/{id}/attempts`, `POST /attempts/{id}/answers`, `POST /attempts/{id}/submit` (Task 6, 7)
- Produces: route `/quizzes/:id/take`; `QuizQuestionView` với props `{ question: QuizQuestion; index: number; total: number; result: AnswerResult | null; isChecking: boolean; selectedIndex: number | null; onSelect: (index: number) => void; onNext: () => void; isLast: boolean }`

- [ ] **Step 1: Viết `QuizQuestionView`**

`frontend/src/components/quiz/QuizQuestionView.tsx`:

```tsx
import { QUESTION_TYPE_LABELS } from '../../types';
import type { AnswerResult, QuizQuestion } from '../../types';

type QuizQuestionViewProps = {
  question: QuizQuestion;
  index: number;
  total: number;
  result: AnswerResult | null;
  isChecking: boolean;
  selectedIndex: number | null;
  onSelect: (optionIndex: number) => void;
  onNext: () => void;
  isLast: boolean;
};

const optionClass = (
  optionIndex: number,
  result: AnswerResult | null,
  selectedIndex: number | null,
) => {
  if (!result) return 'option-button';
  if (optionIndex === result.correct_index) return 'option-button correct';
  if (optionIndex === selectedIndex) return 'option-button wrong';
  return 'option-button';
};

export default function QuizQuestionView({
  question,
  index,
  total,
  result,
  isChecking,
  selectedIndex,
  onSelect,
  onNext,
  isLast,
}: QuizQuestionViewProps) {
  const progressPercent = Math.round(((index + 1) / total) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="progress-box">
        <span>
          Question {index + 1} of {total}
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="hero-card flex flex-col gap-2">
        <span className="badge tone-dark">{QUESTION_TYPE_LABELS[question.question_type]}</span>
        <p className="quiz-prompt">{question.prompt_text}</p>
        {question.prompt_phonetic && (
          <p className="quiz-prompt-phonetic">{question.prompt_phonetic}</p>
        )}
      </div>

      <div className="option-list">
        {question.options.map((option, optionIndex) => (
          <button
            key={option}
            type="button"
            className={optionClass(optionIndex, result, selectedIndex)}
            disabled={result !== null || isChecking}
            onClick={() => onSelect(optionIndex)}
          >
            {option}
          </button>
        ))}
      </div>

      {result && (
        <div className="flex gap-3 justify-end items-center">
          <span>{result.is_correct ? 'Correct!' : 'Not quite.'}</span>
          <button type="button" className="btn btn-primary" onClick={onNext}>
            {isLast ? 'Finish quiz' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Viết `TakeQuizPage`**

`frontend/src/pages/TakeQuizPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import QuizQuestionView from '../components/quiz/QuizQuestionView';
import type { AnswerResult, AttemptStart, AttemptSubmitResult } from '../types';

export default function TakeQuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AttemptStart | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentIndex]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const response = await api.post<AttemptStart>(`/quizzes/${id}/attempts`);
        setAttempt(response.data);
      } catch {
        setError('Could not start this quiz.');
      }
    })();
  }, [id]);

  if (error) {
    return <div className="app-shell center-block">{error}</div>;
  }

  if (!attempt) {
    return <div className="app-shell center-block">Preparing your quiz…</div>;
  }

  const question = attempt.questions[currentIndex];
  const isLast = currentIndex === attempt.questions.length - 1;

  const handleSelect = async (optionIndex: number) => {
    if (result !== null || isChecking) return;

    setSelectedIndex(optionIndex);
    setIsChecking(true);
    try {
      const response = await api.post<AnswerResult>(`/attempts/${attempt.attempt_id}/answers`, {
        question_id: question.id,
        selected_index: optionIndex,
      });
      setResult(response.data);
    } catch {
      setSelectedIndex(null);
      setError('Could not save that answer. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleNext = async () => {
    if (!isLast) {
      setCurrentIndex((current) => current + 1);
      setSelectedIndex(null);
      setResult(null);
      return;
    }

    const response = await api.post<AttemptSubmitResult>(
      `/attempts/${attempt.attempt_id}/submit`,
    );
    navigate(`/attempts/${response.data.attempt_id}`, { replace: true });
  };

  return (
    <div className="page-shell">
      <main className="page-container compact">
        <QuizQuestionView
          question={question}
          index={currentIndex}
          total={attempt.questions.length}
          result={result}
          isChecking={isChecking}
          selectedIndex={selectedIndex}
          onSelect={(optionIndex) => void handleSelect(optionIndex)}
          onNext={() => void handleNext()}
          isLast={isLast}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Thêm route**

`frontend/src/App.tsx` — import `TakeQuizPage` và thêm route **sau** route `/quizzes/:id`:

```tsx
      <Route
        path="/quizzes/:id/take"
        element={
          <ProtectedRoute>
            <TakeQuizPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 4: Type-check và build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: thành công

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quiz/QuizQuestionView.tsx frontend/src/pages/TakeQuizPage.tsx frontend/src/App.tsx
git commit -m "feat: add quiz taking page with per-question feedback"
```

---

### Task 14: `AttemptReviewPage` + verification cuối

**Files:**
- Create: `frontend/src/pages/AttemptReviewPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: types (Task 9), API `GET /attempts/{id}` (Task 7)
- Produces: route `/attempts/:id`

- [ ] **Step 1: Viết `AttemptReviewPage`**

`frontend/src/pages/AttemptReviewPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { QUESTION_TYPE_LABELS } from '../types';
import type { AttemptReview } from '../types';

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
};

export default function AttemptReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const response = await api.get<AttemptReview>(`/attempts/${id}`);
      setReview(response.data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">Loading result…</div>;
  }

  if (!review) {
    return <div className="app-shell center-block">Result not found.</div>;
  }

  const percent =
    review.total_questions > 0
      ? Math.round((review.score / review.total_questions) * 100)
      : 0;

  return (
    <div className="page-shell">
      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">{review.quiz_title}</p>
            <h1 className="text-2xl font-light letter-spacing-tight">
              {review.score}/{review.total_questions} correct · {percent}%
            </h1>
            <p className="quiz-card-meta">
              Finished in {formatDuration(review.duration_seconds)} ·{' '}
              {new Date(review.submitted_at).toLocaleString()}
            </p>
          </div>
          <Link to={`/quizzes/${review.quiz_id}`} className="btn btn-primary">
            <RotateCcw size={16} />
            Back to quiz
          </Link>
        </section>

        <section className="section-header">
          <h2>Review ({review.questions.length})</h2>
        </section>

        <div className="flex flex-col gap-3">
          {review.questions.map((question) => (
            <div key={question.id} className="review-item">
              <div className="flex gap-2 items-center">
                {question.is_correct ? (
                  <CheckCircle2 size={18} color="#16a34a" />
                ) : (
                  <XCircle size={18} color="#dc2626" />
                )}
                <span className="badge">{QUESTION_TYPE_LABELS[question.question_type]}</span>
                <strong>{question.prompt_text}</strong>
                {question.prompt_phonetic && (
                  <span className="quiz-prompt-phonetic">{question.prompt_phonetic}</span>
                )}
              </div>
              <p className="quiz-card-meta">
                Correct answer: {question.options[question.correct_index]}
              </p>
              <p className="quiz-card-meta">
                Your answer:{' '}
                {question.selected_index === null
                  ? 'Not answered'
                  : question.options[question.selected_index]}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Thêm route**

`frontend/src/App.tsx` — import `AttemptReviewPage` và thêm route:

```tsx
      <Route
        path="/attempts/:id"
        element={
          <ProtectedRoute>
            <AttemptReviewPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 3: Type-check và build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: thành công

- [ ] **Step 4: Chạy toàn bộ verification backend**

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -v
.venv/Scripts/python smoke_test.py
.venv/Scripts/python smoke_test_quiz.py
```
Expected: 20 passed · `SMOKE_OK` · `QUIZ_SMOKE_OK`

- [ ] **Step 5: Verify thủ công trên app đang chạy**

```bash
# Terminal 1
docker compose up db
# Terminal 2
cd backend && .venv/Scripts/python -m alembic upgrade head && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
# Terminal 3
cd frontend && npm run dev
```

Đi qua đúng flow: Dashboard → nút **Quizzes** → **Create quiz** → chọn ≥1 session → số câu → dạng câu hỏi → đặt tên → đề xuất hiện trong danh sách → **Open quiz** → **Start quiz** → chọn đáp án và thấy xanh/đỏ ngay → hết câu → trang kết quả → quay lại đề thấy attempt trong lịch sử.

Trong DevTools → Network, mở response của `POST /quizzes/<id>/attempts` và xác nhận **không có** field `correct_index` ở bất kỳ câu hỏi nào.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AttemptReviewPage.tsx frontend/src/App.tsx
git commit -m "feat: add attempt review page with per-question breakdown"
```

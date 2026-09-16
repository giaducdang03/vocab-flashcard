# Quick Practice Pool Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user chọn pool câu hỏi khi bắt đầu Quick Practice — `all`, `unlearned`, hoặc `learned` — thay vì luôn luyện toàn bộ card của session.

**Architecture:** Tách "pool sinh câu hỏi" khỏi "pool lấy đáp án nhiễu". `generate_practice_questions` nhận thêm tham số `distractor_pool`; endpoint lọc card theo `pool` rồi truyền danh sách đã lọc làm pool sinh câu hỏi nhưng vẫn truyền **toàn bộ** card của session làm distractor pool. Nhờ vậy điều kiện `MIN_POOL_SIZE = 4` chỉ áp lên cả session (như hiện tại), pool đã lọc chỉ cần ≥1 card là chạy được, và đáp án nhiễu không bị lặp lại giữa các câu khi pool nhỏ. Việc lọc nằm trong một hàm thuần mới `filter_cards_by_pool` để unit test được mà không cần database.

**Tech Stack:** FastAPI · SQLAlchemy 2.0 async · Pydantic v2 · pytest · React 18 + TypeScript + Vite · react-router-dom · axios · lucide-react · Tailwind

**Spec:** Không có file spec riêng — đây là feature bounded, tiếp nối `docs/superpowers/plans/2026-09-13-quick-practice.md`. Phần "Design Summary" ngay dưới đây là spec.

---

## Design Summary

Các quyết định đã chốt với người dùng:

1. **Distractors lấy từ toàn bộ card của session**, không chỉ pool đã lọc. Câu hỏi chỉ sinh cho card thuộc pool đã lọc.
2. **Chặn ngay trong modal:** modal hiện số card của từng pool, disable lựa chọn nào có 0 card, và disable nút Start kèm lý do khi tổ hợp pool + dạng câu hỏi cho ra 0 câu. Không để user bấm rồi mới thấy lỗi.
3. **Radio / segmented — chọn đúng 1 pool**, mặc định `all`. Dùng đúng tên giá trị `'all' | 'unlearned' | 'learned'` đã có ở `StudyPage` và `SessionDetailPage`.
4. **Không persistence:** vẫn không model mới, không migration, không ghi DB, không đụng `Card.is_learned`.

## Global Constraints

- **Mã pool** dùng đúng 3 giá trị: `all`, `unlearned`, `learned`. Không đổi tên, không thêm giá trị.
- **Mã dạng câu hỏi** dùng đúng 3 giá trị có sẵn: `en_to_vi`, `vi_to_en`, `synonym`.
- **Không tạo model, không tạo migration, không ghi DB.** Endpoint practice chỉ đọc. Không thêm/sửa bất cứ file nào dưới `backend/alembic/`.
- **Không đụng** `Card.is_learned`, bảng `card_learn_events`, hay bất cứ bảng `quiz*` nào.
- **Không sửa** `frontend/src/components/quiz/QuizQuestionView.tsx` và `frontend/src/pages/SessionDetailPage.tsx`. Nếu thấy phải sửa, dừng lại và báo cáo.
- **Backward compatible:** `generate_practice_questions(cards, question_types)` gọi không có `distractor_pool` phải giữ nguyên hành vi cũ. Không sửa bất kỳ test nào đang có trong `backend/tests/test_practice_generator.py` hay `backend/tests/test_quiz_generator.py`.
- **Copy hiển thị cho user viết bằng tiếng Anh**, khớp UI hiện tại. Error `detail` của backend cũng tiếng Anh.
- **Không thêm dependency mới** ở cả frontend lẫn backend.
- **Frontend không có test harness.** Lệnh verify của mọi task frontend là `cd frontend && npm run build` (chạy `tsc -b` rồi build).
- **Backend test** chạy bằng `cd backend && .venv/Scripts/python -m pytest` (Windows). `pyproject.toml` đã set `pythonpath = ["."]`.
- **Tuyệt đối không commit** `frontend/tsconfig.tsbuildinfo` (đang dirty sẵn trong working tree). Mỗi lệnh `git add` trong plan này liệt kê file tường minh — dùng đúng danh sách đó, không dùng `git add -A`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `backend/tests/factories.py` (modify) | Thêm `is_learned` vào fake card để test lọc pool |
| `backend/app/services/quiz_generator.py` (modify) | `filter_cards_by_pool` (mới) + tham số `distractor_pool` cho `generate_practice_questions` |
| `backend/tests/test_practice_generator.py` (modify) | Test cho hai thay đổi trên |
| `backend/app/schemas/practice.py` (modify) | `PracticePool`, field `pool` ở request và response |
| `backend/app/routers/sessions.py` (modify) | Lọc card theo pool, truyền distractor pool, echo pool |
| `frontend/src/types/index.ts` (modify) | `PracticePool`, `PRACTICE_POOL_LABELS`, `pool` trong `PracticeStart` |
| `frontend/src/components/session/PracticeSummary.tsx` (modify) | Chip nhãn pool trong bảng kết quả |
| `frontend/src/pages/PracticePage.tsx` (modify) | Đọc pool từ `location.state`, gửi lên API, bỏ gate `< 4` sai |
| `frontend/src/components/session/PracticeSetupModal.tsx` (modify) | Segmented control chọn pool + đếm số câu theo pool |

---

### Task 1: `filter_cards_by_pool` + tham số `distractor_pool`

Hai thay đổi thuần trong quiz generator, cùng một test file nên làm chung một task.

**Files:**
- Modify: `backend/tests/factories.py`
- Modify: `backend/app/services/quiz_generator.py:245-305` (hàm `generate_practice_questions`) và thêm hàm mới
- Modify: `backend/tests/test_practice_generator.py` (thêm class test mới vào cuối file, **không sửa** class đang có)

**Interfaces:**
- Consumes:
  - `app.services.quiz_generator.GeneratedQuestion`, `MIN_POOL_SIZE`, `QUESTION_TYPES`, `_is_eligible`, `_build_options`, `_prompt_of` (sẵn có)
  - `tests.factories.make_card`, `make_pool` (sẵn có, mở rộng ở Step 1)
- Produces:
  - `app.services.quiz_generator.PRACTICE_POOLS: tuple[str, str, str]`
  - `app.services.quiz_generator.filter_cards_by_pool(cards: Sequence[Any], pool: str) -> list[Any]`
  - `app.services.quiz_generator.generate_practice_questions(cards, question_types, rng=None, distractor_pool: Sequence[Any] | None = None) -> list[GeneratedQuestion]`
  - `tests.factories.make_card(index, card_type="vocab", synonyms=None, is_learned=False)`
  - `tests.factories.make_pool(size, synonyms_for=None, learned_for=None)`

- [ ] **Step 1: Mở rộng factories để dựng được card đã học**

Trong `backend/tests/factories.py`, thêm field `is_learned: bool = False` vào `FakeCard`, ngay sau `front_phonetic`. Mọi field từ `card_type` trở xuống đều có default nên thứ tự này hợp lệ với dataclass:

```python
@dataclass
class FakeCard:
    id: str
    front_text: str
    back_text: str
    card_type: str = "vocab"
    front_phonetic: str | None = None
    is_learned: bool = False
    synonyms: list[FakeSynonym] = field(default_factory=list)
```

Rồi thay `make_card` và `make_pool` bằng:

```python
def make_card(
    index: int,
    card_type: str = "vocab",
    synonyms: list[str] | None = None,
    is_learned: bool = False,
) -> FakeCard:
    """Build a card with predictable, mutually distinct text."""
    return FakeCard(
        id=f"card-{index}",
        front_text=f"word{index}",
        back_text=f"nghia{index}",
        card_type=card_type,
        front_phonetic=f"/w{index}/",
        is_learned=is_learned,
        synonyms=[FakeSynonym(word=word) for word in (synonyms or [])],
    )


def make_pool(
    size: int,
    synonyms_for: set[int] | None = None,
    learned_for: set[int] | None = None,
) -> list[FakeCard]:
    """Build `size` distinct cards; those whose index is in `synonyms_for`
    get one synonym each, and those in `learned_for` are marked learned."""
    synonyms_for = synonyms_for or set()
    learned_for = learned_for or set()
    return [
        make_card(
            index,
            synonyms=[f"syn{index}"] if index in synonyms_for else None,
            is_learned=index in learned_for,
        )
        for index in range(size)
    ]
```

- [ ] **Step 2: Viết test thất bại**

Thêm vào **cuối** `backend/tests/test_practice_generator.py` (giữ nguyên class `TestGeneratePracticeQuestions` đang có):

```python
class TestFilterCardsByPool:
    def test_pool_all_returns_every_card(self):
        cards = make_pool(6, learned_for={0, 1})

        assert qg.filter_cards_by_pool(cards, "all") == list(cards)

    def test_pool_unlearned_keeps_only_cards_not_marked_learned(self):
        cards = make_pool(6, learned_for={0, 1})

        result = qg.filter_cards_by_pool(cards, "unlearned")

        assert [card.id for card in result] == ["card-2", "card-3", "card-4", "card-5"]

    def test_pool_learned_keeps_only_cards_marked_learned(self):
        cards = make_pool(6, learned_for={0, 1})

        result = qg.filter_cards_by_pool(cards, "learned")

        assert [card.id for card in result] == ["card-0", "card-1"]

    def test_pool_learned_on_a_session_with_nothing_learned_is_empty(self):
        cards = make_pool(6)

        assert qg.filter_cards_by_pool(cards, "learned") == []

    def test_unknown_pool_raises(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="Unknown practice pool"):
            qg.filter_cards_by_pool(cards, "mastered")

    def test_all_three_pool_names_are_exported(self):
        assert qg.PRACTICE_POOLS == ("all", "unlearned", "learned")


class TestPracticeDistractorPool:
    def test_two_card_pool_still_works_when_distractors_come_from_the_session(self):
        session_cards = make_pool(10)
        practice_cards = session_cards[:2]

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi"],
            rng=random.Random(21),
            distractor_pool=session_cards,
        )

        assert len(questions) == 2
        for question in questions:
            assert len(question.options) == 4
            assert len(set(question.options)) == 4

    def test_questions_only_cover_the_question_pool(self):
        session_cards = make_pool(10)
        practice_cards = session_cards[3:6]

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi", "vi_to_en"],
            rng=random.Random(22),
            distractor_pool=session_cards,
        )

        assert sorted(q.card_id for q in questions) == ["card-3", "card-4", "card-5"]

    def test_distractors_are_drawn_from_the_distractor_pool(self):
        session_cards = make_pool(10)
        practice_cards = session_cards[:2]
        allowed = {card.back_text for card in session_cards}

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi"],
            rng=random.Random(23),
            distractor_pool=session_cards,
        )

        for question in questions:
            assert set(question.options) <= allowed

    def test_distractor_pool_below_minimum_raises(self):
        session_cards = make_pool(3)
        practice_cards = session_cards[:1]

        with pytest.raises(ValueError, match="at least 4 cards"):
            qg.generate_practice_questions(
                practice_cards,
                ["en_to_vi"],
                rng=random.Random(24),
                distractor_pool=session_cards,
            )

    def test_omitting_distractor_pool_keeps_the_old_behaviour(self):
        cards = make_pool(8)

        with_default = qg.generate_practice_questions(
            cards, ["en_to_vi"], rng=random.Random(25)
        )
        with_explicit = qg.generate_practice_questions(
            cards, ["en_to_vi"], rng=random.Random(25), distractor_pool=cards
        )

        signature = lambda deck: [(q.card_id, tuple(q.options)) for q in deck]
        assert signature(with_default) == signature(with_explicit)
```

- [ ] **Step 3: Chạy test để chắc chắn nó fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_practice_generator.py -v`
Expected: FAIL — `AttributeError: module 'app.services.quiz_generator' has no attribute 'filter_cards_by_pool'` ở class `TestFilterCardsByPool`, và `TypeError: generate_practice_questions() got an unexpected keyword argument 'distractor_pool'` ở class `TestPracticeDistractorPool`.

- [ ] **Step 4: Viết implementation tối thiểu**

a) Trong `backend/app/services/quiz_generator.py`, thêm hằng số ngay **dưới** `MIN_POOL_SIZE = 4` (dòng 15):

```python
# A practice run can be narrowed to part of the session by learned state.
PRACTICE_POOLS: tuple[str, str, str] = ("all", "unlearned", "learned")
```

b) Thay **toàn bộ** hàm `generate_practice_questions` (dòng 245 đến hết file) bằng:

```python
def filter_cards_by_pool(cards: Sequence[Any], pool: str) -> list[Any]:
    """Narrow a session's cards to the requested practice pool.

    Args:
        cards: All cards of the session, in display order.
        pool: One of `PRACTICE_POOLS`.

    Raises:
        ValueError: If `pool` is not one of `PRACTICE_POOLS`.
    """
    if pool == "all":
        return list(cards)
    if pool == "unlearned":
        return [card for card in cards if not card.is_learned]
    if pool == "learned":
        return [card for card in cards if card.is_learned]

    raise ValueError(f"Unknown practice pool: {pool}")


def generate_practice_questions(
    cards: Sequence[Any],
    question_types: Sequence[str],
    rng: Random | None = None,
    distractor_pool: Sequence[Any] | None = None,
) -> list[GeneratedQuestion]:
    """One question per card for a throwaway practice run.

    Unlike `generate_questions`, nothing here is persisted and the caller wants
    the whole pool covered, so every card appears exactly once. The question
    type for a card is drawn at random from the requested types that card is
    eligible for — a card with no synonyms simply gets a translation question.

    Args:
        cards: Cards to generate questions for — already narrowed to the pool
            the user picked.
        question_types: Requested question types.
        rng: Random number generator (default: a fresh `Random()`).
        distractor_pool: Cards the wrong answers are drawn from. Defaults to
            `cards`. Callers narrowing `cards` by learned state pass the whole
            session here, so a two-card pool still gets varied distractors and
            the four-card minimum stays a property of the session.

    Raises:
        ValueError: If the distractor pool has fewer than `MIN_POOL_SIZE`
            cards, `question_types` is empty, or a type is unknown.
    """
    if rng is None:
        rng = Random()

    pool = list(cards) if distractor_pool is None else list(distractor_pool)

    if len(pool) < MIN_POOL_SIZE:
        raise ValueError(f"Need at least {MIN_POOL_SIZE} cards to practice")

    if not question_types:
        raise ValueError("Select at least one question type")

    for question_type in question_types:
        if question_type not in QUESTION_TYPES:
            raise ValueError(f"Unknown question type: {question_type}")

    questions: list[GeneratedQuestion] = []

    for card in cards:
        candidates = [t for t in question_types if _is_eligible(card, t)]
        if not candidates:
            continue

        rng.shuffle(candidates)

        # Try each eligible type until one can find three distractors.
        for question_type in candidates:
            options_result = _build_options(card, question_type, pool, rng)
            if options_result is None:
                continue

            options, correct_index = options_result
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
            break

    rng.shuffle(questions)

    return questions
```

- [ ] **Step 5: Chạy test để chắc chắn nó pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_practice_generator.py -v`
Expected: PASS — toàn bộ, gồm 11 test cũ + 6 test `TestFilterCardsByPool` + 5 test `TestPracticeDistractorPool`.

Rồi chạy toàn bộ để chắc chắn không làm hỏng quiz cũ:

Run: `cd backend && .venv/Scripts/python -m pytest -v`
Expected: PASS — mọi test trong `tests/test_quiz_generator.py` vẫn xanh.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/quiz_generator.py backend/tests/test_practice_generator.py backend/tests/factories.py
git commit -m "feat(practice): add pool filter and distractor pool to practice generator"
```

---

### Task 2: Schema + endpoint nhận `pool`

Cho endpoint nhận `pool`, lọc card, và truyền toàn bộ card của session làm distractor pool.

**Files:**
- Modify: `backend/app/schemas/practice.py`
- Modify: `backend/app/routers/sessions.py:95-141` (hàm `start_practice`)

**Interfaces:**
- Consumes:
  - `app.services.quiz_generator.filter_cards_by_pool`, `generate_practice_questions(..., distractor_pool=...)`, `MIN_POOL_SIZE` (Task 1)
- Produces:
  - `app.schemas.practice.PracticePool = Literal["all", "unlearned", "learned"]`
  - `PracticeStartRequest.pool: PracticePool` (default `"all"`)
  - `PracticeStartOut.pool: PracticePool`

- [ ] **Step 1: Thêm `pool` vào schema**

Thay **toàn bộ** `backend/app/schemas/practice.py` bằng:

```python
from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["en_to_vi", "vi_to_en", "synonym"]

# Which slice of the session to practice, by learned state.
PracticePool = Literal["all", "unlearned", "learned"]


class PracticeStartRequest(BaseModel):
    question_types: list[QuestionType] = Field(min_length=1)
    pool: PracticePool = "all"


class PracticeQuestionOut(BaseModel):
    card_id: str
    question_type: QuestionType
    prompt_text: str
    prompt_phonetic: str | None = None
    options: list[str]
    correct_index: int
    position: int


class PracticeStartOut(BaseModel):
    session_id: str
    session_title: str
    pool: PracticePool
    questions: list[PracticeQuestionOut]
```

- [ ] **Step 2: Lọc card trong endpoint**

Trong `backend/app/routers/sessions.py`, thay đoạn từ `cards = sorted(...)` (dòng 111) đến `raise HTTPException(... "Not enough cards for the selected question types")` (dòng 122) bằng:

```python
    cards = sorted(session.cards, key=lambda c: (c.position, c.created_at))

    # The four-card minimum is a property of the session, not of the chosen
    # pool: distractors are drawn from every card regardless of the pool.
    if len(cards) < quiz_generator.MIN_POOL_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Need at least {quiz_generator.MIN_POOL_SIZE} cards to practice")

    practice_cards = quiz_generator.filter_cards_by_pool(cards, payload.pool)

    if not practice_cards:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No cards match the selected pool")

    try:
        generated_questions = quiz_generator.generate_practice_questions(
            practice_cards, payload.question_types, distractor_pool=cards
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not generated_questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough cards for the selected question types")
```

Rồi thêm `pool` vào response — thay khối `return PracticeStartOut(...)` ở cuối hàm bằng:

```python
    return PracticeStartOut(
        session_id=session.id,
        session_title=session.title,
        pool=payload.pool,
        questions=practice_questions,
    )
```

- [ ] **Step 3: Verify — app import được và route vẫn đăng ký**

Run:
```bash
cd backend && .venv/Scripts/python -c "from app.main import app; print([r.path for r in app.routes if 'practice' in r.path])"
```
Expected: in ra đúng một route chứa `practice` (vd. `['/api/sessions/{session_id}/practice']`), không lỗi import.

- [ ] **Step 4: Verify — test cũ vẫn xanh**

Run: `cd backend && .venv/Scripts/python -m pytest -v`
Expected: PASS — toàn bộ.

- [ ] **Step 5: Smoke test bằng tay**

Khởi động backend (`cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload`), mở `http://localhost:8000/docs`, authorize, chọn một session có ≥ 4 card trong đó **có cả card đã learned và chưa learned**. Gọi `POST /sessions/{session_id}/practice` ba lần:

- `{"question_types": ["en_to_vi", "vi_to_en", "synonym"]}` → 200, `pool` trả về `"all"`, `questions` dài bằng số card có ít nhất một dạng hợp lệ.
- `{"question_types": ["en_to_vi"], "pool": "learned"}` → 200, `pool` là `"learned"`, số câu bằng số card đã learned, mỗi câu vẫn có đúng 4 `options`.
- `{"question_types": ["en_to_vi"], "pool": "unlearned"}` → 200, số câu bằng số card chưa learned.

Rồi thử một session mà **chưa learned card nào**: `{"question_types": ["en_to_vi"], "pool": "learned"}` → 400 với `detail` là `"No cards match the selected pool"`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/practice.py backend/app/routers/sessions.py
git commit -m "feat(practice): accept pool in practice endpoint"
```

---

### Task 3: Frontend types

Khai báo type cho `pool`. Task nhỏ độc lập để Task 4 và 5 dùng chung.

**Files:**
- Modify: `frontend/src/types/index.ts:149-153` (type `PracticeStart`) và thêm vào cuối file

**Interfaces:**
- Consumes: `PracticeQuestion` (sẵn có trong cùng file)
- Produces:
  - `PracticePool = 'all' | 'unlearned' | 'learned'`
  - `PRACTICE_POOL_LABELS: Record<PracticePool, string>`
  - `PracticeStart.pool: PracticePool`

- [ ] **Step 1: Thêm type và nhãn**

Trong `frontend/src/types/index.ts`, thêm `pool` vào `PracticeStart` — thay:

```ts
export type PracticeStart = {
  session_id: string;
  session_title: string;
  questions: PracticeQuestion[];
};
```

bằng:

```ts
export type PracticeStart = {
  session_id: string;
  session_title: string;
  pool: PracticePool;
  questions: PracticeQuestion[];
};
```

Rồi thêm vào **cuối file**:

```ts
/** Which slice of a session a practice run draws its questions from. */
export type PracticePool = 'all' | 'unlearned' | 'learned';

export const PRACTICE_POOL_LABELS: Record<PracticePool, string> = {
  all: 'All cards',
  unlearned: 'Unlearned only',
  learned: 'Learned only',
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không lỗi TypeScript. (`PracticeStart.pool` là field mới bắt buộc nhưng chỉ được đọc từ response API nên không chỗ nào phải khởi tạo nó.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(practice): add practice pool types"
```

---

### Task 4: `PracticePage` gửi pool + `PracticeSummary` hiện nhãn pool

Trang practice đọc pool từ `location.state`, gửi lên API, và truyền xuống bảng kết quả. Hai file chung một task vì `PracticeSummary` nhận prop mới bắt buộc — tách ra sẽ làm `npm run build` fail giữa hai task.

Task này cũng sửa một gate sai đang có: `PracticePage` hiện chặn khi `deck.questions.length < 4`. Với pool đã lọc, một bộ 2–3 câu là hoàn toàn hợp lệ, nên điều kiện đúng là `=== 0`.

**Files:**
- Modify: `frontend/src/components/session/PracticeSummary.tsx:1-12` (props) và `:61-64` (chip)
- Modify: `frontend/src/pages/PracticePage.tsx`

**Interfaces:**
- Consumes:
  - `POST /sessions/{id}/practice` với body `{ question_types, pool }`, response có `pool` (Task 2)
  - `PracticePool`, `PRACTICE_POOL_LABELS`, `PracticeStart` (Task 3)
  - `location.state` hình dạng `{ questionTypes?: QuestionType[]; pool?: PracticePool }` do Task 5 truyền vào
- Produces: `PracticeSummary` props thêm `pool: PracticePool`

- [ ] **Step 1: `PracticeSummary` nhận và hiện pool**

Trong `frontend/src/components/session/PracticeSummary.tsx`:

a) Thay khối import + props ở đầu file (dòng 1–12) bằng:

```tsx
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PracticeAnswer, PracticePool, QuestionType } from '../../types';
import { PRACTICE_POOL_LABELS, QUESTION_TYPE_LABELS } from '../../types';

type PracticeSummaryProps = {
  answers: PracticeAnswer[];
  durationSeconds: number;
  sessionId: string;
  sessionTitle: string;
  pool: PracticePool;
  onRestart: () => void;
};
```

b) Thêm `pool` vào danh sách destructure — thay:

```tsx
export default function PracticeSummary({
  answers,
  durationSeconds,
  sessionId,
  sessionTitle,
  onRestart,
}: PracticeSummaryProps) {
```

bằng:

```tsx
export default function PracticeSummary({
  answers,
  durationSeconds,
  sessionId,
  sessionTitle,
  pool,
  onRestart,
}: PracticeSummaryProps) {
```

c) Thêm chip pool cạnh chip "Practice complete" — thay:

```tsx
          <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
            Practice complete
          </span>
```

bằng:

```tsx
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
              Practice complete
            </span>
            <span className="rounded bg-hairline-soft px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-muted">
              {PRACTICE_POOL_LABELS[pool]}
            </span>
          </div>
```

- [ ] **Step 2: `PracticePage` đọc và gửi pool**

Trong `frontend/src/pages/PracticePage.tsx`:

a) Thêm `PracticePool` vào import type — thay:

```tsx
import type {
  AnswerResult,
  PracticeAnswer,
  PracticeQuestion,
  PracticeStart,
  QuestionType,
  QuizQuestion,
} from '../types';
```

bằng:

```tsx
import type {
  AnswerResult,
  PracticeAnswer,
  PracticePool,
  PracticeQuestion,
  PracticeStart,
  QuestionType,
  QuizQuestion,
} from '../types';
```

b) Đọc pool từ location state — thêm ngay **sau** khối `questionTypes` useMemo (kết thúc ở dòng `}, [location.state?.questionTypes]);`):

```tsx
  // Pool comes from the setup modal; a direct visit practices everything.
  const pool: PracticePool = (location.state?.pool as PracticePool | undefined) ?? 'all';
```

c) Gửi pool trong request — thay:

```tsx
      const response = await api.post<PracticeStart>(`/sessions/${id}/practice`, {
        question_types: questionTypes,
      });
```

bằng:

```tsx
      const response = await api.post<PracticeStart>(`/sessions/${id}/practice`, {
        question_types: questionTypes,
        pool,
      });
```

d) Thêm `pool` vào deps của effect fetch — thay:

```tsx
  }, [id, questionTypes]);
```

bằng:

```tsx
  }, [id, questionTypes, pool]);
```

e) Sửa gate sai — thay:

```tsx
  if (!deck || error || deck.questions.length < 4) {
```

bằng:

```tsx
  // A narrowed pool can legitimately produce fewer than four questions; only
  // an empty deck is unusable.
  if (!deck || error || deck.questions.length === 0) {
```

f) Truyền pool xuống summary — thay:

```tsx
        <PracticeSummary
          answers={answers}
          durationSeconds={durationSeconds}
          sessionId={id!}
          sessionTitle={deck.session_title}
          onRestart={handleRestart}
        />
```

bằng:

```tsx
        <PracticeSummary
          answers={answers}
          durationSeconds={durationSeconds}
          sessionId={id!}
          sessionTitle={deck.session_title}
          pool={deck.pool}
          onRestart={handleRestart}
        />
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 4: Verify bằng tay**

Chạy backend + `cd frontend && npm run dev`, đăng nhập, mở thẳng `http://localhost:5173/sessions/<id>/practice` cho một session có ≥ 4 card.
Expected: bộ câu hỏi hiện ra như trước (pool mặc định `all`); làm hết bài → bảng kết quả có thêm chip "All cards" cạnh chip "Practice complete".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PracticePage.tsx frontend/src/components/session/PracticeSummary.tsx
git commit -m "feat(practice): send pool from practice page and label it in the summary"
```

---

### Task 5: Chọn pool trong `PracticeSetupModal`

Điểm vào của feature: thêm segmented control 3 lựa chọn phía trên mục "Question types", đếm số câu theo pool, và chặn tổ hợp không chạy được ngay trong modal.

Task này cũng sửa một lệch nhỏ đang có: điều kiện eligible cho dạng `synonym` trong modal chỉ kiểm `card.synonyms.length > 0`, còn backend (`quiz_generator._is_eligible`) còn đòi `card_type == "vocab"`. Vì đang sửa đúng chỗ tính số câu, làm cho khớp luôn để con số modal hiện ra không lệch với số câu thật.

**Files:**
- Modify: `frontend/src/components/session/PracticeSetupModal.tsx` (thay toàn bộ file)

**Interfaces:**
- Consumes: `Card`, `QuestionType`, `PracticePool`, `QUESTION_TYPE_LABELS` (Task 3 + sẵn có); route `/sessions/:id/practice` (sẵn có)
- Produces: navigate với `state: { questionTypes: QuestionType[]; pool: PracticePool }` — đúng hình dạng Task 4 đọc

- [ ] **Step 1: Viết lại modal**

Thay **toàn bộ** `frontend/src/components/session/PracticeSetupModal.tsx` bằng:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Card, PracticePool, QuestionType } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type PracticeSetupModalProps = {
  isOpen: boolean;
  sessionId: string;
  cards: Card[];
  onClose: () => void;
};

const POOLS: { value: PracticePool; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unlearned', label: 'Unlearned' },
  { value: 'learned', label: 'Learned' },
];

/** Mirrors quiz_generator._is_eligible on the backend, so the count shown
 *  here matches the deck the server actually builds. */
const isEligible = (card: Card, type: QuestionType) =>
  type === 'synonym' ? card.card_type === 'vocab' && card.synonyms.length > 0 : true;

const cardsInPool = (cards: Card[], pool: PracticePool) => {
  if (pool === 'unlearned') {
    return cards.filter((card) => !card.is_learned);
  }

  if (pool === 'learned') {
    return cards.filter((card) => card.is_learned);
  }

  return cards;
};

export default function PracticeSetupModal({
  isOpen,
  sessionId,
  cards,
  onClose,
}: PracticeSetupModalProps) {
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'en_to_vi',
    'vi_to_en',
    'synonym',
  ]);
  const [pool, setPool] = useState<PracticePool>('all');

  // Each open starts from the default pool rather than the last run's.
  useEffect(() => {
    if (isOpen) {
      setPool('all');
    }
  }, [isOpen]);

  const poolCounts = useMemo(
    () => ({
      all: cards.length,
      unlearned: cards.filter((card) => !card.is_learned).length,
      learned: cards.filter((card) => card.is_learned).length,
    }),
    [cards],
  );

  const activeCards = useMemo(() => cardsInPool(cards, pool), [cards, pool]);

  // Whether the synonym type is offerable depends on the chosen pool.
  const hasSynonyms = useMemo(
    () => activeCards.some((card) => isEligible(card, 'synonym')),
    [activeCards],
  );

  // A card joins the run if at least one selected type fits it.
  const questionCount = useMemo(
    () => activeCards.filter((card) => selectedTypes.some((type) => isEligible(card, type))).length,
    [activeCards, selectedTypes],
  );

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );
  };

  const handleStartPractice = () => {
    navigate(`/sessions/${sessionId}/practice`, {
      state: { questionTypes: selectedTypes, pool },
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const canStart = selectedTypes.length > 0 && questionCount > 0;

  const blockedReason =
    selectedTypes.length === 0
      ? 'Pick at least one question type.'
      : questionCount === 0
        ? 'No cards in this pool match the selected question types.'
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 animate-fadeIn">
      <div className="flex max-h-[90vh] w-[90vw] max-w-md flex-col rounded-3xl border border-hairline bg-canvas animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-7 py-6">
          <h2 className="m-0 text-headline-md font-medium text-ink">Quick practice</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-ink transition-colors hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-7">
          {/* Pool Section */}
          <div className="space-y-3">
            <h3 className="text-body-sm font-semibold text-ink">Cards to practice</h3>

            <div className="flex gap-2">
              {POOLS.map((option) => {
                const count = poolCounts[option.value];
                const disabled = count === 0;
                const active = pool === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPool(option.value)}
                    disabled={disabled}
                    className={`flex-1 rounded-lg border px-3 py-2 text-body-sm font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-hairline bg-surface-card text-ink hover:bg-canvas-soft'
                    } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-card`}
                  >
                    <span className="block">{option.label}</span>
                    <span className="block font-mono text-caption text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Types Section */}
          <div className="space-y-4">
            <h3 className="text-body-sm font-semibold text-ink">Question types</h3>

            <div className="space-y-3">
              {/* EN to VI */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes('en_to_vi')}
                  onChange={() => toggleType('en_to_vi')}
                  className="mt-0.5 rounded border border-hairline accent-primary"
                />
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-ink">
                    {QUESTION_TYPE_LABELS.en_to_vi}
                  </div>
                  <div className="text-caption text-muted">Translate English to Vietnamese</div>
                </div>
              </label>

              {/* VI to EN */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes('vi_to_en')}
                  onChange={() => toggleType('vi_to_en')}
                  className="mt-0.5 rounded border border-hairline accent-primary"
                />
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-ink">
                    {QUESTION_TYPE_LABELS.vi_to_en}
                  </div>
                  <div className="text-caption text-muted">Translate Vietnamese to English</div>
                </div>
              </label>

              {/* Synonym */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes('synonym')}
                  onChange={() => toggleType('synonym')}
                  disabled={!hasSynonyms}
                  className="mt-0.5 rounded border border-hairline accent-primary disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-ink">
                    {QUESTION_TYPE_LABELS.synonym}
                  </div>
                  <div className="text-caption text-muted">
                    {hasSynonyms
                      ? 'Find synonyms for words'
                      : 'No cards in this pool have synonyms yet'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Question Count */}
          <div className="rounded-lg bg-surface-card p-4">
            {blockedReason ? (
              <div className="text-body-sm text-muted">{blockedReason}</div>
            ) : (
              <div className="text-body-sm text-ink">
                <span className="font-semibold text-primary">{questionCount}</span> question
                {questionCount !== 1 ? 's' : ''} in this run
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-hairline px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartPractice}
            disabled={!canStart}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            Start practice
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 3: Verify bằng tay — luồng đầy đủ**

Chạy backend + frontend, mở một session có ≥ 4 card trong đó có **cả card đã learned và chưa learned**:

- Bấm "Quick practice" → modal mở, hàng "Cards to practice" hiện 3 nút All / Unlearned / Learned kèm số card; "All" đang active.
- Bấm "Learned" → số ở ô "N questions in this run" đổi thành số card đã learned; bấm "Unlearned" → đổi thành số card chưa learned. Tổng hai con số bằng "All".
- Bấm "Start practice" với pool "Learned" → trang practice có đúng số câu đó, **kể cả khi chỉ có 1–3 câu**, và mỗi câu vẫn có 4 đáp án.
- Làm hết bài → bảng kết quả hiện chip "Learned only".
- "Practice again" → bộ câu mới, vẫn trong pool "Learned".
- Đóng modal rồi mở lại → pool quay về "All".
- Trên một session **chưa learned card nào**: nút "Learned" bị disable (số 0), không bấm được.
- Chọn pool mà mọi card trong đó đều không có synonym → checkbox Synonym bị disable kèm ghi chú "No cards in this pool have synonyms yet". Bỏ tick hết dạng → nút Start disable và ô dưới hiện "Pick at least one question type."
- Kiểm tra không có gì được lưu: reload session detail — số `learned` không đổi, trang `/quizzes` không có quiz nào mới.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/session/PracticeSetupModal.tsx
git commit -m "feat(practice): choose card pool in the practice setup modal"
```

---

## Final Verification

- [ ] `cd backend && .venv/Scripts/python -m pytest -v` — toàn bộ pass
- [ ] `cd frontend && npm run build` — không lỗi
- [ ] `git log --oneline -5` — 5 commit của 5 task
- [ ] `git status` — `frontend/tsconfig.tsbuildinfo` vẫn dirty và **không** nằm trong commit nào: `git log --stat -5 | grep tsbuildinfo` không trả kết quả
- [ ] Không có file nào dưới `backend/alembic/` bị thêm/sửa: `git diff --name-only HEAD~5 -- backend/alembic/` rỗng
- [ ] Không đụng các file bị cấm: `git diff --name-only HEAD~5` không chứa `QuizQuestionView.tsx` hay `SessionDetailPage.tsx`
- [ ] `grep -rn "practice" backend/app/models/` không trả về kết quả nào

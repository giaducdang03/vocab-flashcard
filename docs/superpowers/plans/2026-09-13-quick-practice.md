# Quick Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép user luyện tập nhanh ngay trong một session — mỗi lần bấm sinh ra một bộ câu trắc nghiệm mới từ chính vocab của session đó, chấm điểm tại chỗ, kết thúc hiện bảng thống kê, và **không lưu bất cứ thứ gì xuống database**.

**Architecture:** Toàn bộ việc sinh câu hỏi nằm trong một hàm thuần mới `generate_practice_questions` thêm vào `app/services/quiz_generator.py` — tái dùng `_build_options`, `_prompt_of`, `_is_eligible` đã có của quiz. Một endpoint stateless `POST /sessions/{id}/practice` trả về danh sách câu hỏi **kèm `correct_index`** (khác quiz thật, vì ở đây không có attempt nào để chấm ở server và không có điểm nào để giấu). Frontend thêm một route `/sessions/:id/practice` chấm điểm hoàn toàn ở client, tái dùng `QuizQuestionView` sẵn có, và tự dựng bảng thống kê ở cuối từ mảng câu trả lời trong state.

**Tech Stack:** FastAPI · SQLAlchemy 2.0 async · Pydantic v2 · pytest · React 18 + TypeScript + Vite · react-router-dom · axios · lucide-react · Tailwind

**Spec:** Không có file spec riêng — đây là feature bounded. Phần "Design Summary" ngay dưới đây là spec.

---

## Design Summary

Các quyết định đã chốt với người dùng:

1. **Độ dài bài:** toàn bộ vocab trong session — **mỗi card sinh đúng 1 câu**. 20 card → 20 câu, kể cả khi tick cả 3 dạng.
2. **Dạng câu hỏi:** user tick dạng muốn luyện trong một modal trước khi bắt đầu. Dạng của từng câu được bốc ngẫu nhiên trong phần giao giữa các dạng user tick và các dạng card đó đủ điều kiện.
3. **UI:** route riêng `/sessions/:id/practice`, nút "Quick practice" đặt cạnh "Study deck" trong session detail.
4. **Feedback:** hiện ngay sau mỗi câu (xanh/đỏ), giống trang làm quiz hiện tại.
5. **Không persistence:** không model mới, không migration, không bảng mới, không đụng `Card.is_learned` hay `card_learn_events`.

## Global Constraints

- **Mã dạng câu hỏi** dùng đúng 3 giá trị có sẵn: `en_to_vi`, `vi_to_en`, `synonym`. Không đổi tên, không thêm dạng mới.
- **Không tạo model, không tạo migration, không ghi DB.** Endpoint practice chỉ đọc.
- **Không đụng** `Card.is_learned`, bảng `card_learn_events`, hay bất cứ bảng `quiz*` nào.
- **Mọi endpoint** yêu cầu `current_user: User = Depends(get_current_user)` và lọc theo `user_id`. Không tìm thấy → 404 với `detail="Session not found"` (khớp chính tả sẵn có).
- **Copy hiển thị cho user viết bằng tiếng Anh**, khớp UI hiện tại ("Study deck", "Add card", "Import"). Error `detail` của backend cũng tiếng Anh.
- **Không thêm dependency mới** ở cả frontend lẫn backend.
- **Không sửa** `frontend/src/components/quiz/QuizQuestionView.tsx` — nó được tái dùng nguyên vẹn. Nếu phải sửa nó, dừng lại và báo cáo.
- **Frontend không có test harness.** Lệnh verify của mọi task frontend là `cd frontend && npm run build` (chạy `tsc -b` rồi build).
- **Backend test** chạy bằng `cd backend && .venv/Scripts/python -m pytest` (Windows). `pyproject.toml` đã set `pythonpath = ["."]`.
- **Tuyệt đối không commit** `frontend/tsconfig.tsbuildinfo` (đang dirty sẵn trong working tree). Mỗi lệnh `git add` trong plan này liệt kê file tường minh — dùng đúng danh sách đó, không dùng `git add -A`.

---

### Task 1: `generate_practice_questions` — hàm thuần sinh đề

Thêm một hàm mới vào quiz generator: mỗi card trong pool sinh đúng một câu hỏi, dạng bốc ngẫu nhiên trong các dạng hợp lệ cho card đó.

**Files:**
- Modify: `backend/app/services/quiz_generator.py` (thêm hàm mới vào cuối file, không sửa hàm cũ)
- Create: `backend/tests/test_practice_generator.py`

**Interfaces:**
- Consumes:
  - `app.services.quiz_generator.GeneratedQuestion` (dataclass sẵn có: `card_id`, `question_type`, `prompt_text`, `prompt_phonetic`, `options`, `correct_index`)
  - `app.services.quiz_generator.MIN_POOL_SIZE`, `QUESTION_TYPES`, `_is_eligible`, `_build_options`, `_prompt_of` (sẵn có)
  - `tests.factories.make_card`, `make_pool`, `FakeSynonym` (sẵn có)
- Produces:
  - `app.services.quiz_generator.generate_practice_questions(cards: Sequence[Any], question_types: Sequence[str], rng: Random | None = None) -> list[GeneratedQuestion]`

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/test_practice_generator.py`:

```python
import random

import pytest

from app.services import quiz_generator as qg
from tests.factories import make_card, make_pool


class TestGeneratePracticeQuestions:
    def test_every_card_produces_exactly_one_question(self):
        cards = make_pool(8)

        questions = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en"], rng=random.Random(1)
        )

        assert len(questions) == 8
        assert sorted(q.card_id for q in questions) == sorted(c.id for c in cards)

    def test_question_type_always_comes_from_the_requested_set(self):
        cards = make_pool(10, synonyms_for={0, 1, 2})

        questions = qg.generate_practice_questions(
            cards, ["vi_to_en"], rng=random.Random(2)
        )

        assert {q.question_type for q in questions} == {"vi_to_en"}

    def test_synonym_only_lands_on_vocab_cards_that_have_synonyms(self):
        cards = make_pool(10, synonyms_for={0, 1, 2})
        with_synonyms = {"card-0", "card-1", "card-2"}

        questions = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(3)
        )

        synonym_card_ids = {q.card_id for q in questions if q.question_type == "synonym"}
        assert synonym_card_ids <= with_synonyms

    def test_card_without_synonyms_falls_back_to_another_requested_type(self):
        cards = make_pool(8, synonyms_for={0})

        questions = qg.generate_practice_questions(
            cards, ["synonym", "en_to_vi"], rng=random.Random(4)
        )

        # Cả 8 card đều ra câu: 7 card không synonym rơi về en_to_vi.
        assert len(questions) == 8
        by_id = {q.card_id: q for q in questions}
        assert by_id["card-3"].question_type == "en_to_vi"

    def test_card_eligible_for_nothing_is_skipped(self):
        cards = make_pool(6)
        cards.append(make_card(9, card_type="collocation"))

        questions = qg.generate_practice_questions(
            cards, ["synonym"], rng=random.Random(5)
        )

        assert questions == []

    def test_options_are_four_distinct_values_with_correct_index_pointing_at_answer(self):
        cards = make_pool(8)

        questions = qg.generate_practice_questions(
            cards, ["en_to_vi"], rng=random.Random(6)
        )

        by_id = {q.card_id: q for q in questions}
        for card in cards:
            question = by_id[card.id]
            assert len(question.options) == 4
            assert len(set(question.options)) == 4
            assert question.options[question.correct_index] == card.back_text

    def test_prompt_matches_the_direction_of_the_question_type(self):
        cards = make_pool(8)

        questions = qg.generate_practice_questions(
            cards, ["vi_to_en"], rng=random.Random(7)
        )

        by_id = {q.card_id: q for q in questions}
        assert by_id["card-2"].prompt_text == "nghia2"
        assert by_id["card-2"].prompt_phonetic is None

    def test_same_seed_gives_the_same_deck_and_different_seeds_differ(self):
        cards = make_pool(12, synonyms_for={0, 1, 2, 3})

        first = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(11)
        )
        same = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(11)
        )
        other = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(99)
        )

        signature = lambda deck: [(q.card_id, q.question_type, tuple(q.options)) for q in deck]
        assert signature(first) == signature(same)
        assert signature(first) != signature(other)

    def test_pool_below_minimum_raises(self):
        cards = make_pool(3)

        with pytest.raises(ValueError, match="at least 4 cards"):
            qg.generate_practice_questions(cards, ["en_to_vi"], rng=random.Random(8))

    def test_empty_question_types_raises(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="at least one question type"):
            qg.generate_practice_questions(cards, [], rng=random.Random(9))

    def test_unknown_question_type_raises(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="Unknown question type"):
            qg.generate_practice_questions(cards, ["en_to_fr"], rng=random.Random(10))
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_practice_generator.py -v`
Expected: FAIL — `AttributeError: module 'app.services.quiz_generator' has no attribute 'generate_practice_questions'`

- [ ] **Step 3: Viết implementation tối thiểu**

Thêm vào **cuối** `backend/app/services/quiz_generator.py` (giữ nguyên mọi thứ phía trên):

```python
def generate_practice_questions(
    cards: Sequence[Any],
    question_types: Sequence[str],
    rng: Random | None = None,
) -> list[GeneratedQuestion]:
    """One question per card for a throwaway practice run.

    Unlike `generate_questions`, nothing here is persisted and the caller wants
    the whole session covered, so every card appears exactly once. The question
    type for a card is drawn at random from the requested types that card is
    eligible for — a card with no synonyms simply gets a translation question.

    Raises:
        ValueError: If pool < 4 cards, question_types is empty, or a type is unknown.
    """
    if rng is None:
        rng = Random()

    if len(cards) < MIN_POOL_SIZE:
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
            options_result = _build_options(card, question_type, cards, rng)
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

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_practice_generator.py -v`
Expected: PASS — 11 passed

Rồi chạy toàn bộ để chắc chắn không làm hỏng quiz cũ:

Run: `cd backend && .venv/Scripts/python -m pytest -v`
Expected: PASS — tất cả test cũ trong `tests/test_quiz_generator.py` vẫn xanh

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/quiz_generator.py backend/tests/test_practice_generator.py
git commit -m "feat(practice): add generate_practice_questions to quiz generator"
```

---

### Task 2: Schema + endpoint `POST /sessions/{id}/practice`

Bọc hàm ở Task 1 thành một endpoint stateless. Endpoint đọc card của session (kèm synonym), sinh đề, trả về — không ghi gì.

**Files:**
- Create: `backend/app/schemas/practice.py`
- Modify: `backend/app/routers/sessions.py` (thêm import ở đầu file, thêm endpoint vào cuối file)

**Interfaces:**
- Consumes:
  - `app.services.quiz_generator.generate_practice_questions` (Task 1)
  - `app.services.quiz_generator.MIN_POOL_SIZE`
- Produces:
  - `POST /sessions/{session_id}/practice`, body `PracticeStartRequest`, response `PracticeStartOut`
  - `app.schemas.practice.PracticeStartRequest`, `PracticeQuestionOut`, `PracticeStartOut`

- [ ] **Step 1: Tạo schema**

Tạo `backend/app/schemas/practice.py`:

```python
from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["en_to_vi", "vi_to_en", "synonym"]


class PracticeStartRequest(BaseModel):
    question_types: list[QuestionType] = Field(min_length=1)


class PracticeQuestionOut(BaseModel):
    """Graded on the client, so correct_index ships with the question.

    Nothing about a practice run is stored, so there is no score to protect
    the way there is for a real quiz attempt.
    """

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
    questions: list[PracticeQuestionOut]
```

- [ ] **Step 2: Thêm endpoint**

Trong `backend/app/routers/sessions.py`, thêm 2 dòng import vào khối import sẵn có (sau dòng `from app.schemas.session import ...`):

```python
from app.schemas.practice import PracticeQuestionOut, PracticeStartOut, PracticeStartRequest
from app.services import quiz_generator
```

Rồi thêm vào **cuối file** (sau `delete_session`):

```python
@router.post("/{session_id}/practice", response_model=PracticeStartOut)
async def start_practice(
    session_id: str,
    payload: PracticeStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PracticeStartOut:
    """Generate a throwaway practice deck from this session's cards.

    Stateless on purpose: nothing is written, so every call returns a fresh
    shuffle and there is no attempt to resume.
    """
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.cards).selectinload(Card.synonyms))
        .where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    cards = sorted(session.cards, key=lambda c: (c.position, c.created_at))

    if len(cards) < quiz_generator.MIN_POOL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Need at least {quiz_generator.MIN_POOL_SIZE} cards to practice",
        )

    questions = quiz_generator.generate_practice_questions(cards, payload.question_types)

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough cards for the selected question types",
        )

    return PracticeStartOut(
        session_id=session.id,
        session_title=session.title,
        questions=[
            PracticeQuestionOut(
                card_id=question.card_id,
                question_type=question.question_type,
                prompt_text=question.prompt_text,
                prompt_phonetic=question.prompt_phonetic,
                options=question.options,
                correct_index=question.correct_index,
                position=index,
            )
            for index, question in enumerate(questions)
        ],
    )
```

- [ ] **Step 3: Verify — app import được và route đã đăng ký**

Run:
```bash
cd backend && .venv/Scripts/python -c "from app.main import app; print([r.path for r in app.routes if 'practice' in r.path])"
```
Expected: `['/api/sessions/{session_id}/practice']` (prefix có thể khác tuỳ cách `main.py` gắn router — miễn là in ra đúng một route chứa `practice`, không lỗi import)

- [ ] **Step 4: Verify — test cũ vẫn xanh**

Run: `cd backend && .venv/Scripts/python -m pytest -v`
Expected: PASS — toàn bộ

- [ ] **Step 5: Smoke test bằng tay**

Khởi động backend (`cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload`), mở `http://localhost:8000/docs`, authorize bằng một tài khoản có sẵn, gọi `POST /sessions/{session_id}/practice` với body `{"question_types": ["en_to_vi", "vi_to_en", "synonym"]}` trên một session có ≥ 4 card.
Expected: 200, `questions` dài đúng bằng số card của session, mỗi phần tử có 4 `options` và một `correct_index` trong khoảng 0–3. Gọi lại lần nữa → thứ tự câu và options khác đi.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/practice.py backend/app/routers/sessions.py
git commit -m "feat(practice): add stateless POST /sessions/{id}/practice endpoint"
```

---

### Task 3: Frontend types

Khai báo type cho payload của endpoint mới. Task độc lập nhỏ này để Task 4 và 5 dùng chung không phải chờ nhau.

**Files:**
- Modify: `frontend/src/types/index.ts` (thêm vào cuối file)

**Interfaces:**
- Consumes: `QuestionType` (sẵn có trong cùng file)
- Produces: `PracticeQuestion`, `PracticeStart`, `PracticeAnswer`

- [ ] **Step 1: Thêm type**

Thêm vào cuối `frontend/src/types/index.ts`:

```ts
export type PracticeQuestion = {
  card_id: string;
  question_type: QuestionType;
  prompt_text: string;
  prompt_phonetic?: string | null;
  options: string[];
  correct_index: number;
  position: number;
};

export type PracticeStart = {
  session_id: string;
  session_title: string;
  questions: PracticeQuestion[];
};

/** One answered question, kept in client state only — never sent to the server. */
export type PracticeAnswer = {
  question: PracticeQuestion;
  selected_index: number;
  is_correct: boolean;
};
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không có lỗi TypeScript

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(practice): add practice types"
```

---

### Task 4: `PracticeSummary` — bảng thống kê cuối bài

Component thuần (không gọi API) nhận mảng câu trả lời và render kết quả. Làm trước Task 5 để trang practice có sẵn thứ nó cần import.

**Files:**
- Create: `frontend/src/components/session/PracticeSummary.tsx`

**Interfaces:**
- Consumes: `PracticeAnswer`, `QuestionType`, `QUESTION_TYPE_LABELS` (Task 3 + sẵn có)
- Produces: `export default function PracticeSummary(props: PracticeSummaryProps)` với
  `{ answers: PracticeAnswer[]; durationSeconds: number; sessionId: string; sessionTitle: string; onRestart: () => void }`

- [ ] **Step 1: Viết component**

Tạo `frontend/src/components/session/PracticeSummary.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { PracticeAnswer, QuestionType } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type PracticeSummaryProps = {
  answers: PracticeAnswer[];
  durationSeconds: number;
  sessionId: string;
  sessionTitle: string;
  onRestart: () => void;
};

const QUESTION_TYPES: QuestionType[] = ['en_to_vi', 'vi_to_en', 'synonym'];

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

export default function PracticeSummary({
  answers,
  durationSeconds,
  sessionId,
  sessionTitle,
  onRestart,
}: PracticeSummaryProps) {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.is_correct).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const wrong = answers.filter((answer) => !answer.is_correct);

  const breakdown = QUESTION_TYPES.map((type) => {
    const forType = answers.filter((answer) => answer.question.question_type === type);
    return {
      type,
      total: forType.length,
      correct: forType.filter((answer) => answer.is_correct).length,
    };
  }).filter((row) => row.total > 0);

  return (
    <div className="page-shell">
      <main className="page-container compact">
        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
            Practice complete
          </span>

          <h1 className="mb-0 mt-4 text-headline-lg font-medium tracking-tight text-ink">
            {sessionTitle}
          </h1>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <div className="font-mono text-headline-lg font-semibold text-ink">
                {correct}/{total}
              </div>
              <div className="text-body-sm text-muted">Correct answers</div>
            </div>
            <div>
              <div className="font-mono text-headline-lg font-semibold text-primary">{percent}%</div>
              <div className="text-body-sm text-muted">Accuracy</div>
            </div>
            <div>
              <div className="font-mono text-headline-lg font-semibold text-ink">
                {formatDuration(durationSeconds)}
              </div>
              <div className="text-body-sm text-muted">Time spent</div>
            </div>
          </div>

          <div className="mt-6 flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent < 33 ? 'bg-error' : percent < 67 ? 'bg-primary' : 'bg-success'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              <RotateCcw size={18} />
              Practice again
            </button>
            <Link
              to={`/sessions/${sessionId}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
            >
              <ArrowLeft size={18} className="text-muted" />
              Back to session
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <h2 className="m-0 text-headline-md font-medium text-ink">By question type</h2>
          <div className="mt-4 space-y-3">
            {breakdown.map((row) => {
              const rowPercent = Math.round((row.correct / row.total) * 100);
              return (
                <div key={row.type}>
                  <div className="mb-1.5 flex items-center justify-between text-body-sm">
                    <span className="font-medium text-ink">{QUESTION_TYPE_LABELS[row.type]}</span>
                    <span className="font-mono text-code-sm text-body">
                      <strong className="font-semibold text-ink">{row.correct}</strong>/{row.total} ({rowPercent}%)
                    </span>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${rowPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <h2 className="m-0 text-headline-md font-medium text-ink">
            {wrong.length > 0 ? `Review ${wrong.length} missed` : 'Nothing missed'}
          </h2>

          {wrong.length === 0 ? (
            <p className="mb-0 mt-3 text-body-sm text-muted">
              A clean run — every answer was correct.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-4 p-0">
              {wrong.map((answer) => (
                <li
                  key={answer.question.card_id}
                  className="rounded-lg border border-hairline bg-canvas-soft p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-hairline-soft px-2 py-0.5 text-caption-uppercase font-bold uppercase tracking-wider text-muted">
                      {QUESTION_TYPE_LABELS[answer.question.question_type]}
                    </span>
                    <span className="text-body-sm font-medium text-ink">
                      {answer.question.prompt_text}
                    </span>
                  </div>
                  <div className="space-y-1 text-body-sm">
                    <div className="text-error">
                      You chose: {answer.question.options[answer.selected_index]}
                    </div>
                    <div className="text-success">
                      Correct: {answer.question.options[answer.question.correct_index]}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không có lỗi TypeScript

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/session/PracticeSummary.tsx
git commit -m "feat(practice): add practice summary component"
```

---

### Task 5: `PracticePage` + route

Trang làm bài: gọi API lúc mount, chấm điểm ở client, hết câu thì đổi sang `PracticeSummary`.

**Files:**
- Create: `frontend/src/pages/PracticePage.tsx`
- Modify: `frontend/src/App.tsx` (thêm import + một `<Route>`)

**Interfaces:**
- Consumes:
  - `POST /sessions/{id}/practice` (Task 2)
  - `PracticeStart`, `PracticeQuestion`, `PracticeAnswer` (Task 3)
  - `PracticeSummary` (Task 4)
  - `QuizQuestionView` (sẵn có, **không sửa**), `PageHeader` (sẵn có)
  - `location.state` hình dạng `{ questionTypes?: QuestionType[] }` do Task 6 truyền vào
- Produces: route `/sessions/:id/practice`

- [ ] **Step 1: Viết trang**

Tạo `frontend/src/pages/PracticePage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import QuizQuestionView from '../components/quiz/QuizQuestionView';
import PracticeSummary from '../components/session/PracticeSummary';
import type {
  AnswerResult,
  PracticeAnswer,
  PracticeStart,
  QuestionType,
  QuizQuestion,
} from '../types';

const ALL_TYPES: QuestionType[] = ['en_to_vi', 'vi_to_en', 'synonym'];

export default function PracticePage() {
  const { id } = useParams();
  const location = useLocation();

  // Types come from the setup modal; a direct visit falls back to all three.
  const stateTypes = (location.state as { questionTypes?: QuestionType[] } | null)?.questionTypes;
  const questionTypes = stateTypes && stateTypes.length > 0 ? stateTypes : ALL_TYPES;

  const [deck, setDeck] = useState<PracticeStart | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeck = async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post<PracticeStart>(`/sessions/${id}/practice`, {
        question_types: questionTypes,
      });
      setDeck(response.data);
      setCurrentIndex(0);
      setSelectedIndex(null);
      setAnswers([]);
      setFinished(false);
      setDurationSeconds(0);
      setStartedAt(Date.now());
    } catch (err) {
      console.error('Failed to start practice:', err);
      setError('Could not build a practice set for this session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDeck();
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentIndex, finished]);

  const currentAnswer =
    deck && answers.find((answer) => answer.question.card_id === deck.questions[currentIndex]?.card_id);

  // Graded here on the client — practice runs are never sent back to the server.
  const result: AnswerResult | null = currentAnswer
    ? { is_correct: currentAnswer.is_correct, correct_index: currentAnswer.question.correct_index }
    : null;

  const handleSelect = (optionIndex: number) => {
    if (!deck || result) {
      return;
    }

    const question = deck.questions[currentIndex];
    setSelectedIndex(optionIndex);
    setAnswers((current) => [
      ...current,
      {
        question,
        selected_index: optionIndex,
        is_correct: optionIndex === question.correct_index,
      },
    ]);
  };

  const handleNext = () => {
    if (!deck) {
      return;
    }

    if (currentIndex === deck.questions.length - 1) {
      setDurationSeconds(Math.round((Date.now() - startedAt) / 1000));
      setFinished(true);
      return;
    }

    setCurrentIndex(currentIndex + 1);
    setSelectedIndex(null);
  };

  if (loading) {
    return <div className="app-shell center-block">Building practice set…</div>;
  }

  if (error || !deck || deck.questions.length === 0) {
    return (
      <div className="page-shell">
        <PageHeader />
        <div className="page-toolbar flex items-center border-b border-hairline">
          <Link
            to={`/sessions/${id}`}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={16} />
            Back to session
          </Link>
        </div>

        <main className="page-container">
          <div className="empty-state">
            <h3>Practice unavailable</h3>
            <p>{error || 'This session does not have enough cards for the selected question types.'}</p>
          </div>
        </main>
      </div>
    );
  }

  if (finished) {
    return (
      <>
        <PageHeader />
        <PracticeSummary
          answers={answers}
          durationSeconds={durationSeconds}
          sessionId={id || ''}
          sessionTitle={deck.session_title}
          onRestart={() => void fetchDeck()}
        />
      </>
    );
  }

  const question = deck.questions[currentIndex];

  // QuizQuestionView is shared with the real quiz flow, which keys on `id` and
  // never sees correct_index — map into its shape rather than changing it.
  const viewQuestion: QuizQuestion = {
    id: question.card_id,
    question_type: question.question_type,
    prompt_text: question.prompt_text,
    prompt_phonetic: question.prompt_phonetic,
    options: question.options,
    position: question.position,
  };

  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--canvas)' }}>
        <PageHeader />
        <div className="page-toolbar flex items-center border-b border-hairline">
          <Link
            to={`/sessions/${id}`}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={16} />
            {deck.session_title}
          </Link>
        </div>
      </div>

      <QuizQuestionView
        question={viewQuestion}
        index={currentIndex}
        total={deck.questions.length}
        result={result}
        isChecking={false}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        onNext={handleNext}
        isLast={currentIndex === deck.questions.length - 1}
      />
    </>
  );
}
```

- [ ] **Step 2: Đăng ký route**

Trong `frontend/src/App.tsx`, thêm import cạnh các import page khác:

```tsx
import PracticePage from './pages/PracticePage';
```

Và thêm `<Route>` ngay sau route `/sessions/:id/study`:

```tsx
      <Route
        path="/sessions/:id/practice"
        element={
          <ProtectedRoute>
            <PracticePage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không có lỗi TypeScript

- [ ] **Step 4: Verify bằng tay**

Chạy backend + `cd frontend && npm run dev`, đăng nhập, mở thẳng `http://localhost:5173/sessions/<id>/practice` cho một session có ≥ 4 card.
Expected: câu hỏi hiện ra, chọn đáp án → tô xanh/đỏ ngay, bấm Next chạy hết bài, câu cuối bấm "Finish quiz" → hiện bảng thống kê. Bấm "Practice again" → bộ câu mới. Refresh trang → bộ câu mới, không có tiến độ cũ nào được khôi phục (đúng như thiết kế: không lưu DB).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PracticePage.tsx frontend/src/App.tsx
git commit -m "feat(practice): add practice page and route"
```

---

### Task 6: `PracticeSetupModal` + nút trong session detail

Điểm vào của feature: nút "Quick practice" mở modal tick dạng câu hỏi, rồi điều hướng sang trang practice.

**Files:**
- Create: `frontend/src/components/session/PracticeSetupModal.tsx`
- Modify: `frontend/src/pages/SessionDetailPage.tsx`

**Interfaces:**
- Consumes: `Card`, `QuestionType`, `QUESTION_TYPE_LABELS` (sẵn có); route `/sessions/:id/practice` (Task 5)
- Produces: `export default function PracticeSetupModal(props)` với
  `{ isOpen: boolean; sessionId: string; cards: Card[]; onClose: () => void }`

- [ ] **Step 1: Viết modal**

Tạo `frontend/src/components/session/PracticeSetupModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Card, QuestionType } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type PracticeSetupModalProps = {
  isOpen: boolean;
  sessionId: string;
  cards: Card[];
  onClose: () => void;
};

const QUESTION_TYPES: QuestionType[] = ['en_to_vi', 'vi_to_en', 'synonym'];

const TYPE_HINTS: Record<QuestionType, string> = {
  en_to_vi: 'Show the English word, pick the Vietnamese meaning.',
  vi_to_en: 'Show the Vietnamese meaning, pick the English word.',
  synonym: 'Show the word, pick one of its synonyms.',
};

/** Mirrors the backend eligibility rule in quiz_generator._is_eligible. */
const isEligible = (card: Card, type: QuestionType) =>
  type === 'synonym' ? card.card_type === 'vocab' && card.synonyms.length > 0 : true;

export default function PracticeSetupModal({
  isOpen,
  sessionId,
  cards,
  onClose,
}: PracticeSetupModalProps) {
  const navigate = useNavigate();
  const [types, setTypes] = useState<QuestionType[]>(QUESTION_TYPES);

  const synonymAvailable = cards.some((card) => isEligible(card, 'synonym'));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTypes(synonymAvailable ? QUESTION_TYPES : ['en_to_vi', 'vi_to_en']);
  }, [isOpen, synonymAvailable]);

  if (!isOpen) {
    return null;
  }

  const toggleType = (type: QuestionType) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  // A card joins the run if at least one selected type fits it.
  const questionCount = cards.filter((card) => types.some((type) => isEligible(card, type))).length;

  const handleStart = () => {
    navigate(`/sessions/${sessionId}/practice`, { state: { questionTypes: types } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 animate-fadeIn">
      <div className="flex max-h-[90vh] w-[90vw] max-w-md flex-col rounded-3xl border border-hairline bg-canvas animate-slideUp">
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-7 py-7">
          <p className="m-0 text-body-sm text-muted">
            Every card in this session gets one question. Nothing is saved — each run is a fresh
            shuffle.
          </p>

          <div className="space-y-2.5">
            {QUESTION_TYPES.map((type) => {
              const disabled = type === 'synonym' && !synonymAvailable;
              const checked = types.includes(type);

              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    disabled
                      ? 'cursor-not-allowed border-hairline opacity-50'
                      : checked
                        ? 'border-primary bg-primary/5'
                        : 'border-hairline bg-surface-card hover:bg-canvas-soft'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleType(type)}
                    className="mt-1"
                  />
                  <span className="space-y-1">
                    <span className="block text-body-sm font-semibold text-ink">
                      {QUESTION_TYPE_LABELS[type]}
                    </span>
                    <span className="block text-body-sm text-muted">
                      {disabled ? 'No cards in this session have synonyms yet.' : TYPE_HINTS[type]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="rounded-xl border border-hairline bg-surface-card px-4 py-3 text-body-sm text-body">
            {types.length === 0 ? (
              <span className="text-muted">Pick at least one question type.</span>
            ) : (
              <span className="font-mono text-code-sm">
                <strong className="font-semibold text-ink">{questionCount}</strong> questions in this
                run
              </span>
            )}
          </div>
        </div>

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
            onClick={handleStart}
            disabled={types.length === 0 || questionCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            <Zap size={16} />
            Start practice
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Nối vào session detail**

Trong `frontend/src/pages/SessionDetailPage.tsx`:

a) Thêm `Zap` vào import lucide có sẵn ở dòng 2 — thành:

```tsx
import { ArrowLeft, BookOpen, Download, Plus, ShieldCheck, Table, Upload, Zap } from 'lucide-react';
```

b) Thêm import component cạnh `AddCardModal`:

```tsx
import PracticeSetupModal from '../components/session/PracticeSetupModal';
```

c) Thêm state cạnh `const [showImport, setShowImport] = useState(false);`:

```tsx
  const [showPractice, setShowPractice] = useState(false);
```

d) Thêm nút ngay **sau** khối `{cards.length > 0 && (<Link ... Study deck</Link>)}` trong hàng action:

```tsx
              {cards.length >= 4 && (
                <button
                  type="button"
                  onClick={() => setShowPractice(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
                >
                  <Zap size={18} className="text-secondary" />
                  Quick practice
                </button>
              )}
```

e) Render modal cạnh các modal khác ở cuối JSX (nơi `<AddCardModal .../>` và `<ImportModal .../>` đang được render):

```tsx
      <PracticeSetupModal
        isOpen={showPractice}
        sessionId={id || ''}
        cards={cards}
        onClose={() => setShowPractice(false)}
      />
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build thành công, không có lỗi TypeScript

- [ ] **Step 4: Verify bằng tay — luồng đầy đủ**

Chạy backend + frontend, mở một session có ≥ 4 card:
- Nút "Quick practice" hiện cạnh "Study deck". Với session < 4 card, nút không hiện.
- Bấm nút → modal mở, cả 3 dạng được tick sẵn (Synonym bị disable + ghi chú nếu session không có synonym nào).
- Bỏ tick hết → nút Start bị disable.
- Bấm "Start practice" → sang trang practice, tổng số câu khớp con số modal hiển thị.
- Làm hết bài → bảng thống kê hiện điểm, %, thời gian, breakdown theo dạng, và danh sách câu sai.
- "Practice again" → bộ câu mới; "Back to session" → quay lại session detail.
- Kiểm tra không có gì được lưu: sau khi làm xong, reload session detail — `learned` count không đổi, trang `/quizzes` không có quiz nào mới.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/session/PracticeSetupModal.tsx frontend/src/pages/SessionDetailPage.tsx
git commit -m "feat(practice): add practice setup modal and session entry point"
```

---

## Final Verification

- [ ] `cd backend && .venv/Scripts/python -m pytest -v` — toàn bộ pass
- [ ] `cd frontend && npm run build` — không lỗi
- [ ] `git status` — chỉ còn `frontend/tsconfig.tsbuildinfo` dirty (đã dirty từ trước, không commit)
- [ ] `git log --oneline -6` — 6 commit của 6 task
- [ ] Không có file nào dưới `backend/alembic/` bị thêm/sửa
- [ ] `grep -rn "practice" backend/app/models/` không trả về kết quả nào

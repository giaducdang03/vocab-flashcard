# Quiz List & Practice Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Quiz List page's quiz cards and the Practice/Take-Quiz question screen to match two reference screenshots, with no backend or data-model changes.

**Architecture:** Pure CSS + JSX markup changes across three existing components (`QuizCard.tsx`, `QuizQuestionView.tsx`, `TakeQuizPage.tsx`) plus new utility classes in `index.css`. No new state, no new API calls, no new dependencies.

**Tech Stack:** React + TypeScript, plain CSS (`index.css`) with a few Tailwind utility classes inline, `lucide-react` icons.

**Spec:** This plan was approved directly in chat during a bounded-path brainstorming session (no separate spec file was written — see conversation history dated 2026-09-13 for the approved design and the three user decisions below).

## Global Constraints

- No speaker/pronunciation icon on the practice question screen — user explicitly said this isn't needed.
- Quiz-card badges keep their existing per-type color-coding (blue = en_to_vi, purple = vi_to_en, orange = synonym) — do not recolor to a single mint-green pill. Only adjust sizing/spacing.
- The practice screen's progress indicator keeps its visual bar; add "N% completed" text next to the "Question X of Y" label rather than replacing the bar with text-only.
- No backend/API changes, no new npm packages.
- Follow existing design tokens already defined in `frontend/src/index.css` (`--primary`, `--ink`, `--body`, `--muted`, `--hairline`, `--surface-strong`, `--success`, `--error`) — do not introduce new hardcoded colors.

---

## File Structure

- Modify: `frontend/src/index.css` — add `.quiz-stat-box` / `.quiz-stat` / `.quiz-stat-label` / `.quiz-stat-value` classes for the card's stat row; add `.option-letter` / `.option-check` classes and change `.option-list` to a single column; add `.progress-box-header` / `.progress-percent` classes.
- Modify: `frontend/src/components/quiz/QuizCard.tsx` — replace the inline meta-row `<div>` with the new stat-box markup; add a trailing arrow icon to the "Open quiz" button.
- Modify: `frontend/src/components/quiz/QuizQuestionView.tsx` — add percentage text to the progress row; restructure each option `<button>` to show a lettered badge (A/B/C/D) and a checkmark icon on the correct answer once a result exists.
- Modify: `frontend/src/pages/TakeQuizPage.tsx` — change the breadcrumb link text from `{attempt.quiz_title}` alone to `Exit | {attempt.quiz_title}`.

No files are created; no files are deleted.

---

## Task 1: Quiz card stat box + button arrow

**Files:**
- Modify: `frontend/src/index.css` (append new rules near the existing `.session-grid` / `.badge` block, e.g. after line 342)
- Modify: `frontend/src/components/quiz/QuizCard.tsx`

**Interfaces:**
- Consumes: `quiz.question_count`, `quiz.attempt_count`, `quiz.best_score` (all already present on the `Quiz` type used by `QuizCard`, no type changes needed).
- Produces: no new exports — this is a leaf UI component.

- [ ] **Step 1: Add stat-box CSS**

Add this block to `frontend/src/index.css` immediately after the `.session-card-actions` rule (around line 342):

```css
.quiz-stat-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--hairline);
  border-radius: 12px;
  overflow: hidden;
}

.quiz-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 8px;
  text-align: center;
}

.quiz-stat:not(:last-child) {
  border-right: 1px solid var(--hairline);
}

.quiz-stat-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.quiz-stat-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
```

- [ ] **Step 2: Replace the meta row in `QuizCard.tsx`**

In `frontend/src/components/quiz/QuizCard.tsx`, replace this block:

```tsx
      {/* Meta row: question count, attempts, best score */}
      <div className="flex justify-between gap-2 text-sm text-body">
        <span>{quiz.question_count} questions</span>
        <span>{quiz.attempt_count} attempts</span>
        <span>
          Best:{' '}
          {quiz.best_score !== null ? `${quiz.best_score}/${quiz.question_count}` : '—'}
        </span>
      </div>
```

with:

```tsx
      {/* Meta row: question count, attempts, best score */}
      <div className="quiz-stat-box">
        <div className="quiz-stat">
          <span className="quiz-stat-label">Questions</span>
          <span className="quiz-stat-value">{quiz.question_count}</span>
        </div>
        <div className="quiz-stat">
          <span className="quiz-stat-label">Attempts</span>
          <span className="quiz-stat-value">{quiz.attempt_count}</span>
        </div>
        <div className="quiz-stat">
          <span className="quiz-stat-label">Best</span>
          <span className="quiz-stat-value">
            {quiz.best_score !== null ? `${quiz.best_score}/${quiz.question_count}` : '—'}
          </span>
        </div>
      </div>
```

- [ ] **Step 3: Add an arrow icon to the "Open quiz" button**

In the same file, the import line currently reads:

```tsx
import { Trash2 } from 'lucide-react';
```

Change it to:

```tsx
import { ArrowRight, Trash2 } from 'lucide-react';
```

Then replace the button:

```tsx
      <button
        type="button"
        onClick={onOpen}
        className="w-full px-4 py-2 bg-primary text-white border border-primary rounded-lg hover:bg-primary-active font-semibold text-sm transition-all"
      >
        Open quiz
      </button>
```

with:

```tsx
      <button
        type="button"
        onClick={onOpen}
        className="w-full px-4 py-2 bg-primary text-white border border-primary rounded-lg hover:bg-primary-active font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        Open quiz
        <ArrowRight size={15} />
      </button>
```

- [ ] **Step 4: Visual check**

Run: `cd frontend && npm run dev`
Open the Quizzes page in a browser and confirm each card shows a 3-column bordered stat box (Questions / Attempts / Best) with uppercase gray labels and bold values, and the "Open quiz" button shows a trailing arrow.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/components/quiz/QuizCard.tsx
git commit -m "style(quiz): restyle quiz card stat row as bordered stat box"
```

---

## Task 2: Practice screen progress percentage

**Files:**
- Modify: `frontend/src/index.css` (append near the existing `.progress-box` rule, around line 528)
- Modify: `frontend/src/components/quiz/QuizQuestionView.tsx`

**Interfaces:**
- Consumes: `index` and `total` props already passed into `QuizQuestionView` (no signature change).
- Produces: no new exports.

- [ ] **Step 1: Add CSS for the progress header row**

Add this block to `frontend/src/index.css` immediately after the `.progress-box span` rule (around line 528):

```css
.progress-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.progress-percent {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
```

- [ ] **Step 2: Update the progress box markup in `QuizQuestionView.tsx`**

Replace:

```tsx
        {/* Progress box */}
        <div className="progress-box">
          <span>
            Question {index + 1} of {total}
          </span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
```

with:

```tsx
        {/* Progress box */}
        <div className="progress-box">
          <div className="progress-box-header">
            <span>
              Question {index + 1} of {total}
            </span>
            <span className="progress-percent">{Math.round(progressPercent)}% completed</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
```

(`progressPercent` is already computed above in the component — no change needed there.)

- [ ] **Step 3: Visual check**

Run: `cd frontend && npm run dev`
Start a quiz attempt and confirm the progress row shows "Question X of Y" on the left and "N% completed" on the right, with the bar still visible underneath.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/quiz/QuizQuestionView.tsx
git commit -m "style(quiz): show percent-complete text alongside progress bar"
```

---

## Task 3: Single-column lettered option list

**Files:**
- Modify: `frontend/src/index.css` (modify existing `.option-list` rule around line 839; add new rules after `.option-button.wrong`, around line 888)
- Modify: `frontend/src/components/quiz/QuizQuestionView.tsx`

**Interfaces:**
- Consumes: `question.options: string[]`, `result: AnswerResult | null` (`result.correct_index: number`, `result.is_correct: boolean`), `selectedIndex: number | null` — all already existing props/fields, no type changes.
- Produces: no new exports.

- [ ] **Step 1: Update `.option-list` to a single column**

In `frontend/src/index.css`, replace:

```css
.option-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

with:

```css
.option-list {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}
```

- [ ] **Step 2: Add letter-badge and check-icon CSS**

Add this block to `frontend/src/index.css` immediately after the existing `.option-button.wrong` rule (around line 888):

```css
.option-button {
  justify-content: flex-start;
  text-align: left;
  gap: 12px;
}

.option-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--surface-strong);
  color: var(--body);
  font-size: 13px;
  font-weight: 700;
}

.option-button.correct .option-letter {
  background: var(--success);
  color: #fff;
}

.option-button.wrong .option-letter {
  background: var(--error);
  color: #fff;
}

.option-check {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--success);
}
```

Note: `.option-button` already has a `justify-content: center` declaration earlier in the file (around line 848) — the new rule above must come *after* it in the file so the override wins (CSS is edited top-to-bottom in this codebase's single `index.css`, so appending at the end of the option-button rules, as instructed, is sufficient).

- [ ] **Step 3: Restructure the option buttons in `QuizQuestionView.tsx`**

Add `Check` to the icon import. Change:

```tsx
import type { AnswerResult, QuizQuestion } from '../../types';
```

Add above it:

```tsx
import { Check } from 'lucide-react';
```

Then replace the options-rendering block:

```tsx
        {/* Options list */}
        <section className="option-list">
          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              type="button"
              className={getOptionButtonClass(optionIndex)}
              onClick={() => onSelect(optionIndex)}
              disabled={isChecking || hasResult}
            >
              {option}
            </button>
          ))}
        </section>
```

with:

```tsx
        {/* Options list */}
        <section className="option-list">
          {question.options.map((option, optionIndex) => {
            const letter = String.fromCharCode(65 + optionIndex);
            const isCorrectOption = hasResult && optionIndex === result.correct_index;

            return (
              <button
                key={optionIndex}
                type="button"
                className={getOptionButtonClass(optionIndex)}
                onClick={() => onSelect(optionIndex)}
                disabled={isChecking || hasResult}
              >
                <span className="option-letter">{letter}</span>
                {option}
                {isCorrectOption && <Check size={18} className="option-check" />}
              </button>
            );
          })}
        </section>
```

- [ ] **Step 4: Visual check**

Run: `cd frontend && npm run dev`
Start a quiz attempt and confirm: options render as a single-column stacked list, each with a lettered circle badge (A, B, C, D) on the left; after selecting an answer, the correct option turns green with a checkmark on the right and (if wrong) the selected wrong option turns red.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/components/quiz/QuizQuestionView.tsx
git commit -m "style(quiz): switch answer options to single-column lettered list"
```

---

## Task 4: Breadcrumb text update

**Files:**
- Modify: `frontend/src/pages/TakeQuizPage.tsx`

**Interfaces:**
- Consumes: `attempt.quiz_title: string` (already on `AttemptStart` type, no change).
- Produces: no new exports.

- [ ] **Step 1: Update the breadcrumb link content**

In `frontend/src/pages/TakeQuizPage.tsx`, replace:

```tsx
          <Link to={`/quizzes/${id}`} className="inline-link">
            <ArrowLeft size={16} />
            {attempt.quiz_title}
          </Link>
```

with:

```tsx
          <Link to={`/quizzes/${id}`} className="inline-link">
            <ArrowLeft size={16} />
            Exit | {attempt.quiz_title}
          </Link>
```

- [ ] **Step 2: Visual check**

Run: `cd frontend && npm run dev`
Start a quiz attempt and confirm the top breadcrumb reads "← Exit | <quiz title>" and still navigates back to the quiz detail page when clicked.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TakeQuizPage.tsx
git commit -m "style(quiz): update practice breadcrumb to 'Exit | title' format"
```

---

## Final Verification

- [ ] **Step 1: Full manual pass**

Run: `cd frontend && npm run dev`
Walk through: Quizzes page (cards match the stat-box + arrow layout) → open a quiz → answer at least 2 questions, including one wrong answer, to confirm both the correct (green + check) and wrong (red) option states render correctly in the new single-column layout → finish the quiz to confirm nothing downstream (attempt summary page) broke.

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new type errors introduced by these changes.

- [ ] **Step 3: Commit any final fixups**

If the manual pass surfaces small issues, fix them and commit with a descriptive message following the same `style(quiz): ...` convention used above.

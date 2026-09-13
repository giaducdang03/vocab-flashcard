# Task 1: Quiz card stat box + button arrow

## Context
This is part of a redesign of the Quiz List page and Practice/Take-Quiz screens to match two reference screenshots. This task focuses on styling the quiz cards on the Quizzes page.

## Requirements

### Files to modify:
- `frontend/src/index.css` — add stat-box CSS classes
- `frontend/src/components/quiz/QuizCard.tsx` — update markup and imports

### Step 1: Add stat-box CSS

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

### Step 2: Update imports in QuizCard.tsx

Change the import line from:
```tsx
import { Trash2 } from 'lucide-react';
```
to:
```tsx
import { ArrowRight, Trash2 } from 'lucide-react';
```

### Step 3: Replace the meta row

In `frontend/src/components/quiz/QuizCard.tsx`, find and replace this block:

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

### Step 4: Add arrow icon to button

In the same file, find the "Open quiz" button and replace it:

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

## Constraints
- Do not introduce new colors—use existing design tokens: `--primary`, `--ink`, `--body`, `--muted`, `--hairline`, `--surface-strong`
- No new npm packages
- No backend/API changes
- The quiz card should still use `QuestionTypeBadges` component with its existing blue/purple/orange colors; do not change badge colors

## Testing
After making changes:
1. Run `cd frontend && npm run dev`
2. Navigate to the Quizzes page
3. Verify each quiz card shows:
   - A 3-column bordered stat box with uppercase gray labels (Questions/Attempts/Best) and bold values
   - The "Open quiz" button has a trailing arrow icon

## Success Criteria
- CSS added without errors
- Quiz card displays stat box correctly (3 columns, borders, labels uppercase)
- "Open quiz" button shows arrow icon
- Type check passes: `npx tsc --noEmit` in frontend directory
- Code is committed with message: `style(quiz): restyle quiz card stat row as bordered stat box`

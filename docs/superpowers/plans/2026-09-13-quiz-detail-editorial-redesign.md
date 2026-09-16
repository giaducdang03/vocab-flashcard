# Quiz Detail "Editorial Focus" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the quiz detail page (`/quizzes/:id`) to the "Editorial Focus" design system: an editorial hero, a four-card stat strip, an attempt-history list (replacing the raw HTML table), and a mastery-trajectory insight card.

**Architecture:** No backend changes. `GET /quizzes/{id}` already returns `{ quiz, attempts }`, and every number the mock shows — average score, best score, net accuracy gain, pace improvement — is derived client-side from the `attempts` array. The derivation is extracted into one pure module (`utils/quizStats.ts`) so the stat strip and the trajectory card cannot drift apart, then consumed by three presentational components wired into a rewritten `QuizDetailPage.tsx`.[text](vscode-webview://0uieo6u746vqo7dlhg45tveenpjrq3hr596u647flfithlav58nn/docs/superpowers/plans/2026-09-13-quiz-detail-editorial-redesign.md)

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Tailwind 3.4, react-router-dom 6, lucide-react, axios. No test framework in this repo — the verification gate for every task is `cd frontend && npm run build` (which runs `tsc -b`) plus the manual browser checks written into each task.

**Spec:** `frontend/docs/quizzes_detail/DESIGN (2).md` (tokens + rules), `frontend/docs/quizzes_detail/code (2).html` (reference markup), `frontend/docs/quizzes_detail/screen (2).png` (visual target). Deliberate divergences are listed under "Known Deviations from the Mock" at the end.

## Global Constraints

- **No backend changes.** No new API fields, no migration. Every displayed number comes from `quiz.question_count` or the `attempts` array already in the response.
- **No invented data.** The mock's quiz description paragraph and its `ID: QZ-8821A` chip are **dropped entirely** (decision confirmed with the user) — `Quiz` has no description field and no short code. Do not substitute a truncated UUID.
- **Existing colour tokens are frozen.** `primary` stays `#a83300`. Only four tokens are new, with these exact values: `muted-soft: '#a09c92'`, `hairline-strong: '#cfcdc4'`, `secondary-fixed: '#94f6ca'`, `primary-fixed: '#ffdbd0'`.
  - Note: `hairline-strong: '#cfcdc4'` and `learned-surface: '#ebf6f1'` may already be present in `tailwind.config.js` from earlier redesigns. Adding an existing key twice is a silent override — check before adding and only add the genuinely missing ones.
- **No CSS deletions.** `hero-card`, `section-header`, `eyebrow`, `inline-link`, `empty-state`, `page-shell` and `page-container` in `frontend/src/index.css` are all still used by `AttemptReviewPage.tsx`, `QuizzesPage.tsx`, `AuthPage.tsx`, `PracticePage.tsx` and others. This plan stops using some of them on this one page; it must not remove any rule from `index.css`.
- **Icons:** `lucide-react` only (already a dependency). The mock's Material Symbols are not available in this app.
- **Radii/depth:** interactive controls `rounded-lg`, cards `rounded-xl`, pills/badges `rounded-full`; depth via `border border-hairline` on `bg-surface-card` over `bg-canvas`. No drop shadows.
- **Score-tint threshold:** a percentage of **80 or above** gets the emerald treatment (`bg-learned-surface text-secondary border-secondary-fixed`); below 80 gets the neutral treatment (`bg-hairline-soft text-body border-hairline`). This one number is used in two components — it lives in `utils/quizStats.ts` as `isStrongScore`, never re-typed inline.
- **Attempt numbering:** attempts are numbered chronologically from oldest (`#1`) and displayed newest-first, so the top row of a 3-attempt quiz is `#3`.
- Verification gate for every task: `cd frontend && npm run build` must exit 0.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `frontend/tailwind.config.js` | Add the missing colour tokens | 1 |
| `frontend/src/utils/quizStats.ts` | **New.** Pure derivation: percent, best, average, trajectory, sort, formatting | 2 |
| `frontend/src/components/quiz/QuizStatCards.tsx` | **New.** The four-card stat strip | 3 |
| `frontend/src/components/quiz/AttemptHistory.tsx` | Rewritten: table → list rows in a bordered card | 4 |
| `frontend/src/components/quiz/MasteryTrajectory.tsx` | **New.** Progress insight card | 5 |
| `frontend/src/pages/QuizDetailPage.tsx` | Rewritten: hero + assembly of the above | 6 |

Dependency order is strict: Task 2 produces the module Tasks 3–5 consume; Task 6 assembles all of them.

---

### Task 1: Add the missing design tokens

**Files:**
- Modify: `frontend/tailwind.config.js` (the `colors` object inside `theme.extend`)

**Interfaces:**
- Produces: Tailwind classes `text-muted-soft`, `border-hairline-strong`, `border-secondary-fixed`, `bg-primary-fixed`.

- [ ] **Step 1: Check which tokens already exist**

Run: `cd frontend && grep -n "muted-soft\|hairline-strong\|secondary-fixed\|primary-fixed\|learned-surface" tailwind.config.js`

Note which keys are already present. `hairline-strong` and `learned-surface` are expected to exist from the session/dashboard redesigns. **Do not add a key that is already there** — a duplicate key in the object silently overrides the first one.

- [ ] **Step 2: Add only the missing tokens**

In the `colors` object inside `extend`, add the lines for keys Step 1 showed as missing. The full set of required values (add only those absent):

```js
        'muted-soft': '#a09c92',
        'hairline-strong': '#cfcdc4',
        'secondary-fixed': '#94f6ca',
        'primary-fixed': '#ffdbd0',
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

Then run: `cd frontend && git diff tailwind.config.js`
Expected: only added lines, no modified or removed lines, and no key appears twice in the `colors` object.

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(design): add quiz detail colour tokens"
```

---

### Task 2: `quizStats` derivation module

**Files:**
- Create: `frontend/src/utils/quizStats.ts`

**Interfaces:**
- Consumes: `QuizAttemptSummary` from `frontend/src/types` (fields: `id: string`, `submitted_at: string`, `score: number`, `total_questions: number`, `duration_seconds: number | null`).
- Produces — exact signatures that Tasks 3, 4 and 5 import:

```ts
export const percentOf: (score: number, total: number) => number;
export const isStrongScore: (percent: number) => boolean;
export const sortNewestFirst: (attempts: QuizAttemptSummary[]) => QuizAttemptSummary[];
export const computeQuizStats: (attempts: QuizAttemptSummary[]) => QuizStats;
export const computeTrajectory: (attempts: QuizAttemptSummary[]) => TrajectoryInsight | null;
export const formatDuration: (seconds: number | null) => string;
export const formatAttemptDate: (dateString: string) => string;

export type QuizStats = {
  attemptCount: number;
  bestScore: number | null;
  bestTotal: number | null;
  bestPercent: number | null;
  averageScore: number | null;
  averagePercent: number | null;
};

export type TrajectoryInsight = {
  firstPercent: number;
  lastPercent: number;
  netGain: number;
  secondsFaster: number | null;
};
```

- [ ] **Step 1: Check whether a `utils` directory exists**

Run: `cd frontend && ls src/utils 2>/dev/null || echo "no utils dir"`

If it does not exist, creating the file below creates it. Nothing else to do.

- [ ] **Step 2: Write the module**

Create `frontend/src/utils/quizStats.ts` with exactly this content:

```ts
import type { QuizAttemptSummary } from '../types';

/** A percentage at or above this counts as a strong score and earns the emerald tint. */
const STRONG_SCORE_THRESHOLD = 80;

export type QuizStats = {
  attemptCount: number;
  bestScore: number | null;
  bestTotal: number | null;
  bestPercent: number | null;
  averageScore: number | null;
  averagePercent: number | null;
};

export type TrajectoryInsight = {
  firstPercent: number;
  lastPercent: number;
  /** Percentage points gained from the first attempt to the latest. Can be negative. */
  netGain: number;
  /** Seconds shaved off since the first attempt. Positive means faster. Null when either attempt lacks a duration. */
  secondsFaster: number | null;
};

export const percentOf = (score: number, total: number): number =>
  total > 0 ? Math.round((score / total) * 100) : 0;

export const isStrongScore = (percent: number): boolean => percent >= STRONG_SCORE_THRESHOLD;

/** Newest attempt first. Does not mutate the input. */
export const sortNewestFirst = (attempts: QuizAttemptSummary[]): QuizAttemptSummary[] =>
  [...attempts].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  );

export const computeQuizStats = (attempts: QuizAttemptSummary[]): QuizStats => {
  if (attempts.length === 0) {
    return {
      attemptCount: 0,
      bestScore: null,
      bestTotal: null,
      bestPercent: null,
      averageScore: null,
      averagePercent: null,
    };
  }

  const best = attempts.reduce((leader, attempt) =>
    percentOf(attempt.score, attempt.total_questions) >
    percentOf(leader.score, leader.total_questions)
      ? attempt
      : leader,
  );

  const scoreSum = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const percentSum = attempts.reduce(
    (sum, attempt) => sum + percentOf(attempt.score, attempt.total_questions),
    0,
  );

  return {
    attemptCount: attempts.length,
    bestScore: best.score,
    bestTotal: best.total_questions,
    bestPercent: percentOf(best.score, best.total_questions),
    averageScore: Math.round((scoreSum / attempts.length) * 10) / 10,
    averagePercent: Math.round(percentSum / attempts.length),
  };
};

export const computeTrajectory = (attempts: QuizAttemptSummary[]): TrajectoryInsight | null => {
  if (attempts.length < 2) {
    return null;
  }

  const ordered = sortNewestFirst(attempts);
  const latest = ordered[0];
  const first = ordered[ordered.length - 1];

  const firstPercent = percentOf(first.score, first.total_questions);
  const lastPercent = percentOf(latest.score, latest.total_questions);

  const secondsFaster =
    first.duration_seconds !== null && latest.duration_seconds !== null
      ? first.duration_seconds - latest.duration_seconds
      : null;

  return {
    firstPercent,
    lastPercent,
    netGain: lastPercent - firstPercent,
    secondsFaster,
  };
};

export const formatDuration = (seconds: number | null): string => {
  if (seconds === null) {
    return '—';
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

export const formatAttemptDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
```

- [ ] **Step 3: Sanity-check the derivations by hand**

There is no test runner, so verify the arithmetic by reading the code against this worked example. Given three attempts scoring 7/10, 8/10 and 9/10:

- `computeQuizStats` → `bestScore: 9`, `bestPercent: 90`, `averageScore: 8`, `averagePercent: 80`.
- `computeTrajectory` → `firstPercent: 70`, `lastPercent: 90`, `netGain: 20`.

Confirm each of those three lines produces the stated value. Confirm `computeQuizStats([])` returns all-null and `computeTrajectory` returns `null` for a one-element array.

- [ ] **Step 4: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/quizStats.ts
git commit -m "feat(quiz): add quizStats derivation module for detail page metrics"
```

---

### Task 3: `QuizStatCards` component

**Files:**
- Create: `frontend/src/components/quiz/QuizStatCards.tsx`

**Interfaces:**
- Consumes: `computeQuizStats` and the `QuizStats` type from `../../utils/quizStats` (Task 2).
- Produces:

```tsx
type QuizStatCardsProps = {
  questionCount: number;
  attempts: QuizAttemptSummary[];
};
export default function QuizStatCards(props: QuizStatCardsProps): JSX.Element;
```

- [ ] **Step 1: Write the component**

Create `frontend/src/components/quiz/QuizStatCards.tsx` with exactly this content:

```tsx
import { BarChart3, History, ListChecks, Trophy } from 'lucide-react';
import type { QuizAttemptSummary } from '../../types';
import { computeQuizStats } from '../../utils/quizStats';

type QuizStatCardsProps = {
  questionCount: number;
  attempts: QuizAttemptSummary[];
};

const CARD_CLASS =
  'flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-space-md';
const EYEBROW_CLASS = 'mb-2 flex items-center justify-between text-muted';
const LABEL_CLASS = 'text-caption-uppercase uppercase';
const TRACK_CLASS = 'mt-3 h-1 w-full overflow-hidden rounded-full bg-hairline-soft';

/** Four dots that fill in as attempts accumulate, mirroring the mock's attempt meter. */
const ATTEMPT_DOTS = [1, 2, 3, 4];

export default function QuizStatCards({ questionCount, attempts }: QuizStatCardsProps) {
  const stats = computeQuizStats(attempts);

  return (
    <div className="grid grid-cols-2 gap-space-sm md:grid-cols-4">
      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Total Questions</span>
          <ListChecks size={18} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg text-ink">{questionCount}</span>
          <span className="font-mono text-code-sm text-muted">items</span>
        </div>
        <div className={TRACK_CLASS}>
          <div className="h-full w-full rounded-full bg-ink" />
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Total Attempts</span>
          <History size={18} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg text-ink">{stats.attemptCount}</span>
          <span className="font-mono text-code-sm text-muted">completed</span>
        </div>
        <div className="mt-3 flex items-center gap-1">
          {ATTEMPT_DOTS.map((dot) => (
            <span
              key={dot}
              className={`h-1 w-2.5 rounded-full ${
                dot <= stats.attemptCount ? 'bg-secondary' : 'bg-hairline-strong'
              }`}
            />
          ))}
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Best Score</span>
          <Trophy size={18} className={stats.bestPercent === null ? undefined : 'text-secondary'} />
        </div>
        <div className="flex items-baseline gap-2">
          {stats.bestScore === null ? (
            <span className="text-headline-lg text-muted">—</span>
          ) : (
            <>
              <span className="text-headline-lg text-ink">
                {stats.bestScore}
                <span className="text-body-sm font-normal text-body">/{stats.bestTotal}</span>
              </span>
              <span className="rounded border border-secondary-fixed bg-learned-surface px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                {stats.bestPercent}%
              </span>
            </>
          )}
        </div>
        <div className={TRACK_CLASS}>
          <div
            className="h-full rounded-full bg-secondary"
            style={{ width: `${stats.bestPercent ?? 0}%` }}
          />
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Average Score</span>
          <BarChart3 size={18} />
        </div>
        <div className="flex items-baseline gap-2">
          {stats.averageScore === null ? (
            <span className="text-headline-lg text-muted">—</span>
          ) : (
            <>
              <span className="text-headline-lg text-ink">
                {stats.averageScore}
                <span className="text-body-sm font-normal text-body">/{questionCount}</span>
              </span>
              <span className="font-mono text-code-sm text-muted">
                {stats.averagePercent}% avg
              </span>
            </>
          )}
        </div>
        <div className={TRACK_CLASS}>
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${stats.averagePercent ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0. The component is not rendered anywhere yet — an unused-export warning is not expected because it is a default export, but a `tsc` error here means a typo in the import path or prop types.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/quiz/QuizStatCards.tsx
git commit -m "feat(quiz): add stat card strip for quiz detail page"
```

---

### Task 4: Rewrite `AttemptHistory` as list rows

**Files:**
- Modify (full rewrite): `frontend/src/components/quiz/AttemptHistory.tsx`

**Interfaces:**
- Consumes: `sortNewestFirst`, `percentOf`, `isStrongScore`, `formatDuration`, `formatAttemptDate` from `../../utils/quizStats` (Task 2).
- Produces: the props signature is **unchanged**, so `QuizDetailPage` keeps working through Task 5:

```tsx
type AttemptHistoryProps = { attempts: QuizAttemptSummary[] };
export default function AttemptHistory(props: AttemptHistoryProps): JSX.Element;
```

The existing file navigates to `/attempts/${attempt.id}` on review — that route is preserved exactly.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `frontend/src/components/quiz/AttemptHistory.tsx` with:

```tsx
import { ArrowRight, CalendarDays, Check, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { QuizAttemptSummary } from '../../types';
import {
  formatAttemptDate,
  formatDuration,
  isStrongScore,
  percentOf,
  sortNewestFirst,
} from '../../utils/quizStats';

type AttemptHistoryProps = {
  attempts: QuizAttemptSummary[];
};

export default function AttemptHistory({ attempts }: AttemptHistoryProps) {
  const navigate = useNavigate();

  if (attempts.length === 0) {
    return (
      <div className="grid min-h-[180px] place-items-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-canvas-soft p-space-xl text-center">
        <h3 className="text-title-md text-ink">No attempts yet</h3>
        <p className="text-body-sm text-body">
          Start your first attempt to build a score history here.
        </p>
      </div>
    );
  }

  const ordered = sortNewestFirst(attempts);

  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface-card">
      {ordered.map((attempt, index) => {
        // Rows render newest-first, but attempts are numbered chronologically from the oldest.
        const attemptNumber = ordered.length - index;
        const isLatest = index === 0;
        const percent = percentOf(attempt.score, attempt.total_questions);
        const strong = isStrongScore(percent);
        const missed = attempt.total_questions - attempt.score;

        return (
          <div
            key={attempt.id}
            className="group flex flex-col justify-between gap-space-sm p-space-md transition-colors hover:bg-canvas-soft sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-space-md sm:items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hairline-soft font-mono text-code-sm font-medium ${
                  isLatest ? 'text-ink' : 'text-muted'
                }`}
              >
                #{attemptNumber}
              </div>

              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-title-sm text-ink">Attempt #{attemptNumber}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      strong
                        ? 'border-secondary-fixed bg-learned-surface text-secondary'
                        : 'border-hairline bg-hairline-soft text-body'
                    }`}
                  >
                    {strong && <Check size={13} />}
                    {percent}% Score
                  </span>
                  {isLatest && (
                    <span className="rounded bg-hairline-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-body">
                      Latest
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                  <span className="flex items-center gap-1 font-mono text-code-sm">
                    <CalendarDays size={15} className="text-muted-soft" />
                    {formatAttemptDate(attempt.submitted_at)}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="flex items-center gap-1 font-mono text-code-sm">
                    <Timer size={15} className="text-muted-soft" />
                    {formatDuration(attempt.duration_seconds)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-space-md pl-12 sm:justify-end sm:pl-0">
              <div className="text-left font-mono text-code-sm sm:text-right">
                <div className="font-medium text-ink">
                  {attempt.score} / {attempt.total_questions}
                </div>
                <div className="text-[11px] text-muted">
                  {attempt.score} correct, {missed} missed
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/attempts/${attempt.id}`)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-hairline-strong bg-surface-card px-3 py-1.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft group-hover:border-ink/40"
              >
                Review attempt
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Check it in the browser**

Run: `cd frontend && npm run dev`, then open a quiz that has at least two attempts at `/quizzes/<id>`.

Confirm all of:
- Rows are a bordered card with hairline dividers, not a table.
- The top row is the most recent attempt, is numbered highest, and carries the `Latest` tag.
- A score of 80% or more shows the emerald pill with a check; below 80% shows the neutral grey pill with no check.
- "Review attempt" navigates to the attempt review page.
- At 375px width the row stacks: meta block on top, score + button beneath.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/quiz/AttemptHistory.tsx
git commit -m "style(quiz): rebuild attempt history as editorial list rows"
```

---

### Task 5: `MasteryTrajectory` component

**Files:**
- Create: `frontend/src/components/quiz/MasteryTrajectory.tsx`

**Interfaces:**
- Consumes: `computeTrajectory` and `formatDuration` from `../../utils/quizStats` (Task 2).
- Produces:

```tsx
type MasteryTrajectoryProps = { attempts: QuizAttemptSummary[] };
export default function MasteryTrajectory(props: MasteryTrajectoryProps): JSX.Element | null;
```

Returns `null` when there are fewer than two attempts — the sentence compares a first and a latest attempt and is meaningless without both. `QuizDetailPage` therefore renders it unconditionally and lets the component decide.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/quiz/MasteryTrajectory.tsx` with exactly this content:

```tsx
import { LineChart, TrendingDown, TrendingUp } from 'lucide-react';
import type { QuizAttemptSummary } from '../../types';
import { computeTrajectory, formatDuration } from '../../utils/quizStats';

type MasteryTrajectoryProps = {
  attempts: QuizAttemptSummary[];
};

export default function MasteryTrajectory({ attempts }: MasteryTrajectoryProps) {
  const trajectory = computeTrajectory(attempts);

  // Fewer than two attempts leaves nothing to compare.
  if (!trajectory) {
    return null;
  }

  const { firstPercent, lastPercent, netGain, secondsFaster } = trajectory;
  const improving = netGain >= 0;
  const paceGained = secondsFaster !== null && secondsFaster > 0;

  return (
    <div className="flex flex-col items-start justify-between gap-space-md rounded-xl border border-hairline bg-surface-card p-space-md md:flex-row md:items-center">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <LineChart size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-title-sm text-ink">Mastery Trajectory</span>
          <span className="text-body-sm text-body">
            {paceGained ? (
              <>
                Your completion pace improved by{' '}
                <strong className="font-medium text-ink">{formatDuration(secondsFaster)}</strong>{' '}
                from your first attempt to your latest, with accuracy{' '}
                {improving ? 'increasing' : 'moving'} from {firstPercent}% to {lastPercent}%.
              </>
            ) : (
              <>
                Across {attempts.length} attempts your accuracy{' '}
                {improving ? 'increased' : 'moved'} from {firstPercent}% to {lastPercent}%.
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch justify-end md:self-auto">
        <span
          className={`flex items-center gap-1 font-mono text-code-sm ${
            improving ? 'text-secondary' : 'text-error'
          }`}
        >
          {improving ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {improving ? '+' : ''}
          {netGain}% Net {improving ? 'Gain' : 'Change'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/quiz/MasteryTrajectory.tsx
git commit -m "feat(quiz): add mastery trajectory insight card"
```

---

### Task 6: Rewrite `QuizDetailPage`

**Files:**
- Modify (full rewrite): `frontend/src/pages/QuizDetailPage.tsx`

**Interfaces:**
- Consumes: `QuizStatCards` (Task 3), `AttemptHistory` (Task 4), `MasteryTrajectory` (Task 5), plus the existing `PageHeader` from `../components/PageHeader`.
- Produces: the default-exported route component for `/quizzes/:id`. Its data fetching (`GET /quizzes/{id}`, `GET /sessions`), its `sessions` title→id map, its loading state and its "Quiz not found" state are all preserved — only presentation changes.

Note the layout change: the page no longer uses the `page-container` class (max-width 1152px) because the mock constrains the detail view to 1024px. It uses an explicit `max-w-5xl` wrapper instead. `page-shell` is kept. Neither class is removed from `index.css` — other pages still use both.

`QuestionTypeBadges` is **no longer imported**: the mock renders the translation direction as a solid dark capsule, which that component does not do. `QuestionTypeBadges` stays in the codebase for `QuizCard`.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `frontend/src/pages/QuizDetailPage.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { ArrowLeft, FolderOpen, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { QuizDetail } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';
import AttemptHistory from '../components/quiz/AttemptHistory';
import MasteryTrajectory from '../components/quiz/MasteryTrajectory';
import PageHeader from '../components/PageHeader';
import QuizStatCards from '../components/quiz/QuizStatCards';

const BACK_LINK_CLASS =
  'group inline-flex items-center gap-1.5 text-body-sm text-body transition-colors hover:text-ink';

export default function QuizDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    try {
      const response = await api.get(`/quizzes/${id}`);
      setDetail(response.data);
    } catch (err) {
      console.error('Failed to fetch quiz detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions');
      const sessionMap: Record<string, string> = {};
      response.data.forEach((session: { id: string; title: string }) => {
        sessionMap[session.title] = session.id;
      });
      setSessions(sessionMap);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDetail();
    void fetchSessions();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">Loading quiz…</div>;
  }

  if (!detail) {
    return (
      <div className="page-shell bg-canvas">
        <PageHeader />
        <main className="mx-auto w-full max-w-5xl px-margin py-space-xl max-sm:px-space-md">
          <Link to="/quizzes" className={BACK_LINK_CLASS}>
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Quizzes
          </Link>
          <div className="mt-space-lg grid min-h-[180px] place-items-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-canvas-soft p-space-xl text-center">
            <h3 className="text-title-md text-ink">Quiz not found</h3>
            <p className="text-body-sm text-body">The quiz you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const { quiz, attempts } = detail;
  const hasAttempts = attempts.length > 0;
  const buttonText = hasAttempts ? 'Retake quiz' : 'Start quiz';
  const uniqueTypes = Array.from(new Set(quiz.question_types));

  return (
    <div className="page-shell bg-canvas">
      <PageHeader />

      <main className="mx-auto w-full max-w-5xl px-margin py-space-xl max-sm:px-space-md">
        <Link to="/quizzes" className={BACK_LINK_CLASS}>
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          Back to Quizzes
        </Link>

        {/* Hero */}
        <div className="mt-space-md flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col gap-space-xs">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {quiz.source_session_titles.map((title) => (
                <span
                  key={title}
                  className="inline-flex items-center gap-1.5 rounded border border-hairline bg-surface-card px-2.5 py-1 font-mono text-code-sm text-body"
                >
                  <FolderOpen size={15} className="text-muted" />
                  From session:{' '}
                  {sessions[title] ? (
                    <Link
                      to={`/sessions/${sessions[title]}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {title}
                    </Link>
                  ) : (
                    <strong className="font-medium text-ink">{title}</strong>
                  )}
                </span>
              ))}
              {uniqueTypes.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center rounded-full bg-ink px-2.5 py-1 text-caption-uppercase uppercase text-surface"
                >
                  {QUESTION_TYPE_LABELS[type]}
                </span>
              ))}
            </div>

            <h1 className="text-display-hero tracking-tight text-ink max-sm:text-headline-lg">
              {quiz.title}
            </h1>
          </div>

          <Link
            to={`/quizzes/${id}/take`}
            className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active md:self-auto"
          >
            <Play size={19} />
            {buttonText}
          </Link>
        </div>

        {/* Stat strip */}
        <div className="mt-space-lg">
          <QuizStatCards questionCount={quiz.question_count} attempts={attempts} />
        </div>

        {/* Attempt history */}
        <div className="mt-space-xl flex flex-col gap-space-sm">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-2">
              <h2 className="text-title-md text-ink">Attempt History</h2>
              <span className="inline-flex h-5 items-center justify-center rounded-full bg-hairline-soft px-2 font-mono text-[11px] text-muted">
                {attempts.length}
              </span>
            </div>
            {hasAttempts && (
              <span className="text-caption-uppercase uppercase text-muted">Sorted by newest</span>
            )}
          </div>
          <AttemptHistory attempts={attempts} />
        </div>

        {/* Insight — renders nothing below two attempts */}
        <div className="mt-space-xl">
          <MasteryTrajectory attempts={attempts} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0. A `tsc` error naming `QuestionTypeBadges` means a leftover import was not removed.

- [ ] **Step 3: Verify no dead imports remain**

Run: `cd frontend && grep -n "QuestionTypeBadges\|hero-card\|section-header\|eyebrow\|page-container" src/pages/QuizDetailPage.tsx`
Expected: no output.

Then run: `cd frontend && grep -rn "QuestionTypeBadges" src/`
Expected: matches in `src/components/QuestionTypeBadges.tsx` and `src/components/quiz/QuizCard.tsx` only. The component stays — it is not deleted.

- [ ] **Step 4: Check every state in the browser**

Run: `cd frontend && npm run dev`.

Walk all four states and confirm:
1. **Quiz with 3+ attempts** — hero badges, 48px title, four stat cards with correct numbers, history list, trajectory card visible with a sensible sentence.
2. **Quiz with exactly 1 attempt** — stat cards show that attempt's score as both best and average; the trajectory card is **absent** (not an empty box).
3. **Quiz with 0 attempts** — Best and Average show `—` with empty bars, the attempt-dot meter is all grey, history shows the dashed empty state, the CTA reads "Start quiz", "Sorted by newest" is hidden, and the trajectory card is absent.
4. **Bad id** (`/quizzes/does-not-exist`) — the "Quiz not found" card renders with a working back link.

Then check responsiveness at 375px, 768px and 1280px: stat cards go 4-up → 2x2 → 2x2, the hero CTA drops below the title on mobile, and nothing scrolls horizontally.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/QuizDetailPage.tsx
git commit -m "style(quiz): rebuild quiz detail page in editorial focus system"
```

---

## Known Deviations from the Mock

These are deliberate. Do not "fix" them back toward the mock.

1. **No quiz description paragraph and no `ID: QZ-8821A` chip.** `Quiz` has neither field and the user chose to drop both rather than invent them or extend the backend.
2. **lucide-react icons instead of Material Symbols.** The mock loads Material Symbols from a CDN; this app ships lucide. Mapping used: `quiz`→`ListChecks`, `history`→`History`, `workspace_premium`→`Trophy`, `analytics`→`BarChart3`, `insights`→`LineChart`, `trending_up`→`TrendingUp`, `folder_open`→`FolderOpen`, `calendar_today`→`CalendarDays`, `timer`→`Timer`, `arrow_back`→`ArrowLeft`, `arrow_forward`→`ArrowRight`, `play_arrow`→`Play`, `check`→`Check`.
3. **Duration reads `1m 45s`, not `1m 45s (105s)`.** The mock's redundant raw-seconds parenthetical is dropped; `formatDuration` is shared with the rest of the app and stays single-format.
4. **The mock's fixed-header + separate footer markup is ignored.** This app already has `PageHeader` (sticky) and no page-level footer; the redesign does not introduce one.
5. **Session badge is repeated per source session.** The mock shows one; a quiz can draw from several sessions, so each gets its own linked chip.
6. **The trajectory card handles regression.** The mock only shows an improving case; when `netGain` is negative the card switches to `TrendingDown` and `text-error` rather than claiming a gain.
7. **CTA label stays "Start quiz"/"Retake quiz"** rather than the mock's "Take Quiz →", preserving the existing behaviour where the label reflects attempt history.

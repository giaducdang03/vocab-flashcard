# Dashboard "Editorial Focus" Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app header, footer, and dashboard to match the "Editorial Focus" design system, using only data the backend actually returns.

**Architecture:** Design tokens land in `tailwind.config.js` first so every later task styles with utility classes instead of hex literals. The full-width sticky header is achieved by redefining `.page-shell` / `.page-container` in CSS rather than editing seven page files — existing JSX keeps working, content stays centred. Stat derivations (personal-best streak, today's learned count) live in a pure `src/lib/stats.ts` module; everything else is presentational.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Tailwind 3.4, react-router-dom 6, chart.js 4 + react-chartjs-2, lucide-react, axios. No test framework — verification is `npm run build` (which runs `tsc -b`) plus browser checks.

**Spec:** `frontend/docs/dashboard/DESIGN.md` (tokens + rules), `frontend/docs/dashboard/code.html` (reference markup + authoritative Tailwind config), `frontend/docs/dashboard/screen.png` (visual target)

## Global Constraints

- **Existing colour tokens are frozen. Do not change a single existing value.** `primary` stays `#f54e00`, `primary-active` stays `#d04200`, and every other token already in `tailwind.config.js` / `index.css` keeps its current value. Note that `DESIGN.md` contradicts itself here — the frontmatter and `code.html` say `#a83300` while the prose (§Colors, §Buttons) says `#f54e00` — and this project stays on `#f54e00`. Tasks only **add** the tokens the design needs that do not exist yet; there are nine, all listed in Task 1.
- **Fonts:** Inter for all UI text; JetBrains Mono for counters, percentages, dates, keyboard hints (`code-sm` / `code-phonetic`).
- **Max content width: `max-w-6xl` (1152px)** as in `code.html`. `DESIGN.md` prose says 1120px — `code.html` wins.
- **No drop shadows beyond `shadow-sm`.** Depth comes from `#ffffff` surfaces on `#f7f7f4` canvas with 1px `#e6e5e0` hairlines.
- **Radii:** interactive controls `rounded-lg` (0.5rem); cards `rounded-xl` (0.75rem); pills/badges `rounded-full`.
- **Never invent numbers.** Any metric without backing data is omitted, not faked. Specifically: `↑ +12` on Total Words and `+3.2%` on Overall Mastery are **dropped** — no historical data exists for them.
- **Icons:** use `lucide-react` (already a dependency). Do **not** add Material Symbols; `code.html` uses it only because it is a static mock.
- Verification gate for every visual task: `npm run build` (runs `tsc -b` — catches type errors) must exit 0.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `frontend/tailwind.config.js` | Design tokens (colors, fontSize, spacing, radii) | 1 |
| `frontend/index.html` | Google Fonts links; drop stray `bg-slate-100` | 1 |
| `frontend/src/index.css` | CSS vars aligned to tokens; layout shell classes | 1, 2 |
| `frontend/src/pages/SessionDetailPage.tsx` | Toolbar centring class | 2 |
| `frontend/src/components/PageHeader.tsx` | Sticky full-width header, nav pills, streak chip | 3 |
| `frontend/src/components/Footer.tsx` | Brand line + nav links | 4 |
| `frontend/src/lib/stats.ts` | **New.** Pure derivations from `DailyPoint[]` | 5 |
| `frontend/src/components/dashboard/KpiTile.tsx` | Metric tile: icon, badge, footnote, accent bar | 6 |
| `frontend/src/components/dashboard/StatsSection.tsx` | Wires four tiles + two panels | 7 |
| `frontend/src/components/dashboard/SessionProgressChart.tsx` | Rewritten as DOM bars (drops chart.js) | 8 |
| `frontend/src/components/dashboard/DailyLearnedChart.tsx` | Restyled chart.js bars + segmented toggle | 9 |
| `frontend/src/pages/DashboardPage.tsx` | Hero, session toolbar, filter chips, cards, tip dock | 10 |
| `frontend/src/components/SessionCard.tsx` | **New.** Extracted session card | 10 |
| `frontend/src/pages/SessionsPage.tsx` | **New.** Standalone `/sessions` list | 11 |
| `frontend/src/App.tsx` | `/sessions` route | 11 |

---

### Task 1: Design tokens and fonts

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css:5-23`

**Interfaces:**
- Produces:
  - **Already available, unchanged:** `bg-canvas`, `bg-surface-card`, `border-hairline`, `text-ink`, `text-body`, `text-muted`, `text-primary`, `bg-primary`, `hover:bg-primary-active`, `text-on-primary`, `text-error`.
  - **Newly added colour classes:** `text-secondary` / `bg-secondary`, `bg-secondary-container`, `text-on-secondary-container`, `text-tertiary`, `bg-surface`, `bg-surface-container`, `bg-canvas-soft`, `bg-hairline-soft`, `border-hairline-strong`.
  - **Newly added type classes:** `text-display-hero`, `text-headline-lg`, `text-headline-md`, `text-title-md`, `text-title-sm`, `text-body-md`, `text-body-sm`, `text-caption-uppercase`, `text-code-sm`, `text-code-phonetic`, plus `font-sans` (Inter) / `font-mono` (JetBrains Mono).
  - **Newly added spacing classes:** `gutter`, `margin`, `space-xs`, `space-sm`, `space-md`, `space-lg`, `space-xl` (usable as `gap-gutter`, `px-margin`, `p-space-md`, …).

- [ ] **Step 1: Append nine colour tokens in `frontend/tailwind.config.js`**

Leave every existing entry in the `colors` object exactly as it is (`primary: '#f54e00'` included). Add these nine lines inside the same `colors` object — these are the tokens later tasks reference that do not exist yet:

```js
  secondary: '#006c4c',
  'secondary-container': '#91f3c7',
  'on-secondary-container': '#007150',
  tertiary: '#5e5c56',
  surface: '#fef9ee',
  'surface-container': '#f2eee2',
  'canvas-soft': '#fafaf7',
  'hairline-soft': '#efeee8',
  'hairline-strong': '#cfcdc4',
```

Nothing else in `colors` changes. After editing, `git diff frontend/tailwind.config.js` must show nine added lines and zero modified lines in the `colors` block — if it shows a modification, you changed a frozen token and must revert it.

- [ ] **Step 2: Add `fontSize`, `fontFamily`, `spacing`, `borderRadius` to the same `extend` block**

Insert alongside `colors`, before the existing `keyframes`:

```js
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
},
fontSize: {
  'display-hero': ['48px', { lineHeight: '54px', letterSpacing: '-0.03em', fontWeight: '400' }],
  'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.015em', fontWeight: '400' }],
  'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '500' }],
  'title-md': ['18px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
  'title-sm': ['15px', { lineHeight: '22px', fontWeight: '600' }],
  'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
  'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
  'caption-uppercase': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
  'code-phonetic': ['14px', { lineHeight: '20px', fontWeight: '400' }],
  'code-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
},
spacing: {
  gutter: '1.25rem',
  margin: '2rem',
  'space-xs': '0.25rem',
  'space-sm': '0.5rem',
  'space-md': '1rem',
  'space-lg': '1.5rem',
  'space-xl': '2rem',
},
```


- [ ] **Step 3: Add font links to `frontend/index.html`**

Inside `<head>`, after the `theme-color` meta:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

Then change `<body class="bg-slate-100">` to `<body>` — that class is a leftover that fights the canvas background.

- [ ] **Step 4: Add the missing CSS variables in `frontend/src/index.css`**

Leave `--primary: #f54e00;` and every other existing variable untouched. Add these three lines to the `:root` block — `.empty-state:368` already references `--hairline-strong`, which is currently undefined, so this also fixes a live bug:

```css
  --hairline-soft: #efeee8;
  --hairline-strong: #cfcdc4;
  --secondary: #006c4c;
```

In the `body` rule, change the font stack to:

```css
  font-family: 'Inter', system-ui, sans-serif;
```

- [ ] **Step 5: Verify the build and the font load**

Run: `cd frontend && npm run build`
Expected: exits 0, no TS errors.

Then `npm run dev`, open the app, and confirm in DevTools that body computed `font-family` resolves to Inter and the page background is `#f7f7f4` (not slate).

- [ ] **Step 6: Commit**

```bash
git add frontend/tailwind.config.js frontend/index.html frontend/src/index.css
git commit -m "feat(design): add Editorial Focus tokens, Inter and JetBrains Mono"
```

---

### Task 2: Full-width shell without touching seven page files

**Files:**
- Modify: `frontend/src/index.css:68-82`
- Modify: `frontend/src/pages/SessionDetailPage.tsx:109`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `.page-shell` = full-bleed column; `.page-container` = centred 1152px content well; `.page-toolbar` = centred sub-toolbar row. Every page that already renders `<div className="page-shell"><PageHeader/>…<main className="page-container">` gets a sticky full-width header for free.

**Why this shape:** `PageHeader` is rendered by six pages (`DashboardPage`, `SessionDetailPage`, `QuizzesPage`, `QuizDetailPage`, `TakeQuizPage`, `AttemptReviewPage`) from inside `.page-shell`, which currently caps width at 1200px and adds padding. Moving the width cap from the shell down to the container makes the header span the viewport in all six at once.

- [ ] **Step 1: Rewrite the shell rules in `frontend/src/index.css`**

Replace the existing `.page-shell`, `.page-container`, and `.page-container.compact` rules with:

```css
.page-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-container {
  width: 100%;
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 32px 80px;
  display: grid;
  gap: 32px;
}

.page-container.compact {
  gap: 24px;
}

.page-toolbar {
  width: 100%;
  max-width: 1152px;
  margin: 0 auto;
  padding: 12px 32px;
}

@media (max-width: 640px) {
  .page-container {
    padding: 20px 16px 64px;
    gap: 24px;
  }

  .page-toolbar {
    padding: 12px 16px;
  }
}
```

- [ ] **Step 2: Centre the SessionDetail sub-toolbar**

`frontend/src/pages/SessionDetailPage.tsx:109` is a `<div>` with inline styles that sits between the header and `<main>`. With the header now full-width, this row would also go edge-to-edge. Change:

```tsx
<div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--hairline)' }}>
```

to:

```tsx
<div className="page-toolbar flex items-center justify-between border-b border-hairline">
```

- [ ] **Step 3: Verify every page still lays out**

Run `npm run dev` and visit each route, checking that content is centred and nothing is edge-to-edge except the header border: `/`, `/sessions/:id` (open a session), `/sessions/:id/study`, `/quizzes`, `/quizzes/:id`, `/quizzes/:id/take`, `/attempts/:id`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/pages/SessionDetailPage.tsx
git commit -m "refactor(layout): move width cap from page shell to page container"
```

---

### Task 3: PageHeader

**Files:**
- Modify: `frontend/src/components/PageHeader.tsx`

**Interfaces:**
- Consumes: tokens (Task 1), shell (Task 2), existing `UserMenu` (`{ user: User; onLogout: () => void }`).
- Produces: `PageHeader({ user?, onLogout?, streakDays? })` — `streakDays?: number` is new and optional; when omitted the streak chip is not rendered. Six existing call sites pass no `streakDays` and keep working unchanged.

**Design reference:** `code.html` line 2, `<header>` element.

- [ ] **Step 1: Replace the whole file**

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import type { User } from '../types';
import UserMenu from './UserMenu';

interface PageHeaderProps {
  user?: User | null;
  onLogout?: () => void;
  streakDays?: number;
}

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Sessions', path: '/sessions' },
  { label: 'Quizzes', path: '/quizzes', badge: 'New' },
];

export default function PageHeader({ user, onLogout, streakDays }: PageHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-space-md px-margin max-sm:px-space-md">
        <div className="flex items-center gap-space-lg">
          <button
            type="button"
            className="flex items-center gap-space-sm"
            onClick={() => navigate('/')}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-[0.08em] text-on-primary">
              VF
            </span>
            <span className="text-title-md tracking-tight text-ink">VocabFlash</span>
          </button>

          <nav className="hidden items-center gap-space-xs rounded-lg bg-hairline-soft p-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-body-sm transition-colors ${
                  isActive(item.path)
                    ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                    : 'text-body hover:text-ink'
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-caption-uppercase uppercase leading-none text-on-secondary-container">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-space-md">
          {typeof streakDays === 'number' && streakDays > 0 && (
            <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface-card px-2.5 py-1 font-mono text-code-sm text-ink sm:flex">
              <Flame size={14} className="text-primary" />
              {streakDays}-day streak
            </span>
          )}
          {user && <UserMenu user={user} onLogout={onLogout ?? (() => {})} />}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build` — expected: exits 0.

In the browser: the header spans the full viewport, sticks on scroll, the active tab is the white pill, and pages that render `<PageHeader />` with no props show the brand and nav but no streak chip and no user menu.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PageHeader.tsx
git commit -m "feat(header): sticky full-width header with nav pills and streak chip"
```

---

### Task 4: Footer

**Files:**
- Modify: `frontend/src/components/Footer.tsx`

**Interfaces:**
- Consumes: tokens (Task 1). Rendered once in `App.tsx:100`, outside the router pages.
- Produces: no props.

Note: `code.html` puts a "Study Arena" link in the footer. There is no standalone study route (study is `/sessions/:id/study`), so the four links are Dashboard, Sessions, Quizzes, and — in place of Study Arena — nothing. Three links only.

- [ ] **Step 1: Replace the whole file**

```tsx
import { Link } from 'react-router-dom';

const LINKS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Sessions', path: '/sessions' },
  { label: 'Quizzes', path: '/quizzes' },
];

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-hairline bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-space-md px-margin py-space-xl text-body-sm text-muted max-sm:px-space-md md:flex-row">
        <div className="flex items-center gap-space-sm">
          <span className="text-title-sm text-ink">VocabFlash</span>
          <span>— Mindful vocabulary mastery.</span>
        </div>

        <nav className="flex items-center gap-space-lg text-body">
          {LINKS.map((link) => (
            <Link key={link.path} to={link.path} className="transition-colors hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
```

The `Copyright © 2026 Duc Dang` line is dropped — it is not in the design. If it must stay, add it as a third flex child with `className="text-code-sm"`.

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build` — expected: exits 0. In the browser, footer sits at the bottom on short pages (the `flex flex-col min-h-screen` wrapper in `App.tsx` plus `mt-auto` handles this) and the links navigate.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Footer.tsx
git commit -m "feat(footer): editorial footer with brand line and nav links"
```

---

### Task 5: Stat derivations

**Files:**
- Create: `frontend/src/lib/stats.ts`

**Interfaces:**
- Consumes: `DailyPoint` and `Session` from `frontend/src/types/index.ts` (`DailyPoint` = `{ date: string; learned_count: number }`).
- Produces:
  - `longestStreak(daily: DailyPoint[]): number`
  - `todayLearned(daily: DailyPoint[]): number` — count for the last entry in the series
  - `activeSessionCount(sessions: Session[]): number` — sessions with `total_cards > 0`

**Why a separate module:** these three functions are the only non-presentational logic in the redesign. Keeping them out of the component makes `StatsSection` readable and makes the streak rules easy to re-check by reading one small file.

**Verification note:** `longestStreak` is the one place a silent off-by-one can hide — a wrong answer still renders as a plausible number. After wiring it up in Task 7, sanity-check it once against real data: open the Network tab, read the `days=365` response, count the longest run of non-zero `learned_count` entries by eye, and confirm the tile matches.

- [ ] **Step 1: Write `frontend/src/lib/stats.ts`**

```ts
import type { DailyPoint, Session } from '../types';

/** Longest run of consecutive entries with at least one word learned. */
export function longestStreak(daily: DailyPoint[]): number {
  let best = 0;
  let run = 0;

  for (const entry of daily) {
    if (entry.learned_count > 0) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return best;
}

/** Words learned on the most recent day of the series. */
export function todayLearned(daily: DailyPoint[]): number {
  return daily.length > 0 ? daily[daily.length - 1].learned_count : 0;
}

/** Sessions that actually contain cards. */
export function activeSessionCount(sessions: Session[]): number {
  return sessions.filter((session) => session.total_cards > 0).length;
}
```

The series from `/stats/daily` is dense (the backend fills every date in the range — see `backend/app/routers/stats.py:52-53`), so consecutive array entries are consecutive calendar days and no date arithmetic is needed.

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: exits 0. Nothing imports the module yet — Task 7 wires it in.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/stats.ts
git commit -m "feat(stats): add derivations for streak and daily counts"
```

---

### Task 6: KpiTile

**Files:**
- Modify: `frontend/src/components/dashboard/KpiTile.tsx`

**Interfaces:**
- Consumes: tokens (Task 1).
- Produces:

```ts
type KpiTileProps = {
  label: string;
  value: number | string;
  unit?: string;           // small muted word after the value, e.g. "days"
  icon?: ReactNode;        // top-right, 18px lucide icon
  badge?: string;          // mint capsule beside the value, e.g. "40% Total"
  footnote?: string;       // muted line under the value
  progress?: number;       // 0-100, renders a thin track under the value
  accent?: 'primary' | 'secondary';  // bottom hairline accent, default 'primary'
};
```

**Design reference:** `code.html` lines 28-81 (four metric tiles).

- [ ] **Step 1: Replace the whole file**

```tsx
import type { ReactNode } from 'react';

type KpiTileProps = {
  label: string;
  value: number | string;
  unit?: string;
  icon?: ReactNode;
  badge?: string;
  footnote?: string;
  progress?: number;
  accent?: 'primary' | 'secondary';
};

export default function KpiTile({
  label,
  value,
  unit,
  icon,
  badge,
  footnote,
  progress,
  accent = 'primary',
}: KpiTileProps) {
  return (
    <div className="group relative flex flex-col gap-space-xs overflow-hidden rounded-xl border border-hairline bg-surface-card p-space-md transition-colors hover:bg-canvas-soft">
      <div className="flex items-center justify-between">
        <span className="text-caption-uppercase uppercase text-muted">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-headline-lg font-medium text-ink">
          {value}
          {unit && <span className="ml-1 text-title-md font-normal text-muted">{unit}</span>}
        </span>
        {badge && (
          <span className="rounded bg-secondary-container px-1.5 py-0.5 text-caption-uppercase text-on-secondary-container">
            {badge}
          </span>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {footnote && <p className="m-0 truncate text-body-sm text-muted">{footnote}</p>}

      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 transition-colors ${
          accent === 'secondary'
            ? 'bg-secondary/30 group-hover:bg-secondary'
            : 'bg-primary/20 group-hover:bg-primary'
        }`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build`
Expected: FAIL — `StatsSection.tsx` still passes the removed `suffix` prop. That is expected and fixed in Task 7. If you want a green build at this commit, do Tasks 6 and 7 back to back before committing.

- [ ] **Step 3: Commit (together with Task 7)**

---

### Task 7: StatsSection

**Files:**
- Modify: `frontend/src/components/dashboard/StatsSection.tsx`

**Interfaces:**
- Consumes: `KpiTile` (Task 6), `longestStreak` / `todayLearned` / `activeSessionCount` (Task 5), `DailyLearnedChart` (Task 9), `SessionProgressChart` (Task 8).
- Produces: `StatsSection({ sessions, onStreakChange? })` — `onStreakChange?: (days: number) => void` reports `current_streak` upward so `DashboardPage` can hand it to `PageHeader`.

**Data honesty:** the four tiles render Total Words, Learned, Overall Mastery, Streak. `↑ +12` and `+3.2%` from the mock are omitted — no historical data exists. Personal best is computed from a **separate one-time 365-day fetch** (the endpoint allows `days` up to 365, see `backend/app/routers/stats.py:20`) so the number does not change when the user toggles the chart between 7 and 30 days.

- [ ] **Step 1: Add the 365-day fetch and derive the tiles**

Replace the body of `StatsSection` with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BookMarked, LineChart, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import type { DailyStats, Session } from '../../types';
import { activeSessionCount, longestStreak, todayLearned } from '../../lib/stats';
import DailyLearnedChart from './DailyLearnedChart';
import SessionProgressChart from './SessionProgressChart';
import KpiTile from './KpiTile';

type StatsSectionProps = {
  sessions: Session[];
  onStreakChange?: (days: number) => void;
};

export default function StatsSection({ sessions, onStreakChange }: StatsSectionProps) {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [bestStreak, setBestStreak] = useState<number | null>(null);

  const tzOffsetMinutes = -new Date().getTimezoneOffset();

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);

    api
      .get('/stats/daily', { params: { days, tz_offset_minutes: tzOffsetMinutes } })
      .then((response) => {
        if (cancelled) return;
        setStats(response.data);
        setStatsError(false);
        onStreakChange?.(response.data.current_streak);
      })
      .catch(() => {
        if (!cancelled) setStatsError(true);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/stats/daily', { params: { days: 365, tz_offset_minutes: tzOffsetMinutes } })
      .then((response) => {
        if (!cancelled) setBestStreak(longestStreak(response.data.daily));
      })
      .catch(() => {
        if (!cancelled) setBestStreak(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const total = sessions.reduce((sum, session) => sum + session.total_cards, 0);
    const learned = sessions.reduce((sum, session) => sum + session.learned_cards, 0);

    return {
      total,
      learned,
      percent: total > 0 ? Math.round((learned / total) * 100) : 0,
      active: activeSessionCount(sessions),
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-card p-space-xl text-center text-body-sm text-body">
        No study data yet. Create your first session to start tracking progress.
      </div>
    );
  }

  const learnedToday = stats ? todayLearned(stats.daily) : 0;
  const streakValue = statsError ? '—' : statsLoading && !stats ? '…' : (stats?.current_streak ?? 0);

  return (
    <div className="flex flex-col gap-gutter">
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total words"
          value={totals.total}
          icon={<BookMarked size={18} />}
          footnote={`Across ${totals.active} active ${totals.active === 1 ? 'session' : 'sessions'}`}
        />
        <KpiTile
          label="Learned"
          value={totals.learned}
          icon={<ShieldCheck size={18} className="text-secondary" />}
          badge={totals.total > 0 ? `${totals.percent}% total` : undefined}
          footnote={
            statsError
              ? undefined
              : `+${learnedToday} ${learnedToday === 1 ? 'word' : 'words'} today`
          }
          accent="secondary"
        />
        <KpiTile
          label="Overall mastery"
          value={`${totals.percent}%`}
          icon={<LineChart size={18} />}
          progress={totals.percent}
        />
        <KpiTile
          label="Streak"
          value={streakValue}
          unit="days"
          icon={<span className="text-[16px]">🔥</span>}
          footnote={bestStreak !== null ? `Personal best: ${bestStreak} days` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-gutter xl:grid-cols-2">
        {!statsError && stats && (
          <DailyLearnedChart daily={stats.daily} days={days} onDaysChange={setDays} />
        )}
        <SessionProgressChart sessions={sessions} />
      </div>

      {statsError && (
        <p className="m-0 text-body-sm text-error">
          Couldn't load daily stats. Your totals are still accurate.
        </p>
      )}
    </div>
  );
}
```

Note the default `days` changed from 30 to 7 — the mock shows the 7-day view selected.

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build`
Expected: exits 0.

In the browser the four tiles render in one row at ≥1024px, 2×2 at tablet, stacked on mobile. Check the Network tab shows exactly two `/stats/daily` calls on mount (one for `days=7`, one for `days=365`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/KpiTile.tsx frontend/src/components/dashboard/StatsSection.tsx
git commit -m "feat(dashboard): editorial KPI tiles with real streak and daily data"
```

---

### Task 8: SessionProgressChart as DOM bars

**Files:**
- Modify: `frontend/src/components/dashboard/SessionProgressChart.tsx`

**Interfaces:**
- Consumes: `Session[]`, tokens (Task 1).
- Produces: same default export and same `{ sessions }` prop — `StatsSection` needs no change.

**Why rewrite rather than restyle:** the design shows labelled rows with a title, a `18 / 46` mono counter, a percentage coloured by threshold, and a legend — all of which are plain DOM. chart.js cannot express the per-bar colour-plus-label layout without heavy plugin work, and this component drops its chart.js dependency entirely.

- [ ] **Step 1: Replace the whole file**

```tsx
import type { Session } from '../../types';

const MAX_ROWS = 6;
const STRONG_RETENTION = 50;

type SessionProgressChartProps = {
  sessions: Session[];
};

export default function SessionProgressChart({ sessions }: SessionProgressChartProps) {
  const withCards = sessions.filter((session) => session.total_cards > 0);

  const ranked = withCards
    .map((session) => ({
      id: session.id,
      title: session.title,
      learned: session.learned_cards,
      total: session.total_cards,
      percent: Math.round((session.learned_cards / session.total_cards) * 100),
    }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, MAX_ROWS);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-space-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-title-md text-ink">Progress by session</h2>
          <p className="m-0 text-body-sm text-muted">Sorted by lowest completion rate</p>
        </div>
        {withCards.length > 0 && (
          <span className="shrink-0 rounded bg-surface-container px-2 py-0.5 text-caption-uppercase text-tertiary">
            {withCards.length} {withCards.length === 1 ? 'Module' : 'Modules'}
          </span>
        )}
      </div>

      {ranked.length === 0 ? (
        <p className="m-0 text-body-sm text-body">No sessions with cards yet.</p>
      ) : (
        <>
          <div className="my-auto space-y-4 pt-2">
            {ranked.map((item) => {
              const strong = item.percent >= STRONG_RETENTION;

              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-body-sm">
                    <span className="truncate font-medium text-ink">{item.title}</span>
                    <span className="shrink-0 font-mono text-code-sm text-muted">
                      {item.learned} / {item.total}
                      <span
                        className={`ml-1 font-medium ${strong ? 'text-secondary' : 'text-ink'}`}
                      >
                        {item.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        strong ? 'bg-secondary' : 'bg-primary'
                      }`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between pt-3 font-mono text-code-sm text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Needs attention (&lt;50%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-secondary" /> Strong retention (≥50%)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && npm run build` — expected: exits 0.

In the browser, sessions below 50% show orange bars, at or above 50% show green, and the row order runs least-complete first.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/SessionProgressChart.tsx
git commit -m "feat(dashboard): rebuild session progress as labelled DOM bars"
```

---

### Task 9: DailyLearnedChart restyle

**Files:**
- Modify: `frontend/src/components/dashboard/DailyLearnedChart.tsx`

**Interfaces:**
- Consumes: `DailyPoint[]`, `days`, `onDaysChange` — signature unchanged.
- Produces: unchanged default export.

Keep chart.js here — with up to 30 bars plus axes and tooltips it earns the dependency, unlike the six-row panel in Task 8.

- [ ] **Step 1: Update the card chrome and the segmented toggle**

Replace the returned JSX (lines 55-86) with:

```tsx
  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-space-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-title-md text-ink">Words learned per day</h2>
          <p className="m-0 text-body-sm text-muted">Daily pace tracked across active SRS intervals</p>
        </div>

        <div className="inline-flex shrink-0 rounded-lg bg-hairline-soft p-0.5 text-body-sm">
          {[7, 30].map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded px-2.5 py-1 transition-all ${
                days === option
                  ? 'bg-surface-card font-medium text-ink'
                  : 'text-muted hover:text-ink'
              }`}
              onClick={() => onDaysChange(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="h-44">
        <Bar data={data} options={options} />
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 font-mono text-code-sm text-muted">
        <span>
          {isEmpty
            ? `No words marked as learned in the last ${days} days.`
            : 'Consistent learning improves retention by 4x.'}
        </span>
        <span>Avg: {average} words/day</span>
      </div>
    </div>
  );
```

- [ ] **Step 2: Recolour the dataset and add the average**

Above the `return`, after the `isEmpty` line, add:

```tsx
  const average =
    daily.length > 0
      ? (daily.reduce((sum, point) => sum + point.learned_count, 0) / daily.length).toFixed(1)
      : '0.0';
```

Leave `backgroundColor: '#f54e00'` and `borderRadius: 4` in the `data` object exactly as they are — that is the frozen primary token.

In `options.scales.y.grid` change `color: '#e6e5e0'` to `color: '#efeee8'` so gridlines sit behind the bars as in the mock, and set `options.scales.x.ticks.font` and `y.ticks.font` to `{ family: 'JetBrains Mono', size: 11 }` to match the mono axis labels in the design.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build` — expected: exits 0. In the browser, toggling 7/30 days refetches and the average updates with it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/DailyLearnedChart.tsx
git commit -m "feat(dashboard): restyle daily chart to editorial card with mono axes"
```

---

### Task 10: DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/components/SessionCard.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 3), `StatsSection` (Task 7), tokens (Task 1).
- Produces: `SessionCard({ session, onDelete })` where `onDelete: (id: string) => void` — reused by `SessionsPage` in Task 11.

**Design reference:** `code.html` lines 4-24 (hero), 216-245 (sessions section), 247-263 (tip dock).

- [ ] **Step 1: Create `frontend/src/components/SessionCard.tsx`**

```tsx
import { ArrowRight, RotateCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Session } from '../types';

const MASTERED = 100;

type SessionCardProps = {
  session: Session;
  onDelete: (sessionId: string) => void;
};

export default function SessionCard({ session, onDelete }: SessionCardProps) {
  const percent =
    session.total_cards > 0
      ? Math.round((session.learned_cards / session.total_cards) * 100)
      : 0;
  const strong = percent >= 50;
  const mastered = percent >= MASTERED;

  return (
    <article className="group flex flex-col justify-between gap-space-sm rounded-xl border border-hairline bg-surface-card p-space-md transition-colors hover:bg-canvas-soft">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/sessions/${session.id}`}
          className="truncate text-title-md text-ink transition-colors group-hover:text-primary"
        >
          {session.title}
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`font-mono text-code-sm font-semibold ${
              strong ? 'text-secondary' : 'text-primary'
            }`}
          >
            {percent}%
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:border-primary hover:text-primary"
            onClick={() => onDelete(session.id)}
            title={`Delete ${session.title}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-hairline-soft">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              strong ? 'bg-secondary' : 'bg-primary'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-code-sm text-muted">
            {session.learned_cards} / {session.total_cards} learned
          </span>

          <Link
            to={`/sessions/${session.id}/study`}
            className={`inline-flex items-center gap-1 text-body-sm font-medium transition-colors ${
              mastered ? 'text-secondary hover:text-primary' : 'text-primary hover:text-primary-active'
            }`}
          >
            {mastered ? 'Review' : 'Study now'}
            {mastered ? <RotateCw size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Rewrite `frontend/src/pages/DashboardPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, History, Lightbulb, Play, Plus, Search, ClipboardList } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Session } from '../types';
import StatsSection from '../components/dashboard/StatsSection';
import PageHeader from '../components/PageHeader';
import SessionCard from '../components/SessionCard';
import SessionCreateModal from '../components/SessionCreateModal';

type FilterKey = 'all' | 'in-progress' | 'mastered';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Sessions' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'mastered', label: 'Mastered' },
];

const percentOf = (session: Session) =>
  session.total_cards > 0 ? Math.round((session.learned_cards / session.total_cards) * 100) : 0;

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [streakDays, setStreakDays] = useState<number | undefined>(undefined);

  const fetchSessions = async () => {
    setLoading(true);
    const response = await api.get('/sessions');
    setSessions(response.data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchSessions();
  }, []);

  const handleCreateSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      await api.post('/sessions', { title: title.trim() });
      setTitle('');
      setShowCreateModal(false);
      await fetchSessions();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sessions.filter((session) => {
      if (needle && !session.title.toLowerCase().includes(needle)) return false;

      const percent = percentOf(session);
      if (filter === 'in-progress') return percent < 100;
      if (filter === 'mastered') return session.total_cards > 0 && percent >= 100;
      return true;
    });
  }, [sessions, filter, query]);

  const resumeTarget = useMemo(
    () =>
      sessions
        .filter((session) => session.total_cards > 0 && percentOf(session) < 100)
        .sort((a, b) => percentOf(b) - percentOf(a))[0],
    [sessions],
  );

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} streakDays={streakDays} />

      <main className="page-container">
        <section className="rounded-xl border border-hairline bg-surface-card p-space-lg">
          <div className="flex flex-col justify-between gap-space-lg lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-space-xs">
              <span className="text-caption-uppercase uppercase tracking-wider text-muted">
                Welcome back
              </span>
              <h1 className="m-0 text-headline-lg font-medium tracking-tight text-ink">
                Great to see you, {user?.display_name}! Let's master something new today.
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-space-sm self-start lg:self-center">
              <Link
                to="/quizzes"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-4 text-body-sm font-medium text-ink transition-colors hover:bg-surface-container"
              >
                <History size={18} className="text-muted" />
                Review History
              </Link>

              {resumeTarget ? (
                <Link
                  to={`/sessions/${resumeTarget.id}/study`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  <Play size={18} />
                  Continue {resumeTarget.title}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  <Plus size={18} />
                  Add session
                </button>
              )}
            </div>
          </div>
        </section>

        <StatsSection sessions={sessions} onStreakChange={setStreakDays} />

        <section className="space-y-space-md">
          <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <h2 className="m-0 text-headline-md font-semibold text-ink">Your sessions</h2>
              <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-code-sm font-medium text-muted">
                {sessions.length} total
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="relative flex items-center">
                <Search size={18} className="absolute left-3 text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter decks..."
                  aria-label="Filter sessions by title"
                  className="h-10 w-44 rounded-lg border border-hairline bg-surface-card pl-9 pr-3 text-body-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink sm:w-56"
                />
              </div>

              <Link
                to="/quizzes"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-surface-container"
              >
                <ClipboardList size={18} className="text-muted" />
                Quizzes
                <span className="rounded bg-secondary-container px-1 py-0.5 text-caption-uppercase uppercase text-on-secondary-container">
                  New
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
              >
                <Plus size={18} />
                Add session
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
                  filter === item.key
                    ? 'bg-ink text-on-primary'
                    : 'border border-hairline bg-surface-card text-body hover:bg-surface-container'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-xl border border-hairline bg-surface-card p-space-xl text-center text-body-sm text-body">
              Loading sessions…
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline-strong bg-surface-card p-space-xl text-center">
              <BookOpenText size={36} className="text-muted" />
              <h3 className="m-0 text-title-md text-ink">
                {sessions.length === 0 ? 'No sessions yet' : 'No sessions match this filter'}
              </h3>
              <p className="m-0 text-body-sm text-body">
                {sessions.length === 0
                  ? 'Create your first study set to start reviewing vocabulary.'
                  : 'Try a different filter or clear the search box.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
              {visibleSessions.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={handleDeleteSession} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col items-center justify-between gap-space-md rounded-xl bg-surface-container p-space-md sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-card text-primary">
              <Lightbulb size={20} />
            </span>
            <p className="m-0 text-body-sm text-ink">
              <strong className="font-semibold">Spaced Repetition Tip:</strong> Spacing intervals by
              24h then 72h cements memory permanence twice as fast as cramming.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 font-mono text-code-sm text-muted">
            <span>Quick action:</span>
            <kbd className="rounded bg-surface-card px-2 py-0.5 text-ink">Space</kbd>
            <span>to flip</span>
            <kbd className="rounded bg-surface-card px-2 py-0.5 text-ink">1-4</kbd>
            <span>to grade</span>
          </div>
        </section>
      </main>

      <SessionCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={title}
        onTitleChange={setTitle}
        onSubmit={handleCreateSession}
        isCreating={creating}
      />
    </div>
  );
}
```

Two deliberate departures from the static mock: **"Continue IELTS Vocab"** resolves to the least-complete real session (falling back to Add session when there is nothing to resume), and **"Review History"** links to `/quizzes` because that is where attempt history lives. Before shipping, confirm the keyboard hints in the tip dock (`Space` to flip, `1-4` to grade) match `StudyPage`'s real bindings; if `1-4` grading does not exist, cut that half of the dock rather than advertising it.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build` — expected: exits 0.

In the browser at `/`: hero, four tiles, two panels, sessions toolbar with working search, three filter chips, 2-column card grid, tip dock. Type in the filter box and confirm cards narrow. Click "Mastered" with no fully-learned session and confirm the empty state reads "No sessions match this filter".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/components/SessionCard.tsx
git commit -m "feat(dashboard): editorial hero, session toolbar, filters and tip dock"
```

---

### Task 11: `/sessions` page and route

**Files:**
- Create: `frontend/src/pages/SessionsPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 3), `SessionCard` (Task 10), `SessionCreateModal`.
- Produces: route `/sessions`, which the header nav and footer already link to.

**Route ordering matters:** `/sessions` must be declared before or alongside `/sessions/:id`; react-router v6 ranks static segments above dynamic ones automatically, so ordering in the file is not load-bearing — but keep them adjacent for readability.

- [ ] **Step 1: Create `frontend/src/pages/SessionsPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Session } from '../types';
import PageHeader from '../components/PageHeader';
import SessionCard from '../components/SessionCard';
import SessionCreateModal from '../components/SessionCreateModal';

export default function SessionsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    const response = await api.get('/sessions');
    setSessions(response.data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchSessions();
  }, []);

  const handleCreateSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      await api.post('/sessions', { title: title.trim() });
      setTitle('');
      setShowCreateModal(false);
      await fetchSessions();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(needle));
  }, [sessions, query]);

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <main className="page-container">
        <section className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-center">
          <div className="space-y-space-xs">
            <span className="text-caption-uppercase uppercase tracking-wider text-muted">
              Library
            </span>
            <h1 className="m-0 text-headline-lg font-medium tracking-tight text-ink">
              All sessions
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="relative flex items-center">
              <Search size={18} className="absolute left-3 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter decks..."
                aria-label="Filter sessions by title"
                className="h-10 w-44 rounded-lg border border-hairline bg-surface-card pl-9 pr-3 text-body-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink sm:w-56"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              <Plus size={18} />
              Add session
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-hairline bg-surface-card p-space-xl text-center text-body-sm text-body">
            Loading sessions…
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline-strong bg-surface-card p-space-xl text-center">
            <BookOpenText size={36} className="text-muted" />
            <h3 className="m-0 text-title-md text-ink">
              {sessions.length === 0 ? 'No sessions yet' : 'No sessions match that search'}
            </h3>
            <p className="m-0 text-body-sm text-body">
              {sessions.length === 0
                ? 'Create your first study set to start reviewing vocabulary.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
            {visibleSessions.map((session) => (
              <SessionCard key={session.id} session={session} onDelete={handleDeleteSession} />
            ))}
          </div>
        )}
      </main>

      <SessionCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={title}
        onTitleChange={setTitle}
        onSubmit={handleCreateSession}
        isCreating={creating}
      />
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `frontend/src/App.tsx`**

Add the import beside the other page imports:

```tsx
import SessionsPage from './pages/SessionsPage';
```

Add this `<Route>` immediately before the existing `/sessions/:id` route:

```tsx
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <SessionsPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run build` — expected: exits 0.

In the browser: the header's "Sessions" pill is active at `/sessions` and not at `/`; `/sessions/:id` still opens the detail page (the static route must not swallow it); the footer "Sessions" link works.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SessionsPage.tsx frontend/src/App.tsx
git commit -m "feat(sessions): add standalone sessions library page and route"
```

---

## Verification Checklist

Run after the final task:

- [ ] `cd frontend && npm run build` — exits 0
- [ ] Visit `/`, `/sessions`, `/sessions/:id`, `/sessions/:id/study`, `/quizzes`, `/quizzes/:id`, `/quizzes/:id/take`, `/attempts/:id` — the header is full-width and sticky everywhere, content is centred, nothing overflows horizontally
- [ ] Resize to 375px, 768px, 1440px — KPI tiles go 1 / 2 / 4 across; session cards 1 / 2 / 2
- [ ] `git diff` on `tailwind.config.js` and `index.css` shows only **added** lines in the colour blocks — no existing token value was modified
- [ ] DevTools Network on `/` shows exactly two `/stats/daily` requests

## Known Deviations from the Mock

These are intentional and documented so a reviewer does not file them as bugs:

| Mock element | Decision | Reason |
|---|---|---|
| Primary orange `#a83300` | Stays `#f54e00` | Existing project token is frozen; `DESIGN.md` prose agrees with `#f54e00` |
| `↑ +12` on Total Words | Dropped | No historical word-count data |
| `+3.2%` on Overall Mastery | Dropped | No historical mastery data |
| "Personal best: 14 days" | Computed over a 365-day window | Real value from `daily[]`, not a constant |
| "Continue IELTS Vocab" | Resolves to the least-complete session | Mock hardcodes a deck name |
| "Review History" button | Links to `/quizzes` | Attempt history lives there |
| Footer "Study Arena" link | Removed | No standalone study route exists |
| Material Symbols icons | lucide-react equivalents | Already a dependency; avoids a second icon font |
| Profile photo in header | Existing `UserMenu` avatar icon | No avatar URL on the `User` type |

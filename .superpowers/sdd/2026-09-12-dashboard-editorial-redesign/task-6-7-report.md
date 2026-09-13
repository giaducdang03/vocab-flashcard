# Task 6 & 7 Report: KpiTile + StatsSection

## What was done

Both files were implemented back-to-back, exactly per the briefs, before any commit:

- **Task 6** — `frontend/src/components/dashboard/KpiTile.tsx` replaced entirely with the token-driven tile component: `label`, `value`, optional `unit`, `icon`, `badge`, `footnote`, `progress` (0-100 clamped track), and `accent` ('primary' | 'secondary', default 'primary') driving the bottom hairline color on hover.
- **Task 7** — `frontend/src/components/dashboard/StatsSection.tsx` rewritten to:
  - Accept `onStreakChange?: (days: number) => void` and report `current_streak` from the primary `/stats/daily` fetch (driven by `days` state, default 7).
  - Run a second, independent `/stats/daily` fetch for `days: 365` on mount only (empty deps), computing `bestStreak` via `longestStreak()` from Task 5's `lib/stats.ts` — unaffected by later `days` changes.
  - Compute `learnedToday` via `todayLearned(stats.daily)` and `totals.active` via `activeSessionCount(sessions)`.
  - Render four `KpiTile`s: Total words (BookMarked icon, active-session footnote), Learned (ShieldCheck icon, secondary accent, badge with % of total, "+N words today" footnote), Overall mastery (LineChart icon, progress bar), Streak (🔥 icon, unit="days", personal-best footnote from the 365-day fetch).
  - Keep the existing charts row (`DailyLearnedChart`, `SessionProgressChart`) and error messaging, restyled with token classes (`gap-gutter`, `text-body-sm`, etc.) and an updated empty-state block.

No other files were touched. Task 5's `frontend/src/lib/stats.ts` (`longestStreak`, `todayLearned`, `activeSessionCount`) was consumed as-is, already present from prior work.

## Verification

- Per the plan, Task 6 in isolation would fail the build (`StatsSection.tsx` still referencing the removed `suffix` prop) — this was not run as a separate isolated step since both tasks were implemented together before any build check, per the briefs' explicit instruction ("do both tasks before committing").
- After both files were in place: `cd frontend && npm run build` (tsc -b && vite build) — **exit 0**. Output:
  ```
  ✓ 1658 modules transformed.
  dist/index.html                  0.93 kB │ gzip:   0.51 kB
  dist/assets/index-L_32qOMQ.css   34.28 kB │ gzip:   7.53 kB
  dist/assets/index-BXvtVMSF.js   448.78 kB │ gzip: 144.85 kB
  ✓ built in 4.25s
  ```
  No TypeScript errors, confirming `KpiTile` props and `StatsSection`'s use of Task 5 functions/imports all type-check correctly.

## Commits

Single commit for both files:

```
b75f9d01b9b0e19ce764106cb895f45510829123 feat(stats): four metric tiles with streak and mastery derivations
```

Files in commit: `frontend/src/components/dashboard/KpiTile.tsx`, `frontend/src/components/dashboard/StatsSection.tsx`.

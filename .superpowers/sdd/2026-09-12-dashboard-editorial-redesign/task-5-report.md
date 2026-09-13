# Task 5: Stat derivations — Report

## What was done

Created `frontend/src/lib/stats.ts` with three pure functions:

- **`longestStreak(daily: DailyPoint[]): number`** — Computes longest run of consecutive entries with at least one word learned
- **`todayLearned(daily: DailyPoint[]): number`** — Returns words learned on the most recent day
- **`activeSessionCount(sessions: Session[]): number`** — Counts sessions with at least one card

All three functions consume `DailyPoint` and `Session` types from `frontend/src/types/index.ts` and are exported for use in StatsSection.

## Verification

```bash
cd frontend && npm run build
```

✓ Exit 0 — no TypeScript errors
✓ Build completed successfully (1657 modules transformed, 3.27s)

## Commits

- `17301bd` — feat(stats): add derivations for streak and daily counts

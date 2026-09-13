# Task 5: Stat derivations

**Files:**
- Create: `frontend/src/lib/stats.ts`

**Interfaces:**
- Consumes: `DailyPoint` and `Session` from `frontend/src/types/index.ts`
  - `DailyPoint = { date: string; learned_count: number }`
  - `Session` has `total_cards`, `learned_cards` fields
- Produces: three functions exported:
  - `longestStreak(daily: DailyPoint[]): number`
  - `todayLearned(daily: DailyPoint[]): number`
  - `activeSessionCount(sessions: Session[]): number`

**Purpose:** Extract non-presentational stat logic into a reusable module so StatsSection stays readable and the streak algorithm is easy to audit.

## Implementation

Create new file `frontend/src/lib/stats.ts` with this content:

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

## Verification

Run: `cd frontend && npm run build`
Expected: exits 0. No consumers yet — Task 7 wires these in.

## Commit

```bash
git add frontend/src/lib/stats.ts
git commit -m "feat(stats): add derivations for streak and daily counts"
```

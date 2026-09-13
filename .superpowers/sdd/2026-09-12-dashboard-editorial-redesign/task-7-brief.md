# Task 7: StatsSection

**Files:**
- Modify: `frontend/src/components/dashboard/StatsSection.tsx`

**Interfaces:**
- Consumes: `KpiTile` (Task 6), `longestStreak` / `todayLearned` / `activeSessionCount` from `frontend/src/lib/stats.ts` (Task 5), `DailyLearnedChart` (Task 9, not yet built), `SessionProgressChart` (Task 8, not yet built)
- Produces: `StatsSection({ sessions, onStreakChange? })` where `onStreakChange?: (days: number) => void` reports the current streak upward so DashboardPage can pass it to PageHeader

**Key logic:** Four tiles (Total Words, Learned, Overall Mastery, Streak). Two separate `/stats/daily` fetches:
1. Main fetch respects the `days` state (7 or 30), sends streak to parent via callback
2. Separate 365-day fetch happens once on mount, computes personal best streak via `longestStreak()`

## Implementation

Replace the body of `StatsSection` with this code:

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

## Verification

Run: `cd frontend && npm run build`
Expected: exits 0.

In the browser, check:
- Four tiles render in one row on desktop (≥1024px), 2×2 on tablet, stacked on mobile
- Network tab shows exactly TWO `/stats/daily` calls on mount (one for `days=7`, one for `days=365`)
- Streak tile shows current streak and personal best from the 365-day fetch
- Changing chart days does not change personal best number

## Commit

```bash
git add frontend/src/components/dashboard/KpiTile.tsx frontend/src/components/dashboard/StatsSection.tsx
git commit -m "feat(stats): four metric tiles with streak and mastery derivations"
```

Note: Do this together with Task 6. Task 6 alone will fail to build (missing imports and props in StatsSection) — that's expected. Once Task 7 is applied, the build succeeds.

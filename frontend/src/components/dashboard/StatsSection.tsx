import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { DailyStats, Session } from '../../types';
import KpiTile from './KpiTile';

type StatsSectionProps = {
  sessions: Session[];
};

export default function StatsSection({ sessions }: StatsSectionProps) {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    const tzOffsetMinutes = -new Date().getTimezoneOffset();

    setStatsLoading(true);

    api
      .get('/stats/daily', { params: { days, tz_offset_minutes: tzOffsetMinutes } })
      .then((response) => {
        if (!cancelled) {
          setStats(response.data);
          setStatsError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const totals = useMemo(() => {
    const total = sessions.reduce((sum, session) => sum + session.total_cards, 0);
    const learned = sessions.reduce((sum, session) => sum + session.learned_cards, 0);

    return {
      total,
      learned,
      percent: total > 0 ? Math.round((learned / total) * 100) : 0,
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>No study data yet. Create your first session to start tracking progress.</p>
      </div>
    );
  }

  const streakValue = statsError ? '—' : statsLoading ? '…' : (stats?.current_streak ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiTile label="Total words" value={totals.total} />
        <KpiTile label="Learned" value={totals.learned} />
        <KpiTile label="Mastery" value={totals.percent} suffix="%" />
        <KpiTile label="Streak" value={streakValue} suffix="days" />
      </div>

      {statsLoading && !stats && (
        <div className="bg-white border border-hairline rounded-2xl p-5 h-72 animate-pulse" />
      )}

      {statsError && (
        <p className="text-sm text-error m-0">
          Couldn't load daily stats. Your totals are still accurate.
        </p>
      )}
    </div>
  );
}

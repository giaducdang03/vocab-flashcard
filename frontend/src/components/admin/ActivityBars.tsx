import type { ActivityDay } from '../../types/admin';
import { formatWeekday } from '../../lib/adminFormat';

type ActivityBarsProps = {
  days: ActivityDay[];
};

export default function ActivityBars({ days }: ActivityBarsProps) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;

  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-caption-uppercase uppercase text-muted">Learning Rhythm</p>
          <h2 className="mt-1 text-title-md text-ink">Last 7 days</h2>
        </div>
        <span className="font-mono text-code-sm text-muted">
          {activeDays}/{days.length} active days · {total} actions
        </span>
      </div>

      <div className="mt-6 flex h-40 items-stretch gap-3">
        {days.map((day, index) => {
          const isToday = index === days.length - 1;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-code-sm text-muted">{day.count}</span>
              <div className="flex w-full flex-1 items-end rounded-md bg-hairline-soft">
                <div
                  className={`w-full rounded-md ${isToday ? 'bg-success' : 'bg-ink/70'}`}
                  style={{ height: `${(day.count / max) * 100}%` }}
                />
              </div>
              <span className="text-caption-uppercase uppercase text-muted">
                {isToday ? 'Today' : formatWeekday(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

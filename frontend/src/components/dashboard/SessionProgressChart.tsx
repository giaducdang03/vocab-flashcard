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

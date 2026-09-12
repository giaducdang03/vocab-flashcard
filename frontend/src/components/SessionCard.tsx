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

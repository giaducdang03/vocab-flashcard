import { ArrowRight, RotateCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Session } from '../types';
import { useFormatters } from '../lib/format';

const MASTERED = 100;

type SessionCardProps = {
  session: Session;
  onDelete: (sessionId: string) => void;
  variant?: 'card' | 'row';
};

export default function SessionCard({ session, onDelete, variant = 'card' }: SessionCardProps) {
  const { t } = useTranslation('session');
  const { date } = useFormatters();
  const percent =
    session.total_cards > 0
      ? Math.round((session.learned_cards / session.total_cards) * 100)
      : 0;
  const strong = percent >= 50;
  const mastered = percent >= MASTERED;
  const createdLabel = date(session.created_at);

  if (variant === 'row') {
    return (
      <article className="group flex flex-col gap-space-md rounded-xl border border-hairline bg-surface-card p-space-md transition-colors hover:bg-canvas-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            to={`/sessions/${session.id}`}
            className="block truncate text-title-md text-ink transition-colors group-hover:text-primary"
          >
            {session.title}
          </Link>
          <p className="m-0 font-mono text-code-sm text-muted">{t('card.session.createdLabel', { date: createdLabel })}</p>
        </div>

        <div className="flex items-center gap-space-md sm:w-64 sm:shrink-0">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline-soft">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                strong ? 'bg-secondary' : 'bg-primary'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span
            className={`shrink-0 font-mono text-code-sm font-semibold ${
              strong ? 'text-secondary' : 'text-primary'
            }`}
          >
            {percent}%
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-space-md">
          <span className="font-mono text-code-sm text-muted">
            {t('card.session.learnedCount', { learned: session.learned_cards, total: session.total_cards })}
          </span>

          <Link
            to={`/sessions/${session.id}/study`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-body-sm font-medium text-on-primary transition-colors ${
              mastered ? 'bg-secondary hover:bg-secondary/85' : 'bg-primary hover:bg-primary-active'
            }`}
          >
            {mastered ? t('card.session.review') : t('card.session.studyNow')}
            {mastered ? <RotateCw size={16} /> : <ArrowRight size={16} />}
          </Link>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:border-primary hover:text-primary"
            onClick={() => onDelete(session.id)}
            title={t('card.session.deleteTitle', { title: session.title })}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col justify-between gap-space-sm rounded-xl border border-hairline bg-surface-card p-space-md transition-colors hover:bg-canvas-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/sessions/${session.id}`}
            className="block truncate text-title-md text-ink transition-colors group-hover:text-primary"
          >
            {session.title}
          </Link>
          <p className="m-0 font-mono text-code-sm text-muted">{t('card.session.createdLabel', { date: createdLabel })}</p>
        </div>

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
            title={t('card.session.deleteTitle', { title: session.title })}
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
            {t('card.session.learnedCount', { learned: session.learned_cards, total: session.total_cards })}
          </span>

          <Link
            to={`/sessions/${session.id}/study`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-body-sm font-medium text-on-primary transition-colors ${
              mastered ? 'bg-secondary hover:bg-secondary/85' : 'bg-primary hover:bg-primary-active'
            }`}
          >
            {mastered ? t('card.session.review') : t('card.session.studyNow')}
            {mastered ? <RotateCw size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>
      </div>
    </article>
  );
}

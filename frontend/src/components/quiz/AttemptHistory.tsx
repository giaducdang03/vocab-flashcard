import { ArrowRight, CalendarDays, Check, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { QuizAttemptSummary } from '../../types';
import { useFormatters } from '../../lib/format';
import {
  formatDuration,
  isStrongScore,
  percentOf,
  sortNewestFirst,
} from '../../utils/quizStats';

type AttemptHistoryProps = {
  attempts: QuizAttemptSummary[];
};

export default function AttemptHistory({ attempts }: AttemptHistoryProps) {
  const navigate = useNavigate();
  const { t } = useTranslation('quiz');
  const { dateTime } = useFormatters();

  if (attempts.length === 0) {
    return (
      <div className="grid min-h-[180px] place-items-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-canvas-soft p-space-xl text-center">
        <h3 className="text-title-md text-ink">{t('history.emptyTitle')}</h3>
        <p className="text-body-sm text-body">{t('history.emptyBody')}</p>
      </div>
    );
  }

  const ordered = sortNewestFirst(attempts);

  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface-card">
      {ordered.map((attempt, index) => {
        // Rows render newest-first, but attempts are numbered chronologically from the oldest.
        const attemptNumber = ordered.length - index;
        const isLatest = index === 0;
        const percent = percentOf(attempt.score, attempt.total_questions);
        const strong = isStrongScore(percent);
        const missed = attempt.total_questions - attempt.score;

        return (
          <div
            key={attempt.id}
            className="group flex flex-col justify-between gap-space-sm p-space-md transition-colors hover:bg-canvas-soft sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-space-md sm:items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hairline-soft font-mono text-code-sm font-medium ${
                  isLatest ? 'text-ink' : 'text-muted'
                }`}
              >
                {t('history.attemptBadge', { number: attemptNumber })}
              </div>

              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-title-sm text-ink">
                    {t('history.attemptLabel', { number: attemptNumber })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      strong
                        ? 'border-secondary-fixed bg-learned-surface text-secondary'
                        : 'border-hairline bg-hairline-soft text-body'
                    }`}
                  >
                    {strong && <Check size={13} />}
                    {t('history.scorePercent', { percent })}
                  </span>
                  {isLatest && (
                    <span className="rounded bg-hairline-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-body">
                      {t('history.latest')}
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                  <span className="flex items-center gap-1 font-mono text-code-sm">
                    <CalendarDays size={15} className="text-muted-soft" />
                    {dateTime(attempt.submitted_at)}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="flex items-center gap-1 font-mono text-code-sm">
                    <Timer size={15} className="text-muted-soft" />
                    {formatDuration(attempt.duration_seconds)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-space-md pl-12 sm:justify-end sm:pl-0">
              <div className="text-left font-mono text-code-sm sm:text-right">
                <div className="font-medium text-ink">
                  {t('history.scoreFraction', {
                    score: attempt.score,
                    total: attempt.total_questions,
                  })}
                </div>
                <div className="text-[11px] text-muted">
                  {t('history.correctMissed', { correct: attempt.score, missed })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/attempts/${attempt.id}`)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-hairline-strong bg-surface-card px-3 py-1.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft group-hover:border-ink/40"
              >
                {t('history.reviewAttempt')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

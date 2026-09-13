import { BarChart3, History, ListChecks, Trophy } from 'lucide-react';
import type { QuizAttemptSummary } from '../../types';
import { computeQuizStats } from '../../utils/quizStats';

type QuizStatCardsProps = {
  questionCount: number;
  attempts: QuizAttemptSummary[];
};

const CARD_CLASS =
  'flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-space-md';
const EYEBROW_CLASS = 'mb-2 flex items-center justify-between text-muted';
const LABEL_CLASS = 'text-caption-uppercase uppercase';
const TRACK_CLASS = 'mt-3 h-1 w-full overflow-hidden rounded-full bg-hairline-soft';

/** Four dots that fill in as attempts accumulate, mirroring the mock's attempt meter. */
const ATTEMPT_DOTS = [1, 2, 3, 4];

export default function QuizStatCards({ questionCount, attempts }: QuizStatCardsProps) {
  const stats = computeQuizStats(attempts);

  return (
    <div className="grid grid-cols-2 gap-space-sm md:grid-cols-4">
      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Total Questions</span>
          <ListChecks size={18} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg text-ink">{questionCount}</span>
          <span className="font-mono text-code-sm text-muted">items</span>
        </div>
        <div className={TRACK_CLASS}>
          <div className="h-full w-full rounded-full bg-ink" />
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Total Attempts</span>
          <History size={18} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg text-ink">{stats.attemptCount}</span>
          <span className="font-mono text-code-sm text-muted">completed</span>
        </div>
        <div className="mt-3 flex items-center gap-1">
          {ATTEMPT_DOTS.map((dot) => (
            <span
              key={dot}
              className={`h-1 w-2.5 rounded-full ${
                dot <= stats.attemptCount ? 'bg-secondary' : 'bg-hairline-strong'
              }`}
            />
          ))}
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Best Score</span>
          <Trophy size={18} className={stats.bestPercent === null ? undefined : 'text-secondary'} />
        </div>
        <div className="flex items-baseline gap-2">
          {stats.bestScore === null ? (
            <span className="text-headline-lg text-muted">—</span>
          ) : (
            <>
              <span className="text-headline-lg text-ink">
                {stats.bestScore}
                <span className="text-body-sm font-normal text-body">/{stats.bestTotal}</span>
              </span>
              <span className="rounded border border-secondary-fixed bg-learned-surface px-1.5 py-0.5 text-[11px] font-medium text-secondary">
                {stats.bestPercent}%
              </span>
            </>
          )}
        </div>
        <div className={TRACK_CLASS}>
          <div
            className="h-full rounded-full bg-secondary"
            style={{ width: `${stats.bestPercent ?? 0}%` }}
          />
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={EYEBROW_CLASS}>
          <span className={LABEL_CLASS}>Average Score</span>
          <BarChart3 size={18} />
        </div>
        <div className="flex items-baseline gap-2">
          {stats.averageScore === null ? (
            <span className="text-headline-lg text-muted">—</span>
          ) : (
            <>
              <span className="text-headline-lg text-ink">
                {stats.averageScore}
                <span className="text-body-sm font-normal text-body">/{questionCount}</span>
              </span>
              <span className="font-mono text-code-sm text-muted">
                {stats.averagePercent}% avg
              </span>
            </>
          )}
        </div>
        <div className={TRACK_CLASS}>
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${stats.averagePercent ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

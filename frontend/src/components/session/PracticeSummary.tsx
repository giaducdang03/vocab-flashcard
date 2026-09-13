import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PracticeAnswer, QuestionType } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type PracticeSummaryProps = {
  answers: PracticeAnswer[];
  durationSeconds: number;
  sessionId: string;
  sessionTitle: string;
  onRestart: () => void;
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};


export default function PracticeSummary({
  answers,
  durationSeconds,
  sessionId,
  sessionTitle,
  onRestart,
}: PracticeSummaryProps) {
  const total = answers.length;
  const correct = answers.filter((a) => a.is_correct).length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Calculate breakdown by question type
  const typeBreakdown: Record<QuestionType, { correct: number; total: number }> = {
    en_to_vi: { correct: 0, total: 0 },
    vi_to_en: { correct: 0, total: 0 },
    synonym: { correct: 0, total: 0 },
  };

  answers.forEach((answer) => {
    const type = answer.question.question_type;
    typeBreakdown[type].total += 1;
    if (answer.is_correct) {
      typeBreakdown[type].correct += 1;
    }
  });

  const breakdown = Object.entries(typeBreakdown)
    .map(([type, stats]) => ({
      type: type as QuestionType,
      correct: stats.correct,
      total: stats.total,
    }))
    .filter((row) => row.total > 0);

  // Get wrong answers
  const wrong = answers.filter((a) => !a.is_correct);

  return (
    <div className="page-shell">
      <main className="page-container compact">
        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
            Practice complete
          </span>

          <h1 className="mb-0 mt-4 text-headline-lg font-medium tracking-tight text-ink">
            {sessionTitle}
          </h1>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <div className="font-mono text-headline-lg font-semibold text-ink">
                {correct}/{total}
              </div>
              <div className="text-body-sm text-muted">Correct answers</div>
            </div>
            <div>
              <div className="font-mono text-headline-lg font-semibold text-primary">{percent}%</div>
              <div className="text-body-sm text-muted">Accuracy</div>
            </div>
            <div>
              <div className="font-mono text-headline-lg font-semibold text-ink">
                {formatDuration(durationSeconds)}
              </div>
              <div className="text-body-sm text-muted">Time spent</div>
            </div>
          </div>

          <div className="mt-6 flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent < 33 ? 'bg-error' : percent < 67 ? 'bg-primary' : 'bg-success'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              <RotateCcw size={18} />
              Practice again
            </button>
            <Link
              to={`/sessions/${sessionId}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
            >
              <ArrowLeft size={18} className="text-muted" />
              Back to session
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <h2 className="m-0 text-headline-md font-medium text-ink">By question type</h2>
          <div className="mt-4 space-y-3">
            {breakdown.map((row) => {
              const rowPercent = Math.round((row.correct / row.total) * 100);
              return (
                <div key={row.type}>
                  <div className="mb-1.5 flex items-center justify-between text-body-sm">
                    <span className="font-medium text-ink">{QUESTION_TYPE_LABELS[row.type]}</span>
                    <span className="font-mono text-code-sm text-body">
                      <strong className="font-semibold text-ink">{row.correct}</strong>/{row.total} ({rowPercent}%)
                    </span>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${rowPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <h2 className="m-0 text-headline-md font-medium text-ink">
            {wrong.length > 0 ? `Review ${wrong.length} missed` : 'Nothing missed'}
          </h2>

          {wrong.length === 0 ? (
            <p className="mb-0 mt-3 text-body-sm text-muted">
              A clean run — every answer was correct.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none space-y-4 p-0">
              {wrong.map((answer) => (
                <li
                  key={answer.question.card_id}
                  className="rounded-lg border border-hairline bg-canvas-soft p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-hairline-soft px-2 py-0.5 text-caption-uppercase font-bold uppercase tracking-wider text-muted">
                      {QUESTION_TYPE_LABELS[answer.question.question_type]}
                    </span>
                    <span className="text-body-sm font-medium text-ink">
                      {answer.question.prompt_text}
                    </span>
                  </div>
                  <div className="space-y-1 text-body-sm">
                    <div className="text-error">
                      You chose: {answer.question.options[answer.selected_index]}
                    </div>
                    <div className="text-success">
                      Correct: {answer.question.options[answer.question.correct_index]}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

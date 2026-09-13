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

const getAccuracyColor = (accuracy: number) => {
  if (accuracy < 33) return 'bg-red-500';
  if (accuracy < 67) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getAccuracyColorClass = (accuracy: number) => {
  if (accuracy < 33) return '#ef4444';
  if (accuracy < 67) return '#eab308';
  return '#10b981';
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
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

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

  // Get wrong answers
  const wrongAnswers = answers.filter((a) => !a.is_correct);

  const typeColors: Record<QuestionType, { bg: string; text: string }> = {
    en_to_vi: { bg: 'bg-blue-50', text: 'text-blue-700' },
    vi_to_en: { bg: 'bg-purple-50', text: 'text-purple-700' },
    synonym: { bg: 'bg-orange-50', text: 'text-orange-700' },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Card with Summary */}
      <div className="hero-card">
        <div>
          <p className="eyebrow">{sessionTitle}</p>
          <div className="mt-3">
            <p className="text-lg font-semibold">
              {correct} / {total} correct · {accuracy}%
            </p>
            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--hairline)',
                }}
              >
                <div
                  style={{
                    width: `${accuracy}%`,
                    backgroundColor: getAccuracyColorClass(accuracy),
                    transition: 'width 0.3s ease',
                  }}
                />
                <div
                  style={{
                    width: `${100 - accuracy}%`,
                    backgroundColor: '#ef4444',
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-body mt-3">
              Finished in {formatDuration(durationSeconds)}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onRestart}
        >
          <RotateCcw size={16} />
          Practice again
        </button>
      </div>

      {/* Breakdown by Question Type */}
      <div>
        <div className="section-header">
          <h2>Breakdown by question type</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Object.entries(typeBreakdown).map(([type, stats]) => {
            if (stats.total === 0) return null;
            const percent = Math.round((stats.correct / stats.total) * 100);
            const colors = typeColors[type as QuestionType];
            return (
              <div
                key={type}
                className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-card p-4"
              >
                <span
                  className={`inline-block w-fit px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}
                >
                  {QUESTION_TYPE_LABELS[type as QuestionType]}
                </span>
                <div>
                  <p className="text-xs text-muted font-semibold uppercase">Accuracy</p>
                  <p className="text-2xl font-semibold text-ink mt-1">{percent}%</p>
                  <p className="text-sm text-body mt-1">
                    {stats.correct} / {stats.total} correct
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wrong Answers */}
      {wrongAnswers.length > 0 && (
        <div>
          <div className="section-header">
            <h2>Missed questions ({wrongAnswers.length})</h2>
          </div>
          <div className="flex flex-col gap-4">
            {wrongAnswers.map((answer, index) => {
              const type = answer.question.question_type;
              const colors = typeColors[type];
              const correctAnswer = answer.question.options[answer.question.correct_index];
              const selectedAnswer = answer.question.options[answer.selected_index];

              return (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}
                    >
                      {QUESTION_TYPE_LABELS[type]}
                    </span>
                    <strong className="flex-1">{answer.question.prompt_text}</strong>
                    {answer.question.prompt_phonetic && (
                      <span className="text-xs text-muted">
                        {answer.question.prompt_phonetic}
                      </span>
                    )}
                  </div>

                  <div className="pl-0 sm:pl-8">
                    <p className="text-sm text-body mb-2">
                      <strong>Correct answer:</strong>{' '}
                      <span style={{ color: '#16a34a' }}>
                        {correctAnswer}
                      </span>
                    </p>
                    <p className="text-sm text-body">
                      <strong>Your answer:</strong>{' '}
                      <span style={{ color: '#dc2626' }}>
                        {selectedAnswer}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          className="btn btn-secondary flex-1"
          onClick={onRestart}
        >
          <RotateCcw size={16} />
          Practice again
        </button>
        <Link
          to={`/sessions/${sessionId}`}
          className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to session
        </Link>
      </div>
    </div>
  );
}

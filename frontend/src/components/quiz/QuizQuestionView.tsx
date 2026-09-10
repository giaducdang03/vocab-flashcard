import type { AnswerResult, QuizQuestion } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type QuizQuestionViewProps = {
  question: QuizQuestion;
  index: number;
  total: number;
  result: AnswerResult | null;
  isChecking: boolean;
  selectedIndex: number | null;
  onSelect: (optionIndex: number) => void;
  onNext: () => void;
  isLast: boolean;
};

export default function QuizQuestionView({
  question,
  index,
  total,
  result,
  isChecking,
  selectedIndex,
  onSelect,
  onNext,
  isLast,
}: QuizQuestionViewProps) {
  const progressPercent = ((index + 1) / total) * 100;
  const hasResult = result !== null;

  const getOptionButtonClass = (optionIndex: number): string => {
    const baseClass = 'option-button';

    if (!hasResult) {
      if (selectedIndex === optionIndex) {
        return `${baseClass} checked`;
      }
      return baseClass;
    }

    if (optionIndex === result.correct_index) {
      return `${baseClass} correct`;
    }

    if (selectedIndex === optionIndex && !result.is_correct) {
      return `${baseClass} wrong`;
    }

    return baseClass;
  };

  return (
    <div className="page-shell">
      <main className="page-container">
        {/* Progress box */}
        <div className="progress-box">
          <span>
            Question {index + 1} of {total}
          </span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Hero card with question */}
        <section className="hero-card">
          <div style={{ flex: 1 }}>
            <span className="badge">{QUESTION_TYPE_LABELS[question.question_type]}</span>
            <h1 className="quiz-prompt">{question.prompt_text}</h1>
            {question.prompt_phonetic && (
              <p className="quiz-prompt-phonetic">{question.prompt_phonetic}</p>
            )}
          </div>
        </section>

        {/* Options list */}
        <section className="option-list">
          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              type="button"
              className={getOptionButtonClass(optionIndex)}
              onClick={() => onSelect(optionIndex)}
              disabled={isChecking || hasResult}
            >
              {option}
            </button>
          ))}
        </section>

        {/* Feedback and Next button */}
        {hasResult && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              paddingTop: '8px',
            }}
          >
            <span
              style={{
                fontSize: '16px',
                fontWeight: 500,
                color: result.is_correct ? 'var(--success)' : 'var(--error)',
              }}
            >
              {result.is_correct ? 'Correct!' : 'Not quite.'}
            </span>
            <button type="button" className="btn btn-primary" onClick={onNext}>
              {isLast ? 'Finish quiz' : 'Next question'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

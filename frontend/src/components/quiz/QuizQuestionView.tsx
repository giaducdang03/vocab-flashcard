import type { AnswerResult, QuizQuestion } from '../../types';
import { CORRECT_MESSAGES, QUESTION_TYPE_HINTS, WRONG_MESSAGES } from '../../types';
import { ArrowRight, Check, Sparkles, X } from 'lucide-react';

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

const verdictMessage = (isCorrect: boolean, index: number): string => {
  const messages = isCorrect ? CORRECT_MESSAGES : WRONG_MESSAGES;
  return messages[index % messages.length];
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

  const BLANK_TYPES = ['cloze', 'verb_tense'];

  const renderPrompt = (text: string, questionType: string) => {
    if (!BLANK_TYPES.includes(questionType) || !text.includes('___')) {
      return text;
    }

    const [before, ...rest] = text.split('___');

    return (
      <>
        {before}
        <span className="cloze-blank" aria-label="blank" />
        {rest.join('___')}
      </>
    );
  };

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
          <div className="progress-box-header">
            <span>
              Question {index + 1} of {total}
            </span>
            <span className="progress-percent">{Math.round(progressPercent)}% completed</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Hero card with question */}
        <section className={question.source === 'ai' ? 'hero-card hero-card--ai' : 'hero-card'}>
          {question.source === 'ai' && (
            <span className="ai-corner-chip" title="AI-generated question; may contain mistakes.">
              <Sparkles size={12} />
              AI-generated
            </span>
          )}
          <div style={{ flex: 1, paddingTop: question.source === 'ai' ? '20px' : 0 }}>
            <p className="quiz-type-hint">{QUESTION_TYPE_HINTS[question.question_type]}</p>
            <h1 className="quiz-prompt">
              {renderPrompt(question.prompt_text, question.question_type)}
            </h1>
            {question.prompt_phonetic && (
              <p className="quiz-prompt-phonetic">{question.prompt_phonetic}</p>
            )}
          </div>
        </section>

        {/* Options list */}
        <section className="option-list">
          {question.options.map((option, optionIndex) => {
            const letter = String.fromCharCode(65 + optionIndex);
            const isCorrectOption = hasResult && optionIndex === result.correct_index;

            return (
              <button
                key={optionIndex}
                type="button"
                className={getOptionButtonClass(optionIndex)}
                onClick={() => onSelect(optionIndex)}
                disabled={isChecking || hasResult}
              >
                <span className="option-letter">{letter}</span>
                {option}
                {isCorrectOption && <Check size={18} className="option-check" />}
              </button>
            );
          })}
        </section>

        {/* One feedback panel: verdict + explanation on the left, Next on the right */}
        {hasResult && (
          <div
            className={`feedback-panel ${
              result.is_correct ? 'feedback-panel--correct' : 'feedback-panel--wrong'
            }`}
          >
            <div className="feedback-panel-body">
              <div className="feedback-verdict">
                {result.is_correct ? <Check size={18} /> : <X size={18} />}
                {verdictMessage(result.is_correct, index)}
                {result.explanation && (
                  <span className="ai-chip" title="AI-generated content may contain mistakes.">
                    <Sparkles />
                    AI-generated
                  </span>
                )}
              </div>
              {result.explanation && <p className="feedback-explanation">{result.explanation}</p>}
            </div>
            <button type="button" className="btn btn-primary" onClick={onNext}>
              {isLast ? 'Finish quiz' : 'Next question'}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

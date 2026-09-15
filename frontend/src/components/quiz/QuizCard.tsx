import { ArrowRight, Sparkles, Trash2 } from 'lucide-react';
import type { Quiz } from '../../types';
import QuestionTypeBadges from '../QuestionTypeBadges';

type QuizCardProps = {
  quiz: Quiz;
  onOpen: () => void;
  onDelete: () => void;
  onRetry: (quizId: string) => void;
};

export default function QuizCard({ quiz, onOpen, onDelete, onRetry }: QuizCardProps) {
  if (quiz.status === 'pending') {
    return (
      <article className="quiz-card quiz-card--pending ai-frame">
        <h3 className="quiz-card__title">{quiz.title}</h3>
        <p className="quiz-card__note">
          <Sparkles size={14} />
          AI is generating the quiz…
        </p>
        <div className="quiz-card__skeleton" />
      </article>
    );
  }

  if (quiz.status === 'failed') {
    return (
      <article className="quiz-card quiz-card--failed">
        <h3 className="quiz-card__title">{quiz.title}</h3>
        <p className="quiz-card__error">{quiz.error_message ?? 'Quiz generation failed.'}</p>
        <button
          type="button"
          className="btn btn-secondary quiz-card__retry"
          onClick={() => onRetry(quiz.id)}
        >
          Retry
        </button>
      </article>
    );
  }

  return (
    <article
      className={
        quiz.uses_ai
          ? 'ai-frame border rounded-2xl p-5 flex flex-col gap-4'
          : 'bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4'
      }
      style={quiz.uses_ai ? { paddingTop: '28px' } : undefined}
    >
      {quiz.uses_ai && (
        <span className="ai-corner-chip" title="Contains AI-generated questions; may contain mistakes.">
          <Sparkles size={12} />
          AI-generated
        </span>
      )}
      {/* Header: title + delete icon-button */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold letter-spacing-tight text-ink flex-1">
          {quiz.title}
        </h3>
        <button
          type="button"
          className="w-9 h-9 border border-hairline rounded-xl bg-white text-ink hover:border-primary hover:text-primary transition-all flex items-center justify-center"
          onClick={onDelete}
          title="Delete quiz"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Badges: question types */}
      <QuestionTypeBadges types={quiz.question_types} />

      {/* Meta row: question count, attempts, best score */}
      <div className="quiz-stat-box">
        <div className="quiz-stat">
          <span className="quiz-stat-label">Questions</span>
          <span className="quiz-stat-value">{quiz.question_count}</span>
        </div>
        <div className="quiz-stat">
          <span className="quiz-stat-label">Attempts</span>
          <span className="quiz-stat-value">{quiz.attempt_count}</span>
        </div>
        <div className="quiz-stat">
          <span className="quiz-stat-label">Best</span>
          <span className={quiz.best_score !== null ? 'quiz-stat-value quiz-stat-value-best' : 'quiz-stat-value'}>
            {quiz.best_score !== null ? `${quiz.best_score} / ${quiz.question_count}` : '—'}
          </span>
        </div>
      </div>

      {/* Meta row: source sessions */}
      <div className="text-sm text-body">
        {quiz.source_session_titles.length > 0
          ? `From: ${quiz.source_session_titles.join(', ')}`
          : '—'}
      </div>

      {/* Button: Open quiz */}
      <button
        type="button"
        onClick={onOpen}
        className="w-full px-4 py-2 bg-primary text-white border border-primary rounded-lg hover:bg-primary-active font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        Open quiz
        <ArrowRight size={15} />
      </button>
    </article>
  );
}

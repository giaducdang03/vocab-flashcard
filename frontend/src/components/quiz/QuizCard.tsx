import { Trash2 } from 'lucide-react';
import type { Quiz } from '../../types';
import QuestionTypeBadges from '../QuestionTypeBadges';

type QuizCardProps = {
  quiz: Quiz;
  onOpen: () => void;
  onDelete: () => void;
};

export default function QuizCard({ quiz, onOpen, onDelete }: QuizCardProps) {
  return (
    <article className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4">
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
      <div className="flex justify-between gap-2 text-sm text-body">
        <span>{quiz.question_count} questions</span>
        <span>{quiz.attempt_count} attempts</span>
        <span>
          Best:{' '}
          {quiz.best_score !== null ? `${quiz.best_score}/${quiz.question_count}` : '—'}
        </span>
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
        className="w-full px-4 py-2 bg-primary text-white border border-primary rounded-lg hover:bg-primary-active font-semibold text-sm transition-all"
      >
        Open quiz
      </button>
    </article>
  );
}

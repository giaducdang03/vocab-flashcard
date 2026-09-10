import { Trash2 } from 'lucide-react';
import type { Quiz, QUESTION_TYPE_LABELS } from '../../types';
import { QUESTION_TYPE_LABELS as LABELS } from '../../types';

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
        <h3 className="text-xl font-light letter-spacing-tight text-ink flex-1">
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
      <div className="flex flex-wrap gap-2">
        {quiz.question_types.map((type) => (
          <span
            key={type}
            className="inline-flex items-center justify-center px-2 py-1 bg-orange-100/20 text-ink text-xs font-bold uppercase rounded-full"
          >
            {type === 'en_to_vi' && 'EN→VI'}
            {type === 'vi_to_en' && 'VI→EN'}
            {type === 'synonym' && 'Synonym'}
          </span>
        ))}
      </div>

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
        className="w-full px-4 py-2 bg-primary text-white border border-primary rounded-lg hover:bg-primary-dark font-semibold text-sm transition-all"
      >
        Open quiz
      </button>
    </article>
  );
}

import type { QuestionType } from '../types';
import { QUESTION_TYPE_COLORS, QUESTION_TYPE_LABELS } from '../types';

interface QuestionTypeBadgesProps {
  types: QuestionType[];
  variant?: 'inline' | 'stacked';
}

export default function QuestionTypeBadges({ types, variant = 'inline' }: QuestionTypeBadgesProps) {
  const uniqueTypes = Array.from(new Set(types));

  const containerClass = variant === 'stacked' ? 'flex flex-col gap-2' : 'flex gap-2 flex-wrap';

  return (
    <div className={containerClass}>
      {uniqueTypes.map((type) => {
        const colors = QUESTION_TYPE_COLORS[type];
        return (
          <span
            key={type}
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}
          >
            {QUESTION_TYPE_LABELS[type]}
          </span>
        );
      })}
    </div>
  );
}

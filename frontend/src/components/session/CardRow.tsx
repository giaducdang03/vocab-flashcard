import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import type { Card } from '../../types';

type CardRowProps = {
  card: Card;
  index: number;
  selected: boolean;
  onToggleSelect: (cardId: string) => void;
  onToggleLearned: (cardId: string, value: boolean) => void;
  onDelete: (cardId: string) => void;
};

export default function CardRow({ card, index, selected, onToggleSelect, onToggleLearned, onDelete }: CardRowProps) {
  const isCollocation = card.card_type === 'collocation';

  return (
    <article
      className={`rounded-xl p-5 transition-colors sm:p-6 ${
        card.is_learned ? 'border-2 border-success bg-surface-card' : 'bg-surface-card hover:bg-canvas-soft'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(card.id)}
            className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-0"
            aria-label={`Select ${card.front_text}`}
          />
          <span
            className={`inline-flex items-center rounded px-2.5 py-0.5 text-caption-uppercase font-bold uppercase tracking-wide text-surface-card ${
              isCollocation ? 'bg-tertiary' : 'bg-ink'
            }`}
          >
            {isCollocation ? 'Collocation' : 'Vocab'}
          </span>
          <span className="font-mono text-code-sm text-muted">#{String(index + 1).padStart(2, '0')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleLearned(card.id, !card.is_learned)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-body-sm font-semibold transition-colors ${
              card.is_learned
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-surface-card text-body hover:text-secondary'
            }`}
          >
            {card.is_learned ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-muted" />}
            {card.is_learned ? 'Learned' : 'Mark learned'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(card.id)}
            title="Delete card"
            className="rounded-lg p-1.5 text-muted transition-colors hover:text-error"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-baseline gap-6 md:grid-cols-12">
        <div className="space-y-1 md:col-span-6">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {isCollocation ? 'Collocation phrase' : 'Front'}
          </span>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h3 className="text-title-md font-semibold text-ink">{card.front_text}</h3>
            {card.front_phonetic && (
              <span className="font-mono text-code-phonetic text-tertiary">{card.front_phonetic}</span>
            )}
          </div>

          {card.synonyms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-3">
              {card.synonyms.map((synonym) => (
                <span
                  key={synonym.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-canvas-soft px-2.5 py-1 text-body-sm"
                >
                  <span className="text-muted">syn:</span>
                  <strong className="font-medium text-ink">{synonym.word}</strong>
                  {synonym.phonetic && (
                    <span className="font-mono text-code-sm text-muted">/{synonym.phonetic}/</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1 md:col-span-6">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {isCollocation ? 'Vietnamese definition & context' : 'Back'}
          </span>
          <p className="text-title-md text-ink">{card.back_text}</p>
          {card.example &&
            (isCollocation ? (
              <div className="mt-2 rounded-lg bg-canvas p-3 text-body-sm text-ink">
                <span className="font-semibold text-primary">Example: </span>
                {card.example}
              </div>
            ) : (
              <p className="pt-1 text-body-sm italic text-muted">&ldquo;{card.example}&rdquo;</p>
            ))}
        </div>
      </div>
    </article>
  );
}

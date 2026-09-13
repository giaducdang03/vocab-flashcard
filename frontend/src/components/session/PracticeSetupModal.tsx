import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Card, QuestionType } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type PracticeSetupModalProps = {
  isOpen: boolean;
  sessionId: string;
  cards: Card[];
  onClose: () => void;
};

export default function PracticeSetupModal({
  isOpen,
  sessionId,
  cards,
  onClose,
}: PracticeSetupModalProps) {
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'en_to_vi',
    'vi_to_en',
    'synonym',
  ]);

  // Check if any cards have synonyms
  const hasSynonyms = useMemo(() => cards.some((card) => card.synonyms.length > 0), [cards]);

  // Calculate predicted question count
  const questionCount = useMemo(() => {
    // Count each card exactly once if it's eligible for at least one selected type
    return cards.filter((card) => {
      return selectedTypes.some((type) => {
        if (type === 'synonym') return card.synonyms.length > 0;
        return true;
      });
    }).length;
  }, [cards, selectedTypes]);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );
  };

  const handleStartPractice = () => {
    navigate(`/sessions/${sessionId}/practice`, {
      state: { questionTypes: selectedTypes },
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const canStart = selectedTypes.length > 0 && questionCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 animate-fadeIn">
      <div className="flex w-[90vw] max-w-md flex-col rounded-3xl border border-hairline bg-canvas animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-7 py-6">
          <h2 className="m-0 text-headline-md font-medium text-ink">Quick practice</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-ink transition-colors hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-7 py-7">
          {/* Question Types Section */}
          <div className="space-y-4">
            <h3 className="text-body-sm font-semibold text-ink">Question types</h3>

            <div className="space-y-3">
              {/* EN to VI */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes('en_to_vi')}
                  onChange={() => toggleType('en_to_vi')}
                  className="mt-0.5 rounded border border-hairline accent-primary"
                />
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-ink">
                    {QUESTION_TYPE_LABELS.en_to_vi}
                  </div>
                  <div className="text-caption text-muted">Translate English to Vietnamese</div>
                </div>
              </label>

              {/* VI to EN */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes('vi_to_en')}
                  onChange={() => toggleType('vi_to_en')}
                  className="mt-0.5 rounded border border-hairline accent-primary"
                />
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-ink">
                    {QUESTION_TYPE_LABELS.vi_to_en}
                  </div>
                  <div className="text-caption text-muted">Translate Vietnamese to English</div>
                </div>
              </label>

              {/* Synonym */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes('synonym')}
                  onChange={() => toggleType('synonym')}
                  disabled={!hasSynonyms}
                  className="mt-0.5 rounded border border-hairline accent-primary disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="text-body-sm font-medium text-ink">
                    {QUESTION_TYPE_LABELS.synonym}
                  </div>
                  <div className="text-caption text-muted">
                    {hasSynonyms
                      ? 'Find synonyms for words'
                      : 'No cards in this session have synonyms yet'}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Question Count */}
          <div className="rounded-lg bg-surface-card p-4">
            <div className="text-body-sm text-ink">
              <span className="font-semibold text-primary">{questionCount}</span> question
              {questionCount !== 1 ? 's' : ''} in this run
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-hairline px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartPractice}
            disabled={!canStart}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            Start practice
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Card, PracticePool, QuestionType } from '../../types';
import { QUESTION_TYPE_LABELS } from '../../types';

type PracticeSetupModalProps = {
  isOpen: boolean;
  sessionId: string;
  cards: Card[];
  onClose: () => void;
};

const POOLS: PracticePool[] = ['all', 'unlearned', 'learned'];

/** Mirrors quiz_generator._is_eligible on the backend, so the count shown
 *  here matches the deck the server actually builds. */
const isEligible = (card: Card, type: QuestionType) =>
  type === 'synonym' ? card.card_type === 'vocab' && card.synonyms.length > 0 : true;

const cardsInPool = (cards: Card[], pool: PracticePool) => {
  if (pool === 'unlearned') {
    return cards.filter((card) => !card.is_learned);
  }

  if (pool === 'learned') {
    return cards.filter((card) => card.is_learned);
  }

  return cards;
};

export default function PracticeSetupModal({
  isOpen,
  sessionId,
  cards,
  onClose,
}: PracticeSetupModalProps) {
  const { t } = useTranslation('session');
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'en_to_vi',
    'vi_to_en',
    'synonym',
  ]);
  const [pool, setPool] = useState<PracticePool>('all');

  // Each open starts from the default pool rather than the last run's.
  useEffect(() => {
    if (isOpen) {
      setPool('all');
    }
  }, [isOpen]);

  const poolCounts = useMemo(
    () => ({
      all: cards.length,
      unlearned: cards.filter((card) => !card.is_learned).length,
      learned: cards.filter((card) => card.is_learned).length,
    }),
    [cards],
  );

  const activeCards = useMemo(() => cardsInPool(cards, pool), [cards, pool]);

  // Whether the synonym type is offerable depends on the chosen pool.
  const hasSynonyms = useMemo(
    () => activeCards.some((card) => isEligible(card, 'synonym')),
    [activeCards],
  );

  // A card joins the run if at least one selected type fits it.
  const questionCount = useMemo(
    () => activeCards.filter((card) => selectedTypes.some((type) => isEligible(card, type))).length,
    [activeCards, selectedTypes],
  );

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );
  };

  const handleStartPractice = () => {
    navigate(`/sessions/${sessionId}/practice`, {
      state: { questionTypes: selectedTypes, pool },
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const canStart = selectedTypes.length > 0 && questionCount > 0;

  const blockedReason =
    selectedTypes.length === 0
      ? t('practice.setup.blockedNoType')
      : questionCount === 0
        ? t('practice.setup.blockedNoCards')
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 animate-fadeIn">
      <div className="flex max-h-[90vh] w-[90vw] max-w-md flex-col rounded-3xl border border-hairline bg-canvas animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-7 py-6">
          <h2 className="m-0 text-headline-md font-medium text-ink">{t('practice.setup.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-ink transition-colors hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-7">
          {/* Pool Section */}
          <div className="space-y-3">
            <h3 className="text-body-sm font-semibold text-ink">{t('practice.setup.poolsHeading')}</h3>

            <div className="flex gap-2">
              {POOLS.map((value) => {
                const count = poolCounts[value];
                const disabled = count === 0;
                const active = pool === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPool(value)}
                    disabled={disabled}
                    className={`flex-1 rounded-lg border px-3 py-2 text-body-sm font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-hairline bg-surface-card text-ink hover:bg-canvas-soft'
                    } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-card`}
                  >
                    <span className="block">{t(`practice.setup.pool.${value}`)}</span>
                    <span className="block font-mono text-caption text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Types Section */}
          <div className="space-y-4">
            <h3 className="text-body-sm font-semibold text-ink">{t('practice.setup.typesHeading')}</h3>

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
                  <div className="text-caption text-muted">{t('practice.setup.enToViDesc')}</div>
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
                  <div className="text-caption text-muted">{t('practice.setup.viToEnDesc')}</div>
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
                      ? t('practice.setup.synonymDesc')
                      : t('practice.setup.synonymUnavailable')}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Question Count */}
          <div className="rounded-lg bg-surface-card p-4">
            {blockedReason ? (
              <div className="text-body-sm text-muted">{blockedReason}</div>
            ) : (
              <div className="text-body-sm text-ink">
                {t('practice.setup.questionCount', { count: questionCount })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-hairline px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
          >
            {t('practice.setup.cancel')}
          </button>
          <button
            type="button"
            onClick={handleStartPractice}
            disabled={!canStart}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {t('practice.setup.start')}
          </button>
        </div>
      </div>
    </div>
  );
}

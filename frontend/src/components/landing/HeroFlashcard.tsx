import type { KeyboardEvent, MouseEvent, RefObject } from 'react';
import { BookOpen, CheckCircle2, Keyboard, MoveRight, RefreshCw, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HeroFlashcardProps {
  flipped: boolean;
  onToggle: () => void;
  cardRef: RefObject<HTMLDivElement>;
}

const SYNONYMS = ['tenacious', 'durable', 'adaptable'];

export default function HeroFlashcard({ flipped, onToggle, cardRef }: HeroFlashcardProps) {
  const { t } = useTranslation('landing');

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    onToggle();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -right-12 -top-12 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-64 w-64 rounded-full bg-secondary/5 blur-2xl" />

      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-caption-uppercase text-muted">{t('flashcard.deckLabel')}</span>
            <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-code-sm text-ink">
              IELTS-Band8-Lexicon
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-secondary/20 bg-learned-surface px-2.5 py-0.5 font-mono text-[12px] text-secondary">
              <CheckCircle2 size={14} /> {t('flashcard.retention', { value: '94%' })}
            </span>
            <span className="hidden items-center gap-1 rounded-full bg-primary-fixed/50 px-2.5 py-0.5 font-mono text-[12px] text-primary sm:inline-flex">
              🔥 {t('flashcard.streak', { count: 7 })}
            </span>
          </div>
        </div>

        <div
          ref={cardRef}
          role="button"
          tabIndex={0}
          aria-label={flipped ? t('flashcard.flipToWordAria') : t('flashcard.flipToMeaningAria')}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          className={`relative flex min-h-[420px] w-full cursor-pointer select-none flex-col justify-between rounded-2xl border border-hairline p-6 shadow-[0_4px_24px_rgba(38,37,30,0.04)] transition-all duration-300 sm:p-8 ${
            flipped ? 'bg-canvas-soft' : 'bg-surface-card'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-soft pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-ink px-2 py-0.5 text-caption-uppercase text-surface-card">
                {t('flashcard.partOfSpeech.adjective')}
              </span>
              <span className="whitespace-nowrap font-mono text-code-sm text-muted">
                {t('flashcard.level', { level: 'C1' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('flashcard.audioAria')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-ink transition-colors hover:bg-surface-container"
              >
                <Volume2 size={18} />
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-hairline bg-surface-container-low px-3 py-1 text-button text-body transition-colors hover:bg-surface-container"
              >
                <RefreshCw
                  size={16}
                  className="transition-transform duration-300"
                  style={{ transform: flipped ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
                <span>{flipped ? t('flashcard.flipToWord') : t('flashcard.flipToMeaning')}</span>
              </button>
            </div>
          </div>

          <div className="my-6">
            {flipped ? (
              <div className="flex flex-col items-center space-y-3 py-4 text-center">
                <div className="mb-1 inline-block rounded-full bg-learned-surface px-3 py-1 font-mono text-code-sm font-medium text-secondary">
                  {t('flashcard.vietnameseDefinition')}
                </div>
                <span className="text-headline-lg font-medium tracking-tight text-ink">
                  kiên cường, có sức bật
                </span>
                <p className="max-w-md text-body-md text-body">
                  Khả năng phục hồi nhanh chóng sau biến cố lớn hoặc áp lực ngoại cảnh; dẻo dai bền bỉ.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3 py-4 text-center">
                <span className="text-[32px] font-normal leading-[38px] tracking-tight text-ink md:text-display-hero">
                  resilient
                </span>
                <div className="flex items-center gap-2 font-mono text-code-phonetic text-muted">
                  <span>/rɪˈzɪl.i.ənt/</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-hairline-strong" />
                  <span className="font-sans text-body-sm text-muted">{t('flashcard.regionLabel')}</span>
                </div>
                <p className="mt-2 max-w-md text-body-md italic text-body">
                  “Able to withstand or recover quickly from difficult conditions, shocks, or systemic
                  disruptions.”
                </p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-hairline bg-canvas-soft p-4 text-left">
              <div className="mb-1 flex items-center gap-1.5 text-primary">
                <BookOpen size={16} />
                <span className="text-caption-uppercase font-semibold">{t('flashcard.collocationLabel')}</span>
              </div>
              <p className="text-body-sm leading-relaxed text-ink">
                “Developing a{' '}
                <span className="font-semibold text-primary underline decoration-primary-fixed decoration-2 underline-offset-4">
                  resilient economic infrastructure
                </span>{' '}
                is paramount for island economies vulnerable to climate volatility.”
              </p>
            </div>
          </div>

          <div className="border-t border-hairline-soft pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-caption-uppercase text-muted">{t('flashcard.synonymsLabel')}</span>
                {SYNONYMS.map((word) => (
                  <span
                    key={word}
                    className="rounded border border-hairline bg-surface-card px-2.5 py-1 text-body-sm text-body transition-colors hover:border-hairline-strong"
                  >
                    {word}
                  </span>
                ))}
              </div>
              <span className="font-mono text-code-sm text-muted">
                {t('flashcard.cardProgress', { current: 14, total: 46 })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-card px-3 py-1.5 font-mono text-code-sm text-ink transition-colors hover:bg-surface-container"
            >
              <Keyboard size={16} /> {t('flashcard.shortcutFlip')}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-card px-3 py-1.5 font-mono text-code-sm text-ink transition-colors hover:bg-surface-container"
            >
              <MoveRight size={16} /> {t('flashcard.shortcutNext')}
            </button>
          </div>
          <div className="flex items-center gap-1 text-body-sm text-muted">
            <span className="h-2 w-2 rounded-full bg-secondary" />
            <span>{t('flashcard.spacedRepetition', { box: 4 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

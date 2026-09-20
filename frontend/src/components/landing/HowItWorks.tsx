import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEP_KEYS = ['capture', 'review', 'verify'] as const;

export default function HowItWorks() {
  const { t } = useTranslation('landing');

  return (
    <section id="method" className="w-full scroll-mt-16 px-space-md py-20 md:py-28 lg:px-space-xl">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-2 block text-caption-uppercase font-semibold tracking-wider text-primary">
              {t('howItWorks.eyebrow')}
            </span>
            <h2 className="text-headline-lg tracking-tight text-ink">{t('howItWorks.title')}</h2>
          </div>
          <p className="max-w-md text-body-sm text-body">{t('howItWorks.description')}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEP_KEYS.map((key) => (
            <div key={key} className="flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded bg-primary-fixed/40 px-2 py-1 font-mono text-code-sm font-bold text-primary">
                  {t(`howItWorks.steps.${key}.label`)}
                </span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <h3 className="text-title-md text-ink">{t(`howItWorks.steps.${key}.title`)}</h3>
              <p className="text-body-sm leading-relaxed text-body">
                {t(`howItWorks.steps.${key}.description`)}
              </p>
              <div className="space-y-1.5 rounded-xl border border-hairline bg-surface-card p-4 font-mono text-[12px] text-muted">
                {key === 'capture' && (
                  <>
                    <div className="flex items-center gap-1 font-semibold text-ink">
                      <Check size={14} className="text-secondary" />{' '}
                      {t('howItWorks.steps.capture.parsedStatus', { count: 120 })}
                    </div>
                    <div className="truncate text-body-sm text-muted-soft">
                      {t('howItWorks.steps.capture.columnMapping')}
                    </div>
                  </>
                )}
                {key === 'review' && (
                  <>
                    <div className="flex items-center justify-between font-semibold text-ink">
                      <span>{t('howItWorks.steps.review.shortcutsActive')}</span>
                      <span className="text-secondary">{t('howItWorks.steps.review.ready')}</span>
                    </div>
                    <div className="text-body-sm text-muted-soft">
                      {t('howItWorks.steps.review.shortcutsLegend')}
                    </div>
                  </>
                )}
                {key === 'verify' && (
                  <>
                    <div className="flex items-center justify-between font-semibold text-ink">
                      <span>{t('howItWorks.steps.verify.deckMastery')}</span>
                      <span className="font-bold text-secondary">
                        {t('howItWorks.steps.verify.masteryValue', { value: '88.4%' })}
                      </span>
                    </div>
                    <div className="text-body-sm text-muted-soft">
                      {t('howItWorks.steps.verify.breakdown', { mastered: 42, review: 4, new: 0 })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

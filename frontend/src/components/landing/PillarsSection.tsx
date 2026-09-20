import type { ReactNode } from 'react';
import { FolderOpen, ListChecks, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PillarCardProps {
  icon: ReactNode;
  label: string;
  title: string;
  description: ReactNode;
  visual: ReactNode;
}

function PillarCard({ icon, label, title, description, visual }: PillarCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-8 transition-colors hover:border-hairline-strong">
      <div>
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
          {icon}
        </div>
        <span className="mb-1 block text-caption-uppercase text-muted">{label}</span>
        <h3 className="mb-3 text-title-md text-ink">{title}</h3>
        <p className="mb-6 text-body-sm leading-relaxed text-body">{description}</p>
      </div>
      {visual}
    </div>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-container px-1 py-0.5 font-mono text-[12px]">{children}</code>;
}

export default function PillarsSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="features" className="w-full scroll-mt-16 px-space-md py-20 md:py-28 lg:px-space-xl">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-14 max-w-2xl">
          <span className="mb-2 block text-caption-uppercase font-semibold tracking-wider text-primary">
            {t('pillars.eyebrow')}
          </span>
          <h2 className="mb-4 text-headline-lg tracking-tight text-ink">{t('pillars.title')}</h2>
          <p className="text-body-md leading-relaxed text-body">{t('pillars.description')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <PillarCard
            icon={<FolderOpen size={24} />}
            label={t('pillars.session.label')}
            title={t('pillars.session.title')}
            description={t('pillars.session.description')}
            visual={
              <div className="space-y-2 rounded-lg border border-hairline bg-canvas-soft p-3.5 font-mono text-code-sm text-ink">
                <div className="flex items-center justify-between border-b border-hairline pb-1 text-[11px] text-muted">
                  <span>{t('pillars.session.activeDeck')}</span>
                  <span>{t('pillars.session.items')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-secondary" />
                    IELTS_Environment.csv
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-muted">
                    {t('pillars.session.cardsCount', { count: 48 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    Philosophy_Epistemology.xlsx
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-muted">
                    {t('pillars.session.cardsCount', { count: 32 })}
                  </span>
                </div>
              </div>
            }
          />

          <PillarCard
            icon={<ListChecks size={24} />}
            label={t('pillars.quiz.label')}
            title={t('pillars.quiz.title')}
            description={
              <>
                {t('pillars.quiz.descriptionPrefix')} <InlineCode>en_to_vi</InlineCode>,{' '}
                <InlineCode>vi_to_en</InlineCode>, {t('pillars.quiz.descriptionSuffix')}
              </>
            }
            visual={
              <div className="space-y-1.5 rounded-lg border border-hairline bg-canvas-soft p-3.5">
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span>{t('pillars.quiz.generationLabel')}</span>
                  <span className="font-medium text-secondary">{t('pillars.quiz.autoCalibrated')}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                  <div className="h-full rounded-full bg-secondary" style={{ width: '75%' }} />
                </div>
                <div className="flex items-center justify-between pt-1 text-[12px]">
                  <span className="font-medium text-ink">{t('pillars.quiz.modeLabel')}</span>
                  <span className="font-mono text-secondary">
                    {t('pillars.quiz.completed', { done: 3, total: 4 })}
                  </span>
                </div>
              </div>
            }
          />

          <PillarCard
            icon={<TrendingUp size={24} />}
            label={t('pillars.learningCurve.label')}
            title={t('pillars.learningCurve.title')}
            description={t('pillars.learningCurve.description')}
            visual={
              <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas-soft p-3.5">
                <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                  <span>{t('pillars.learningCurve.telemetryLabel')}</span>
                  <span>{t('pillars.learningCurve.days30')}</span>
                </div>
                <svg
                  className="h-10 w-full text-primary"
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 25"
                  aria-hidden="true"
                >
                  <path
                    d="M0,20 Q15,18 25,12 T50,10 T75,5 T100,2"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M0,20 Q15,18 25,12 T50,10 T75,5 T100,2 L100,25 L0,25 Z"
                    fill="currentColor"
                    fillOpacity="0.08"
                  />
                </svg>
                <div className="flex items-center justify-between font-mono text-[11px] text-muted-soft">
                  <span>{t('pillars.learningCurve.day1', { value: '45%' })}</span>
                  <span className="font-semibold text-ink">
                    {t('pillars.learningCurve.day30', { value: '94.2%' })}
                  </span>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

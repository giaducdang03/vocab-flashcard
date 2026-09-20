import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import HeroFlashcard from './HeroFlashcard';

export default function HeroSection() {
  const { t } = useTranslation('landing');
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const toggleFlip = () => setFlipped((value) => !value);

  const handleQuickDemo = () => {
    toggleFlip();
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section className="relative w-full overflow-hidden px-space-md py-16 md:py-24 lg:px-space-xl">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col items-start lg:col-span-6">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-container px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              <span className="text-caption-uppercase font-semibold tracking-wider text-ink">
                {t('hero.badge')}
              </span>
            </div>
            <h1 className="mb-6 text-[32px] font-normal leading-[38px] tracking-tight text-ink md:text-display-hero">
              {t('hero.title')}
            </h1>
            <p className="mb-8 max-w-xl text-body-md leading-relaxed text-body">{t('hero.description')}</p>
            <div className="mb-6 flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <Link
                to="/login"
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-button text-on-primary shadow-sm transition-colors hover:bg-primary-active"
              >
                <span>{t('hero.ctaPrimary')}</span>
                <ArrowRight size={18} />
              </Link>
              <button
                type="button"
                onClick={handleQuickDemo}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-hairline-strong bg-surface-card px-5 text-button text-ink transition-colors hover:bg-surface-container-low"
              >
                <PlayCircle size={18} className="text-primary" />
                <span>{t('hero.ctaSecondary')}</span>
              </button>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-card bg-surface-container-high font-mono text-[10px] text-ink">
                  JW
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-card bg-primary-fixed font-mono text-[10px] font-bold text-on-primary-fixed">
                  AL
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-card bg-secondary-fixed font-mono text-[10px] font-bold text-on-secondary-fixed">
                  KT
                </div>
              </div>
              <p className="text-body-sm text-muted">
                <Trans i18nKey="hero.socialProof" t={t} components={{ 1: <span className="font-medium text-ink" /> }} />
              </p>
            </div>
          </div>

          <div className="lg:col-span-6">
            <HeroFlashcard flipped={flipped} onToggle={toggleFlip} cardRef={cardRef} />
          </div>
        </div>
      </div>
    </section>
  );
}

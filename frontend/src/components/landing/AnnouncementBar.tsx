import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLatestVersion } from '../../lib/changelog';

const latest = getLatestVersion();

export default function AnnouncementBar() {
  const { t } = useTranslation('landing');

  if (!latest) return null;

  return (
    <section className="w-full bg-surface-container-low px-space-md py-2.5">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-space-md text-body-sm">
        <div className="flex min-w-0 items-center gap-space-sm text-body">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-caption-uppercase text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {t('announcement.version', { version: latest.version })}
          </span>
          <span className="hidden truncate font-medium text-ink sm:inline">{latest.title}</span>
          <span className="hidden text-muted-soft md:inline">·</span>
          <span className="hidden text-muted md:inline">{t('announcement.description')}</span>
        </div>
        <Link
          to="/changelog"
          className="inline-flex shrink-0 items-center gap-1 text-button text-primary transition-colors hover:text-primary-active"
        >
          {t('announcement.cta')} <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

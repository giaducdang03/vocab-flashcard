import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation('nav');

  return (
    <footer className="mt-auto w-full border-t border-hairline bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-space-sm px-margin py-space-lg text-body-sm text-muted max-sm:px-space-md md:flex-row">
        <div className="flex items-center gap-space-sm">
          <span className="text-title-sm text-ink">VocabFlash</span>
          <span>{t('footer.tagline')}</span>
        </div>

        <span>{t('footer.rights')}</span>
      </div>
    </footer>
  );
}

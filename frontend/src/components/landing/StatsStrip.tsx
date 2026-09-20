import { useTranslation } from 'react-i18next';

const STAT_KEYS = ['retention', 'latency', 'collocations', 'focus'] as const;

export default function StatsStrip() {
  const { t } = useTranslation('landing');

  return (
    <section className="w-full border-y border-hairline bg-canvas-soft px-space-md py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STAT_KEYS.map((key) => (
            <div key={key} className="flex flex-col space-y-1">
              <span className="text-headline-lg font-normal text-ink">
                {t(`stats.items.${key}.value`)}
              </span>
              <span className="text-title-sm text-ink">{t(`stats.items.${key}.title`)}</span>
              <p className="text-body-sm leading-snug text-muted">
                {t(`stats.items.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

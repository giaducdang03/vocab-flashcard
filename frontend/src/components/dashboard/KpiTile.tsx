import type { ReactNode } from 'react';

type KpiTileProps = {
  label: string;
  value: number | string;
  unit?: string;
  icon?: ReactNode;
  badge?: string;
  footnote?: string;
  progress?: number;
  accent?: 'primary' | 'secondary';
};

export default function KpiTile({
  label,
  value,
  unit,
  icon,
  badge,
  footnote,
  progress,
  accent = 'primary',
}: KpiTileProps) {
  return (
    <div className="group relative flex flex-col gap-space-xs overflow-hidden rounded-xl border border-hairline bg-surface-card p-space-md transition-colors hover:bg-canvas-soft">
      <div className="flex items-center justify-between">
        <span className="text-caption-uppercase uppercase text-muted">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-headline-lg font-medium text-ink">
          {value}
          {unit && <span className="ml-1 text-title-md font-normal text-muted">{unit}</span>}
        </span>
        {badge && (
          <span className="rounded bg-secondary-container px-1.5 py-0.5 text-caption-uppercase text-on-secondary-container">
            {badge}
          </span>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {footnote && <p className="m-0 truncate text-body-sm text-muted">{footnote}</p>}

      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 transition-colors ${
          accent === 'secondary'
            ? 'bg-secondary/30 group-hover:bg-secondary'
            : 'bg-primary/20 group-hover:bg-primary'
        }`}
      />
    </div>
  );
}

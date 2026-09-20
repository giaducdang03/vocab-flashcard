import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type FilterKey = 'all' | 'vocab' | 'collocation' | 'unlearned' | 'learned';
export type SortKey = 'position' | 'alphabetical' | 'recent';

const FILTERS: FilterKey[] = ['all', 'vocab', 'collocation', 'unlearned', 'learned'];

const SORT_OPTIONS: SortKey[] = ['position', 'alphabetical', 'recent'];

type CardsToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  filter: FilterKey;
  onFilterChange: (value: FilterKey) => void;
  counts: Record<FilterKey, number>;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
};

export default function CardsToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
}: CardsToolbarProps) {
  const { t } = useTranslation('session');
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative max-w-lg flex-1">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('toolbar.searchPlaceholder')}
          aria-label={t('toolbar.searchAriaLabel')}
          className="h-11 w-full rounded-lg border border-hairline bg-surface-card pl-11 pr-4 text-body-sm text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-ink"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-body-sm font-medium transition-colors ${
              filter === key
                ? 'bg-ink text-surface-card'
                : 'border border-hairline bg-surface-card text-body hover:text-ink'
            }`}
          >
            {t(`toolbar.filter.${key}`)} <span className="ml-1 font-mono text-code-sm opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto">
        <div className="flex h-10 items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 text-body-sm text-ink">
          <SlidersHorizontal size={16} className="text-muted" />
          <span className="text-muted">{t('toolbar.sortLabel')}</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            className="cursor-pointer bg-transparent pr-1 font-medium text-ink outline-none"
          >
            {SORT_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {t(`toolbar.sort.${key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

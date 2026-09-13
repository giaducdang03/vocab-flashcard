import { Search, SlidersHorizontal } from 'lucide-react';

export type FilterKey = 'all' | 'vocab' | 'collocation' | 'unlearned' | 'learned';
export type SortKey = 'position' | 'alphabetical' | 'recent';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vocab', label: 'Vocab' },
  { key: 'collocation', label: 'Collocations' },
  { key: 'unlearned', label: 'Unlearned' },
  { key: 'learned', label: 'Learned' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'position', label: 'Position (Default)' },
  { key: 'alphabetical', label: 'Alphabetical (A-Z)' },
  { key: 'recent', label: 'Recently added' },
];

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
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative max-w-lg flex-1">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search word, phonetic or definition..."
          aria-label="Search cards"
          className="h-11 w-full rounded-lg border border-hairline bg-surface-card pl-11 pr-4 text-body-sm text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-ink"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilterChange(item.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-body-sm font-medium transition-colors ${
              filter === item.key
                ? 'bg-ink text-surface-card'
                : 'border border-hairline bg-surface-card text-body hover:text-ink'
            }`}
          >
            {item.label} <span className="ml-1 font-mono text-code-sm opacity-70">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto">
        <div className="flex h-10 items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 text-body-sm text-ink">
          <SlidersHorizontal size={16} className="text-muted" />
          <span className="text-muted">Sort:</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            className="cursor-pointer bg-transparent pr-1 font-medium text-ink outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type BulkActionBarProps = {
  totalVisible: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onMarkLearned: () => void;
  onDelete: () => void;
};

export default function BulkActionBar({
  totalVisible,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onMarkLearned,
  onDelete,
}: BulkActionBarProps) {
  const { t } = useTranslation('session');
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface-container/60 px-4 py-3 text-body-sm sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            disabled={totalVisible === 0}
            className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-primary focus:ring-offset-0"
          />
          <span className="font-medium text-ink">{t('bulk.selectAll', { count: totalVisible })}</span>
        </label>
        <span className="hidden text-hairline-strong sm:inline">|</span>
        <span className="text-muted">{t('bulk.selected', { count: selectedCount })}</span>
      </div>

      <div className="flex items-center gap-2 max-sm:w-full">
        <button
          type="button"
          onClick={onMarkLearned}
          disabled={!hasSelection}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-surface-card px-2.5 py-2.5 text-body-sm text-body transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60 max-sm:flex-1 sm:py-1"
        >
          <CheckCircle2 size={16} />
          {t('bulk.markLearned')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-surface-card px-2.5 py-2.5 text-body-sm text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60 max-sm:flex-1 sm:py-1"
        >
          <Trash2 size={16} />
          {t('bulk.delete')}
        </button>
      </div>
    </div>
  );
}

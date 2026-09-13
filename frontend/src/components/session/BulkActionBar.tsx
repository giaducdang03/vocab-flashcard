import { CheckCircle2, Trash2 } from 'lucide-react';

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
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-container/60 px-4 py-2.5 text-body-sm">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            disabled={totalVisible === 0}
            className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-primary focus:ring-offset-0"
          />
          <span className="font-medium text-ink">Select all {totalVisible} items</span>
        </label>
        <span className="text-hairline-strong">|</span>
        <span className="text-muted">{selectedCount} cards selected</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMarkLearned}
          disabled={!hasSelection}
          className="inline-flex items-center gap-1.5 rounded bg-surface-card px-2.5 py-1 text-body-sm text-body transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={16} />
          Mark learned
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          className="inline-flex items-center gap-1.5 rounded bg-surface-card px-2.5 py-1 text-body-sm text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </div>
  );
}

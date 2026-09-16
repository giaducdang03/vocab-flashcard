import { Ban, Pencil, Zap } from 'lucide-react';
import type { AdminUserRow } from '../../types/admin';
import { formatDate, formatPercent, initials, plural } from '../../lib/adminFormat';
import RolePill from './RolePill';

type UserTableProps = {
  rows: AdminUserRow[];
  onOpen: (id: string) => void;
};

const HEADERS = ['User', 'Role', 'Joined', 'Sessions & Cards', 'Quizzes & Accuracy', 'AI Access & Limit', ''];

function AiCell({ row }: { row: AdminUserRow }) {
  if (!row.ai_enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-body-sm text-muted">
        <Ban size={14} />
        Disabled
      </span>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1.5 text-body-sm text-success">
        <Zap size={14} />
        Enabled
      </span>
      <span className="font-mono text-code-sm text-muted">
        {row.ai_used_24h} / {row.ai_daily_limit} · 24h{row.ai_limit_is_custom ? '' : ' (default)'}
      </span>
    </div>
  );
}

export default function UserTable({ rows, onOpen }: UserTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface-card">
      <table className="w-full min-w-[880px] text-left">
        <thead className="border-b border-hairline bg-canvas-soft">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-4 py-3 text-caption-uppercase uppercase text-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-hairline-soft last:border-0 hover:bg-canvas-soft"
              onClick={() => onOpen(row.id)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hairline-soft text-caption-uppercase text-ink">
                    {initials(row.display_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-title-sm text-ink">{row.display_name}</p>
                    <p className="truncate text-body-sm text-muted">{row.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <RolePill role={row.role} />
              </td>
              <td className="px-4 py-3 font-mono text-code-sm text-body">{formatDate(row.created_at)}</td>
              <td className="px-4 py-3">
                <p className="text-body-sm text-ink">{plural(row.session_count, 'session')}</p>
                <p className="text-body-sm text-muted">{plural(row.card_count, 'card')}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-body-sm text-ink">{row.quizzes_taken} taken</p>
                <p className="font-mono text-code-sm text-muted">{formatPercent(row.avg_accuracy)}</p>
              </td>
              <td className="px-4 py-3">
                <AiCell row={row} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  title="Edit user"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-white text-body transition-colors hover:text-ink"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}
                >
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

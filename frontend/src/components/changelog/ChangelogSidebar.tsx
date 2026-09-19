import type { MouseEvent } from 'react';
import { MessageSquareWarning, Rocket, ShieldCheck } from 'lucide-react';
import type { ChangelogVersion } from '../../lib/changelog';

// Thay bằng kênh liên hệ thật (ví dụ mailto:...) khi có.
const FEEDBACK_URL = 'https://github.com/giaducdang03/vocab-flashcard/issues';

interface ChangelogSidebarProps {
  versions: ChangelogVersion[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const versionAnchor = (version: string) => `v${version.replace(/\./g, '-')}`;

export default function ChangelogSidebar({ versions, activeId, onSelect }: ChangelogSidebarProps) {
  const jumpTo = (event: MouseEvent, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    onSelect(id);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside className="sticky top-24 hidden space-y-space-md lg:col-span-4 lg:block">
      <div className="rounded-xl bg-surface-card p-5 shadow-sm">
        <div className="mb-space-sm text-caption-uppercase uppercase tracking-wider text-muted">
          CHUYỂN NHANH ĐẾN BẢN CẬP NHẬT
        </div>
        <nav className="flex flex-col space-y-1">
          {versions.map((v) => {
            const id = versionAnchor(v.version);
            const active = activeId === id;
            return (
              <a
                key={v.version}
                href={`#${id}`}
                onClick={(event) => jumpTo(event, id)}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 text-body-sm transition-colors hover:bg-canvas ${
                  active ? 'bg-canvas font-medium text-ink' : 'text-body hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      active ? 'bg-primary-active' : 'bg-hairline-strong'
                    }`}
                  />
                  v{v.version} — {v.shortTitle}
                </span>
                <span
                  className={`ml-2 shrink-0 font-mono text-xs text-muted ${active ? 'text-primary' : ''}`}
                >
                  {v.date.slice(0, 5)}
                </span>
              </a>
            );
          })}
          <a
            href="#roadmap"
            onClick={(event) => jumpTo(event, 'roadmap')}
            className="group mt-2 flex items-center justify-between rounded-lg border-t border-hairline px-3 pt-2 text-body-sm font-medium text-primary transition-colors hover:bg-canvas"
          >
            <span className="flex items-center gap-2">
              <Rocket size={14} />
              Kế hoạch sắp có
            </span>
            <span className="text-xs font-semibold">Roadmap</span>
          </a>
        </nav>
      </div>

      <div className="rounded-xl bg-surface-card p-5 shadow-sm">
        <h4 className="mb-1 text-title-sm text-ink">Quy tắc đặt phiên bản</h4>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Các cập
          nhật giao diện và tính năng học được đóng gói theo tuần để duy trì độ tin cậy cao nhất cho người
          học.
        </p>
        <div className="flex items-center gap-2 text-xs font-medium text-secondary">
          <ShieldCheck size={16} />
          <span>Cam kết bảo mật dữ liệu người học</span>
        </div>
      </div>

      <div className="rounded-xl bg-canvas p-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-card text-primary">
          <MessageSquareWarning size={22} />
        </div>
        <h4 className="mb-1 text-title-sm text-ink">Góp ý tính năng mới</h4>
        <p className="mb-3 text-xs text-muted">
          Bạn muốn cải thiện trải nghiệm học hay phát hiện điều bất thường?
        </p>
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-lg bg-surface-card px-3 py-2 text-button text-ink transition-colors hover:bg-white"
        >
          Gửi phản hồi cho tác giả
        </a>
      </div>
    </aside>
  );
}

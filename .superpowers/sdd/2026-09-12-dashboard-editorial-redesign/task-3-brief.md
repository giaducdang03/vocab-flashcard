# Task 3: PageHeader

**Files:**
- Modify: `frontend/src/components/PageHeader.tsx`

**Interfaces:**
- Consumes: tokens from Task 1, layout shell from Task 2, existing `UserMenu` (`{ user: User; onLogout: () => void }`).
- Produces: `PageHeader({ user?, onLogout?, streakDays? })` — `streakDays?: number` is new and optional; when omitted the streak chip is not rendered. Six existing call sites pass no `streakDays` and keep working unchanged.

**Design reference:** `code.html` line 2, `<header>` element.

## Implementation

Replace the entire file with this code:

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import type { User } from '../types';
import UserMenu from './UserMenu';

interface PageHeaderProps {
  user?: User | null;
  onLogout?: () => void;
  streakDays?: number;
}

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Sessions', path: '/sessions' },
  { label: 'Quizzes', path: '/quizzes', badge: 'New' },
];

export default function PageHeader({ user, onLogout, streakDays }: PageHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-space-md px-margin max-sm:px-space-md">
        <div className="flex items-center gap-space-lg">
          <button
            type="button"
            className="flex items-center gap-space-sm"
            onClick={() => navigate('/')}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[11px] font-bold tracking-[0.08em] text-on-primary">
              VF
            </span>
            <span className="text-title-md tracking-tight text-ink">VocabFlash</span>
          </button>

          <nav className="hidden items-center gap-space-xs rounded-lg bg-hairline-soft p-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive(item.path) ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-body-sm transition-colors ${
                  isActive(item.path)
                    ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                    : 'text-body hover:text-ink'
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-caption-uppercase uppercase leading-none text-on-secondary-container">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-space-md">
          {typeof streakDays === 'number' && streakDays > 0 && (
            <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface-card px-2.5 py-1 font-mono text-code-sm text-ink sm:flex">
              <Flame size={14} className="text-primary" />
              {streakDays}-day streak
            </span>
          )}
          {user && <UserMenu user={user} onLogout={onLogout ?? (() => {})} />}
        </div>
      </div>
    </header>
  );
}
```

## Verification

Run: `cd frontend && npm run build`
Expected: exits 0, no TypeScript errors.

In the browser: header spans full viewport, sticks on scroll, active tab is white pill, pages with `<PageHeader />` show brand and nav; without props show no streak chip or user menu.

## Commit

```bash
git add frontend/src/components/PageHeader.tsx
git commit -m "feat(header): sticky full-width header with nav pills and streak chip"
```

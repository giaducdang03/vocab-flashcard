import { useLocation, useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { User } from '../types';
import UserMenu from './UserMenu';
import LanguageSwitcher from './LanguageSwitcher';

interface PageHeaderProps {
  user?: User | null;
  onLogout?: () => void;
  streakDays?: number;
}

const NAV_ITEMS = [
  { key: 'dashboard', path: '/' },
  { key: 'sessions', path: '/sessions' },
  { key: 'quizzes', path: '/quizzes', badge: true },
] as const;

export default function PageHeader({ user, onLogout, streakDays }: PageHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation('nav');

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
            <img src="/favicon.ico" alt="" className="h-9 w-9 object-contain" />
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
                {t(`items.${item.key}`)}
                {'badge' in item && item.badge && (
                  <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-caption-uppercase uppercase leading-none text-on-secondary-container">
                    {t('badgeNew')}
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
              {t('streak', { count: streakDays })}
            </span>
          )}
          <LanguageSwitcher />
          {user && <UserMenu user={user} onLogout={onLogout ?? (() => {})} />}
        </div>
      </div>
    </header>
  );
}

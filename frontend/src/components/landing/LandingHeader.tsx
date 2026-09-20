import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { scrollToSection } from './scrollToSection';
import LanguageSwitcher from '../LanguageSwitcher';

const NAV_ITEMS = [
  { key: 'features', id: 'features' },
  { key: 'method', id: 'method' },
  { key: 'quizzes', id: 'quizzes' },
  { key: 'pricing', id: 'pricing' },
] as const;

export default function LandingHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('nav');

  const handleNavClick = (event: React.MouseEvent, id: string) => {
    event.preventDefault();
    if (pathname === '/') {
      scrollToSection(event, id);
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-space-md sm:px-space-xl">
        <div className="flex items-center gap-space-lg">
          <Link to="/" className="flex items-center gap-space-sm">
            <img src="/favicon.ico" alt="" className="h-8 w-8 object-contain" />
            <span className="text-title-md tracking-tight text-ink">VocabFlash</span>
            <span className="hidden rounded-full bg-primary-fixed px-2 py-0.5 text-caption-uppercase text-on-primary-fixed sm:inline">
              PRO
            </span>
          </Link>

          <nav className="ml-space-md hidden items-center gap-space-lg md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => handleNavClick(event, item.id)}
                className="text-body-sm text-on-surface-variant transition-colors hover:text-ink"
              >
                {t(`landing.${item.key}`)}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-space-md">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="hidden px-space-xs py-space-sm text-button text-body transition-colors hover:text-ink sm:block"
          >
            {t('landing.signIn')}
          </Link>
          <Link
            to="/login"
            className="flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-button text-on-primary transition-colors hover:bg-primary-active"
          >
            {t('landing.getStarted')}
          </Link>
          <Link
            to="/login"
            aria-label={t('landing.signIn')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <User size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}

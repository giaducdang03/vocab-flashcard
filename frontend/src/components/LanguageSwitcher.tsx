import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setAppLanguage, type AppLanguage } from '../i18n';
import FlagEn from './flags/FlagEn';
import FlagVi from './flags/FlagVi';

const LABEL: Record<AppLanguage, string> = { en: 'EN', vi: 'VI' };
const NAME: Record<AppLanguage, string> = { en: 'English', vi: 'Tiếng Việt' };

function Flag({ lang, className }: { lang: AppLanguage; className: string }) {
  return lang === 'en' ? <FlagEn className={className} /> : <FlagVi className={className} />;
}

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const current: AppLanguage = i18n.language.startsWith('vi') ? 'vi' : 'en';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const choose = (lang: AppLanguage) => {
    setAppLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('language')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-ink transition-colors hover:bg-canvas"
      >
        <Flag lang={current} className="h-3.5 w-5 rounded-[2px] ring-1 ring-hairline" />
        <span className="text-body-sm font-medium">{LABEL[current]}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-hairline bg-white shadow-lg"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="option"
              aria-selected={lang === current}
              onClick={() => choose(lang)}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-ink transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-canvas"
            >
              <Flag lang={lang} className="h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-hairline" />
              <span className="flex-1 text-left">{NAME[lang]}</span>
              {lang === current && <Check size={16} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

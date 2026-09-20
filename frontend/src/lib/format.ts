import { useTranslation } from 'react-i18next';
import { INTL_LOCALE, type AppLanguage } from '../i18n';

function localeOf(language: string): string {
  const base = language.split('-')[0];
  return INTL_LOCALE[base as AppLanguage] ?? INTL_LOCALE.en;
}

/** Định dạng ngày/số theo ngôn ngữ đang bật. Dùng trong component. */
export function useFormatters() {
  const { i18n } = useTranslation();
  const locale = localeOf(i18n.language);

  return {
    date: (iso: string) =>
      new Date(iso).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    dateTime: (iso: string) =>
      new Date(iso).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    number: (n: number) => n.toLocaleString(locale),
  };
}

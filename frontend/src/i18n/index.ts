import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import viCommon from './locales/vi/common.json';
import enNav from './locales/en/nav.json';
import viNav from './locales/vi/nav.json';
import enLanding from './locales/en/landing.json';
import viLanding from './locales/vi/landing.json';
import enAuth from './locales/en/auth.json';
import viAuth from './locales/vi/auth.json';
import enSession from './locales/en/session.json';
import viSession from './locales/vi/session.json';
import enQuiz from './locales/en/quiz.json';
import viQuiz from './locales/vi/quiz.json';
import enDashboard from './locales/en/dashboard.json';
import viDashboard from './locales/vi/dashboard.json';

export type AppLanguage = 'en' | 'vi';

export const LANGUAGES: readonly AppLanguage[] = ['en', 'vi'] as const;
export const LANG_STORAGE_KEY = 'vocabflash.lang';
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

/** Locale dùng cho Intl, suy ra từ ngôn ngữ app. */
export const INTL_LOCALE: Record<AppLanguage, string> = {
  en: 'en-US',
  vi: 'vi-VN',
};

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'vi';
}

/** Đọc ngôn ngữ đã lưu. localStorage có thể ném lỗi ở chế độ ẩn danh. */
export function getStoredLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isAppLanguage(stored)) {
      return stored;
    }
  } catch {
    // Bỏ qua: không đọc được thì dùng mặc định.
  }
  return DEFAULT_LANGUAGE;
}

export const resources = {
  en: { common: enCommon, nav: enNav, landing: enLanding, auth: enAuth, session: enSession, quiz: enQuiz, dashboard: enDashboard },
  vi: { common: viCommon, nav: viNav, landing: viLanding, auth: viAuth, session: viSession, quiz: viQuiz, dashboard: viDashboard },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

/** Đổi ngôn ngữ, ghi nhớ lựa chọn, và cập nhật thuộc tính lang của trang. */
export function setAppLanguage(lang: AppLanguage): void {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Bỏ qua: không ghi được thì lựa chọn chỉ sống trong phiên này.
  }
}

document.documentElement.lang = i18n.language;

export default i18n;

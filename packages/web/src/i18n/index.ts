import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import zhHans from './zh-Hans';

/**
 * Bilingual from day one (spec §7) — the Tiger and Moomoo user base is largely
 * Chinese-speaking.
 *
 * Tax terms of art keep their English name with the Chinese gloss alongside, e.g.
 * "Fair Dividend Rate (FDR) 公平股息率法" — never translated away. The user has to
 * match these against IR461 and talk to an accountant about them, and a purely Chinese
 * rendering would leave them unable to do either.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-Hans', label: '简体中文' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'fif.language';

export function storedLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored as LanguageCode;
    }
  } catch {
    // Private browsing or blocked site data — fall through to the default.
  }
  return 'en';
}

export function setLanguage(code: LanguageCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Persisting the choice is a convenience; failing to persist must not break it.
  }
  void i18n.changeLanguage(code);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-Hans': { translation: zhHans },
  },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

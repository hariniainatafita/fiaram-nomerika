import { translations } from './translations';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './constants';
import type { Language, TranslationParams } from './types';

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'fr';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {
    // Ignore storage errors (private mode, disabled storage, etc.).
  }
  return 'fr';
}

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function translate(key: string, params?: TranslationParams): string {
  const entry = translations[key];
  const language = getStoredLanguage();
  const text = entry?.[language] || entry?.fr || entry?.en || key;
  return interpolate(text, params);
}

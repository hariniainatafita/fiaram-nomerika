import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './constants';
import { LanguageContext, type LanguageContextValue } from './languageContext';
import type { Language, TranslationParams } from './types';

function getInitialLanguage(): Language {
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

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    setLanguageState(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The language still applies for the current session.
    }
  }, []);

  const t = useCallback((key: string, params?: TranslationParams) => {
    const entry = translations[key];
    const text = entry?.[language] || entry?.fr || entry?.en || key;
    return interpolate(text, params);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

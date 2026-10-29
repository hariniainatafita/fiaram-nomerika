import type { Language } from './types';

export const LANGUAGE_STORAGE_KEY = 'fiaram_language_v1';

export const SUPPORTED_LANGUAGES: Language[] = ['mg', 'fr', 'en'];

export const LANGUAGE_NAMES: Record<Language, string> = {
  mg: 'Malagasy',
  fr: 'Français',
  en: 'English'
};

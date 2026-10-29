export type Language = 'mg' | 'fr' | 'en';

export type Translation = Record<Language, string>;

export type TranslationDictionary = Record<string, Translation>;

export type TranslationParams = Record<string, string | number>;

import React from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGE_NAMES } from './constants';
import { useLanguage } from './languageContext';
import type { Language } from './types';

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

const LANGUAGES: Language[] = ['mg', 'fr', 'en'];

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false, className }) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label
      className={className}
      title={t('nav.language')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '4px' : '7px',
        padding: compact ? '4px 6px' : '6px 9px',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.03)',
        color: 'var(--text-muted)',
        cursor: 'pointer'
      }}
    >
      <Globe size={compact ? 14 : 16} />
      <select
        aria-label={t('nav.language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text-main)',
          fontSize: compact ? '0.72rem' : '0.8rem',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {LANGUAGES.map((item) => (
          <option key={item} value={item} style={{ background: '#111827', color: '#ffffff' }}>
            {LANGUAGE_NAMES[item]}
          </option>
        ))}
      </select>
    </label>
  );
};

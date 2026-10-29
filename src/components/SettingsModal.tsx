import React, { useState } from 'react';
import { Membre, AdminSettings, RegistrationQuestion } from '../types';
import { StorageService } from '../utils/storage';
import { isAdmin } from '../utils/permissions';
import { 
  Settings, 
  X, 
  Save, 
  HelpCircle, 
  Wallet, 
  ShieldCheck, 
  Bell, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  RotateCcw,
  Sliders,
  IdCard
} from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '../i18n';

interface SettingsModalProps {
  currentUser: Membre;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onSettingsSaved
}) => {
  const { t } = useLanguage();
  const isAdminOnly = isAdmin(currentUser);

  const [settings, setSettings] = useState<AdminSettings>(() => StorageService.getAdminSettings());
  const [activeCategory, setActiveCategory] = useState<'general' | 'cotisations' | 'questions' | 'badge' | 'system'>('general');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New question form state
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);

  if (!isAdminOnly) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12px',
        overflowY: 'auto'
      }}>
        <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '28px', textAlign: 'center', margin: 'auto' }}>
          <ShieldCheck size={38} style={{ color: '#ef4444', marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px' }}>{t('settings.accessDeniedTitle')}</h3>
          <p style={{ margin: '0 0 18px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('settings.accessDeniedDescription')}
          </p>
          <button onClick={onClose} className="btn btn-ghost">{t('common.close')}</button>
        </div>
      </div>
    );
  }

  // Save all settings
  const handleSaveAll = () => {
    StorageService.saveAdminSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    if (onSettingsSaved) onSettingsSaved();
  };

  // Add registration question
  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    const newQ: RegistrationQuestion = {
      id: 'q_' + Date.now(),
      question: newQuestionText.trim(),
      required: newQuestionRequired
    };
    const updated = {
      ...settings,
      registration_questions: [...settings.registration_questions, newQ]
    };
    setSettings(updated);
    StorageService.saveAdminSettings(updated);
    setNewQuestionText('');
    setNewQuestionRequired(true);
    if (onSettingsSaved) onSettingsSaved();
  };

  // Delete registration question
  const handleDeleteQuestion = (id: string) => {
    const updated = {
      ...settings,
      registration_questions: settings.registration_questions.filter(q => q.id !== id)
    };
    setSettings(updated);
    StorageService.saveAdminSettings(updated);
    if (onSettingsSaved) onSettingsSaved();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '12px',
      overflowY: 'auto'
    }}>
      <div 
        className="glass-card settings-modal-card"
        style={{
          maxWidth: '850px',
          width: '100%',
          maxHeight: 'calc(100dvh - 24px)',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0e1728 0%, #070d18 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(245, 158, 11, 0.2)',
          overflow: 'hidden'
        }}
      >
        {/* Top Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.35)'
            }}>
              <Settings size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff' }}>
                {t('settings.title')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t('settings.subtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LanguageSwitcher compact />
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '50%', color: '#94a3b8' }}
              title={t('common.close')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Layout: Sidebar categories + Main Settings Area */}
        <div className="settings-modal-layout" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* Categories Sidebar */}
          <div className="settings-modal-sidebar" style={{
            width: '230px',
            flexShrink: 0,
            borderRight: '1px solid var(--border-color)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: 'rgba(0,0,0,0.2)'
          }}>
            {[
              { id: 'general' as const, label: t('settings.category.general'), icon: Sliders },
              { id: 'cotisations' as const, label: t('settings.category.cotisations'), icon: Wallet },
              { id: 'questions' as const, label: t('settings.category.questions'), icon: HelpCircle },
              { id: 'badge' as const, label: t('settings.category.badges'), icon: IdCard },
              { id: 'system' as const, label: t('settings.category.system'), icon: Bell }
            ].map((cat) => {
              const active = activeCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: active ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: active ? 'var(--accent-gold)' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={16} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Body */}
          <div className="settings-modal-body" style={{ flex: 1, minWidth: 0, padding: '24px', overflowY: 'auto' }}>

            {/* Success notification */}
            {savedSuccess && (
              <div style={{
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{t('settings.savedSuccess')}</span>
              </div>
            )}

            {/* CATEGORY: GENERAL */}
            {activeCategory === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                  {t('settings.general.title')}
                </h4>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('settings.general.groupName')} :
                  </label>
                  <input
                    type="text"
                    value={settings.chorale_nom}
                    onChange={(e) => setSettings({ ...settings, chorale_nom: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                      {t('settings.general.acronym')} :
                    </label>
                    <input
                      type="text"
                      value={settings.chorale_sigle}
                      onChange={(e) => setSettings({ ...settings, chorale_sigle: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                      {t('settings.general.currency')} :
                    </label>
                    <input
                      type="text"
                      value={settings.devise}
                      onChange={(e) => setSettings({ ...settings, devise: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={settings.allow_self_registration}
                      onChange={(e) => setSettings({ ...settings, allow_self_registration: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>{t('settings.general.allowRegistration')}</span>
                  </label>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: '28px', marginTop: '4px' }}>
                    {t('settings.general.allowRegistrationHint')}
                  </div>
                </div>
              </div>
            )}

            {/* CATEGORY: COTISATIONS */}
            {activeCategory === 'cotisations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                  {t('settings.cotisations.title')}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                      {t('settings.cotisations.monthlyDefault')} :
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="500"
                        step="500"
                        value={settings.cotisation_mensuelle_defaut}
                        onChange={(e) => setSettings({ ...settings, cotisation_mensuelle_defaut: Number(e.target.value) })}
                        className="form-input"
                        style={{ paddingRight: '40px' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                        {settings.devise}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                      {t('settings.cotisations.dailyDefault')} :
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="200"
                        step="200"
                        value={settings.cotisation_journaliere_defaut}
                        onChange={(e) => setSettings({ ...settings, cotisation_journaliere_defaut: Number(e.target.value) })}
                        className="form-input"
                        style={{ paddingRight: '40px' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                        {settings.devise}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('settings.cotisations.hint')}
                </div>
              </div>
            )}

            {/* CATEGORY: REGISTRATION QUESTIONS */}
            {activeCategory === 'questions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                  {t('settings.questions.title', { count: settings.registration_questions.length })}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('settings.questions.description')}
                </p>

                {/* Add new question */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={t('settings.questions.placeholder')}
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={newQuestionRequired}
                      onChange={(e) => setNewQuestionRequired(e.target.checked)}
                    />
                    <span>{t('settings.questions.required')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    <Plus size={15} />
                    <span>{t('common.add')}</span>
                  </button>
                </div>

                {/* List of existing questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {settings.registration_questions.map((q, idx) => (
                    <div 
                      key={q.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 800 }}>#{idx + 1}</span>
                        <span style={{ fontSize: '0.85rem' }}>{q.question}</span>
                        {q.required && (
                          <span className="badge badge-gold" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                            {t('settings.questions.requiredBadge')}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="btn btn-ghost"
                        style={{ padding: '4px 6px', color: '#ef4444' }}
                        title={t('settings.questions.deleteTitle')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CATEGORY: BADGES */}
            {activeCategory === 'badge' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                  {t('settings.badges.title')}
                </h4>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('settings.badges.headerTitle')} :
                  </label>
                  <input
                    type="text"
                    value={settings.titre_badge_defaut}
                    onChange={(e) => setSettings({ ...settings, titre_badge_defaut: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('settings.badges.info')}
                </div>
              </div>
            )}

            {/* CATEGORY: SYSTEM */}
            {activeCategory === 'system' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                  {t('settings.system.title')}
                </h4>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={settings.notifications_sonores}
                      onChange={(e) => setSettings({ ...settings, notifications_sonores: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>{t('settings.system.soundEffects')}</span>
                  </label>
                </div>

                {isAdminOnly && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginBottom: '6px' }}>
                      {t('settings.system.dangerTitle')} :
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      {t('settings.system.dangerDescription')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('settings.system.resetConfirm'))) {
                          StorageService.resetToCleanState();
                        }
                      }}
                      className="btn btn-danger"
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RotateCcw size={14} />
                      <span>{t('settings.system.resetButton')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="settings-modal-footer" style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ fontSize: '0.85rem' }}
          >
            {t('common.close')}
          </button>

          <button
            onClick={handleSaveAll}
            className="btn btn-primary"
            style={{
              fontSize: '0.85rem',
              padding: '10px 22px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Save size={16} />
            <span>{t('settings.saveChanges')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

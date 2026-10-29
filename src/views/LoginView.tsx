import React, { useState } from 'react';
import { Membre, Groupe, RegistrationQuestion } from '../types';
import { Music, Lock, User, ArrowRight, ShieldCheck, Sparkles, HelpCircle, Clock, ArrowLeft } from 'lucide-react';
import { StorageService } from '../utils/storage';
import confetti from 'canvas-confetti';
import { useLanguage, LanguageSwitcher } from '../i18n';

interface LoginViewProps {
  onLoginSuccess: (user: Membre) => void;
  allGroupes: Groupe[];
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  allGroupes
}) => {
  const { t } = useLanguage();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredCode, setRegisteredCode] = useState('');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin');

  // Register form state
  const [regNom, setRegNom] = useState('');
  const [regPrenom, setRegPrenom] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGroupeId, setRegGroupeId] = useState(allGroupes[0]?.id || 'g1');

  // Registration wizard step
  const [regStep, setRegStep] = useState(1);

  // Registration questions answers
  const adminSettings = StorageService.getAdminSettings();
  const regQuestions: RegistrationQuestion[] = adminSettings.registration_questions || [];
  const [regAnswers, setRegAnswers] = useState<Record<string, string>>({});

  // Feedback message
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const res = StorageService.login(loginIdentifier, loginPassword);
    if (!res.success) {
      setErrorMsg(res.message);
    } else if (res.user) {
      onLoginSuccess(res.user);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regNom.trim() || !regPrenom.trim() || !regUsername.trim() || !regPassword.trim()) {
      setErrorMsg(t('auth.requiredFieldsError'));
      return;
    }

    // Check required registration questions
    for (const q of regQuestions) {
      if (q.required && (!regAnswers[q.id] || !regAnswers[q.id].trim())) {
        setErrorMsg(t('auth.answerRequiredError', { question: q.question }));
        return;
      }
    }

    const answers = regQuestions.map(q => ({
      question: q.question,
      answer: regAnswers[q.id] || ''
    })).filter(a => a.answer.trim());

    const res = StorageService.register({
      nom: regNom,
      prenom: regPrenom,
      username: regUsername,
      email: regEmail || `${regUsername.toLowerCase()}@fiaram.mg`,
      password: regPassword,
      telephone: regPhone,
      groupe_id: regGroupeId,
      registration_answers: answers
    });

    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 }
      });
      // Show success message instead of auto-login
      setRegistrationSuccess(true);
      setRegisteredCode(res.user?.code_unique || '');
    }
  };

  // Registration success screen
  if (registrationSuccess) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--bg-primary)'
      }}>
        <div className="glass-card-gold" style={{
          maxWidth: '460px',
          width: '100%',
          padding: '40px 32px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
            <LanguageSwitcher compact />
          </div>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#10b981'
          }}>
            <Clock size={36} />
          </div>

          <h2 style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#10b981' }}>
            {t('auth.successTitle')}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            {t('auth.successMessagePrefix')}{' '}
            <strong style={{ color: 'var(--accent-gold)' }}>{t('auth.successMessagePending')}</strong>{' '}
            {t('auth.successMessageSuffix')}
          </p>

          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px' }}>{t('auth.memberCodeLabel')}:</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--accent-gold)', letterSpacing: '2px' }}>
              {registeredCode}
            </div>
          </div>

          <button
            onClick={() => {
              setRegistrationSuccess(false);
              setIsRegisterMode(false);
              setRegNom('');
              setRegPrenom('');
              setRegUsername('');
              setRegEmail('');
              setRegPassword('');
              setRegPhone('');
              setRegAnswers({});
              setRegStep(1);
            }}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            <ArrowRight size={16} />
            <span>{t('auth.backToLogin')}</span>
          </button>
        </div>
      </div>
    );
  }

  const stepLabels = [
    t('auth.step1.label'),
    t('auth.step2.label'),
    t('auth.step3.label'),
    t('auth.step4.label')
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'var(--bg-primary)'
    }}>
      <div className="glass-card-gold" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '32px 28px',
        position: 'relative',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
          <LanguageSwitcher compact />
        </div>

        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '58px',
            height: '58px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)'
          }}>
            <Music size={30} />
          </div>

          <h1 style={{
            fontSize: '1.5rem',
            margin: '0 0 4px',
            background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}>
            FIARAM NUMERIQUE
          </h1>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {t('auth.subtitle')}
          </div>
        </div>

        {/* Tab switch between Login and Register */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegisterMode(false); setErrorMsg(null); setRegStep(1); }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: !isRegisterMode ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: !isRegisterMode ? 'var(--accent-gold)' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {t('auth.tabLogin')}
          </button>

          <button
            type="button"
            onClick={() => { setIsRegisterMode(true); setErrorMsg(null); setRegStep(1); }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: isRegisterMode ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: isRegisterMode ? 'var(--accent-gold)' : 'var(--text-dim)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {t('auth.tabRegister')}
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            fontSize: '0.85rem',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        {!isRegisterMode ? (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                {t('auth.identifierLabel')}:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  required
                  placeholder={t('auth.identifierPlaceholder')}
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                {t('common.password')}:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-dim)' }} />
                <input
                  type="password"
                  required
                  placeholder={t('auth.passwordPlaceholder')}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.95rem' }}
            >
              <span>{t('auth.loginButton')}</span>
              <ArrowRight size={16} />
            </button>

            {/* Default Admin Account Helper Box */}
            <div style={{
              marginTop: '10px',
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '4px' }}>
                <ShieldCheck size={14} />
                <span>{t('auth.defaultAdminTitle')}:</span>
              </div>
              <div>{t('common.username')}: <strong style={{ color: 'var(--text-main)' }}>admin</strong></div>
              <div>{t('common.password')}: <strong style={{ color: 'var(--text-main)' }}>admin</strong></div>
            </div>
          </form>
        ) : (
          /* REGISTRATION WIZARD */
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px'
            }}>
              {[1, 2, 3, 4].map((step) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: regStep >= step ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)',
                    color: regStep >= step ? '#000' : 'var(--text-dim)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)'
                  }}>
                    {step}
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: regStep === step ? 'var(--accent-gold)' : 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {stepLabels[step - 1]}
                  </span>
                  {step < 4 && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      background: regStep > step ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)'
                    }} />
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {regStep === 1 && (
                <>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px' }}>
                    {t('auth.step1.title')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                        {t('auth.firstNameLabel')}:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t('auth.firstNamePlaceholder')}
                        value={regPrenom}
                        onChange={(e) => setRegPrenom(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                        {t('common.lastName')}:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t('auth.lastNamePlaceholder')}
                        value={regNom}
                        onChange={(e) => setRegNom(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                        {t('common.username')}:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t('auth.usernamePlaceholder')}
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                        {t('common.email')}:
                      </label>
                      <input
                        type="email"
                        placeholder={t('auth.emailPlaceholder')}
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                </>
              )}

              {regStep === 2 && (
                <>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px' }}>
                    {t('auth.step2.title')}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      {t('common.phone')}:
                    </label>
                    <input
                      type="text"
                      placeholder="+261 34..."
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      {t('auth.groupAssignmentLabel')} :
                    </label>
                    <select
                      value={regGroupeId}
                      onChange={(e) => setRegGroupeId(e.target.value)}
                      className="form-select"
                    >
                      {allGroupes.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nom_groupe}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                      {t('common.password')}:
                    </label>
                    <input
                      type="password"
                      required
                      placeholder={t('auth.createPasswordPlaceholder')}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </>
              )}

              {regStep === 3 && (
                <>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px' }}>
                    {t('auth.step3.title')}
                  </div>
                  {regQuestions.length > 0 ? (
                    <div style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(139, 92, 246, 0.08)',
                      border: '1px solid rgba(139, 92, 246, 0.2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '0.82rem', fontWeight: 700, color: '#8b5cf6' }}>
                        <HelpCircle size={16} />
                        <span>{t('auth.registrationQuestionsTitle')}</span>
                      </div>
                      {regQuestions.map((q) => (
                        <div key={q.id} style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
                            {q.question} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
                          </label>
                          <input
                            type="text"
                            required={q.required}
                            placeholder={t('auth.answerPlaceholder')}
                            value={regAnswers[q.id] || ''}
                            onChange={(e) => setRegAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="form-input"
                            style={{ fontSize: '0.82rem' }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Aucune question d'inscription configurée.
                    </div>
                  )}
                </>
              )}

              {regStep === 4 && (
                <>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px' }}>
                    {t('auth.step4.title')}
                  </div>
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px', fontSize: '0.78rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{t('common.firstName')}</div>
                        <div style={{ fontWeight: 700 }}>{regPrenom}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{t('common.lastName')}</div>
                        <div style={{ fontWeight: 700 }}>{regNom}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{t('common.username')}</div>
                        <div style={{ fontWeight: 700 }}>{regUsername}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{t('common.email')}</div>
                        <div style={{ fontWeight: 700 }}>{regEmail || `${regUsername.toLowerCase()}@fiaram.mg`}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px', fontSize: '0.78rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{t('common.phone')}</div>
                        <div style={{ fontWeight: 700 }}>{regPhone || '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{t('auth.groupAssignmentLabel')}</div>
                        <div style={{ fontWeight: 700 }}>{allGroupes.find((g) => g.id === regGroupeId)?.nom_groupe || '—'}</div>
                      </div>
                    </div>
                    {regQuestions.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        {regQuestions.map((q) => (
                          <div key={q.id} style={{ marginBottom: '6px', fontSize: '0.78rem' }}>
                            <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{q.question}</div>
                            <div style={{ fontWeight: 700 }}>{regAnswers[q.id] || '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '10px'
                  }}>
                    <Clock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span>{t('auth.pendingApprovalNotice')}</span>
                  </div>
                </>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px',
                gap: '10px'
              }}>
                {regStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setRegStep(prev => prev - 1)}
                    className="btn btn-ghost"
                    style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                  >
                    <ArrowLeft size={14} />
                    <span>{t('common.previous')}</span>
                  </button>
                )}
                {regStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setRegStep(prev => prev + 1)}
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                  >
                    <span>{t('common.next')}</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                  >
                    <Sparkles size={16} />
                    <span>{t('auth.registerButton')}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

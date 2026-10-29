import React, { useState } from 'react';
import { Membre, Cotisation, TypeCotisation } from '../types';
import { 
  Wallet, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  AlertCircle, 
  Printer, 
  Sparkles, 
  CreditCard, 
  Building, 
  Smartphone,
  CalendarDays
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StorageService } from '../utils/storage';
import { canManageAnyCotisation, canManageCotisation } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface CotisationViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  cotisations: Cotisation[];
  onRefreshCotisations: () => void;
}

const MOIS = [
  { code: '01', key: 'common.month.1' },
  { code: '02', key: 'common.month.2' },
  { code: '03', key: 'common.month.3' },
  { code: '04', key: 'common.month.4' },
  { code: '05', key: 'common.month.5' },
  { code: '06', key: 'common.month.6' },
  { code: '07', key: 'common.month.7' },
  { code: '08', key: 'common.month.8' },
  { code: '09', key: 'common.month.9' },
  { code: '10', key: 'common.month.10' },
  { code: '11', key: 'common.month.11' },
  { code: '12', key: 'common.month.12' }
];

export const CotisationView: React.FC<CotisationViewProps> = ({
  currentUser,
  allMembres,
  cotisations,
  onRefreshCotisations
}) => {
  const { t } = useLanguage();
  const paymentMethodLabel = (method: string) => {
    const keys: Record<string, string> = {
      MVola: 'cotisations.method.mvola',
      AirtelMoney: 'cotisations.method.airtel',
      OrangeMoney: 'cotisations.method.orange',
      'Karatra Banky': 'cotisations.method.bank',
      'Vola Tanan-tanana': 'cotisations.method.cash',
      Haingo: 'cotisations.method.fiaram'
    };
    return keys[method] ? t(keys[method]) : method;
  };
  const roleLabel = (role: Membre['role']) => {
    const keys: Record<Membre['role'], string> = {
      admin: 'common.role.admin',
      super_chef: 'common.role.superChef',
      chef: 'common.role.chef',
      membre: 'common.role.member'
    };
    return t(keys[role]);
  };
  const canManage = canManageAnyCotisation(currentUser);
  const allGroupes = StorageService.getGroupes();
  const manageableMembres = canManage
    ? allMembres.filter((m) => canManageCotisation(currentUser, m, allGroupes))
    : [currentUser];

  // Selected member to view cotisations for (default to current user)
  const [selectedMembreId, setSelectedMembreId] = useState(currentUser.id);
  const targetMembre = manageableMembres.find((m) => m.id === selectedMembreId) || currentUser;

  // Type of cotisation: 'mensuel' (isambolana) or 'journalier' (isan'andro)
  const [typeCotisation, setTypeCotisation] = useState<TypeCotisation>('mensuel');

  // Payment form state
  const [montant, setMontant] = useState(5000);
  const [mois, setMois] = useState('10');
  const [annee, setAnnee] = useState('2026');
  const [dateJour, setDateJour] = useState(new Date().toISOString().split('T')[0]);
  const [motif, setMotif] = useState('');
  const [methode, setMethode] = useState('MVola');
  const [reference, setReference] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Digital receipt modal
  const [receiptCotisation, setReceiptCotisation] = useState<Cotisation | null>(null);

  // Filter cotisations for target member
  const memberCotisations = cotisations.filter((c) => c.membre_id === targetMembre.id);
  const totalPaid = memberCotisations.reduce((acc, c) => acc + c.montant, 0);

  // Totals by type
  const totalMensuel = memberCotisations
    .filter(c => !c.type_cotisation || c.type_cotisation === 'mensuel')
    .reduce((acc, c) => acc + c.montant, 0);

  const totalJournalier = memberCotisations
    .filter(c => c.type_cotisation === 'journalier')
    .reduce((acc, c) => acc + c.montant, 0);

  // Check which months of 2026 are paid
  const isMonthPaid = (mCode: string) => {
    return memberCotisations.some((c) => (c.type_cotisation === 'mensuel' || !c.type_cotisation) && c.mois === mCode && c.annee === annee);
  };

  // Submit payment
  const handlePaiement = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!canManage) {
      setErrorMsg(t('cotisations.error.noPermission'));
      return;
    }

    if (!canManageCotisation(currentUser, targetMembre, allGroupes)) {
      setErrorMsg(t('cotisations.error.noPermissionMember'));
      return;
    }

    const res = StorageService.addCotisation(
      targetMembre.id,
      Number(montant),
      mois,
      annee,
      methode,
      reference,
      typeCotisation,
      dateJour,
      motif
    );

    if (!res.success) {
      setErrorMsg(
        typeCotisation === 'journalier'
          ? t('cotisations.error.dayAlreadyPaid', { date: dateJour })
          : t('cotisations.error.monthAlreadyPaid', { month: mois, year: annee })
      );
    } else {
      const typeLabel = typeCotisation === 'journalier'
        ? `${t('common.cotisation.daily')} (${dateJour})`
        : `${t('common.cotisation.monthly')} (${mois}/${annee})`;
      setSuccessMsg(t('cotisations.success.added', {
        type: typeLabel,
        amount: Number(montant).toLocaleString()
      }));
      onRefreshCotisations();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });
      if (res.cotisation) {
        setReceiptCotisation(res.cotisation);
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Wallet size={28} style={{ color: 'var(--accent-gold)' }} />
          <div>
            <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{t('cotisations.title')}</h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('cotisations.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Warning banner for simple members: read-only */}
      {!canManage && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={22} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem' }}>
            <strong>{t('cotisations.warning.title')}</strong> {t('cotisations.warning.body1')} <strong>{t('cotisations.warning.roles')}</strong> {t('cotisations.warning.body2')}
          </div>
        </div>
      )}

      {/* CHEF / ADMIN: SELECT MEMBER DROPDOWN */}
      {canManage && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
            {t('cotisations.managerSelectLabel')}
          </span>
          <select
            value={selectedMembreId}
            onChange={(e) => setSelectedMembreId(e.target.value)}
            className="form-select"
            style={{ maxWidth: '340px', padding: '8px 12px', fontSize: '0.85rem' }}
          >
            {manageableMembres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.prenom} {m.nom} ({m.code_unique}) • {roleLabel(m.role)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#ef4444',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{errorMsg}</div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={20} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{successMsg}</div>
        </div>
      )}

      {/* Overview Card of Selected Member */}
      <div className="glass-card-gold" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={targetMembre.photo_url}
            alt={targetMembre.prenom}
            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }}
          />
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{targetMembre.prenom} {targetMembre.nom}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)' }}>
              {t('cotisations.memberCodeCategory', {
                code: targetMembre.code_unique,
                role: targetMembre.role.toUpperCase()
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('cotisations.totalPaidAll')}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>
              {totalPaid.toLocaleString()} {t('common.currency')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('cotisations.monthlyTotal')}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3b82f6' }}>
              {totalMensuel.toLocaleString()} {t('common.currency')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('cotisations.dailyTotal')}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
              {totalJournalier.toLocaleString()} {t('common.currency')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        
        {/* PAYMENT FORM (Only for Chef/Admin) */}
        {canManage ? (
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b'
              }}>
                <Wallet size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{t('cotisations.paymentTitle')}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('cotisations.paymentSubtitle')}</div>
              </div>
            </div>

            {/* SWITCH: ISAM-BOLANA vs ISAN'ANDRO */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '4px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              marginBottom: '16px'
            }}>
              <button
                type="button"
                onClick={() => setTypeCotisation('mensuel')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: typeCotisation === 'mensuel' ? 'var(--accent-gold)' : 'transparent',
                  color: typeCotisation === 'mensuel' ? '#070d1e' : 'var(--text-muted)',
                  fontWeight: typeCotisation === 'mensuel' ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Calendar size={15} />
                <span>{t('cotisations.typeMonthly')}</span>
              </button>

              <button
                type="button"
                onClick={() => setTypeCotisation('journalier')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: typeCotisation === 'journalier' ? 'var(--accent-gold)' : 'transparent',
                  color: typeCotisation === 'journalier' ? '#070d1e' : 'var(--text-muted)',
                  fontWeight: typeCotisation === 'journalier' ? 800 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <CalendarDays size={15} />
                <span>{t('cotisations.typeDaily')}</span>
              </button>
            </div>

            <form onSubmit={handlePaiement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('cotisations.amountLabel')}
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={montant}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  className="form-input"
                />
              </div>

              {/* IF MENSUEL: MONTH AND YEAR */}
              {typeCotisation === 'mensuel' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                      {t('cotisations.monthLabel')}
                    </label>
                    <select
                      value={mois}
                      onChange={(e) => setMois(e.target.value)}
                      className="form-select"
                    >
                      {MOIS.map((m) => (
                        <option key={m.code} value={m.code}>
                          {t(m.key)} ({m.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                      {t('cotisations.yearLabel')}
                    </label>
                    <select
                      value={annee}
                      onChange={(e) => setAnnee(e.target.value)}
                      className="form-select"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>
              ) : (
                /* IF JOURNALIER: DATE PAR JOUR */
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('cotisations.dayDateLabel')}
                  </label>
                  <input
                    type="date"
                    required
                    value={dateJour}
                    onChange={(e) => setDateJour(e.target.value)}
                    className="form-input"
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    {t('cotisations.dayDateHint')}
                  </div>
                </div>
              )}

              {/* MOTIF / ANTONY */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('cotisations.motifLabel')}
                </label>
                <input
                  type="text"
                  placeholder={typeCotisation === 'journalier'
                    ? t('cotisations.motifPlaceholderDaily')
                    : t('cotisations.motifPlaceholderMonthly')}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* METHODE DE PAIEMENT */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('cotisations.methodLabel')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'MVola', key: 'cotisations.method.mvola', icon: Smartphone },
                    { id: 'AirtelMoney', key: 'cotisations.method.airtel', icon: Smartphone },
                    { id: 'OrangeMoney', key: 'cotisations.method.orange', icon: Smartphone },
                    { id: 'Karatra Banky', key: 'cotisations.method.bank', icon: CreditCard },
                    { id: 'Vola Tanan-tanana', key: 'cotisations.method.cash', icon: Building },
                    { id: 'Haingo', key: 'cotisations.method.fiaram', icon: Sparkles }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethode(m.id)}
                      className={`btn ${methode === m.id ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.75rem', padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    >
                      <m.icon size={15} />
                      <span>{t(m.key)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('cotisations.referenceLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('cotisations.referencePlaceholder')}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: '6px', padding: '12px' }}
              >
                <CreditCard size={18} />
                <span>{t('cotisations.submitPayment', {
                  type: t(typeCotisation === 'journalier' ? 'common.cotisation.daily' : 'common.cotisation.monthly')
                })}</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <Wallet size={48} style={{ color: 'var(--accent-gold)', marginBottom: '14px', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 8px' }}>{t('cotisations.myAccountTitle')}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
              {t('cotisations.myAccountMessage')}
            </p>
            <div style={{ marginTop: '16px', padding: '12px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.8rem' }}>
              {t('cotisations.memberCodeLabel')} <strong style={{ color: 'var(--accent-gold)' }}>{currentUser.code_unique}</strong>
            </div>
          </div>
        )}

        {/* ANNUAL 12-MONTH MATRIX & RECENT DAILY SUMMARY */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{t('cotisations.calendarTitle', { year: annee })}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('cotisations.calendarLegend')}</div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '16px'
          }}>
            {MOIS.map((m) => {
              const paid = isMonthPaid(m.code);
              return (
                <div
                  key={m.code}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '10px',
                    border: paid ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                    background: paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: paid ? '#10b981' : 'var(--text-main)' }}>
                    {t(m.key)}
                  </div>
                  <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>
                    {paid ? (
                      <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <CheckCircle2 size={12} /> {t('cotisations.paid')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>
                        {t('cotisations.unpaid')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px' }}>
            💡 <em>{t('cotisations.calendarHintLabel')}</em> {t('cotisations.calendarHint')}
          </div>
        </div>

      </div>

      {/* TABLE OF COTISATION HISTORY */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{t('cotisations.historyTitle', { count: memberCotisations.length })}</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            {t('cotisations.historySubtitle')}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.type')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.periodDate')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.motif')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.amount')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.method')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.reference')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.paymentDate')}</th>
                <th style={{ padding: '10px 12px' }}>{t('cotisations.col.receipt')}</th>
              </tr>
            </thead>
            <tbody>
              {memberCotisations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '26px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('cotisations.emptyHistory')}
                  </td>
                </tr>
              ) : (
                memberCotisations.map((c) => {
                  const isDaily = c.type_cotisation === 'journalier';
                  const mObj = MOIS.find((m) => m.code === c.mois);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }}>
                        {isDaily ? (
                          <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>
                            {t('common.cotisation.daily')}
                          </span>
                        ) : (
                          <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                            {t('common.cotisation.monthly')}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px', fontWeight: 700 }}>
                        {isDaily ? (
                          <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>
                            {c.date_jour || c.date_paiement?.split(' ')[0]}
                          </span>
                        ) : (
                          <span>{mObj ? t(mObj.key) : c.mois} {c.annee}</span>
                        )}
                      </td>

                      <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {c.motif || (isDaily
                          ? t('cotisations.defaultDailyMotif')
                          : t('cotisations.defaultMonthlyMotif'))}
                      </td>

                      <td style={{ padding: '12px', color: '#10b981', fontWeight: 800 }}>
                        {c.montant.toLocaleString()} {t('common.currency')}
                      </td>

                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {paymentMethodLabel(c.methode)}
                      </td>

                      <td style={{ padding: '12px', color: 'var(--accent-gold)', fontFamily: 'monospace' }}>
                        {c.reference || '—'}
                      </td>

                      <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {c.date_paiement}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setReceiptCotisation(c)}
                            className="btn btn-ghost"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title={t('cotisations.viewReceiptTitle')}
                          >
                            <FileText size={13} />
                            <span>{t('common.view')}</span>
                          </button>

                          <button
                            onClick={() => StorageService.printReceiptCotisation(c, targetMembre)}
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title={t('cotisations.printReceiptTitle')}
                          >
                            <Printer size={13} />
                            <span>{t('common.print')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIGITAL RECEIPT MODAL */}
      {receiptCotisation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '28px', background: '#0b132b', border: '1px solid var(--border-gold)' }}>
            
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-gold)' }}>
                {t('cotisations.receiptBrand')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t('cotisations.receiptSubtitle')}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '8px', color: '#ffffff' }}>
                {t('cotisations.receiptTitle')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{t('cotisations.receiptNumber')}</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{receiptCotisation.reference}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{t('common.member')}:</span>
                <span style={{ fontWeight: 700 }}>{targetMembre.prenom} {targetMembre.nom}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{t('common.code')}:</span>
                <span>{targetMembre.code_unique}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{t('common.type')}:</span>
                <span style={{ fontWeight: 700 }}>
                  {t(receiptCotisation.type_cotisation === 'journalier'
                    ? 'cotisations.typeDaily'
                    : 'cotisations.typeMonthly')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>
                  {t(receiptCotisation.type_cotisation === 'journalier'
                    ? 'cotisations.paidDate'
                    : 'cotisations.paidMonth')}
                </span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                  {receiptCotisation.type_cotisation === 'journalier'
                    ? (receiptCotisation.date_jour || receiptCotisation.date_paiement)
                    : `${t(MOIS.find((m) => m.code === receiptCotisation.mois)?.key || 'common.month.1')} ${receiptCotisation.annee}`
                  }
                </span>
              </div>
              {receiptCotisation.motif && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{t('cotisations.motif')}</span>
                  <span>{receiptCotisation.motif}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{t('cotisations.paymentMethod')}</span>
                <span>{paymentMethodLabel(receiptCotisation.methode)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>{t('cotisations.paymentDate')}</span>
                <span>{receiptCotisation.date_paiement}</span>
              </div>

              <div style={{
                marginTop: '12px',
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{t('cotisations.totalPaid')}</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>
                  {receiptCotisation.montant.toLocaleString()} {t('common.currency')}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => StorageService.printReceiptCotisation(receiptCotisation, targetMembre)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <Printer size={16} />
                <span>{t('cotisations.printReceipt')}</span>
              </button>
              <button
                onClick={() => setReceiptCotisation(null)}
                className="btn btn-ghost"
              >
                {t('common.close')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

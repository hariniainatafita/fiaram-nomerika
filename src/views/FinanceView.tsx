import React, { useState } from 'react';
import { Membre, Groupe, FinanceGroupe } from '../types';
import { 
  CircleDollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Download, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Search,
  CheckCircle2
} from 'lucide-react';
import { StorageService } from '../utils/storage';
import {
  canAccessFinance,
  canManageFinanceForGroup,
  canViewAllFinances,
  getManagedGroupIds
} from '../utils/permissions';
import { useLanguage } from '../i18n';

interface FinanceViewProps {
  currentUser: Membre;
  allGroupes: Groupe[];
  allMembres: Membre[];
  finances: FinanceGroupe[];
  onRefreshFinances: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  currentUser,
  allGroupes,
  allMembres,
  finances,
  onRefreshFinances
}) => {
  const { t } = useLanguage();
  const canViewFinance = canAccessFinance(currentUser);
  const managedGroupIds = getManagedGroupIds(currentUser, allGroupes);
  const allowedGroupes = canViewAllFinances(currentUser)
    ? allGroupes
    : allGroupes.filter((g) => managedGroupIds.includes(g.id));

  // Group selection
  const [selectedGroupeId, setSelectedGroupeId] = useState(allowedGroupes[0]?.id || '');

  // Transaction form modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [txType, setTxType] = useState<'entree' | 'sortie'>('entree');
  const [montant, setMontant] = useState(20000);
  const [motif, setMotif] = useState('');

  // Filter
  const [filterType, setFilterType] = useState<string>('all');
  const [searchMotif, setSearchMotif] = useState('');

  const activeGroupe = allowedGroupes.find((g) => g.id === selectedGroupeId) || allowedGroupes[0];

  if (!canViewFinance || !activeGroupe) {
    return (
      <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '600px', margin: '40px auto' }}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <CircleDollarSign size={42} style={{ color: '#ef4444', marginBottom: '12px' }} />
          <h2 style={{ margin: '0 0 8px' }}>{t('finance.accessDeniedTitle')}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('finance.accessDeniedMessage')}
          </p>
        </div>
      </div>
    );
  }

  // Group finances
  const groupFinances = finances.filter((f) => f.groupe_id === activeGroupe?.id);
  const totalEntrees = groupFinances.reduce((acc, f) => acc + (f.argent_entree || 0), 0);
  const totalSorties = groupFinances.reduce((acc, f) => acc + (f.argent_sortie || 0), 0);
  const soldeActuel = (activeGroupe?.solde || 0);

  // Handle Add Transaction
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageFinanceForGroup(currentUser, activeGroupe)) return;
    if (!allowedGroupes.some((g) => g.id === activeGroupe.id)) return;
    if (!motif.trim()) return;

    const entree = txType === 'entree' ? Number(montant) : 0;
    const sortie = txType === 'sortie' ? Number(montant) : 0;

    StorageService.addFinanceTransaction(activeGroupe.id, currentUser.id, motif, entree, sortie);
    onRefreshFinances();
    setShowAddModal(false);
    setMotif('');
    setMontant(20000);
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      t('finance.csv.id'),
      t('finance.csv.group'),
      t('common.date'),
      t('finance.csv.motif'),
      t('finance.csv.income'),
      t('finance.csv.expense'),
      t('finance.csv.balance')
    ];
    const rows = groupFinances.map((f) => [
      f.id,
      activeGroupe.nom_groupe,
      f.date_operation,
      `"${f.motif.replace(/"/g, '""')}"`,
      f.argent_entree,
      f.argent_sortie,
      f.reste
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", t('finance.csv.fileName', {
      group: activeGroupe.nom_groupe.replace(/\s+/g, '_'),
      date: new Date().toISOString().slice(0, 10)
    }));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredFinances = groupFinances.filter((f) => {
    const motifMatch = f.motif.toLowerCase().includes(searchMotif.toLowerCase());
    const typeMatch = filterType === 'all' 
      ? true 
      : filterType === 'entree' 
        ? f.argent_entree > 0 
        : f.argent_sortie > 0;
    return motifMatch && typeMatch;
  });

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-gold">{t('finance.badge')}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('finance.title')}</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('finance.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={exportCSV} 
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} />
            <span>{t('finance.exportCsv')}</span>
          </button>

          {canManageFinanceForGroup(currentUser, activeGroupe) && (
            <button 
              onClick={() => setShowAddModal(true)} 
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={18} />
              <span>{t('finance.addTransaction')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Group Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
        {allowedGroupes.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGroupeId(g.id)}
            className={`btn ${selectedGroupeId === g.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
          >
            <span>{g.nom_groupe}</span>
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Remaining Solde */}
        <div className="glass-card-gold" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>
            {t('finance.kpi.balance')}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-gold)', margin: '6px 0' }}>
            {soldeActuel.toLocaleString()} <span style={{ fontSize: '1rem' }}>{t('common.currency')}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t('finance.kpi.balanceSubtitle', { group: activeGroupe.nom_groupe })}
          </div>
        </div>

        {/* Total In */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('finance.kpi.income')}</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#10b981', margin: '6px 0' }}>
                +{totalEntrees.toLocaleString()} {t('common.currency')}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <TrendingUp size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('finance.kpi.incomeSubtitle')}
          </div>
        </div>

        {/* Total Out */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('finance.kpi.expense')}</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ef4444', margin: '6px 0' }}>
                -{totalSorties.toLocaleString()} {t('common.currency')}
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <TrendingDown size={22} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('finance.kpi.expenseSubtitle')}
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder={t('finance.searchPlaceholder')}
              value={searchMotif}
              onChange={(e) => setSearchMotif(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-select"
            style={{ width: '180px' }}
          >
            <option value="all">{t('finance.filter.all')}</option>
            <option value="entree">{t('finance.filter.income')}</option>
            <option value="sortie">{t('finance.filter.expense')}</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '10px 12px' }}>{t('common.date')}</th>
                <th style={{ padding: '10px 12px' }}>{t('finance.col.motif')}</th>
                <th style={{ padding: '10px 12px' }}>{t('common.type')}</th>
                <th style={{ padding: '10px 12px' }}>{t('common.amount')}</th>
                <th style={{ padding: '10px 12px' }}>{t('finance.col.balance')}</th>
                <th style={{ padding: '10px 12px' }}>{t('finance.col.responsible')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredFinances.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '26px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('finance.empty')}
                  </td>
                </tr>
              ) : (
                filteredFinances.map((f) => {
                  const m = allMembres.find((mbr) => mbr.id === f.membre_action_id);
                  const isEntree = f.argent_entree > 0;

                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {f.date_operation}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>
                        {f.motif}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {isEntree ? (
                          <span className="badge badge-green">
                            <ArrowDownLeft size={12} /> {t('finance.incomeBadge')}
                          </span>
                        ) : (
                          <span className="badge badge-red">
                            <ArrowUpRight size={12} /> {t('finance.expenseBadge')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 800, color: isEntree ? '#10b981' : '#ef4444' }}>
                        {isEntree
                          ? `+${f.argent_entree.toLocaleString()} ${t('common.currency')}`
                          : `-${f.argent_sortie.toLocaleString()} ${t('common.currency')}`}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--accent-gold)' }}>
                        {f.reste.toLocaleString()} {t('common.currency')}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-dim)' }}>
                        {m ? `${m.prenom} ${m.nom}` : t('finance.manager')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD TRANSACTION MODAL */}
      {showAddModal && (
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
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '26px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
              {t('finance.addModalTitle', { group: activeGroupe.nom_groupe })}
            </h3>

            <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('finance.txTypeLabel')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTxType('entree')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: txType === 'entree' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      background: txType === 'entree' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: txType === 'entree' ? '#10b981' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <ArrowDownLeft size={16} />
                    <span>{t('finance.incomeButton')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTxType('sortie')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: txType === 'sortie' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                      background: txType === 'sortie' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      color: txType === 'sortie' ? '#ef4444' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <ArrowUpRight size={16} />
                    <span>{t('finance.expenseButton')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('finance.amountLabel')}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('finance.motifLabel')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('finance.motifPlaceholder')}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <CheckCircle2 size={16} />
                  <span>{t('finance.submit')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

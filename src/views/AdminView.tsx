import React, { useEffect, useState } from 'react';
import { Membre, Groupe, Role, SuperChefPermissions } from '../types';
import { 
  ShieldAlert, 
  Crown, 
  Search, 
  UserPlus, 
  IdCard,
  RotateCcw,
  UserCheck,
  UserX,
  Ban,
  Unlock,
  Trash2,
  HelpCircle,
  Plus,
  X,
  Eye,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { StorageService } from '../utils/storage';
import {
  canAccessAdminPanel,
  canManageBadges,
  isAdmin
} from '../utils/permissions';
import { MemberBadgeModal } from '../components/MemberBadgeModal';
import { BatchBadgeModal } from '../components/BatchBadgeModal';
import { useLanguage } from '../i18n';

const ROLE_KEYS: Record<Role, string> = {
  admin: 'common.role.admin',
  super_chef: 'common.role.superChef',
  chef: 'common.role.chef',
  membre: 'common.role.member'
};

const SUPER_CHEF_PERMISSION_KEYS: [keyof SuperChefPermissions, string][] = [
  ['view_all_members', 'admin.permissionViewAllMembers'],
  ['manage_groups', 'admin.permissionManageGroups'],
  ['manage_chefs', 'admin.permissionManageChefs'],
  ['validate_presences', 'admin.permissionValidatePresences'],
  ['view_global_finance', 'admin.permissionViewGlobalFinance'],
  ['manage_cotisations', 'admin.permissionManageCotisations']
];

interface AdminViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  onRefreshMembres: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  allMembres,
  allGroupes,
  onRefreshMembres
}) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'members' | 'dossiers' | 'settings'>('members');

  // Badge Modal State
  const [selectedBadgeMembre, setSelectedBadgeMembre] = useState<Membre | null>(null);
  const [showBatchBadgeModal, setShowBatchBadgeModal] = useState<boolean>(false);

  // Dossier Modal State
  const [dossierMembre, setDossierMembre] = useState<Membre | null>(null);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNom, setNewNom] = useState('');
  const [newPrenom, setNewPrenom] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newEmail, setNewEmail] = useState('');
  const [newTel, setNewTel] = useState('');
  const [newRole, setNewRole] = useState<Role>('membre');
  const [newGroupeId, setNewGroupeId] = useState(allGroupes[0]?.id || 'g1');

  // Registration Questions State
  const [adminSettings, setAdminSettings] = useState(() => StorageService.getAdminSettings());
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);

  // Confirmation modal
  const [confirmAction, setConfirmAction] = useState<{ type: string; membre: Membre; message: string } | null>(null);

  const isAdminUser = isAdmin(currentUser);
  const canViewPanel = canAccessAdminPanel(currentUser);
  const canManageBadgesAccess = canManageBadges(currentUser);

  useEffect(() => {
    if (!isAdminUser && activeTab !== 'members') {
      setActiveTab('members');
    }
  }, [isAdminUser, activeTab]);  if (!canViewPanel) {
    return (
      <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '600px', margin: '40px auto' }}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <ShieldAlert size={42} style={{ color: '#ef4444', marginBottom: '12px' }} />
          <h2 style={{ margin: '0 0 8px' }}>{t('admin.accessDeniedTitle')}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('admin.accessDeniedMessage')}
          </p>
        </div>
      </div>
    );
  }

  // Change Role (admin only)
  const handleRoleChange = (membre: Membre, newR: Role) => {
    if (!isAdminUser) {
      alert(t('admin.roleChangeAdminOnly'));
      return;
    }
    const updated: Membre = { ...membre, role: newR };
    StorageService.updateMembre(updated);
    onRefreshMembres();
  };

  // Toggle Active (admin only)
  const handleToggleActive = (membre: Membre) => {
    if (!isAdminUser) return;
    const updated: Membre = { ...membre, is_active: !membre.is_active };
    StorageService.updateMembre(updated);
    onRefreshMembres();
  };

  // Verify dossier (admin only)
  const handleVerifyDossier = (membre: Membre) => {
    if (!isAdminUser) return;
    StorageService.verifyDossier(membre.id);
    onRefreshMembres();
  };

  // Reject (delete) unverified registration (admin only)
  const handleRejectDossier = (membre: Membre) => {
    if (!isAdminUser) return;
    setConfirmAction({
      type: 'reject',
      membre,
      message: t('admin.confirmReject', { name: `${membre.prenom} ${membre.nom}` })
    });
  };

  // Block member (admin only)
  const handleBlockMembre = (membre: Membre) => {
    if (!isAdminUser) return;
    setConfirmAction({
      type: 'block',
      membre,
      message: t('admin.confirmBlock', { name: `${membre.prenom} ${membre.nom}` })
    });
  };

  // Unblock member (admin only)
  const handleUnblockMembre = (membre: Membre) => {
    if (!isAdminUser) return;
    StorageService.unblockMembre(membre.id);
    onRefreshMembres();
  };

  // Delete member (admin only)
  const handleDeleteMembre = (membre: Membre) => {
    if (!isAdminUser) return;
    setConfirmAction({
      type: 'delete',
      membre,
      message: t('admin.confirmDelete', { name: `${membre.prenom} ${membre.nom}` })
    });
  };

  // Execute confirmed action (admin only)
  const executeConfirmedAction = () => {
    if (!isAdminUser) return;
    if (!confirmAction) return;
    const { type, membre } = confirmAction;
    if (type === 'reject') {
      StorageService.rejectDossier(membre.id);
    } else if (type === 'block') {
      StorageService.blockMembre(membre.id);
    } else if (type === 'delete') {
      StorageService.deleteMembre(membre.id);
    }
    onRefreshMembres();
    setConfirmAction(null);
  };

  const handleToggleSuperPermission = (key: keyof SuperChefPermissions) => {
    if (!isAdminUser) return;
    const updated = {
      ...adminSettings,
      super_chef_permissions: {
        ...adminSettings.super_chef_permissions,
        [key]: !adminSettings.super_chef_permissions[key]
      }
    };
    setAdminSettings(updated);
    StorageService.saveAdminSettings(updated);
  };

  // Add Registration Question
  const handleAddQuestion = () => {
    if (!isAdminUser || !newQuestionText.trim()) return;
    StorageService.addRegistrationQuestion(newQuestionText, newQuestionRequired);
    setAdminSettings(StorageService.getAdminSettings());
    setNewQuestionText('');
    setNewQuestionRequired(false);
  };

  // Remove Registration Question
  const handleRemoveQuestion = (id: string) => {
    if (!isAdminUser) return;
    StorageService.removeRegistrationQuestion(id);
    setAdminSettings(StorageService.getAdminSettings());
  };

  // Add Member Submit
  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUser) return;
    if (!newNom.trim() || !newPrenom.trim() || !newUsername.trim()) return;

    const count = allMembres.length + 1;
    const code = `GRP-2026-${count.toString().padStart(3, '0')}`;

    const newM = StorageService.addMembre({
      nom: newNom.toUpperCase().trim(),
      prenom: newPrenom.trim(),
      username: newUsername.toLowerCase().trim(),
      password: newPassword || '123456',
      email: newEmail.trim() || `${newUsername.toLowerCase().trim()}@fiaram.mg`,
      telephone: newTel.trim(),
      role: newRole,
      groupe_id: newGroupeId,
      is_active: true,
      is_approved: true, // Admin-added members are auto-approved
      dossier_verified: true, // Created by the admin = file already checked
      is_blocked: false,
      code_unique: code,
      solde: 0,
      theme: 'dark',
      fingerprint_registered: false
    });

    onRefreshMembres();
    setShowAddModal(false);
    setNewNom('');
    setNewPrenom('');
    setNewUsername('');
    setNewPassword('123456');
    setNewEmail('');
    setNewTel('');

    // Open their badge immediately for preview / printing
    setSelectedBadgeMembre(newM);
  };

  // Stats
  const totalMembres = allMembres.filter(m => m.is_approved !== false).length;
  const activeMembres = allMembres.filter((m) => m.is_active && m.is_approved !== false).length;
  const dossiersToVerify = allMembres.filter(m => m.dossier_verified === false && !m.is_blocked);
  const blockedMembres = allMembres.filter(m => m.is_blocked);
  const totalSoldeGroupes = allGroupes.reduce((acc, g) => acc + (g.solde || 0), 0);

  // Filtered members (exclude pending from main list)
  const filteredMembres = allMembres
    .filter(m => m.is_approved !== false) // Only approved
    .filter((m) => {
      const textMatch = `${m.nom} ${m.prenom} ${m.email} ${m.username || ''} ${m.code_unique}`.toLowerCase().includes(searchTerm.toLowerCase());
      const roleMatch = roleFilter === 'all' || m.role === roleFilter;
      return textMatch && roleMatch;
    });

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Sceptre Banner */}
      <div 
        className="sceptre-card"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)'
          }}>
            <Crown size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#f59e0b', margin: 0 }}>
                {isAdminUser ? t('admin.titleAdmin') : t('admin.titleSuperChef')}
              </h2>
              <span className={`badge ${isAdminUser ? 'badge-red' : 'badge-purple'}`}>
                {isAdminUser ? t('common.admin') : t('common.superChef')}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isAdminUser
                ? t('admin.subtitleAdmin')
                : t('admin.subtitleSuperChef')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canManageBadgesAccess && (
            <button
              onClick={() => setShowBatchBadgeModal(true)}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#070d1e',
                fontWeight: 800
              }}
            >
              <Layers size={18} />
              <span>{t('admin.batchBadges')}</span>
            </button>
          )}

          {isAdminUser && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}
            >
              <UserPlus size={18} />
              <span>{t('admin.addMember')}</span>
            </button>
          )}

          {isAdminUser && (
            <button
              onClick={() => {
                if (window.confirm(t('admin.resetConfirm'))) {
                  StorageService.resetToCleanState();
                }
              }}
              className="btn btn-danger"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              title={t('admin.resetTitle')}
            >
              <RotateCcw size={15} />
              <span>{t('admin.resetButton')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global stats KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('admin.totalMembers')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#3b82f6', margin: '4px 0' }}>
            {totalMembres}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
            {t('admin.activeMembers', { count: activeMembres })}
          </div>
        </div>

        <div
          className="glass-card"
          style={{ padding: '20px', cursor: isAdminUser ? 'pointer' : 'default' }}
          onClick={() => isAdminUser && setActiveTab('dossiers')}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('admin.dossiersKpi')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>
            {dossiersToVerify.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
            {t('admin.dossiersKpiSub')}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('admin.blocked')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444', margin: '4px 0' }}>
            {blockedMembres.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
            {t('admin.blockedAccounts')}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('admin.totalBalance')}</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--accent-gold)', margin: '4px 0' }}>
            {totalSoldeGroupes.toLocaleString()} <span style={{ fontSize: '1rem' }}>{t('common.currency')}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('admin.consolidatedTreasury')}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        {[
          { id: 'members' as const, label: t('admin.tabMembers'), count: filteredMembres.length },
          ...(isAdminUser
            ? [
                { id: 'dossiers' as const, label: t('admin.tabDossiers'), count: dossiersToVerify.length },
                { id: 'settings' as const, label: t('admin.tabSettings'), count: 0 }
              ]
            : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px', position: 'relative' }}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && tab.id === 'dossiers' && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#ef4444',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== DOSSIER VERIFICATION TAB ==================== */}
      {activeTab === 'dossiers' && isAdminUser && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={20} style={{ color: '#f59e0b' }} />
            {t('admin.dossiersTitle', { count: dossiersToVerify.length })}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('admin.dossiersDesc')}
          </p>

          {dossiersToVerify.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 12px', display: 'block' }} />
              {t('admin.noDossiers')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dossiersToVerify.map(m => (
                <div key={m.id} className="glass-card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <img
                      src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                      alt={m.prenom}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.prenom} {m.nom}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        @{m.username} • {m.email} • {m.telephone || t('admin.noPhone')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', marginTop: '2px' }}>
                        {t('admin.codeAndDate', { code: m.code_unique, date: m.created_at })}
                      </div>
                    </div>
                  </div>

                  {/* Registration Answers */}
                  {m.registration_answers && m.registration_answers.length > 0 && (
                    <div style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '6px' }}>
                        {t('admin.registrationAnswers')}
                      </div>
                      {m.registration_answers.map((a, i) => (
                        <div key={i} style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-dim)' }}>{a.question}</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginLeft: '8px' }}>→ {a.answer}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleVerifyDossier(m)}
                      className="btn btn-success"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <UserCheck size={14} />
                      <span>{t('admin.verify')}</span>
                    </button>
                    <button
                      onClick={() => handleRejectDossier(m)}
                      className="btn btn-danger"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <UserX size={14} />
                      <span>{t('admin.reject')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== SETTINGS TAB ==================== */}
      {activeTab === 'settings' && isAdminUser && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} style={{ color: '#8b5cf6' }} />
            {t('admin.registrationQuestionsTitle')}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {t('admin.registrationQuestionsDesc')}
          </p>

          <div style={{
            padding: '18px',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.06)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#a78bfa', marginBottom: '4px' }}>
              {t('admin.superChefPermissionsTitle')}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>
              {t('admin.superChefPermissionsDesc')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {SUPER_CHEF_PERMISSION_KEYS.map(([key, labelKey]) => (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    cursor: isAdminUser ? 'pointer' : 'not-allowed'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={adminSettings.super_chef_permissions[key]}
                    onChange={() => handleToggleSuperPermission(key)}
                    disabled={!isAdminUser}
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          </div>

          {/* Existing Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {adminSettings.registration_questions.map((q, i) => (
              <div key={q.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {i + 1}. {q.question}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: q.required ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    {q.required ? t('admin.requiredObligatory') : t('admin.optionalFacultative')}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveQuestion(q.id)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 8px', color: '#ef4444' }}
                  title={t('common.remove')}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Add new question */}
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.06)',
            border: '1px dashed rgba(139, 92, 246, 0.3)'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', color: '#8b5cf6' }}>
              {t('admin.addQuestionTitle')}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={t('admin.questionPlaceholder')}
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                className="form-input"
                style={{ flex: 1, minWidth: '220px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={newQuestionRequired}
                  onChange={(e) => setNewQuestionRequired(e.target.checked)}
                />
                {t('admin.requiredLabel')}
              </label>
              <button
                onClick={handleAddQuestion}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                disabled={!newQuestionText.trim()}
              >
                <Plus size={14} />
                <span>{t('common.add')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MEMBERS DIRECTORY TAB ==================== */}
      {activeTab === 'members' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', margin: 0 }}>
              {t('admin.membersListTitle', { count: filteredMembres.length })}
            </h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder={t('admin.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ padding: '8px 12px 8px 32px', fontSize: '0.85rem' }}
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="form-select"
                style={{ width: '160px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <option value="all">{t('admin.allRoles')}</option>
                <option value="admin">{t('common.role.admin')}</option>
                <option value="super_chef">{t('common.role.superChef')}</option>
                <option value="chef">{t('common.role.chef')}</option>
                <option value="membre">{t('common.role.member')}</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '10px 12px' }}>{t('admin.colMember')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('admin.colCode')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('admin.colUsernameEmail')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('admin.colRole')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('admin.colStatus')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('admin.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembres.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                          alt={m.prenom}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700 }}>{m.prenom} {m.nom}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('admin.fieldBalance')}: {(m.solde || 0).toLocaleString()} {t('common.currency')}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--accent-gold)', fontWeight: 700 }}>
                      {m.code_unique}
                    </td>

                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      <div><strong style={{ color: 'var(--text-main)' }}>@{m.username || 'admin'}</strong></div>
                      <div style={{ fontSize: '0.75rem' }}>{m.email}</div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      {isAdminUser ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m, e.target.value as Role)}
                          className="form-select"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', width: '130px' }}
                        >
                          <option value="membre">{t('common.role.member')}</option>
                          <option value="chef">{t('common.role.chef')}</option>
                          <option value="super_chef">{t('common.role.superChef')}</option>
                          <option value="admin">{t('common.role.admin')}</option>
                        </select>
                      ) : (
                        <span className="badge badge-purple">{t(ROLE_KEYS[m.role])}</span>
                      )}
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        {m.is_blocked ? (
                          <span className="badge badge-red">{t('common.status.blocked')}</span>
                        ) : m.is_active ? (
                          <span className="badge badge-green">{t('common.status.active')}</span>
                        ) : (
                          <span className="badge badge-red">{t('common.status.inactive')}</span>
                        )}
                        {m.dossier_verified === false && (
                          <span className="badge badge-gold" style={{ fontSize: '0.62rem' }}>{t('admin.dossierToVerifyBadge')}</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* View Dossier */}
                        <button
                          onClick={() => setDossierMembre(m)}
                          className="btn btn-ghost"
                          style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                          title={t('admin.viewFileTitle')}
                        >
                          <Eye size={13} />
                        </button>

                        {/* Badge */}
                        {canManageBadgesAccess && (
                          <button
                            onClick={() => setSelectedBadgeMembre(m)}
                            className={m.badge_generated ? 'btn btn-ghost' : 'btn btn-primary'}
                            style={{
                              padding: '5px 8px',
                              fontSize: '0.72rem',
                              border: m.badge_generated ? '1px solid #10b981' : undefined,
                              color: m.badge_generated ? '#10b981' : undefined
                            }}
                            title={m.badge_generated ? t('admin.badgeGeneratedTitle') : t('admin.badgeTitle')}
                          >
                            <IdCard size={13} />
                            {m.badge_generated && <span style={{ fontSize: '0.65rem', marginLeft: '3px', fontWeight: 800 }}>✓</span>}
                          </button>
                        )}

                        {/* Block / Unblock */}
                        {m.is_blocked ? (
                          <button
                            onClick={() => handleUnblockMembre(m)}
                            className="btn btn-success"
                            style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                            title={t('admin.unblockTitle')}
                          >
                            <Unlock size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlockMembre(m)}
                            className="btn btn-ghost"
                            style={{ padding: '5px 8px', fontSize: '0.72rem', color: '#f59e0b' }}
                            title={t('admin.blockTitle')}
                          >
                            <Ban size={13} />
                          </button>
                        )}

                        {/* Toggle Active */}
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`btn ${m.is_active ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                        >
                          {m.is_active ? t('admin.actionDeactivate') : t('admin.actionActivate')}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteMembre(m)}
                          className="btn btn-ghost"
                          style={{ padding: '5px 8px', fontSize: '0.72rem', color: '#ef4444' }}
                          title={t('admin.deleteTitle')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== DOSSIER MODAL ==================== */}
      {dossierMembre && (
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
          <div className="glass-card" style={{ maxWidth: '550px', width: '100%', padding: '28px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} style={{ color: '#8b5cf6' }} />
                {t('admin.dossierTitle')}
              </h3>
              <button onClick={() => setDossierMembre(null)} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '50%' }}>✕</button>
            </div>

            {/* Photo & name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <img src={dossierMembre.photo_url || DEFAULT_AVATAR_IMAGE} alt={dossierMembre.prenom} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }} />
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{dossierMembre.prenom} {dossierMembre.nom}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--accent-gold)' }}>{dossierMembre.code_unique}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t(ROLE_KEYS[dossierMembre.role]).toUpperCase()} • {dossierMembre.is_active ? t('common.status.active') : t('common.status.inactive')}
                  {dossierMembre.is_blocked && ` • ${t('admin.blockedUpper')}`}
                </div>
                <div style={{ marginTop: '6px' }}>
                  {dossierMembre.dossier_verified === false ? (
                    <span className="badge badge-gold" style={{ fontSize: '0.66rem' }}>{t('admin.dossierToVerifyBadge')}</span>
                  ) : (
                    <span className="badge badge-green" style={{ fontSize: '0.66rem' }}>{t('admin.dossierVerifiedBadge')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {[
                { label: t('admin.fieldUsername'), value: `@${dossierMembre.username || '-'}` },
                { label: t('admin.fieldEmail'), value: dossierMembre.email },
                { label: t('admin.fieldPhone'), value: dossierMembre.telephone || '-' },
                { label: t('admin.fieldCin'), value: dossierMembre.cin || '-' },
                { label: t('admin.fieldJob'), value: dossierMembre.profession || '-' },
                { label: t('admin.fieldRegistered'), value: dossierMembre.created_at },
                { label: t('admin.fieldBalance'), value: `${(dossierMembre.solde || 0).toLocaleString()} ${t('common.currency')}` },
                { label: t('admin.fieldGroup'), value: allGroupes.find(g => g.id === dossierMembre.groupe_id)?.nom_groupe || '-' }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{item.label}</span>
                  <span style={{ fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Registration Answers */}
            {dossierMembre.registration_answers && dossierMembre.registration_answers.length > 0 && (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HelpCircle size={15} />
                  {t('admin.registrationAnswersDossier')}
                </div>
                {dossierMembre.registration_answers.map((a, i) => (
                  <div key={i} style={{ marginBottom: '8px', fontSize: '0.82rem' }}>
                    <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>{a.question}</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', paddingLeft: '8px' }}>→ {a.answer}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Verify dossier footer */}
            {dossierMembre.dossier_verified === false && (
              <button
                onClick={() => {
                  handleVerifyDossier(dossierMembre);
                  setDossierMembre(null);
                }}
                className="btn btn-success"
                style={{ width: '100%', marginTop: '18px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <UserCheck size={16} />
                <span>{t('admin.verify')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== CONFIRMATION MODAL ==================== */}
      {confirmAction && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '28px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#ef4444'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{t('admin.confirmationTitle')}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              {confirmAction.message}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={executeConfirmedAction}
                className="btn btn-danger"
                style={{ flex: 1 }}
              >
                {t('admin.confirmYes')}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIC BADGE MODAL */}
      {selectedBadgeMembre && canManageBadgesAccess && (
        <MemberBadgeModal
          membre={selectedBadgeMembre}
          allGroupes={allGroupes}
          onClose={() => setSelectedBadgeMembre(null)}
          onUpdateMembre={onRefreshMembres}
        />
      )}

      {/* BATCH A4 BADGES GENERATOR MODAL */}
      {showBatchBadgeModal && canManageBadgesAccess && (
        <BatchBadgeModal
          allMembres={allMembres}
          allGroupes={allGroupes}
          onClose={() => setShowBatchBadgeModal(false)}
          onRefreshMembres={onRefreshMembres}
        />
      )}

      {/* ADD MEMBER MODAL */}
      {showAddModal && isAdminUser && (
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
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '26px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>{t('admin.addMember')}</h3>

            <form onSubmit={handleAddMemberSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.firstNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('admin.firstNamePlaceholder')}
                    value={newPrenom}
                    onChange={(e) => setNewPrenom(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.lastNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('admin.lastNamePlaceholder')}
                    value={newNom}
                    onChange={(e) => setNewNom(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.usernameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('admin.usernamePlaceholder')}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.passwordLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('admin.passwordPlaceholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.emailLabel')}
                  </label>
                  <input
                    type="email"
                    placeholder={t('admin.emailPlaceholder')}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.phoneLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('admin.phonePlaceholder')}
                    value={newTel}
                    onChange={(e) => setNewTel(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.groupVoiceLabel')}
                  </label>
                  <select
                    value={newGroupeId}
                    onChange={(e) => setNewGroupeId(e.target.value)}
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('admin.roleLabel')}
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="form-select"
                  >
                    <option value="membre">{t('common.role.member')}</option>
                    <option value="chef">{t('common.role.chef')}</option>
                    <option value="super_chef">{t('common.role.superChef')}</option>
                    <option value="admin">{t('common.role.admin')}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('admin.addAndGenerateBadge')}
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

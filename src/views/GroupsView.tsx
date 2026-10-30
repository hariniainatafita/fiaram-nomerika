import React, { useState } from 'react';
import { Membre, Groupe } from '../types';
import { 
  Users, 
  Crown, 
  Plus, 
  Music, 
  Settings, 
  Edit3, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  ArrowRightLeft, 
  CheckCircle2, 
  Search, 
  X
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { StorageService } from '../utils/storage';
import { canManageAllGroups, canManageChefs, canManageGroup, getManagedGroupIds } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface GroupsViewProps {
  currentUser: Membre;
  allGroupes: Groupe[];
  allMembres: Membre[];
  onRefreshGroupes: () => void;
  onRefreshMembres?: () => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  currentUser,
  allGroupes,
  allMembres,
  onRefreshGroupes,
  onRefreshMembres
}) => {
  const { t } = useLanguage();
  const canManageAll = canManageAllGroups(currentUser);
  const canAssignChef = canManageChefs(currentUser);
  const managedGroupIds = getManagedGroupIds(currentUser, allGroupes);
  const visibleGroupes = canManageAll
    ? allGroupes
    : allGroupes.filter((g) => managedGroupIds.includes(g.id) || g.id === currentUser.groupe_id);
  const movableGroupes = canManageAll
    ? allGroupes
    : allGroupes.filter((g) => managedGroupIds.includes(g.id));

  // Selected group to view & manage (chef starts on his own group)
  const [selectedGroupe, setSelectedGroupe] = useState<Groupe>(
    visibleGroupes.find((g) => managedGroupIds.includes(g.id)) || visibleGroupes[0] || null
  );
  const canManageSelected = canManageGroup(currentUser, selectedGroupe);
  const canEditSelected = canManageSelected || canAssignChef;

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMoveMemberModal, setShowMoveMemberModal] = useState<Membre | null>(null);
  const [targetMoveGroupId, setTargetMoveGroupId] = useState<string>('');

  // Create Group Form
  const [newNom, setNewNom] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newChefId, setNewChefId] = useState(allMembres[0]?.id || '');

  // Edit Group Form
  const [editNom, setEditNom] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editChefId, setEditChefId] = useState('');

  // Search filter inside group
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Feedback notifications
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // Refresh all state
  const handleDataRefresh = (updatedSelectedGroup?: Groupe) => {
    onRefreshGroupes();
    if (onRefreshMembres) onRefreshMembres();
    if (updatedSelectedGroup) {
      setSelectedGroupe(updatedSelectedGroup);
    } else {
      const refreshedList = StorageService.getGroupes();
      const stillThere = refreshedList.find((g) => g.id === selectedGroupe?.id);
      setSelectedGroupe(stillThere || refreshedList[0] || null);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (grp: Groupe) => {
    setEditNom(grp.nom_groupe);
    setEditDesc(grp.description || '');
    setEditChefId(grp.chef_id);
    setShowEditGroupModal(true);
  };

  // Submit Create Group
  const handleCreateGroupe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAll) {
      alert(t('groups.noPermissionCreate'));
      return;
    }
    if (!newNom.trim()) return;

    const newG = StorageService.addGroupe(newNom.trim(), newDesc.trim(), newChefId);
    handleDataRefresh(newG);
    setShowAddModal(false);
    setNewNom('');
    setNewDesc('');
    showNotification(t('groups.createSuccess', { name: newG.nom_groupe }));
  };

  // Submit Edit Group
  const handleSaveEditGroupe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupe || !editNom.trim()) return;
    if (!canManageSelected && !canAssignChef) {
      alert(t('groups.noPermissionEdit'));
      return;
    }

    const updated: Groupe = {
      ...selectedGroupe,
      nom_groupe: canManageSelected ? editNom.trim() : selectedGroupe.nom_groupe,
      description: canManageSelected ? editDesc.trim() : selectedGroupe.description,
      chef_id: canAssignChef ? editChefId : selectedGroupe.chef_id
    };

    StorageService.updateGroupe(updated);
    handleDataRefresh(updated);
    setShowEditGroupModal(false);
    showNotification(t('groups.editSuccess', { name: updated.nom_groupe }));
  };

  // Delete Group
  const handleDeleteGroupe = () => {
    if (!selectedGroupe) return;
    if (!canManageAll) {
      alert(t('groups.noPermissionDelete'));
      return;
    }
    if (allGroupes.length <= 1) {
      alert(t('groups.cannotDeleteLast'));
      return;
    }
    if (window.confirm(t('groups.deleteConfirm', { name: selectedGroupe.nom_groupe }))) {
      StorageService.deleteGroupe(selectedGroupe.id);
      setShowEditGroupModal(false);
      handleDataRefresh();
      showNotification(t('groups.deleteSuccess'));
    }
  };

  // Add Member to Group
  const handleAddMemberToGroup = (membreId: string) => {
    if (!selectedGroupe) return;
    if (!canManageGroup(currentUser, selectedGroupe)) {
      alert(t('groups.noPermissionAddMember'));
      return;
    }
    StorageService.setMembreGroupe(membreId, selectedGroupe.id);
    handleDataRefresh();
    showNotification(t('groups.addMemberSuccess'));
  };

  // Remove Member from Group
  const handleRemoveMemberFromGroup = (m: Membre) => {
    if (!selectedGroupe) return;
    if (!canManageGroup(currentUser, selectedGroupe)) {
      alert(t('groups.noPermissionRemoveMember'));
      return;
    }
    if (window.confirm(t('groups.removeMemberConfirm', { group: selectedGroupe.nom_groupe, name: `${m.prenom} ${m.nom}` }))) {
      StorageService.setMembreGroupe(m.id, undefined);
      handleDataRefresh();
      showNotification(t('groups.removeMemberSuccess', { name: m.prenom }));
    }
  };

  // Move Member to Another Group
  const handleMoveMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMoveMemberModal || !targetMoveGroupId) return;
    if (!canManageAll) {
      alert(t('groups.noPermissionMoveMember'));
      return;
    }

    StorageService.setMembreGroupe(showMoveMemberModal.id, targetMoveGroupId);
    const targetGroup = allGroupes.find((g) => g.id === targetMoveGroupId);
    setShowMoveMemberModal(null);
    handleDataRefresh();
    showNotification(t('groups.moveMemberSuccess', {
      group: targetGroup?.nom_groupe || t('groups.otherGroup'),
      name: showMoveMemberModal.prenom
    }));
  };

  // Promote Member to Chef of Selected Group
  const handlePromoteToChef = (m: Membre) => {
    if (!selectedGroupe) return;
    if (!canAssignChef) {
      alert(t('groups.noPermissionAssignChef'));
      return;
    }
    if (window.confirm(t('groups.promoteConfirm', { group: selectedGroupe.nom_groupe, name: `${m.prenom} ${m.nom}` }))) {
      const updated: Groupe = {
        ...selectedGroupe,
        chef_id: m.id
      };
      StorageService.updateGroupe(updated);
      handleDataRefresh(updated);
      showNotification(t('groups.promoteSuccess', { name: `${m.prenom} ${m.nom}`, group: selectedGroupe.nom_groupe }));
    }
  };

  // Members of selected group
  const groupMembers = selectedGroupe
    ? allMembres.filter((m) => m.groupe_id === selectedGroupe.id)
    : [];

  const filteredGroupMembers = groupMembers.filter((m) => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nom.toLowerCase().includes(q) ||
      m.prenom.toLowerCase().includes(q) ||
      m.code_unique.toLowerCase().includes(q)
    );
  });

  // Candidate members to add (not currently in this group)
  const candidateMembers = selectedGroupe
    ? allMembres.filter(
        (m) =>
          m.groupe_id !== selectedGroupe.id &&
          m.is_approved !== false &&
          (canManageAll || !m.groupe_id)
      )
    : [];

  const filteredCandidateMembers = candidateMembers.filter((m) => {
    const q = candidateSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nom.toLowerCase().includes(q) ||
      m.prenom.toLowerCase().includes(q) ||
      m.code_unique.toLowerCase().includes(q)
    );
  });

  const selectedChef = allMembres.find((m) => m.id === selectedGroupe?.chef_id);

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1140px', margin: '0 auto' }}>
      
      {/* Toast notification */}
      {actionSuccessMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100,
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.88rem',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-gold">{t('groups.badge')}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('groups.title')}</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('groups.subtitle')}
          </p>
        </div>

        {canManageAll && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} />
            <span>{t('groups.create')}</span>
          </button>
        )}
      </div>

      {/* Groups Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {visibleGroupes.map((grp) => {
          const chef = allMembres.find((m) => m.id === grp.chef_id);
          const isSelected = selectedGroupe?.id === grp.id;
          const memberCount = allMembres.filter((m) => m.groupe_id === grp.id).length;

          return (
            <div
              key={grp.id}
              onClick={() => setSelectedGroupe(grp)}
              className={isSelected ? "glass-card-gold" : "glass-card"}
              style={{
                padding: '22px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b'
                  }}>
                    <Music size={22} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                      <Users size={12} /> {t('common.memberCount', { count: memberCount })}
                    </span>

                    {canManageGroup(currentUser, grp) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupe(grp);
                          handleOpenEditModal(grp);
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '6px', borderRadius: '50%' }}
                        title={t('groups.editGroupTitle')}
                      >
                        <Settings size={16} style={{ color: 'var(--accent-gold)' }} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 style={{ fontSize: '1.2rem', margin: '0 0 6px' }}>{grp.nom_groupe}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
                  {grp.description || t('groups.noDescription')}
                </p>
              </div>

              {/* Chef footer */}
              <div style={{
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={chef?.photo_url || DEFAULT_AVATAR_IMAGE}
                    alt=""
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>{t('groups.chefLabel')} </span>
                    <strong style={{ color: 'var(--text-main)' }}>{chef ? `${chef.prenom} ${chef.nom}` : t('groups.unassigned')}</strong>
                  </div>
                </div>

                {isSelected ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700 }}>{t('groups.selected')}</span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{t('groups.clickToView')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Group Detail & Member Management Section */}
      {selectedGroupe && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
          
          {/* Group Header Info & Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '18px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
                  {selectedGroupe.nom_groupe}
                </h2>
                <span className="badge badge-gold">
                  {t('common.memberCount', { count: groupMembers.length })}
                </span>
              </div>
              
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {selectedGroupe.description || t('groups.noDescriptionDetail')}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>{t('groups.chefDeGroupe')} </span>
                  <strong style={{ color: 'var(--accent-gold)' }}>
                    {selectedChef ? `${selectedChef.prenom} ${selectedChef.nom}` : t('groups.unassigned')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>{t('groups.balance')} </span>
                  <strong style={{ color: '#10b981' }}>{(selectedGroupe.solde || 0).toLocaleString()} {t('common.currency')}</strong>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {canEditSelected && (
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(selectedGroupe)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                >
                  <Edit3 size={15} />
                  <span>{t('groups.editNameChef')}</span>
                </button>
              )}

              {canManageSelected && (
                <button
                  type="button"
                  onClick={() => {
                    setCandidateSearchQuery('');
                    setShowAddMemberModal(true);
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                >
                  <UserPlus size={16} />
                  <span>{t('groups.addMembers')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Members search filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '14px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
              {t('groups.membersListTitle', { count: filteredGroupMembers.length })}
            </h3>

            <div className="groups-search" style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={t('groups.searchMemberPlaceholder')}
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="form-input"
                style={{ padding: '7px 12px 7px 30px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Members Grid */}
          {filteredGroupMembers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
              <div style={{ fontWeight: 600 }}>{t('groups.emptyMembers')}</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                {t('groups.emptyMembersHint')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {filteredGroupMembers.map((m) => {
                const isGroupChef = selectedGroupe.chef_id === m.id;

                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: isGroupChef ? '1px solid var(--border-gold)' : '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                        alt={m.prenom}
                        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.prenom} {m.nom}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '0.74rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                          {m.code_unique}
                        </div>

                        {isGroupChef ? (
                          <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: '4px' }}>
                            <Crown size={11} /> {t('groups.chefBadge')}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {m.profession || t('common.member')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member actions */}
                    {canManageSelected && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '6px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingTop: '8px'
                      }}>
                        {canAssignChef && !isGroupChef && (
                          <button
                            type="button"
                            onClick={() => handlePromoteToChef(m)}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.72rem', padding: '4px 8px', color: '#f59e0b' }}
                            title={t('groups.promoteTitle')}
                          >
                            <Crown size={13} />
                            <span>{t('groups.promoteAction')}</span>
                          </button>
                        )}

                        {canManageAll && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMoveMemberModal(m);
                              setTargetMoveGroupId(movableGroupes.find((g) => g.id !== selectedGroupe.id)?.id || '');
                            }}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.72rem', padding: '4px 8px', color: '#3b82f6' }}
                            title={t('groups.moveTitle')}
                          >
                            <ArrowRightLeft size={13} />
                            <span>{t('groups.moveAction')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromGroup(m)}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '4px 8px', color: '#ef4444' }}
                          title={t('groups.removeTitle')}
                        >
                          <UserMinus size={13} />
                          <span>{t('common.remove')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: EDIT GROUP SETTINGS */}
      {showEditGroupModal && selectedGroupe && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} style={{ color: 'var(--accent-gold)' }} />
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{t('groups.editGroupModalTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditGroupModal(false)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditGroupe} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.nameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="form-input"
                  placeholder={t('groups.namePlaceholder')}
                  disabled={!canManageSelected}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.descriptionLabel')}
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="form-textarea"
                  placeholder={t('groups.descriptionPlaceholder')}
                  disabled={!canManageSelected}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.chefLabelForm')}
                </label>
                <select
                  value={editChefId}
                  onChange={(e) => setEditChefId(e.target.value)}
                  className="form-select"
                  disabled={!canAssignChef}
                >
                  {allMembres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.prenom} {m.nom} ({m.code_unique})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {canAssignChef
                    ? t('groups.chefHintAllowed')
                    : t('groups.chefHintDenied')}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                {canManageAll && allGroupes.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleDeleteGroupe}
                    className="btn btn-danger"
                    style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                  >
                    <Trash2 size={15} />
                    <span>{t('groups.deleteGroup')}</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditGroupModal(false)}
                    className="btn btn-ghost"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {t('groups.saveChanges')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD MEMBERS TO GROUP */}
      {showAddMemberModal && selectedGroupe && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{ maxWidth: '540px', width: '100%', padding: '24px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} style={{ color: 'var(--accent-gold)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{t('groups.addMembers')}</h3>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {t('groups.inGroup')} <strong style={{ color: 'var(--accent-gold)' }}>{selectedGroupe.nom_groupe}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Candidate Search */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={t('groups.searchCandidatePlaceholder')}
                value={candidateSearchQuery}
                onChange={(e) => setCandidateSearchQuery(e.target.value)}
                className="form-input"
                style={{ padding: '8px 12px 8px 30px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Candidate List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {filteredCandidateMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  {t('groups.noCandidates')}
                </div>
              ) : (
                filteredCandidateMembers.map((cand) => {
                  const currentGrp = allGroupes.find((g) => g.id === cand.groupe_id);

                  return (
                    <div
                      key={cand.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <img
                          src={cand.photo_url || DEFAULT_AVATAR_IMAGE}
                          alt={cand.prenom}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cand.prenom} {cand.nom}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {cand.code_unique} • {t('groups.currentGroupLabel')} <strong style={{ color: currentGrp ? '#3b82f6' : '#94a3b8' }}>{currentGrp ? currentGrp.nom_groupe : t('common.none')}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddMemberToGroup(cand.id)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem', padding: '6px 12px', flexShrink: 0 }}
                      >
                        <Plus size={14} />
                        <span>{t('groups.addAction')}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="btn btn-ghost"
              >
                {t('groups.done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MOVE MEMBER TO ANOTHER GROUP */}
      {showMoveMemberModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={18} style={{ color: '#3b82f6' }} />
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{t('groups.moveMemberTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMoveMemberModal(null)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '0.85rem' }}>
              {t('groups.moveMemberIntroPrefix')} <strong style={{ color: 'var(--accent-gold)' }}>{showMoveMemberModal.prenom} {showMoveMemberModal.nom}</strong> {t('groups.moveMemberIntroSuffix')}
            </div>

            <form onSubmit={handleMoveMemberSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.selectNewGroup')}
                </label>
                <select
                  value={targetMoveGroupId}
                  onChange={(e) => setTargetMoveGroupId(e.target.value)}
                  className="form-select"
                >
                  {movableGroupes.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nom_groupe}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('groups.confirmMove')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMoveMemberModal(null)}
                  className="btn btn-ghost"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE GROUP MODAL */}
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
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>{t('groups.createTitle')}</h3>

            <form onSubmit={handleCreateGroupe} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.nameLabelPlain')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('groups.createNamePlaceholder')}
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.descriptionLabel')}
                </label>
                <textarea
                  rows={3}
                  placeholder={t('groups.descriptionPlaceholder')}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('groups.chefLabelForm')}
                </label>
                <select
                  value={newChefId}
                  onChange={(e) => setNewChefId(e.target.value)}
                  className="form-select"
                >
                  {allMembres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.prenom} {m.nom} ({m.code_unique})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t('groups.createSubmit')}
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

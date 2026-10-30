import React, { useMemo, useState } from 'react';
import { Membre, Groupe } from '../types';
import { Search, UsersRound, Phone, BadgeCheck, User, MessageCircle, Mail, X, UserCircle2 } from 'lucide-react';
import { PresenceMap, isMemberOnline } from '../utils/presence';
import { useLanguage } from '../i18n';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';

interface MembersViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  presence: PresenceMap;
  onOpenChat: (membreId: string) => void;
  onOpenOwnProfile: () => void;
}

const ROLE_TRANSLATION_KEYS: Record<Membre['role'], string> = {
  admin: 'common.role.admin',
  super_chef: 'common.role.superChef',
  chef: 'common.role.chef',
  membre: 'common.role.member'
};

export const MembersView: React.FC<MembersViewProps> = ({
  currentUser,
  allMembres,
  allGroupes,
  presence,
  onOpenChat,
  onOpenOwnProfile
}) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedMembreId, setSelectedMembreId] = useState<string | null>(null);

  const directoryMembres = useMemo(
    () => allMembres.filter((m) => m.is_approved !== false && !m.is_blocked),
    [allMembres]
  );

  const members = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return directoryMembres
      .filter((m) => {
        if (selectedGroupId === 'none' && m.groupe_id) return false;
        if (selectedGroupId !== 'all' && selectedGroupId !== 'none' && m.groupe_id !== selectedGroupId) {
          return false;
        }
        if (!query) return true;
        return (
          `${m.prenom} ${m.nom}`.toLowerCase().includes(query) ||
          m.code_unique.toLowerCase().includes(query) ||
          (m.profession || '').toLowerCase().includes(query) ||
          (m.telephone || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) =>
        `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr', { sensitivity: 'base' })
      );
  }, [directoryMembres, searchTerm, selectedGroupId]);

  const groupName = (membre: Membre): string => {
    if (membre.groupe_id) {
      return allGroupes.find((g) => g.id === membre.groupe_id)?.nom_groupe || t('members.noGroup');
    }
    return allGroupes.find((g) => g.chef_id === membre.id)?.nom_groupe || t('members.noGroup');
  };

  const selectedMembre = selectedMembreId
    ? directoryMembres.find((m) => m.id === selectedMembreId) || null
    : null;

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-gold">{t('members.badge')}</span>
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('members.title')}</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('members.subtitle', { count: directoryMembres.length })}
        </p>
      </div>

      <div className="glass-card" style={{ padding: '18px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)'
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            placeholder={t('members.searchPlaceholder')}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedGroupId('all')}
            className={`btn ${selectedGroupId === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.78rem', padding: '7px 12px' }}
          >
            {t('members.allGroups')}
          </button>
          {allGroupes.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupId(g.id)}
              className={`btn ${selectedGroupId === g.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.78rem', padding: '7px 12px' }}
            >
              {g.nom_groupe}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedGroupId('none')}
            className={`btn ${selectedGroupId === 'none' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.78rem', padding: '7px 12px' }}
          >
            {t('members.noGroup')}
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <UsersRound size={36} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <div>{t('members.empty')}</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '14px'
        }}>
          {members.map((membre) => {
            const online = isMemberOnline(presence, membre.id);
            const isCurrentUser = membre.id === currentUser.id;

            return (
              <div
                key={membre.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedMembreId(membre.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedMembreId(membre.id);
                  }
                }}
                className="glass-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  border: '1px solid var(--border-color)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-gold)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {membre.photo_url ? (
                    <img
                      src={membre.photo_url}
                      alt={`${membre.prenom} ${membre.nom}`}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--border-gold)',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)',
                      color: '#ffffff',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>
                      <User size={26} strokeWidth={2.4} />
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.9rem' }}>
                        {membre.prenom} {membre.nom}
                      </strong>
                      {isCurrentUser && (
                        <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                          {t('publications.you')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span className="badge badge-purple" style={{ fontSize: '0.62rem', padding: '2px 7px' }}>
                        {t(ROLE_TRANSLATION_KEYS[membre.role])}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.7rem',
                        color: online ? '#10b981' : 'var(--text-dim)'
                      }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: online ? '#10b981' : 'var(--text-dim)'
                        }} />
                        {online ? t('members.online') : t('members.offline')}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UsersRound size={13} />
                    <span>{groupName(membre)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BadgeCheck size={13} />
                    <span>{membre.code_unique}</span>
                  </div>
                  {membre.telephone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} />
                      <span>{membre.telephone}</span>
                    </div>
                  )}
                </div>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCurrentUser) {
                      onOpenOwnProfile();
                    } else {
                      onOpenChat(membre.id);
                    }
                  }}
                  className={`btn ${isCurrentUser ? 'btn-ghost' : 'btn-primary'}`}
                  style={{
                    fontSize: '0.78rem',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {isCurrentUser ? <UserCircle2 size={15} /> : <MessageCircle size={15} />}
                  <span>{isCurrentUser ? t('members.ownProfile') : t('members.sendMessage')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MEMBER DETAIL MODAL */}
      {selectedMembre && (
        <div
          onClick={() => setSelectedMembreId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', width: '100%', padding: '26px', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{t('members.profileTitle')}</h3>
              <button
                onClick={() => setSelectedMembreId(null)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
                title={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <img
                src={selectedMembre.photo_url || DEFAULT_AVATAR_IMAGE}
                alt={`${selectedMembre.prenom} ${selectedMembre.nom}`}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--border-gold)'
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  {selectedMembre.prenom} {selectedMembre.nom}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span className="badge badge-purple" style={{ fontSize: '0.64rem' }}>
                    {t(ROLE_TRANSLATION_KEYS[selectedMembre.role])}
                  </span>
                  <span className="badge badge-blue" style={{ fontSize: '0.64rem' }}>
                    {selectedMembre.code_unique}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {[
                { label: t('common.group'), value: groupName(selectedMembre) },
                {
                  label: t('common.phone'),
                  value: selectedMembre.telephone || '—',
                  href: selectedMembre.telephone ? `tel:${selectedMembre.telephone}` : undefined
                },
                { label: t('common.email'), value: selectedMembre.email },
                { label: t('admin.fieldJob'), value: selectedMembre.profession || '—' },
                { label: t('members.memberSince'), value: selectedMembre.created_at }
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.84rem'
                  }}
                >
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{item.label}</span>
                  {item.href ? (
                    <a href={item.href} style={{ fontWeight: 600, color: 'var(--accent-gold)', textDecoration: 'none' }}>
                      {item.value}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setSelectedMembreId(null);
                if (selectedMembre.id === currentUser.id) {
                  onOpenOwnProfile();
                } else {
                  onOpenChat(selectedMembre.id);
                }
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {selectedMembre.id === currentUser.id ? <UserCircle2 size={16} /> : <MessageCircle size={16} />}
              <span>
                {selectedMembre.id === currentUser.id ? t('members.ownProfile') : t('members.sendMessage')}
              </span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '12px', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
              <Mail size={13} />
              <span>{t('members.contactHint')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

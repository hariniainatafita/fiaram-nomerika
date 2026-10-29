import React, { useMemo, useState } from 'react';
import { Membre, Groupe } from '../types';
import { Search, UsersRound, Phone, BadgeCheck } from 'lucide-react';
import { PresenceMap, isMemberOnline } from '../utils/presence';
import { useLanguage } from '../i18n';

interface MembersViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  presence: PresenceMap;
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
  presence
}) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('all');

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
                className="glass-card"
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
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
                      {membre.prenom?.charAt(0).toUpperCase() || 'M'}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

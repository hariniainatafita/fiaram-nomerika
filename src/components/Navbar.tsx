import React, { useMemo, useState } from 'react';
import { Chanson, Evenement, Groupe, Membre, Publication, Role } from '../types';
import {
  Sun,
  Moon,
  Wifi,
  Crown,
  ShieldCheck,
  Music,
  User,
  Sparkles,
  Menu,
  LogOut,
  Search,
  X
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import {
  canAccessAdminPanel,
  canAccessView,
  canViewEvenement,
  canViewPublication,
  getVisibleGroupIds
} from '../utils/permissions';
import { LanguageSwitcher, useLanguage } from '../i18n';

interface NavbarProps {
  currentUser: Membre;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleMobileSidebar: () => void;
  activeView: string;
  onSelectView: (view: string) => void;
  allMembres: Membre[];
  allGroupes: Groupe[];
  allEvenements: Evenement[];
  allPublications: Publication[];
  allChansons: Chanson[];
  onLogout: () => void;
}

interface SearchResult {
  id: string;
  view: string;
  label: string;
  sub: string;
}

const ROLE_TRANSLATION_KEYS: Record<Membre['role'], string> = {
  admin: 'common.role.admin',
  super_chef: 'common.role.superChef',
  chef: 'common.role.chef',
  membre: 'common.role.member'
};

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  onToggleMobileSidebar,
  onSelectView,
  allMembres,
  allGroupes,
  allEvenements,
  allPublications,
  allChansons,
  onLogout
}) => {
  const { t } = useLanguage();
  const canAccessPanel = canAccessAdminPanel(currentUser);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const visibleGroupIds = getVisibleGroupIds(currentUser, allGroupes);

  const searchResults = useMemo<SearchResult[]>(() => {
    const term = query.toLowerCase().trim();
    if (term.length < 2) return [];

    const results: SearchResult[] = [];
    const push = (result: SearchResult) => {
      if (canAccessView(currentUser, result.view)) results.push(result);
    };

    allMembres
      .filter((m) =>
        m.is_approved !== false && !m.is_blocked &&
        (`${m.prenom} ${m.nom}`.toLowerCase().includes(term) ||
        m.code_unique.toLowerCase().includes(term) ||
        (m.profession || '').toLowerCase().includes(term))
      )
      .slice(0, 4)
      .forEach((m) => push({
        id: `member-${m.id}`,
        view: 'members',
        label: `${m.prenom} ${m.nom}`,
        sub: t(ROLE_TRANSLATION_KEYS[m.role])
      }));

    if (canAccessView(currentUser, 'groups')) {
      allGroupes
        .filter((g) => g.nom_groupe.toLowerCase().includes(term) && (visibleGroupIds.includes(g.id) || currentUser.role === 'admin' || currentUser.role === 'super_chef'))
        .slice(0, 3)
        .forEach((g) => push({
          id: `group-${g.id}`,
          view: 'groups',
          label: g.nom_groupe,
          sub: t('nav.groups')
        }));
    }

    allEvenements
      .filter((ev) =>
        ev.nom.toLowerCase().includes(term) &&
        canViewEvenement(currentUser, ev, allGroupes)
      )
      .slice(0, 3)
      .forEach((ev) => push({
        id: `event-${ev.id}`,
        view: 'events',
        label: ev.nom,
        sub: t('nav.events')
      }));

    allPublications
      .filter((pub) =>
        pub.contenu.toLowerCase().includes(term) &&
        canViewPublication(currentUser, pub, allGroupes)
      )
      .slice(0, 3)
      .forEach((pub) => push({
        id: `publication-${pub.id}`,
        view: 'publications',
        label: pub.contenu.slice(0, 70) || t('nav.publications'),
        sub: t('nav.publications')
      }));

    allChansons
      .filter((song) =>
        song.titre.toLowerCase().includes(term) ||
        (song.auteur || '').toLowerCase().includes(term)
      )
      .slice(0, 3)
      .forEach((song) => push({
        id: `song-${song.id}`,
        view: 'songs',
        label: song.titre,
        sub: song.auteur || t('nav.resources')
      }));

    return results.slice(0, 10);
  }, [query, currentUser, allMembres, allGroupes, allEvenements, allPublications, allChansons, visibleGroupIds, t]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'admin':
        return <span className="badge badge-red" style={{ fontSize: '0.65rem', padding: '2px 6px' }}><ShieldCheck size={11} /> {t('common.role.admin')}</span>;
      case 'super_chef':
        return <span className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '2px 6px' }}><Crown size={11} /> {t('common.role.superChef')}</span>;
      case 'chef':
        return <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '2px 6px' }}><Music size={11} /> {t('common.role.chef')}</span>;
      default:
        return <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}><User size={11} /> {t('common.role.member')}</span>;
    }
  };

  return (
    <header className="app-navbar" style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    }}>
      {/* Left branding & mobile menu toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onToggleMobileSidebar}
          className="btn btn-ghost nav-menu-btn"
          style={{ padding: '8px', display: 'flex', alignItems: 'center' }}
          title={t('nav.menu')}
        >
          <Menu size={20} />
        </button>

        <div
          onClick={() => onSelectView('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="FIARAM NUMERIQUE"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              objectFit: 'cover',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
            }}
          />
          <div className="nav-brand-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                FIARAM NUMERIQUE
              </span>
              
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('nav.management')}
            </div>
          </div>
        </div>
      </div>

      {/* Center Sceptre indicator if Super Chef */}
      {currentUser.role === 'super_chef' && canAccessPanel && (
        <div
          onClick={() => onSelectView('admin')}
          className="sceptre-card nav-sceptre"
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Crown size={15} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>
            {t('nav.superChefPanel')}
          </span>
          <Sparkles size={13} style={{ color: '#a78bfa' }} />
        </div>
      )}

      {/* Right controls: Role switcher, theme toggle, user card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Offline/Online badge */}
        <div className="nav-online" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '0.75rem',
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }}>
          <Wifi size={13} />
          <span style={{ fontWeight: 600 }}>{t('nav.active')}</span>
        </div>

        <div className="nav-search" style={{ position: 'relative' }}>
          <button
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            className="btn btn-ghost"
            style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%' }}
            title={t('nav.search')}
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>

          {searchOpen && (
            <div
              className="glass-card nav-search-panel"
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                width: 'min(380px, calc(100vw - 32px))',
                padding: '12px',
                zIndex: 60
              }}
            >
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '11px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-dim)'
                  }}
                />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="form-input"
                  placeholder={t('nav.searchPlaceholder')}
                  style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                />
              </div>

              {query.trim().length >= 2 && (
                <div style={{
                  marginTop: '10px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '14px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t('nav.searchEmpty')}
                    </div>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          onSelectView(result.view);
                          closeSearch();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: '8px',
                          border: '1px solid transparent',
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{
                          fontSize: '0.82rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {result.label}
                        </span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--accent-gold)', flexShrink: 0 }}>
                          {result.sub}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <LanguageSwitcher compact />

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="btn btn-ghost"
          style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%' }}
          title={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
        >
          {theme === 'dark' ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} />}
        </button>

        {/* Current Logged-in User Profile Pill (No switcher dropdown for security) */}
        <div
          className="glass-card nav-user-card"
          style={{
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderRadius: 'var(--radius-full)'
          }}
        >
          <img
            src={currentUser.photo_url || DEFAULT_AVATAR_IMAGE}
            alt={currentUser.prenom}
            style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div className="nav-user-meta" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.2 }}>
              {currentUser.prenom}
            </span>
            <div>
              {getRoleBadge(currentUser.role)}
            </div>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="btn btn-ghost"
          style={{ padding: '8px', color: '#ef4444' }}
          title={t('nav.logout')}
        >
          <LogOut size={18} />
        </button>
      </div>

    </header>
  );
};

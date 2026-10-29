import React from 'react';
import { Membre, Role } from '../types';
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
  LogOut
} from 'lucide-react';
import { canAccessAdminPanel } from '../utils/permissions';
import { LanguageSwitcher, useLanguage } from '../i18n';

interface NavbarProps {
  currentUser: Membre;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleMobileSidebar: () => void;
  activeView: string;
  onSelectView: (view: string) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  onToggleMobileSidebar,
  onSelectView,
  onLogout
}) => {
  const { t } = useLanguage();
  const canAccessPanel = canAccessAdminPanel(currentUser);

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
    <header style={{
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
          className="btn btn-ghost"
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
            src="/logo.png"
            alt="FIARAM NUMERIQUE"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              objectFit: 'cover',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
            }}
          />
          <div>
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
          className="sceptre-card"
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
        <div style={{
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
          className="glass-card"
          style={{
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderRadius: 'var(--radius-full)'
          }}
        >
          <img
            src={currentUser.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
            alt={currentUser.prenom}
            style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}>
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

import React, { useState } from 'react';
import { Membre } from '../types';
import { 
  LayoutDashboard, 
  QrCode, 
  Wallet, 
  CircleDollarSign, 
  Music, 
  MessageSquare, 
  Users, 
  CalendarDays, 
  UserCheck, 
  ShieldAlert, 
  RotateCcw,
  Sparkles,
  Camera,
  X,
  Settings,
  UsersRound
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { StorageService } from '../utils/storage';
import { canAccessAdminPanel, canAccessFinance, canAccessGroupData, isAdmin, canValidateAnyPresence } from '../utils/permissions';
import { useLanguage } from '../i18n';
import { SettingsModal } from './SettingsModal';
import QrScannerModal from './QrScannerModal';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  currentUser: Membre;
  allMembres: Membre[];
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  unreadCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  currentUser,
  allMembres,
  isMobileOpen,
  onCloseMobile,
  unreadCount
}) => {
  const { t } = useLanguage();
  const isAdminUser = isAdmin(currentUser);
  const canAccessPanel = canAccessAdminPanel(currentUser);
  const canSeeFinance = canAccessFinance(currentUser);
  const canValidate = canValidateAnyPresence(currentUser);
  const hasGroupAccess = canAccessGroupData(currentUser);

  const [showSettings, setShowSettings] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, hidden: !hasGroupAccess },
    { id: 'publications', label: t('nav.publications'), icon: Camera },
    { id: 'members', label: t('nav.members'), icon: UsersRound },
    { id: 'presence', label: t('nav.presence'), icon: QrCode, hidden: !hasGroupAccess },
    { id: 'cotisations', label: t('nav.cotisations'), icon: Wallet, hidden: !hasGroupAccess },
    { id: 'finance', label: t('nav.finance'), icon: CircleDollarSign, hidden: !canSeeFinance },
    { id: 'songs', label: t('nav.resources'), icon: Music },
    { id: 'chat', label: t('nav.chat'), icon: MessageSquare, badge: unreadCount },
    { id: 'groups', label: t('nav.groups'), icon: Users, hidden: !hasGroupAccess },
    { id: 'events', label: t('nav.events'), icon: CalendarDays, hidden: !hasGroupAccess },
    { id: 'profile', label: t('nav.profile'), icon: UserCheck },
    {
      id: 'admin',
      label: isAdminUser ? t('nav.admin') : t('nav.superChefPanel'),
      icon: ShieldAlert,
      hidden: !canAccessPanel,
      special: true
    }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 45
          }}
        />
      )}

      <aside style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        width: 'min(280px, 84vw)',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        transform: isMobileOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Header inside sidebar */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070d1e',
              fontWeight: 900
            }}>
              :
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                FIARAM
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {t('nav.digitalManagement')}
              </div>
            </div>
          </div>

          <button 
            onClick={onCloseMobile}
            className="btn btn-ghost"
            style={{ padding: '6px', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* User preview banner */}
        <div style={{
          padding: '14px 18px',
          margin: '12px 14px 4px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <img 
            src={currentUser.photo_url || DEFAULT_AVATAR_IMAGE} 
            alt={currentUser.prenom} 
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.prenom} {currentUser.nom}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
              {t('nav.code')}: {currentUser.code_unique}
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.filter((i) => !i.hidden).map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: isActive 
                    ? item.special 
                      ? '1px solid rgba(139, 92, 246, 0.5)' 
                      : '1px solid var(--border-gold)' 
                    : '1px solid transparent',
                  background: isActive 
                    ? item.special 
                      ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(245, 158, 11, 0.1))' 
                      : 'rgba(245, 158, 11, 0.12)' 
                    : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon 
                    size={19} 
                    style={{ 
                      color: isActive 
                        ? item.special ? '#a78bfa' : '#f59e0b' 
                        : 'var(--text-dim)' 
                    }} 
                  />
                  <span style={{ 
                    fontSize: '0.88rem', 
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--text-main)' : 'inherit'
                  }}>
                    {item.label}
                  </span>
                </div>

                {item.special && (
                  <Sparkles size={14} style={{ color: '#a78bfa' }} />
                )}

                {item.badge && item.badge > 0 ? (
                  <span className="badge badge-red" style={{ padding: '2px 7px' }}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Footer with Reset mock data */}
        <div style={{
          padding: '14px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {isAdminUser && (
            <button
              onClick={() => {
                if (window.confirm(t('nav.resetConfirm'))) {
                  StorageService.resetAllData();
                }
              }}
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: '0.78rem', padding: '8px 12px' }}
            >
              <RotateCcw size={14} />
              <span>{t('nav.resetData')}</span>
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            {canValidate && (
              <button
                onClick={() => setShowQrScanner(true)}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.78rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
              >
                <QrCode size={14} />
                <span>{t('nav.scanQr')}</span>
              </button>
            )}
            {isAdminUser && (
              <button
                onClick={() => setShowSettings(true)}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.78rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
              >
                <Settings size={14} />
                <span>{t('nav.settingsAdmin')}</span>
              </button>
            )}
          </div>
          
          <div style={{ fontSize: '0.68rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            FIARAM NUMERIQUE v1.0 · {t('nav.footer')}
          </div>
        </div>
      </aside>

      {showQrScanner && (
        <QrScannerModal
          onClose={() => setShowQrScanner(false)}
          currentUser={currentUser}
          allMembres={allMembres}
        />
      )}

      {showSettings && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
        />
      )}

      <style>{`
        @media (max-width: 1023px) {
          .sidebar-container {
            transform: translateX(-100%);
          }
          .sidebar-container.mobile-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};

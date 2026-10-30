import React from 'react';
import { LayoutDashboard, QrCode, Wallet, Music, MessageSquare, Camera, UsersRound } from 'lucide-react';
import { Membre } from '../types';
import { canAccessGroupData } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface BottomNavProps {
  activeView: string;
  onSelectView: (view: string) => void;
  unreadCount: number;
  currentUser: Membre;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeView,
  onSelectView,
  unreadCount,
  currentUser
}) => {
  const { t } = useLanguage();
  const hasGroupAccess = canAccessGroupData(currentUser);
  const items = [
    ...(hasGroupAccess
      ? [
          { id: 'dashboard', label: t('nav.short.dashboard'), icon: LayoutDashboard },
          { id: 'presence', label: t('nav.short.presence'), icon: QrCode },
          { id: 'cotisations', label: t('nav.short.cotisations'), icon: Wallet }
        ]
      : [{ id: 'songs', label: t('nav.short.resources'), icon: Music }]),
    { id: 'publications', label: t('nav.short.publications'), icon: Camera },
    { id: 'members', label: t('nav.short.members'), icon: UsersRound },
    { id: 'chat', label: t('nav.short.chat'), icon: MessageSquare, badge: unreadCount }
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 40,
      padding: '0 8px env(safe-area-inset-bottom, 0px)'
    }}
    className="bottom-nav-bar"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              color: isActive ? 'var(--accent-gold)' : 'var(--text-dim)',
              cursor: 'pointer',
              flex: 1,
              height: '100%',
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} />
              {item.badge && item.badge > 0 ? (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-8px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  lineHeight: '16px',
                  textAlign: 'center',
                  boxShadow: '0 0 0 2px var(--bg-secondary, #111827)'
                }}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </div>
            <span style={{
              fontSize: 'clamp(0.58rem, 2.6vw, 0.68rem)',
              fontWeight: isActive ? 700 : 500,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {item.label}
            </span>
          </button>
        );
      })}

      <style>{`
        @media (min-width: 1024px) {
          .bottom-nav-bar {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
};

import React from 'react';
import { Membre, Groupe, Presence, Cotisation, Evenement } from '../types';
import { 
  Sparkles, 
  Crown, 
  QrCode, 
  Wallet, 
  Music, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowUpRight,
  ShieldAlert,
  Users,
  Camera
} from 'lucide-react';
import { useLanguage } from '../i18n';

interface DashboardViewProps {
  currentUser: Membre;
  allPresences: Presence[];
  allCotisations: Cotisation[];
  allGroupes: Groupe[];
  allEvenements: Evenement[];
  onSelectView: (view: string) => void;
  unreadCount: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  allPresences,
  allCotisations,
  allGroupes,
  allEvenements,
  onSelectView,
  unreadCount
}) => {
  const { t } = useLanguage();

  // Member's presences
  const userPresences = allPresences.filter((p) => p.membre_id === currentUser.id);
  const presentCount = userPresences.filter((p) => p.statut === 'present').length;
  const retardCount = userPresences.filter((p) => p.statut === 'retard').length;
  const absentCount = userPresences.filter((p) => p.statut === 'absent').length;
  const totalPointages = userPresences.length;
  const attendanceRate = totalPointages > 0 
    ? Math.round(((presentCount + retardCount * 0.5) / totalPointages) * 100) 
    : 100;

  // Member's cotisations
  const userCotisations = allCotisations.filter((c) => c.membre_id === currentUser.id);
  const totalCotisationsPaid = userCotisations.reduce((sum, c) => sum + c.montant, 0);

  // Group of user
  const userGroup = allGroupes.find((g) => g.chef_id === currentUser.id) || allGroupes[0];

  const now = new Date();
  const formattedDate = t('dashboard.dateFormat', {
    weekday: t(`common.day.${now.getDay()}`),
    day: now.getDate(),
    month: t(`common.month.${now.getMonth() + 1}`),
    year: now.getFullYear()
  });

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Super Chef Sceptre Mode Alert if Super Chef */}
      {currentUser.role === 'super_chef' && (
        <div 
          className="sceptre-card"
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)'
            }}>
              <Crown size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.25rem', color: '#f59e0b', margin: 0 }}>
                   {t('dashboard.superChef.title')}
                </h3>
                <span className="badge badge-purple">{t('common.status.active')}</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('dashboard.superChef.description')}
              </p>
            </div>
          </div>

          <button 
            onClick={() => onSelectView('admin')}
            className="btn btn-purple"
            style={{ fontWeight: 700 }}
          >
            <ShieldAlert size={18} />
            <span>{t('dashboard.superChef.openAdmin')}</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div 
        className="glass-card-gold"
        style={{
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={18} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('dashboard.hero.eyebrow')}
            </span>
          </div>
          <h1 style={{ fontSize: '1.8rem', margin: '0 0 6px', lineHeight: 1.2 }}>
            {t('dashboard.hero.greeting', { name: currentUser.prenom })}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            {t('dashboard.hero.welcomeIntro')}{' '}
            <strong style={{ color: 'var(--text-main)' }}>FIARAM NUMERIQUE</strong>.{' '}
            {t('dashboard.hero.welcomeToday', { date: formattedDate })}
          </p>
        </div>

        {/* Member ID and Solde Widget */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <div className="glass-card" style={{ padding: '12px 18px', textAlign: 'center', minWidth: '130px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('dashboard.hero.memberCode')}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '2px' }}>
              {currentUser.code_unique}
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '12px 18px', textAlign: 'center', minWidth: '140px', borderColor: 'var(--border-gold)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('dashboard.hero.balance')}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
              {(currentUser.solde || 0).toLocaleString()} <span style={{ fontSize: '0.85rem' }}>{t('common.currency')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Attendance Rate */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('dashboard.kpi.attendanceRate')}</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: attendanceRate >= 80 ? '#10b981' : '#f59e0b', margin: '4px 0' }}>
                {attendanceRate}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('dashboard.kpi.attendanceBasis', { count: totalPointages })}
              </div>
            </div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <CheckCircle2 size={24} />
            </div>
          </div>

          {/* Breakdown mini-bar */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckCircle2 size={12} /> {t('dashboard.kpi.presentCount', { count: presentCount })}
            </span>
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={12} /> {t('dashboard.kpi.lateCount', { count: retardCount })}
            </span>
            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <XCircle size={12} /> {t('dashboard.kpi.absentCount', { count: absentCount })}
            </span>
          </div>
        </div>

        {/* Cotisations Stats */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('dashboard.kpi.cotisationsPaid')}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6', margin: '4px 0' }}>
                {totalCotisationsPaid.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>{t('common.currency')}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('dashboard.kpi.monthsRecorded', { count: userCotisations.length })}
              </div>
            </div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Wallet size={24} />
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => onSelectView('cotisations')}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{t('dashboard.kpi.newCotisation')}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* User Group Card */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('dashboard.kpi.yourGroup')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0' }}>
                {userGroup.nom_groupe}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                {t('dashboard.kpi.groupBalance', { amount: (userGroup.solde || 0).toLocaleString() })}
              </div>
            </div>
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
              <Users size={24} />
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => onSelectView('groups')}
              style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{t('dashboard.kpi.viewAllGroups')}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Messages Unread Card */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>{t('dashboard.kpi.messages')}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8b5cf6', margin: '4px 0' }}>
                {unreadCount > 0 ? t('dashboard.kpi.unreadCount', { count: unreadCount }) : t('dashboard.kpi.allRead')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('dashboard.kpi.messagesSubtitle')}
              </div>
            </div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b5cf6'
            }}>
              <MessageSquare size={24} />
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => onSelectView('chat')}
              style={{ background: 'none', border: 'none', color: '#8b5cf6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{t('dashboard.kpi.openMessages')}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent-gold)' }} />
          <span>{t('dashboard.shortcuts.title')}</span>
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          <button
            onClick={() => onSelectView('publications')}
            className="btn glass-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(236, 72, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ec4899'
            }}>
              <Camera size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('dashboard.shortcuts.publicationsTitle')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('dashboard.shortcuts.publicationsSubtitle')}</div>
            </div>
          </button>

          <button
            onClick={() => onSelectView('presence')}
            className="btn glass-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <QrCode size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('dashboard.shortcuts.checkinTitle')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('dashboard.shortcuts.checkinSubtitle')}</div>
            </div>
          </button>

          <button
            onClick={() => onSelectView('profile')}
            className="btn glass-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <QrCode size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('dashboard.shortcuts.myQrTitle')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('dashboard.shortcuts.myQrSubtitle')}</div>
            </div>
          </button>

          <button
            onClick={() => onSelectView('songs')}
            className="btn glass-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}>
              <Music size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('dashboard.shortcuts.resourcesTitle')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('dashboard.shortcuts.resourcesSubtitle')}</div>
            </div>
          </button>

          <button
            onClick={() => onSelectView('cotisations')}
            className="btn glass-card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b5cf6'
            }}>
              <Wallet size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('dashboard.shortcuts.cotisationsTitle')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('dashboard.shortcuts.cotisationsSubtitle')}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Events & Projects Progress Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.15rem', margin: 0 }}>{t('dashboard.events.title')}</h3>
          <button 
            onClick={() => onSelectView('events')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('dashboard.events.viewAll')} →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {allEvenements.map((ev) => {
            const percent = Math.min(100, Math.round((ev.collecte_actuelle / ev.objectif_financier) * 100));

            return (
              <div key={ev.id} className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    {ev.is_pinned && <span className="badge badge-gold" style={{ marginBottom: '6px' }}>{t('dashboard.events.pinned')}</span>}
                    <h4 style={{ fontSize: '1rem', margin: '2px 0 4px', lineHeight: 1.3 }}>
                      {ev.nom}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {ev.notes}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>
                      {t('dashboard.events.collected', { amount: ev.collecte_actuelle.toLocaleString() })}
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {t('dashboard.events.goal', { amount: ev.objectif_financier.toLocaleString(), percent })}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${percent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #10b981, #f59e0b)',
                      borderRadius: '4px',
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

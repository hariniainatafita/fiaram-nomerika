import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { StorageService } from './utils/storage';
import { subscribeToSupabase } from './utils/supabaseSync';
import { usePresence } from './utils/presence';
import { canAccessGroupData, canAccessView } from './utils/permissions';
import { Membre, Groupe, Presence, FinanceGroupe, Cotisation, Chanson, Message, Evenement, Publication } from './types';
import {useLanguage} from './i18n';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';

// Views
import { DashboardView } from './views/DashboardView';
import { PresenceView } from './views/PresenceView';
import { CotisationView } from './views/CotisationView';
import { FinanceView } from './views/FinanceView';
import { SongsView } from './views/SongsView';
import { ChatView } from './views/ChatView';
import { GroupsView } from './views/GroupsView';
import { EventsView } from './views/EventsView';
import { PublicationsView } from './views/PublicationsView';
import { MembersView } from './views/MembersView';
import { ProfileView } from './views/ProfileView';
import { AdminView } from './views/AdminView';
import { LoginView } from './views/LoginView';

export function App() {
  const { t } = useLanguage();

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Active view state
  const [activeView, setActiveView] = useState<string>('dashboard');

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Deep link into a direct chat conversation (from the members directory)
  const [chatFocus, setChatFocus] = useState<{ peerId: string; nonce: number } | null>(null);

  // Confirmation before logging out
  const [confirmLogout, setConfirmLogout] = useState(false);

  // App Data States
  const [currentUser, setCurrentUser] = useState<Membre | null>(() => StorageService.getCurrentUser());
  const [allMembres, setAllMembres] = useState<Membre[]>(() => StorageService.getMembres());
  const [allGroupes, setAllGroupes] = useState<Groupe[]>(() => StorageService.getGroupes());
  const [allPresences, setAllPresences] = useState<Presence[]>(() => StorageService.getPresences());
  const [allFinances, setAllFinances] = useState<FinanceGroupe[]>(() => StorageService.getFinances());
  const [allCotisations, setAllCotisations] = useState<Cotisation[]>(() => StorageService.getCotisations());
  const [allChansons, setAllChansons] = useState<Chanson[]>(() => StorageService.getChansons());
  const [allMessages, setAllMessages] = useState<Message[]>(() => StorageService.getMessages());
  const [allEvenements, setAllEvenements] = useState<Evenement[]>(() => StorageService.getEvenements());
  const [allPublications, setAllPublications] = useState<Publication[]>(() => StorageService.getPublications());

  // Live presence: only members with a recent heartbeat are shown online
  const presenceMap = usePresence(currentUser?.id);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = StorageService.getTheme();
    setTheme(savedTheme);
    StorageService.setTheme(savedTheme);
  }, []);

  // Never keep a view that the current role is not allowed to open
  useEffect(() => {
    if (currentUser && !canAccessView(currentUser, activeView)) {
      setActiveView(canAccessGroupData(currentUser) ? 'dashboard' : 'publications');
    }
  }, [currentUser, activeView]);

  // Always show the beginning of a view when navigating from the navbar or menus
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeView]);

  // Toggle Theme
  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    StorageService.setTheme(next);
  };

  // Refresh functions
  const openChatWithMember = (membreId: string) => {
    setChatFocus({ peerId: membreId, nonce: Date.now() });
    setActiveView('chat');
  };

  const openOwnProfile = () => {
    setActiveView('profile');
  };

  const refreshMembres = () => {
    const m = StorageService.getMembres();
    setAllMembres(m);
    if (currentUser) {
      const updatedCurrent = m.find((user) => user.id === currentUser.id);
      if (updatedCurrent) setCurrentUser(updatedCurrent);
    }
  };

  const refreshPresences = () => {
    setAllPresences(StorageService.getPresences());
  };

  const refreshFinances = () => {
    setAllFinances(StorageService.getFinances());
    setAllGroupes(StorageService.getGroupes());
  };

  const refreshCotisations = () => {
    setAllCotisations(StorageService.getCotisations());
    refreshMembres();
  };

  const refreshChansons = () => {
    setAllChansons(StorageService.getChansons());
  };

  const refreshMessages = () => {
    setAllMessages(StorageService.getMessages());
  };

  const refreshEvenements = () => {
    setAllEvenements(StorageService.getEvenements());
  };

  const refreshPublications = () => {
    setAllPublications(StorageService.getPublications());
  };

  // Live sync: when another device updates shared data, refresh every store.
  useEffect(() => {
    const unsubscribe = subscribeToSupabase(() => {
      setAllMembres(StorageService.getMembres());
      setAllGroupes(StorageService.getGroupes());
      setAllPresences(StorageService.getPresences());
      setAllFinances(StorageService.getFinances());
      setAllCotisations(StorageService.getCotisations());
      setAllChansons(StorageService.getChansons());
      setAllMessages(StorageService.getMessages());
      setAllEvenements(StorageService.getEvenements());
      setAllPublications(StorageService.getPublications());
      setCurrentUser((prev) => {
        if (!prev) return prev;
        return StorageService.getMembres().find((m) => m.id === prev.id) ?? null;
      });
    });
    return unsubscribe;
  }, [currentUser?.id]);

  // If user is not logged in, render Login / Registration View
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          StorageService.setCurrentUser(user.id);
          setCurrentUser(user);
          refreshMembres();
        }}
      />
    );
  }

  const unreadCount = allMessages.filter(
    (m) => m.receiver_id === currentUser.id && m.status === 'sent'
  ).length;

  // Final guard: even if a forbidden view is in state, render a safe view instead
  const defaultView = canAccessGroupData(currentUser) ? 'dashboard' : 'publications';
  const allowedView = canAccessView(currentUser, activeView) ? activeView : defaultView;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={allowedView}
        onSelectView={setActiveView}
        currentUser={currentUser}
        allMembres={allMembres}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        unreadCount={unreadCount}
      />

      {/* Main Content Area */}
      <div className="main-content" style={{ minHeight: '100dvh' }}>
        {/* Top Navbar */}
        <Navbar
          currentUser={currentUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          activeView={allowedView}
          onSelectView={setActiveView}
          allMembres={allMembres}
          allGroupes={allGroupes}
          allEvenements={allEvenements}
          allPublications={allPublications}
          allChansons={allChansons}
          onLogout={() => {
            setConfirmLogout(true);
          }}
        />

        {/* Dynamic Views */}
        <main style={{ flex: 1 }}>
          {allowedView === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              allPresences={allPresences}
              allCotisations={allCotisations}
              allGroupes={allGroupes}
              allEvenements={allEvenements}
              onSelectView={setActiveView}
              unreadCount={unreadCount}
            />
          )}

          {allowedView === 'publications' && (
            <PublicationsView
              currentUser={currentUser}
              allMembres={allMembres}
              allGroupes={allGroupes}
              publications={allPublications}
              onRefreshPublications={refreshPublications}
            />
          )}

          {allowedView === 'members' && (
            <MembersView
              currentUser={currentUser}
              allMembres={allMembres}
              allGroupes={allGroupes}
              presence={presenceMap}
              onOpenChat={openChatWithMember}
              onOpenOwnProfile={openOwnProfile}
            />
          )}

          {allowedView === 'presence' && (
            <PresenceView
              currentUser={currentUser}
              allMembres={allMembres}
              presences={allPresences}
              onRefreshPresences={refreshPresences}
            />
          )}

          {allowedView === 'cotisations' && (
            <CotisationView
              currentUser={currentUser}
              allMembres={allMembres}
              cotisations={allCotisations}
              onRefreshCotisations={refreshCotisations}
            />
          )}

          {allowedView === 'finance' && (
            <FinanceView
              currentUser={currentUser}
              allGroupes={allGroupes}
              allMembres={allMembres}
              finances={allFinances}
              onRefreshFinances={refreshFinances}
            />
          )}

          {allowedView === 'songs' && (
            <SongsView
              currentUser={currentUser}
              chansons={allChansons}
              onRefreshChansons={refreshChansons}
            />
          )}

          {allowedView === 'chat' && (
            <ChatView
              currentUser={currentUser}
              allMembres={allMembres}
              allGroupes={allGroupes}
              messages={allMessages}
              presence={presenceMap}
              onRefreshMessages={refreshMessages}
              openPeerId={chatFocus?.peerId}
              focusKey={chatFocus?.nonce}
            />
          )}

          {allowedView === 'groups' && (
            <GroupsView
              currentUser={currentUser}
              allGroupes={allGroupes}
              allMembres={allMembres}
              onRefreshGroupes={() => {
                setAllGroupes(StorageService.getGroupes());
                refreshMembres();
              }}
              onRefreshMembres={refreshMembres}
            />
          )}

          {allowedView === 'events' && (
            <EventsView
              currentUser={currentUser}
              allGroupes={allGroupes}
              evenements={allEvenements}
              onRefreshEvents={refreshEvenements}
            />
          )}

          {allowedView === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              allGroupes={allGroupes}
              onRefreshUser={refreshMembres}
            />
          )}

          {allowedView === 'admin' && (
            <AdminView
              currentUser={currentUser}
              allMembres={allMembres}
              allGroupes={allGroupes}
              onRefreshMembres={refreshMembres}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          activeView={allowedView}
          onSelectView={setActiveView}
          unreadCount={unreadCount}
          currentUser={currentUser}
        />
      </div>

      {/* LOGOUT CONFIRMATION WARNING */}
      {confirmLogout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '28px', textAlign: 'center' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              color: '#f59e0b'
            }}>
              <AlertTriangle size={26} />
            </div>
            <h3 style={{ fontSize: '1.08rem', marginBottom: '8px' }}>{t('common.logoutWarningTitle')}</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.6 }}>
              {t('common.logoutWarningMessage')}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  StorageService.logout();
                  setConfirmLogout(false);
                  setCurrentUser(null);
                }}
                className="btn btn-danger"
                style={{ flex: 1 }}
              >
                {t('common.logoutConfirm')}
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

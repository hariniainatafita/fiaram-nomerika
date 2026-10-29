import React, { useState, useEffect } from 'react';
import { StorageService } from './utils/storage';
import { subscribeToSupabase } from './utils/supabaseSync';
import { usePresence } from './utils/presence';
import { canAccessView } from './utils/permissions';
import { Membre, Groupe, Presence, FinanceGroupe, Cotisation, Chanson, Message, Evenement, Publication } from './types';
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
import { ProfileView } from './views/ProfileView';
import { AdminView } from './views/AdminView';
import { LoginView } from './views/LoginView';

export function App() {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Active view state
  const [activeView, setActiveView] = useState<string>('dashboard');

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

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
      setActiveView('dashboard');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // If user is not logged in, render Login / Registration View
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          refreshMembres();
        }}
        allGroupes={allGroupes}
      />
    );
  }

  const unreadCount = allMessages.filter(
    (m) => m.receiver_id === currentUser.id && m.status === 'sent'
  ).length;

  // Final guard: even if a forbidden view is in state, render a safe view instead
  const allowedView = canAccessView(currentUser, activeView) ? activeView : 'dashboard';

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
          onLogout={() => {
            StorageService.logout();
            setCurrentUser(null);
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
              publications={allPublications}
              onRefreshPublications={refreshPublications}
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
        />
      </div>
    </div>
  );
}

export default App;

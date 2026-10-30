import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { StorageService } from './utils/storage';
import { subscribeToSupabase, hydrateFromSupabase } from './utils/supabaseSync';
import { usePresence } from './utils/presence';
import { canAccessGroupData, canAccessView } from './utils/permissions';
import { Membre, Groupe, Presence, FinanceGroupe, Cotisation, Chanson, Message, Evenement, Publication } from './types';
import {useLanguage} from './i18n';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { MessageToastList, MessageToastData } from './components/MessageToast';
import { playMessageNotification } from './utils/notificationSound';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  NotificationPermissionState
} from './utils/notificationPermission';
import { updateFaviconBadge } from './utils/faviconBadge';

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

  // Clic sur une bulle : va directement dans la conversation concernée.
  const openToastChat = (toast: MessageToastData) => {
    setMessageToasts((prev) => prev.filter((t) => t.id !== toast.id));
    if (toast.peerId) {
      openChatWithMember(toast.peerId);
      return;
    }
    // Message de groupe : la vue chat s'ouvre, l'utilisateur choisit le groupe.
    setActiveView('chat');
  };

  const closeToast = (toastId: string) => {
    setMessageToasts((prev) => prev.filter((t) => t.id !== toastId));
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
      else {
        // The current account does not exist anymore (deleted or dossier
        // rejected by the admin): end the session right away.
        StorageService.logout();
        setCurrentUser(null);
      }
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
    const refreshAll = () => {
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
    };
    const unsubscribe = subscribeToSupabase(refreshAll);

    // Smartphones: realtime socket drops while the app sleeps in background
    // and missed (non-queued) events never replay. On resume / focus / network
    // up, re-hydrate from Supabase so new messages and unread badges appear.
    const onResume = () => {
      if (document.visibilityState !== 'visible') return;
      void hydrateFromSupabase().then(refreshAll);
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
    };
  }, [currentUser?.id]);

  // Unread counter for nav badges: unread private messages + group messages
  // that arrived after the user's per-group read cursor.
  // Messages from accounts that no longer exist (deleted members) are not
  // counted, otherwise a badge keeps pointing to a conversation that cannot
  // be opened anywhere.
  const unreadCount = React.useMemo(() => {
    const knownMemberIds = new Set(allMembres.map((m) => m.id));
    const direct = allMessages.filter(
      (m) =>
        m.receiver_id === currentUser?.id &&
        m.sender_id &&
        knownMemberIds.has(m.sender_id) &&
        m.status === 'sent' &&
        !m.is_deleted
    ).length;
    const reads = currentUser ? StorageService.getGroupReads() : {};
    const groups = currentUser
      ? allMessages.filter((m) => {
          if (!m.group_id || m.is_deleted || m.sender_id === currentUser.id) return false;
          const cursor = reads[`${currentUser.id}:${m.group_id}`] || '';
          return !cursor || m.sent_at > cursor;
        }).length
      : 0;
    return direct + groups;
  }, [allMessages, allMembres, currentUser]);

  // ==================== CENTRE DE NOTIFICATIONS (style Facebook) ====================
  // Différencie les rendus consécutifs de CHAQUE collection : tout ce qui est
  // nouveau et ne vient pas de moi déclenche (1) une bulle en bas à droite,
  // (2) un son, (3) une notification système par-dessus les autres sites/
  // onglets, (4) le compteur qui clignote dans le titre de l'onglet + favicon.
  // Sources surveillées : messages privés, messages de groupe, publications,
  // événements, et nouvelles demandes d'adhésion pour le compte admin.
  const seenMessageIdsRef = React.useRef<Set<string> | null>(null);
  const seenPublicationIdsRef = React.useRef<Set<string> | null>(null);
  const seenEventIdsRef = React.useRef<Set<string> | null>(null);
  const pendingMembersRef = React.useRef<number>(-1);
  const unviewedByKindRef = React.useRef<Record<MessageToastData['kind'], number>>({
    message: 0, group: 0, publication: 0, event: 0, member: 0
  });
  const [messageToasts, setMessageToasts] = useState<MessageToastData[]>([]);
  const [unviewedNotifications, setUnviewedNotifications] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(
    () => getBrowserNotificationPermission()
  );
  const [permissionBannerDismissed, setPermissionBannerDismissed] = useState<boolean>(
    () => window.localStorage.getItem('fn_notif_banner') === 'done'
  );

  const pushMessageToasts = useCallback((items: MessageToastData[]) => {
    setMessageToasts((prev) => [...prev.filter((existing) => !items.some((item) => item.id === existing.id)), ...items]);
    items.forEach((toast) => {
      window.setTimeout(() => {
        setMessageToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 6000);
    });
  }, []);

  const countUnviewed = useCallback(() => {
    const kinds = unviewedByKindRef.current;
    setUnviewedNotifications(kinds.message + kinds.group + kinds.publication + kinds.event + kinds.member);
  }, []);

  const bumpUnviewed = useCallback((kind: MessageToastData['kind'], amount = 1) => {
    unviewedByKindRef.current[kind] += amount;
    countUnviewed();
  }, [countUnviewed]);

  useEffect(() => {
    if (!currentUser) {
      seenMessageIdsRef.current = null;
      seenPublicationIdsRef.current = null;
      seenEventIdsRef.current = null;
      pendingMembersRef.current = -1;
      unviewedByKindRef.current = { message: 0, group: 0, publication: 0, event: 0, member: 0 };
      setUnviewedNotifications(0);
      return;
    }

    const items: MessageToastData[] = [];

    // ---- Messages privés et de groupe ----
    const seenMsg = seenMessageIdsRef.current ?? new Set<string>(StorageService.getMessages().map((m) => m.id));
    seenMessageIdsRef.current = seenMsg;
    const freshMsg = allMessages.filter(
      (m) =>
        !m.is_deleted &&
        !!m.sent_at &&
        !seenMsg.has(m.id) &&
        m.sender_id !== currentUser.id &&
        m.status !== 'read' &&
        (m.receiver_id === currentUser.id || !!m.group_id)
    );
    allMessages.forEach((m) => seenMsg.add(m.id));
    freshMsg.forEach((msg) => {
      const sender = allMembres.find((m) => m.id === msg.sender_id);
      if (!sender) return; // expéditeur supprimé : rien à montrer
      const group = msg.group_id ? allGroupes.find((g) => g.id === msg.group_id) : undefined;
      const kind: MessageToastData['kind'] = group ? 'group' : 'message';
      const preview = msg.image_url || msg.image_ref || msg.file_type === 'image'
        ? `📷 ${msg.message ?? ''}`.trim()
        : msg.file_url || msg.file_type === 'audio'
          ? `🎤 ${msg.file_name ?? msg.message ?? ''}`.trim()
          : msg.file_type === 'document'
            ? `📄 ${msg.file_name ?? msg.message ?? ''}`.trim()
            : (msg.message ?? '');
      items.push({
        id: msg.id,
        kind,
        senderName: `${sender.prenom} ${sender.nom}`.trim(),
        senderPhoto: sender.photo_url,
        text: preview,
        groupName: group?.nom_groupe,
        peerId: msg.group_id ? undefined : msg.sender_id
      });
    });

    // ---- Publications ----
    const seenPub = seenPublicationIdsRef.current ?? new Set<string>(StorageService.getPublications().map((p) => p.id));
    seenPublicationIdsRef.current = seenPub;
    const canSeeEveryPublication = currentUser.role === 'admin' || currentUser.role === 'super_chef';
    const freshPub = allPublications.filter(
      (p) => !seenPub.has(p.id) && p.auteur_id !== currentUser.id &&
        (canSeeEveryPublication || !p.groupe_id || p.audience === 'all' || p.groupe_id === currentUser.groupe_id)
    );
    allPublications.forEach((p) => seenPub.add(p.id));
    freshPub.forEach((pub) => {
      const author = allMembres.find((m) => m.id === pub.auteur_id);
      if (!author) return;
      items.push({
        id: `pub:${pub.id}`,
        kind: 'publication',
        label: 'Nouvelle publication',
        senderName: `${author.prenom} ${author.nom}`.trim(),
        senderPhoto: author.photo_url,
        text: (pub.contenu ?? '').slice(0, 90)
      });
    });

    // ---- Événements ----
    const seenEv = seenEventIdsRef.current ?? new Set<string>(StorageService.getEvenements().map((e) => e.id));
    seenEventIdsRef.current = seenEv;
    const freshEv = allEvenements.filter((e) => !seenEv.has(e.id));
    allEvenements.forEach((e) => seenEv.add(e.id));
    freshEv.forEach((event) => {
      items.push({
        id: `ev:${event.id}`,
        kind: 'event',
        label: 'Nouvel événement',
        senderName: event.nom,
        text: event.date_evenement ? event.date_evenement : ''
      });
    });

    // ---- Nouvelles adhésions en attente (admins uniquement) ----
    if (currentUser.role === 'admin') {
      const pendingCount = allMembres.filter((m) => m.is_approved === false).length;
      const previous = pendingMembersRef.current;
      pendingMembersRef.current = pendingCount;
      if (previous >= 0 && pendingCount > previous) {
        items.push({
          id: `member:${Date.now()}`,
          kind: 'member',
          label: 'Nouveau membre',
          senderName: `${pendingCount - previous} demande${pendingCount - previous > 1 ? 's' : ''} de compte`,
          senderPhoto: undefined,
          text: 'En attente de validation de dossier'
        });
      }
    }

    if (!items.length) return;
    pushMessageToasts(items);
    items.forEach((item) => {
      bumpUnviewed(item.kind);
      showBrowserNotification(
        item.groupName ? `${item.groupName} — ${item.senderName}` : (item.label ?? item.senderName),
        { body: item.text || '…', tag: item.id, icon: item.senderPhoto }
      );
    });
    if (StorageService.getAdminSettings().notifications_sonores) playMessageNotification();
  }, [allMessages, allMembres, allGroupes, allPublications, allEvenements, currentUser, pushMessageToasts, bumpUnviewed]);

  // Vue effectivement affichée (identique à allowedView, calculé avant le
  // premier rendu protégé — nécessaire pour les hooks).
  const allowedViewValue = currentUser && canAccessView(currentUser, activeView) ? activeView : '';

  // Quand l'utilisateur ouvre la vue correspondante, les compteurs qui
  // clignotent dans le titre / favicon retombent à zéro (comportement Facebook).
  useEffect(() => {
    const kindsByView: Record<string, Array<MessageToastData['kind']>> = {
      chat: ['message', 'group'],
      publications: ['publication'],
      events: ['event'],
      admin: ['member']
    };
    const kinds = kindsByView[allowedViewValue];
    if (!kinds) return;
    let touched = false;
    kinds.forEach((kind) => {
      if (unviewedByKindRef.current[kind] > 0) {
        unviewedByKindRef.current[kind] = 0;
        touched = true;
      }
    });
    if (touched) countUnviewed();
  }, [allowedViewValue, countUnviewed]);

  // Titre de l'onglet qui clignote + favicon avec compteur rouge, tant que des
  // nouveautés n'ont pas été consultées.
  useEffect(() => {
    const baseTitle = 'FIARAM NUMERIQUE - Gestion de groupe';
    if (!currentUser || unviewedNotifications <= 0) {
      document.title = baseTitle;
      updateFaviconBadge(0);
      return;
    }
    document.title = `(${unviewedNotifications}) FIARAM NUMERIQUE - Gestion de groupe`;
    updateFaviconBadge(unviewedNotifications);
    let flip = false;
    const blink = window.setInterval(() => {
      flip = !flip;
      document.title = flip
        ? `(${unviewedNotifications}) FIARAM NUMERIQUE - NOUVEAUX ÉLÉMENTS !`
        : baseTitle;
    }, 1200);
    return () => window.clearInterval(blink);
  }, [unviewedNotifications, currentUser]);

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

        {/* Bulles de notification des nouveaux messages */}
        <MessageToastList toasts={messageToasts} onOpen={openToastChat} onClose={closeToast} />

        {/* Demande d'autorisation des notifications système (une seule fois) */}
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && !permissionBannerDismissed && (
          <div
            className="animate-fade-in"
            style={{
              position: 'fixed',
              left: '14px',
              bottom: '84px',
              zIndex: 3200,
              maxWidth: 'min(320px, calc(100vw - 28px))',
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'var(--bg-secondary, #101828)',
              border: '1px solid var(--border-gold, rgba(245,158,11,.45))',
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              color: 'var(--text-main, #f8fafc)'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
              🔔 Recevoir les alertes en continu
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)', lineHeight: 1.5, marginBottom: '10px' }}>
              Autorisez les notifications système : vous verrez chaque nouveau message, publication, événement ou demande d'adhésion
              même en naviguant sur d'autres sites.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.78rem', padding: '8px 10px' }}
                onClick={async () => {
                  const result = await requestBrowserNotificationPermission();
                  setNotifPermission(result);
                  window.localStorage.setItem('fn_notif_banner', 'done');
                  setPermissionBannerDismissed(true);
                }}
              >
                Autoriser
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '8px 10px' }}
                onClick={() => {
                  window.localStorage.setItem('fn_notif_banner', 'done');
                  setPermissionBannerDismissed(true);
                }}
              >
                Plus tard
              </button>
            </div>
          </div>
        )}
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

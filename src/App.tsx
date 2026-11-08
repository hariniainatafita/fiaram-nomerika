import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { StorageService } from './utils/storage';
import { subscribeToSupabase, hydrateFromSupabase, pullKeyFromSupabase } from './utils/supabaseSync';
import { markOffline, usePresence } from './utils/presence';
import { canAccessGroupData, canAccessView, canViewPublication, getVisibleGroupIds } from './utils/permissions';
import { STORAGE_KEYS } from './utils/storageKeys';
import { Membre, Groupe, Presence, FinanceGroupe, Cotisation, Chanson, Message, Evenement, Publication, Story, Quiz, QuizResult, ReactionType, BilletCommande } from './types';
import {useLanguage} from './i18n';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { MessageToastList, MessageToastData } from './components/MessageToast';
import { NotificationPanel } from './components/NotificationPanel';
import { VoiceCallOverlay } from './components/VoiceCallOverlay';
import { useVoiceCall } from './utils/voiceCall';
import {
  addNotifications,
  clearNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications
} from './utils/notifications';
import type { AppNotification, AppNotificationInput } from './utils/notifications';
import { getReactionEntries, getReactionOption } from './utils/reactions';
import { playMessageNotification } from './utils/notificationSound';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  NotificationPermissionState
} from './utils/notificationPermission';
import { updateFaviconBadge } from './utils/faviconBadge';
import {
  MessengerBubble,
  isMessengerBubbleAvailable,
  isMessengerBubbleEnabled
} from './utils/messengerBubble';
import { supabaseUrl, supabaseAnonKey } from './lib/supabase';

// Views
import { DashboardView } from './views/DashboardView';
import { PresenceView } from './views/PresenceView';
import { CotisationView } from './views/CotisationView';
import { FinanceView } from './views/FinanceView';
import { SongsView } from './views/SongsView';
import { ChatView } from './views/ChatView';
import { GroupsView } from './views/GroupsView';
import { EventsView } from './views/EventsView';
import { QuizView } from './views/QuizView';
import { PublicationsView } from './views/PublicationsView';
import { TicketsView } from './views/TicketsView';
import { NewsView } from './views/NewsView';
import { MembersView } from './views/MembersView';
import { ProfileView } from './views/ProfileView';
import { MemberProfileModal } from './components/MemberProfileModal';
import { OPEN_MEMBER_PROFILE_EVENT } from './utils/memberProfileNav';
import { AdminView } from './views/AdminView';
import { LoginView } from './views/LoginView';
import { UpdateModal } from './components/UpdateModal';
import { OPEN_APP_UPDATE_EVENT } from './utils/appUpdate';
import { autoPrecacheIfNeeded } from './utils/mediaCache';
import { isNativeApp } from './lib/appConfig';

interface PublicationNotificationSnapshot {
  reactions: Map<string, ReactionType>;
  commentIds: Set<string>;
}

function buildPublicationNotificationSnapshot(
  publications: Publication[]
): Map<string, PublicationNotificationSnapshot> {
  return new Map(
    publications.map((publication) => [
      publication.id,
      {
        reactions: new Map<string, ReactionType>(
          getReactionEntries(publication.liked_by, publication.reactions)
            .map((entry): [string, ReactionType] => [entry.membreId, entry.type])
        ),
        commentIds: new Set(publication.commentaires.map((comment) => comment.id))
      }
    ])
  );
}

export function App() {
  const { t } = useLanguage();

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Active view state
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [viewedMemberId, setViewedMemberId] = useState<string | null>(null);

  // Any view can ask to open a member profile (feed, comments, chat, directory).
  useEffect(() => {
    const handleOpenMember = (event: Event) => {
      const detail = (event as CustomEvent<{ memberId?: string }>).detail;
      if (detail?.memberId) setViewedMemberId(detail.memberId);
    };
    window.addEventListener(OPEN_MEMBER_PROFILE_EVENT, handleOpenMember);
    return () => window.removeEventListener(OPEN_MEMBER_PROFILE_EVENT, handleOpenMember);
  }, []);

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Deep link into a direct or group chat conversation.
  const [chatFocus, setChatFocus] = useState<{
    peerId?: string;
    groupId?: string;
    nonce: number;
  } | null>(null);
  // Incrémenté à chaque clic sur l'icône Messages pour forcer la liste des
  // discussions, même si l'utilisateur était déjà dans la vue chat.
  const [chatListNonce, setChatListNonce] = useState(0);
  // Conversation ouverte : masque la navbar et la barre de navigation pour
  // laisser toute la place aux messages (style Messenger).
  const [chatFocusMode, setChatFocusMode] = useState(false);
  useEffect(() => {
    if (activeView !== 'chat') setChatFocusMode(false);
  }, [activeView]);

  // Cursor « dernières publications vues » : sert au badge rouge du bouton
  // Publications, comme sur Facebook quand de nouvelles publications arrivent.
  const [publicationSeenAt, setPublicationSeenAt] = useState<number>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.PUBLICATIONS_SEEN);
    if (stored) return Number(stored) || 0;
    const baseline = Date.now();
    window.localStorage.setItem(STORAGE_KEYS.PUBLICATIONS_SEEN, String(baseline));
    return baseline;
  });

  // Confirmation before logging out
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Fenêtre de mise à jour (ouverte depuis le menu ou les paramètres)
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Centre de notifications persistant (une liste par compte, locale à l'appareil).
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const handleOpenUpdate = () => setShowUpdateModal(true);
    window.addEventListener(OPEN_APP_UPDATE_EVENT, handleOpenUpdate);
    return () => window.removeEventListener(OPEN_APP_UPDATE_EVENT, handleOpenUpdate);
  }, []);

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
const [allStories, setAllStories] = useState<Story[]>(() => StorageService.getStories());
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>(() => StorageService.getQuizzes());
  const [allQuizResults, setAllQuizResults] = useState<QuizResult[]>(() => StorageService.getQuizResults());
  const [allBilletCommandes, setAllBilletCommandes] = useState<BilletCommande[]>(() => StorageService.getBilletsCommandes());

  // Service Android d'arrière-plan : il maintient la présence et la veille des
  // messages même quand la bulle flottante est désactivée. La bulle est
  // restaurée en plus uniquement pour les membres qui l'ont activée.
  useEffect(() => {
    if (!isMessengerBubbleAvailable()) return;
    if (!currentUser || !supabaseUrl || !supabaseAnonKey) {
      void MessengerBubble.stopBackgroundWatcher().catch(() => { /* service absent */ });
      return;
    }
    const session = {
      userId: currentUser.id,
      userName: `${currentUser.prenom} ${currentUser.nom}`.trim(),
      photoUrl: currentUser.photo_url,
      supabaseUrl,
      supabaseAnonKey,
      role: currentUser.role,
      groupeId: currentUser.groupe_id
    };
    void MessengerBubble.startBackgroundWatcher(session).catch(() => { /* service absent */ });
    if (isMessengerBubbleEnabled()) {
      void MessengerBubble.startBubble(session).catch(() => { /* permission refusée */ });
    }
  }, [currentUser]);

  // Push notifications are independent from the floating bubble: a member who
  // disabled the bubble must still receive messages when the app is closed.
  useEffect(() => {
    if (!isMessengerBubbleAvailable() || !currentUser || !supabaseUrl || !supabaseAnonKey) return;
    const session = {
      userId: currentUser.id,
      userName: `${currentUser.prenom} ${currentUser.nom}`.trim(),
      photoUrl: currentUser.photo_url,
      supabaseUrl,
      supabaseAnonKey,
      role: currentUser.role,
      groupeId: currentUser.groupe_id
    };
    void MessengerBubble.requestNotificationPermission()
      .catch(() => { /* permission refusée */ })
      .finally(() => {
        void MessengerBubble.registerPushToken(session)
          .catch(() => { /* Firebase non configuré */ });
      });
  }, [currentUser]);

  // Chat ouvert depuis une bulle ou une notification Android : le service
  // natif depose la cible dans les preferences, le pont web la consomme.
  useEffect(() => {
    if (!isMessengerBubbleAvailable()) return;
    let cancelled = false;
    const consume = async () => {
      try {
        const pending = await MessengerBubble.consumePendingChat();
        if (cancelled || !pending?.id) return;
        if (pending.type === 'list' || pending.id === 'list') {
          setChatFocus({ nonce: Date.now() });
          setActiveView('chat');
          return;
        }
        setChatFocus({
          peerId: pending.type === 'group' ? undefined : pending.id,
          groupId: pending.type === 'group' ? pending.id : undefined,
          nonce: Date.now()
        });
        setActiveView('chat');
      } catch {
        /* service absent */
      }
    };
    void consume();
    const handleVisible = () => {
      if (document.visibilityState === 'visible') void consume();
    };
    // A notification tapped while the app is already visible does not always
    // fire visibilitychange/focus, so poll the pending target while shown.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void consume();
    }, 4000);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, [currentUser]);

  // Téléchargement silencieux des médias déjà partagés (une fois par jour) :
  // l'application Android n'a plus besoin de les récupérer à chaque ouverture.
  useEffect(() => {
    if (!isNativeApp()) return;
    if (!currentUser) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const timer = window.setTimeout(() => {
      void autoPrecacheIfNeeded().catch(() => { /* cache indisponible */ });
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [currentUser]);

  // Android hardware back / browser back: walk through the app views instead of
  // closing the app. Each view change becomes a history entry, and an open
  // member profile is its own entry so back closes the profile first.
  const viewHistoryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      viewHistoryRef.current = null;
      return;
    }
    if (viewHistoryRef.current === null) {
      window.history.replaceState(
        { ...window.history.state, fiaramApp: true, fiaramView: activeView },
        ''
      );
      viewHistoryRef.current = activeView;
      return;
    }
    if (viewHistoryRef.current !== activeView) {
      window.history.pushState(
        { fiaramApp: true, fiaramView: activeView },
        ''
      );
      viewHistoryRef.current = activeView;
    }
  }, [currentUser, activeView]);

  useEffect(() => {
    if (!currentUser || !viewedMemberId) return;
    const state = window.history.state as { fiaramModal?: string } | null;
    if (state?.fiaramModal) return;
    window.history.pushState(
      { fiaramApp: true, fiaramView: viewHistoryRef.current ?? activeView, fiaramModal: 'member' },
      ''
    );
  }, [currentUser, viewedMemberId, activeView]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { fiaramView?: string; fiaramModal?: string } | null;
      if (!state?.fiaramModal) setViewedMemberId(null);
      if (state?.fiaramView) {
        viewHistoryRef.current = state.fiaramView;
        setActiveView(state.fiaramView);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const closeMemberProfile = () => {
    const state = window.history.state as { fiaramModal?: string } | null;
    if (state?.fiaramModal) {
      window.history.back();
    } else {
      setViewedMemberId(null);
    }
  };

  // Unread counts for navigation badges
  const quizUnreadCount = React.useMemo(() => {
    // Count published quizzes as potential notification source
    return allQuizzes.filter((q) => q.is_published).length;
  }, [allQuizzes]);

  // Live presence: only members with a recent heartbeat are shown online
  const presenceMap = usePresence(currentUser?.id);

  // Appels vocaux gratuits (WebRTC, sans credit telephonique). Le service vit
  // au niveau de l'application : un appel continue meme si l'on change d'ecran.
  const voiceCall = useVoiceCall(currentUser);
  const voiceCallBusy =
    voiceCall.state.status === 'outgoing' ||
    voiceCall.state.status === 'incoming' ||
    voiceCall.state.status === 'connecting' ||
    voiceCall.state.status === 'active';

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

  // Navigation depuis la barre / le menu : on repart toujours de la liste des
  // discussions, jamais de la dernière conversation privée ouverte.
  const handleSelectView = (view: string) => {
    setNotificationsOpen(false);
    setChatFocus(null);
    if (view === 'chat') setChatListNonce((nonce) => nonce + 1);
    setActiveView(view);
    if (view === 'publications') {
      refreshPublications();
    }
  };

  // Refresh functions
  const openChatWithMember = (membreId: string) => {
    setChatFocus({ peerId: membreId, nonce: Date.now() });
    setActiveView('chat');
  };

  // Leaving a member profile to write a message replaces the profile history
  // entry, so "back" returns to the view that opened the profile.
  const openChatFromMemberProfile = (membreId: string) => {
    const state = window.history.state as { fiaramModal?: string } | null;
    if (state?.fiaramModal) {
      window.history.replaceState({ fiaramApp: true, fiaramView: 'chat' }, '');
      viewHistoryRef.current = 'chat';
    }
    setViewedMemberId(null);
    openChatWithMember(membreId);
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

  const handleOpenNotifications = () => {
    setNotificationsOpen((open) => !open);
    setIsMobileSidebarOpen(false);
  };

  const handleCloseNotifications = () => {
    setNotificationsOpen(false);
  };

  const handleSelectNotification = (notification: AppNotification) => {
    if (!currentUser) return;
    markNotificationRead(currentUser.id, notification.id);
    setNotificationsOpen(false);

    if (notification.kind === 'update' && notification.targetView === 'update') {
      setShowUpdateModal(true);
      return;
    }
    if (notification.kind === 'message' || notification.kind === 'group') {
      if (notification.peerId) {
        openChatWithMember(notification.peerId);
      } else {
        handleSelectView('chat');
      }
      return;
    }
    if (notification.targetView) {
      handleSelectView(notification.targetView);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    if (currentUser) markAllNotificationsRead(currentUser.id);
  };

  const handleClearNotifications = () => {
    if (currentUser) clearNotifications(currentUser.id);
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
        markOffline(currentUser.id);
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

const refreshStories = () => {
    setAllStories(StorageService.getStories());
  };

  const refreshQuizzes = () => {
    setAllQuizzes(StorageService.getQuizzes());
  };

  const refreshQuizResults = () => {
    setAllQuizResults(StorageService.getQuizResults());
  };

  // Live sync: when another device updates shared data, refresh every store.
  useEffect(() => {
    const refreshAll = (changedKey?: string) => {
      StorageService.refreshMemberImageCache(changedKey);
      setAllMembres(StorageService.getMembres());
      setAllGroupes(StorageService.getGroupes());
      setAllPresences(StorageService.getPresences());
      setAllFinances(StorageService.getFinances());
      setAllCotisations(StorageService.getCotisations());
      setAllChansons(StorageService.getChansons());
      setAllMessages(StorageService.getMessages());
      setAllEvenements(StorageService.getEvenements());
      setAllPublications(StorageService.getPublications());
      setAllStories(StorageService.getStories());
      setAllQuizzes(StorageService.getQuizzes());
      setAllQuizResults(StorageService.getQuizResults());
      setAllBilletCommandes(StorageService.getBilletsCommandes());
      setCurrentUser((prev) => {
        if (!prev) return prev;
        return StorageService.getMembres().find((m) => m.id === prev.id) ?? null;
      });
    };
    const unsubscribe = subscribeToSupabase(refreshAll);

    // Profile/cover photos have their own rows: download the ones that are not
    // cached yet, then refresh the avatars across the app.
    const loadMemberPhotos = () => {
      void StorageService.hydrateMemberImages().then((fetched) => {
        if (fetched) refreshAll();
      });
    };
    loadMemberPhotos();

    // Android: the realtime socket can stay silent after a long sleep. As a
    // safety net, a light sync runs periodically while the screen is visible so
    // messages, presence and profile photos always end up appearing.
    let pollTimer: number | undefined;
    let polling = false;
    if (isNativeApp()) {
      pollTimer = window.setInterval(() => {
        if (polling || document.visibilityState !== 'visible') return;
        polling = true;
        void (async () => {
          try {
            await hydrateFromSupabase();
            await StorageService.hydrateMemberImages();
            refreshAll();
          } catch {
            /* prochaine tentative */
          } finally {
            polling = false;
          }
        })();
      }, 45000);
    }

    // Chat must stay live even when a realtime event is missed. Only the
    // messages row is fetched (small), so this safety net costs very little.
    const messagePollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void Promise.all([
        pullKeyFromSupabase(STORAGE_KEYS.MESSAGES),
        pullKeyFromSupabase(STORAGE_KEYS.BILLETS_COMMANDES)
      ])
        .then(() => {
          setAllMessages(StorageService.getMessages());
          setAllBilletCommandes(StorageService.getBilletsCommandes());
        })
        .catch(() => { /* prochaine tentative */ });
    }, 8000);

    // Smartphones: realtime socket drops while the app sleeps in background
    // and missed (non-queued) events never replay. On resume / focus / network
    // up, re-hydrate from Supabase so new messages and unread badges appear.
    const onResume = () => {
      if (document.visibilityState !== 'visible') return;
      void hydrateFromSupabase()
        .then(() => {
          StorageService.compactMemberImages();
          return StorageService.hydrateMemberImages();
        })
        .then(() => refreshAll());
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);
    return () => {
      unsubscribe();
      if (pollTimer) window.clearInterval(pollTimer);
      window.clearInterval(messagePollTimer);
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
    const visibleGroups = new Set(
      currentUser ? getVisibleGroupIds(currentUser, allGroupes) : []
    );
    const groups = currentUser
      ? allMessages.filter((m) => {
          if (!m.group_id || m.is_deleted || m.sender_id === currentUser.id) return false;
          if (!visibleGroups.has(m.group_id)) return false;
          const cursor = reads[`${currentUser.id}:${m.group_id}`] || '';
          return !cursor || m.sent_at > cursor;
        }).length
      : 0;
    return direct + groups;
  }, [allMessages, allMembres, allGroupes, currentUser]);

  // Badge du bouton Publications : nombre de publications d'autres membres
  // arrivées après la dernière visite du fil.
  const publicationUnreadCount = React.useMemo(() => {
    if (!currentUser) return 0;
    return allPublications.filter(
      (publication) =>
        publication.auteur_id !== currentUser.id &&
        new Date(publication.created_at).getTime() > publicationSeenAt &&
        canViewPublication(currentUser, publication, allGroupes)
    ).length;
  }, [allPublications, allGroupes, currentUser, publicationSeenAt]);

  // Badge du fil d'actualité (même source que Publications).
  const feedUnreadCount = publicationUnreadCount;
  const notificationUnreadCount = notifications.reduce(
    (count, notification) => count + (notification.read ? 0 : 1),
    0
  );

  // Ouvrir le fil marque les publications comme vues (le badge disparaît).
  useEffect(() => {
    if (!currentUser || activeView !== 'publications') return;
    const newest = allPublications.reduce(
      (max, publication) =>
        canViewPublication(currentUser, publication, allGroupes)
          ? Math.max(max, new Date(publication.created_at).getTime())
          : max,
      0
    );
    if (newest > publicationSeenAt) {
      window.localStorage.setItem(STORAGE_KEYS.PUBLICATIONS_SEEN, String(newest));
      setPublicationSeenAt(newest);
    }
  }, [activeView, allPublications, allGroupes, currentUser, publicationSeenAt]);

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
  const previousPublicationsRef = useRef<Map<string, PublicationNotificationSnapshot> | null>(null);
  const seenBilletStatutsRef = React.useRef<Map<string, string> | null>(null);
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

  const notificationUserId = currentUser?.id;
  useEffect(() => {
    if (!notificationUserId) {
      setNotifications([]);
      setNotificationsOpen(false);
      return;
    }
    const refresh = () => setNotifications(getNotifications(notificationUserId));
    refresh();
    return subscribeNotifications(refresh);
  }, [notificationUserId]);

  useEffect(() => {
    if (!currentUser) {
      seenMessageIdsRef.current = null;
      seenPublicationIdsRef.current = null;
      seenEventIdsRef.current = null;
      previousPublicationsRef.current = null;
      seenBilletStatutsRef.current = null;
      pendingMembersRef.current = -1;
      unviewedByKindRef.current = { message: 0, group: 0, publication: 0, event: 0, member: 0 };
      setUnviewedNotifications(0);
      return;
    }

    const items: MessageToastData[] = [];
    const appNotifications: AppNotificationInput[] = [];

    // ---- Messages privés et de groupe ----
    const seenMsg = seenMessageIdsRef.current ?? new Set<string>(StorageService.getMessages().map((m) => m.id));
    seenMessageIdsRef.current = seenMsg;
    // Only notify for conversations the member can actually open: a message
    // from a group the user does not belong to must not create a dead alert.
    const visibleGroupIds = new Set(getVisibleGroupIds(currentUser, allGroupes));
    const freshMsg = allMessages.filter(
      (m) =>
        !m.is_deleted &&
        !!m.sent_at &&
        !seenMsg.has(m.id) &&
        m.sender_id !== currentUser.id &&
        m.status !== 'read' &&
        (m.receiver_id === currentUser.id ||
          (!!m.group_id && visibleGroupIds.has(m.group_id)))
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
      const notificationPreview = preview.length > 160 ? `${preview.slice(0, 157)}…` : preview;
      items.push({
        id: msg.id,
        kind,
        senderName: `${sender.prenom} ${sender.nom}`.trim(),
        senderPhoto: sender.photo_url,
        text: preview,
        groupName: group?.nom_groupe,
        peerId: msg.group_id ? undefined : msg.sender_id
      });

      const sentAt = Date.parse(msg.sent_at.replace(' ', 'T'));
      appNotifications.push({
        id: `message:${msg.id}`,
        kind,
        title: group
          ? t('notifications.group.title', { group: group.nom_groupe })
          : t('notifications.message.title', { name: `${sender.prenom} ${sender.nom}`.trim() }),
        body: group
          ? `${sender.prenom} ${sender.nom} : ${notificationPreview}`
          : notificationPreview,
        targetView: 'chat',
        actorId: sender.id,
        peerId: msg.group_id ? undefined : msg.sender_id,
        groupName: group?.nom_groupe,
        createdAt: Number.isFinite(sentAt) ? sentAt : undefined
      });

      if (isMessengerBubbleAvailable() && isMessengerBubbleEnabled()) {
        void MessengerBubble.showMessage({
          messageId: msg.id,
          peerId: msg.group_id ? undefined : msg.sender_id,
          groupId: msg.group_id,
          senderId: msg.sender_id,
          senderName: `${sender.prenom} ${sender.nom}`.trim(),
          text: preview,
          photoUrl: sender.photo_url
        }).catch(() => { /* bulle non autorisée */ });
      }
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

      appNotifications.push({
        id: `publication:${pub.id}`,
        kind: 'publication',
        title: t('notifications.publication.title', {
          name: `${author.prenom} ${author.nom}`.trim()
        }),
        body: (pub.contenu ?? '').slice(0, 90),
        targetView: 'publications',
        actorId: author.id
      });
    });

    // ---- Réactions et commentaires sur mes publications ----
    if (previousPublicationsRef.current === null) {
      if (allPublications.length > 0) {
        previousPublicationsRef.current = buildPublicationNotificationSnapshot(allPublications);
      }
    } else {
      const previous = previousPublicationsRef.current;
      allPublications.forEach((publication) => {
        if (publication.auteur_id !== currentUser.id) return;
        const snapshot = previous.get(publication.id);
        if (!snapshot) return;

        const currentReactions = new Map<string, ReactionType>(
          getReactionEntries(publication.liked_by, publication.reactions)
            .map((entry): [string, ReactionType] => [entry.membreId, entry.type])
        );
        currentReactions.forEach((type, membreId) => {
          if (membreId === currentUser.id) return;
          if (snapshot.reactions.get(membreId) === type) return;
          const actor = allMembres.find((member) => member.id === membreId);
          if (!actor) return;
          const option = getReactionOption(type);
          const reactionAt = publication.reactions_updated_at?.[membreId] ?? publication.created_at;
          appNotifications.push({
            id: `reaction:${publication.id}:${membreId}:${type}:${reactionAt}`,
            kind: 'reaction',
            title: t('notifications.reaction.title', {
              name: `${actor.prenom} ${actor.nom}`.trim(),
              emoji: option?.emoji ?? '👍'
            }),
            body: (publication.contenu ?? '').slice(0, 90),
            targetView: 'publications',
            actorId: actor.id
          });
        });

        publication.commentaires.forEach((comment) => {
          if (snapshot.commentIds.has(comment.id)) return;
          if (comment.auteur_id === currentUser.id) return;
          const actor = allMembres.find((member) => member.id === comment.auteur_id);
          if (!actor) return;
          appNotifications.push({
            id: `comment:${comment.id}`,
            kind: 'comment',
            title: t('notifications.comment.title', {
              name: `${actor.prenom} ${actor.nom}`.trim()
            }),
            body: comment.contenu.slice(0, 120),
            targetView: 'publications',
            actorId: actor.id
          });
        });
      });
      previousPublicationsRef.current = buildPublicationNotificationSnapshot(allPublications);
    }

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

      appNotifications.push({
        id: `event:${event.id}`,
        kind: 'event',
        title: t('notifications.event.title', { name: event.nom }),
        body: event.date_evenement || '',
        targetView: 'events'
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

        appNotifications.push({
          id: `member:${Date.now()}`,
          kind: 'member',
          title: t('notifications.member.title'),
          body: t('notifications.member.body', { count: pendingCount - previous }),
          targetView: 'admin'
        });
      }
    }

    // ---- Billetterie événement ----
    const firstBilletScan = seenBilletStatutsRef.current === null;
    const seenBillets = seenBilletStatutsRef.current
      ?? new Map<string, string>(
        StorageService.getBilletsCommandes().map((commande) => [commande.id, commande.statut])
      );
    seenBilletStatutsRef.current = seenBillets;
    const canManageTicketNotifications =
      currentUser.role === 'admin' ||
      currentUser.role === 'chef' ||
      currentUser.role === 'super_chef';
    allBilletCommandes.forEach((commande) => {
      const previousStatut = seenBillets.get(commande.id);
      seenBillets.set(commande.id, commande.statut);
      if (firstBilletScan) return;
      if (previousStatut === commande.statut) return;
      const buyer = allMembres.find((membre) => membre.id === commande.acheteur_id);
      const buyerLabel = buyer
        ? `${buyer.prenom} ${buyer.nom}`.trim()
        : t('publications.event.buyer');
      const isMine = commande.acheteur_id === currentUser.id;
      if (commande.statut === 'paiement_declare' && canManageTicketNotifications && !isMine) {
        const body = t('publications.event.notifyNewOrder.body', {
          name: buyerLabel,
          amount: commande.montant_total
        });
        items.push({
          id: `ticket-order:${commande.id}`,
          kind: 'event',
          label: t('publications.event.notifyNewOrder.title'),
          senderName: buyerLabel,
          text: body
        });
        appNotifications.push({
          id: `ticket-order:${commande.id}`,
          kind: 'event',
          title: t('publications.event.notifyNewOrder.title'),
          body,
          targetView: 'publications',
          actorId: commande.acheteur_id
        });
      } else if (isMine && (commande.statut === 'valide' || commande.statut === 'rejete')) {
        const validated = commande.statut === 'valide';
        const title = t(validated
          ? 'publications.event.notifyValidated.title'
          : 'publications.event.notifyRejected.title');
        const body = t(validated
          ? 'publications.event.notifyValidated.body'
          : 'publications.event.notifyRejected.body', { reference: commande.reference });
        items.push({
          id: `ticket-${commande.statut}:${commande.id}`,
          kind: 'event',
          label: title,
          senderName: commande.evenement_nom,
          text: body
        });
        appNotifications.push({
          id: `ticket-${commande.statut}:${commande.id}`,
          kind: 'event',
          title,
          body,
          targetView: 'profile'
        });
      }
    });

    if (appNotifications.length) addNotifications(currentUser.id, appNotifications);
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
  }, [allMessages, allMembres, allGroupes, allPublications, allEvenements, allBilletCommandes, currentUser, pushMessageToasts, bumpUnviewed, t]);

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
    if (allowedViewValue === 'chat' && isMessengerBubbleAvailable() && isMessengerBubbleEnabled()) {
      void MessengerBubble.clearMessages().catch(() => { /* service arrêté */ });
    }
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
  const viewedMember = viewedMemberId
    ? allMembres.find((membre) => membre.id === viewedMemberId) || null
    : null;

  return (
    <div className={`app-container${chatFocusMode ? ' chat-focus-mode' : ''}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={allowedView}
        onSelectView={handleSelectView}
        currentUser={currentUser}
        allMembres={allMembres}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        unreadCount={unreadCount}
        publicationUnreadCount={publicationUnreadCount}
        quizUnreadCount={quizUnreadCount}
        feedUnreadCount={feedUnreadCount}
        notificationUnreadCount={notificationUnreadCount}
        notificationsOpen={notificationsOpen}
        onOpenNotifications={handleOpenNotifications}
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
          onSelectView={handleSelectView}
          allMembres={allMembres}
          allGroupes={allGroupes}
          allEvenements={allEvenements}
          allPublications={allPublications}
          allChansons={allChansons}
          allQuizzes={allQuizzes}
          notificationUnreadCount={notificationUnreadCount}
          notificationsOpen={notificationsOpen}
          onOpenNotifications={handleOpenNotifications}
          onLogout={() => {
            setConfirmLogout(true);
          }}
        />

        {/* Dynamic Views */}
        <main style={{ flex: 1 }}>
          {allowedView === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              allMembres={allMembres}
              allPresences={allPresences}
              allCotisations={allCotisations}
              allGroupes={allGroupes}
              allEvenements={allEvenements}
              onRefreshMembres={refreshMembres}
              onSelectView={handleSelectView}
              unreadCount={unreadCount}
            />
          )}

          {allowedView === 'publications' && (
            <PublicationsView
              currentUser={currentUser}
              allMembres={allMembres}
              allGroupes={allGroupes}
              publications={allPublications}
              stories={allStories}
              onRefreshPublications={refreshPublications}
              onRefreshStories={refreshStories}
            />
          )}

          {allowedView === 'news' && (
            <NewsView />
          )}

          {allowedView === 'tickets' && (
            <TicketsView
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
              onRefreshGroupes={() => {
                setAllGroupes(StorageService.getGroupes());
                refreshMembres();
              }}
              openPeerId={chatFocus?.peerId}
              openGroupId={chatFocus?.groupId}
              focusKey={chatFocus?.nonce}
              listKey={chatListNonce}
              onConversationChange={setChatFocusMode}
              onStartVoiceCall={(peerId) => {
                const peer = allMembres.find((membre) => membre.id === peerId);
                if (peer) voiceCall.startCall(peer);
              }}
              onStartVideoCall={(peerId) => {
                const peer = allMembres.find((membre) => membre.id === peerId);
                if (peer) voiceCall.startVideoCall(peer);
              }}
              voiceCallBusy={voiceCallBusy}
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

          {allowedView === 'quiz' && (
            <QuizView
              currentUser={currentUser}
              allMembres={allMembres}
              quizzes={allQuizzes}
              results={allQuizResults}
              onRefreshQuizzes={refreshQuizzes}
              onRefreshResults={refreshQuizResults}
            />
          )}

          {allowedView === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              allGroupes={allGroupes}
              publications={allPublications}
              stories={allStories}
              onRefreshUser={refreshMembres}
              onRefreshPublications={refreshPublications}
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
          onSelectView={handleSelectView}
          unreadCount={unreadCount}
          publicationUnreadCount={publicationUnreadCount}
          notificationUnreadCount={notificationUnreadCount}
          notificationsOpen={notificationsOpen}
          onOpenNotifications={handleOpenNotifications}
          currentUser={currentUser}
        />

        {/* Centre de notifications */}
        {notificationsOpen && (
          <NotificationPanel
            notifications={notifications}
            members={allMembres}
            onClose={handleCloseNotifications}
            onSelect={handleSelectNotification}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onClear={handleClearNotifications}
          />
        )}

        {/* Appel vocal entrant / en cours (WebRTC, sans credit telephonique) */}
        <VoiceCallOverlay call={voiceCall} />

        {/* Bulles de notification des nouveaux messages */}
        <MessageToastList toasts={messageToasts} onOpen={openToastChat} onClose={closeToast} />

        {/* Profil public d'un membre (comme Facebook) */}
        {viewedMember && (
          <MemberProfileModal
            membre={viewedMember}
            currentUser={currentUser}
            publications={allPublications}
            stories={allStories}
            onClose={closeMemberProfile}
            onOpenChat={openChatFromMemberProfile}
            onStartVoiceCall={(membreId) => {
              const peer = allMembres.find((membre) => membre.id === membreId);
              closeMemberProfile();
              if (peer) voiceCall.startCall(peer);
            }}
            onStartVideoCall={(membreId) => {
              const peer = allMembres.find((membre) => membre.id === membreId);
              closeMemberProfile();
              if (peer) voiceCall.startVideoCall(peer);
            }}
            voiceCallBusy={voiceCallBusy}
          />
        )}

        {/* Mise à jour de l'application Android */}
        {showUpdateModal && <UpdateModal onClose={() => setShowUpdateModal(false)} />}

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
                  if (currentUser) markOffline(currentUser.id);
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

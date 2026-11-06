import React, { useState, useEffect, useRef } from 'react';
import { Membre, Groupe, Message } from '../types';
import {
  Send,
  Image as ImageIcon,
  Search,
  Users,
  Check,
  CheckCheck,
  X,
  Maximize2,
  Download,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Settings,
  MessageSquare,
  ThumbsUp,
  Crown,
  ShieldCheck,
  Phone,
  Video
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { StorageService } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { uploadDataUrl, downloadMedia } from '../utils/media';
import { isMemberOnline, PresenceMap } from '../utils/presence';
import { useLanguage } from '../i18n';
import {
  canManageMessengerGroup,
  getVisibleGroupIds,
  isAdmin,
  isMessengerGroupAdmin,
  isMessengerGroupOwner
} from '../utils/permissions';
import { useTypingIndicator } from '../utils/typing';
import { fetchMessageImageIfMissing } from '../utils/supabaseSync';
import { openMemberProfile } from '../utils/memberProfileNav';
import {
  MessengerBubble,
  isMessengerBubbleAvailable,
  isMessengerBubbleEnabled,
  setMessengerBubbleEnabled
} from '../utils/messengerBubble';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';

interface ChatViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  messages: Message[];
  presence: PresenceMap;
  onRefreshMessages: () => void;
  onRefreshGroupes: () => void;
  openPeerId?: string;
  openGroupId?: string;
  focusKey?: number;
  listKey?: number;
  onConversationChange?: (open: boolean) => void;
  onStartVoiceCall?: (peerId: string) => void;
  onStartVideoCall?: (peerId: string) => void;
  voiceCallBusy?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  allMembres,
  allGroupes,
  messages,
  presence,
  onRefreshMessages,
  onRefreshGroupes,
  openPeerId,
  openGroupId,
  focusKey,
  listKey,
  onConversationChange,
  onStartVoiceCall,
  onStartVideoCall,
  voiceCallBusy
}) => {
  const visibleGroupIds = getVisibleGroupIds(currentUser, allGroupes);
  const visibleGroupes = allGroupes.filter((g) => visibleGroupIds.includes(g.id));
  const directFallbackId = allMembres.find((m) => m.id !== currentUser.id)?.id || '';

  // Active conversation target: either a group id or a member id
  const [activeChannelType, setActiveChannelType] = useState<'group' | 'direct'>(
    visibleGroupes.length > 0 ? 'group' : 'direct'
  );
  const [activeChannelId, setActiveChannelId] = useState(
    visibleGroupes[0]?.id || directFallbackId
  );

  // New message input
  const [inputText, setInputText] = useState('');
  const [searchContact, setSearchContact] = useState('');

  // Réponse à un message (appui long / glissement)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [swipeMessageId, setSwipeMessageId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Staged image attachment state
  const [stagedImage, setStagedImage] = useState<{
    dataUrl: string;
    fileName: string;
    fileSizeKb: number;
  } | null>(null);

  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Lightbox modal for viewing image full-screen
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // On phones, show either the contact list or the active conversation
  const [isMobileConversation, setIsMobileConversation] = useState(false);
  // Sur ordinateur, la conversation est toujours visible à côté de la liste :
  // on masque aussi la navbar et le footer pour un vrai plein écran.
  const [isWideViewport, setIsWideViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches
  );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)');
    const handleChange = (event: MediaQueryListEvent) => setIsWideViewport(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Bulle Messenger Android (au-dessus des autres applications)
  const [bubbleEnabled, setBubbleEnabled] = useState<boolean>(() => isMessengerBubbleEnabled());

  const handleToggleBubble = async () => {
    if (!isMessengerBubbleAvailable()) {
      alert(t('chat.bubbleUnsupported'));
      return;
    }
    if (bubbleEnabled) {
      setMessengerBubbleEnabled(false);
      setBubbleEnabled(false);
      await MessengerBubble.stopBubble().catch(() => { /* service déjà arrêté */ });
      return;
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      alert(t('chat.bubbleUnsupported'));
      return;
    }

    const permissions = await MessengerBubble.getBubblePermissions().catch(() => null);
    if (!permissions?.notifications) {
      await MessengerBubble.requestNotificationPermission().catch(() => { /* refusée */ });
    }
    if (!permissions?.overlay) {
      await MessengerBubble.requestOverlayPermission().catch(() => { /* réglages indisponibles */ });
      alert(t('chat.bubbleOverlayHint'));
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
    try {
      const result = await MessengerBubble.startBubble(session);
      if (result.needsOverlayPermission) {
        alert(t('chat.bubbleOverlayHint'));
        return;
      }
    } catch {
      alert(t('chat.bubbleOverlayHint'));
      return;
    }
    setMessengerBubbleEnabled(true);
    setBubbleEnabled(true);
    void MessengerBubble.registerPushToken(session).catch(() => { /* Firebase non configuré */ });
  };

  // Édition / suppression de messages
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingText, setEditingText] = useState('');

  // Groupes Messenger (discussion uniquement)
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [manageName, setManageName] = useState('');
  const [manageMemberIds, setManageMemberIds] = useState<string[]>([]);
  const [manageAdminIds, setManageAdminIds] = useState<string[]>([]);
  const [managePhotoUrl, setManagePhotoUrl] = useState<string | undefined>(undefined);
  const [isProcessingGroupPhoto, setIsProcessingGroupPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageSwipeRef = useRef<{ id: string; x: number; y: number; triggered: boolean } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { t } = useLanguage();

  const currentUserName = `${currentUser.prenom} ${currentUser.nom}`.trim();
  const { typingNames, notifyTyping } = useTypingIndicator(
    currentUser.id,
    currentUserName,
    activeChannelType,
    activeChannelId
  );

  // Mode « conversation » : l'application masque sa navbar et son footer.
  // Sur mobile uniquement quand une conversation est ouverte ; sur ordinateur
  // dès que la vue Messages est affichée (la liste reste dans la sidebar).
  useEffect(() => {
    onConversationChange?.(isMobileConversation || isWideViewport);
  }, [isMobileConversation, isWideViewport, onConversationChange]);

  // Le champ de saisie grandit avec le texte (retours à la ligne autorisés).
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 132)}px`;
  }, [inputText]);

  // On ne garde pas une réponse citée en changeant de conversation.
  useEffect(() => {
    setReplyingTo(null);
  }, [activeChannelId, activeChannelType]);

  const getMessagePreviewText = (message: Message) => {
    if (message.message?.trim()) return message.message.trim();
    if (message.image_url || message.image_ref || message.file_type === 'image') {
      return t('chat.replyImage');
    }
    return '';
  };

  const getMessageSenderName = (message: Message) => {
    if (message.sender_id === currentUser.id) return t('chat.youPrefix');
    const member = allMembres.find((m) => m.id === message.sender_id);
    return member ? `${member.prenom} ${member.nom}` : '';
  };

  const startMessageSwipe = (message: Message, clientX: number, clientY: number) => {
    messageSwipeRef.current = { id: message.id, x: clientX, y: clientY, triggered: false };
    setSwipeMessageId(message.id);
    setSwipeOffset(0);
  };

  const moveMessageSwipe = (message: Message, clientX: number, clientY: number) => {
    const current = messageSwipeRef.current;
    if (!current || current.id !== message.id || current.triggered) return;
    const deltaX = clientX - current.x;
    const deltaY = clientY - current.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    setSwipeOffset(Math.max(-72, Math.min(72, deltaX)));
    if (Math.abs(deltaX) >= 56) {
      current.triggered = true;
      lastSwipeAtRef.current = Date.now();
      setReplyingTo(message);
      setSwipeOffset(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
    }
  };

  const endMessageSwipe = () => {
    messageSwipeRef.current = null;
    setSwipeMessageId(null);
    setSwipeOffset(0);
  };

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannelId, stagedImage]);

  // Current conversation details
  const activeGroup = activeChannelType === 'group' 
    ? allGroupes.find((g) => g.id === activeChannelId) 
    : null;
  const activePeer = activeChannelType === 'direct' 
    ? allMembres.find((m) => m.id === activeChannelId) 
    : null;
  const isPeerOnline = isMemberOnline(presence, activePeer?.id);

  // Membres actuellement en ligne : affichés en haut de la liste des messages.
  const onlineMembers = React.useMemo(
    () =>
      allMembres
        .filter(
          (m) =>
            m.id !== currentUser.id &&
            m.is_approved !== false &&
            !m.is_blocked &&
            isMemberOnline(presence, m.id)
        )
        .slice()
        .sort((a, b) => (presence[b.id] || 0) - (presence[a.id] || 0)),
    [allMembres, currentUser.id, presence]
  );

  const typingLabel =
    typingNames.length === 0
      ? ''
      : typingNames.length === 1
        ? t('chat.typing', { name: typingNames[0] })
        : t('chat.typingMultiple', { names: typingNames.slice(0, 2).join(', ') });

  const openDirectChannel = (memberId: string) => {
    setActiveChannelType('direct');
    setActiveChannelId(memberId);
    setIsMobileConversation(true);
  };

  const openManageGroup = () => {
    if (!activeGroup || !canManageActiveGroup) return;
    setManageGroupId(activeGroup.id);
    setManageName(activeGroup.nom_groupe);
    setManageMemberIds(activeGroup.membre_ids || []);
    setManageAdminIds(activeGroup.admin_ids || []);
    setManagePhotoUrl(activeGroup.photo_url);
  };

  // Filter messages for current channel
  const channelMessages = messages.filter((m) => {
    if (activeChannelType === 'group') {
      return m.group_id === activeChannelId;
    } else {
      return (
        (m.sender_id === currentUser.id && m.receiver_id === activeChannelId) ||
        (m.sender_id === activeChannelId && m.receiver_id === currentUser.id)
      );
    }
  });

  // Mark received messages as read while the private conversation is open
  useEffect(() => {
    if (activeChannelType !== 'direct' || !activeChannelId) return;
    if (StorageService.markConversationAsRead(currentUser.id, activeChannelId)) {
      onRefreshMessages();
    }
  }, [activeChannelType, activeChannelId, messages, currentUser.id, onRefreshMessages]);

  // Mark the group channel as read while it is open (per-user read cursor)
  const [readTick, setReadTick] = useState(0);

  // Group read cursors are re-read whenever they may have changed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupReads = React.useMemo(() => StorageService.getGroupReads(), [readTick, messages]);

  // Deep link: open a direct conversation when triggered from another view.
  // Sans cible (clic sur l'icône « messages »), on revient à la liste des
  // discussions : on n'atterrit plus dans la conversation d'un utilisateur.
  useEffect(() => {
    if (openGroupId) {
      setActiveChannelType('group');
      setActiveChannelId(openGroupId);
      setIsMobileConversation(true);
      return;
    }
    if (!openPeerId) {
      setIsMobileConversation(false);
      return;
    }
    setActiveChannelType('direct');
    setActiveChannelId(openPeerId);
    setIsMobileConversation(true);
  }, [openPeerId, openGroupId, focusKey, listKey]);

  // Per-conversation unread helpers
  const unreadDirectCount = (peerId: string): number =>
    messages.filter(
      (msg) =>
        msg.sender_id === peerId &&
        msg.receiver_id === currentUser.id &&
        msg.status !== 'read' &&
        !msg.is_deleted
    ).length;

  const unreadGroupCount = (groupId: string): number => {
    const cursor = groupReads[`${currentUser.id}:${groupId}`] || '';
    return messages.filter(
      (msg) =>
        msg.group_id === groupId &&
        msg.sender_id !== currentUser.id &&
        !msg.is_deleted &&
        (!cursor || msg.sent_at > cursor)
    ).length;
  };

  // While a group channel is open, clear its unread badge automatically
  const activeGroupUnread = activeChannelType === 'group' && activeChannelId
    ? unreadGroupCount(activeChannelId)
    : 0;

  useEffect(() => {
    if (activeChannelType !== 'group' || !activeChannelId) return;
    if (activeGroupUnread > 0) {
      StorageService.markGroupAsRead(currentUser.id, activeChannelId);
      setReadTick((n) => n + 1);
      onRefreshMessages();
    }
  }, [activeChannelType, activeChannelId, currentUser.id, activeGroupUnread, onRefreshMessages]);

  // Accusés de lecture des groupes : marque comme « vu » les messages des
  // autres dès que le membre ouvre la conversation (comme Messenger).
  const hasUnreadGroupByMe = activeChannelType === 'group' && activeChannelId
    ? channelMessages.some(
        (msg) =>
          msg.sender_id !== currentUser.id &&
          !msg.is_deleted &&
          !(msg.read_by || []).includes(currentUser.id)
      )
    : false;

  useEffect(() => {
    if (activeChannelType !== 'group' || !activeChannelId || !hasUnreadGroupByMe) return;
    if (StorageService.markGroupMessagesRead(currentUser.id, activeChannelId)) {
      onRefreshMessages();
    }
  }, [activeChannelType, activeChannelId, currentUser.id, hasUnreadGroupByMe, onRefreshMessages]);

  const previewText = (msg?: Message): string => {
    if (!msg) return '';
    // Message images may still be lazy-loading from their dedicated sync row
    if (msg.image_url || msg.file_url || msg.image_ref) return '📷 ' + (msg.message || t('chat.unreadPreviewImage'));
    return msg.message || '';
  };

  // Image of a message: legacy inline data URL, or payload stored in the
  // message's own sync row (small realtime payloads stay deliverable).
  const resolveMessageImage = (msg: Message): string | undefined => {
    if (msg.image_url) return msg.image_url;
    if (msg.file_type === 'image' && msg.file_url) return msg.file_url;
    if (msg.image_ref) return StorageService.getMessageImage(msg.image_ref);
    return undefined;
  };

  // Chat images sync in their own rows: fetch any payload missing locally
  const [imageTick, setImageTick] = useState(0);
  const pendingImageRefs = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    for (const msg of messages) {
      const ref = msg.image_ref;
      if (!ref || pendingImageRefs.current.has(ref)) continue;
      if (StorageService.getMessageImage(ref)) continue;
      pendingImageRefs.current.add(ref);
      void fetchMessageImageIfMissing(ref).then(() => {
        pendingImageRefs.current.delete(ref);
        if (!cancelled) setImageTick((n) => n + 1);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [messages]);

  // Dernier message réel d'une conversation (dans les deux sens) : la liste
  // doit toujours afficher le contenu le plus récent, pas la fonction du
  // correspondant (« membre », « administrateur »…).
  const lastChannelMessage = (channelType: 'group' | 'direct', channelId: string): Message | undefined => {
    const list = messages
      .filter((m) => {
        if (m.is_deleted || !m.sent_at) return false;
        if (channelType === 'group') return m.group_id === channelId;
        return (
          (m.sender_id === channelId && m.receiver_id === currentUser.id) ||
          (m.sender_id === currentUser.id && m.receiver_id === channelId)
        );
      })
      .sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1));
    return list[list.length - 1];
  };

  // Most recent activity per channel (any message, mine or theirs): the
  // conversation list behaves like a messenger, the freshest channel on top.
  const lastActivity = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const msg of messages) {
      if (msg.is_deleted || !msg.sent_at) continue;
      const key = msg.group_id
        ? `g:${msg.group_id}`
        : `d:${msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id}`;
      if (!map[key] || msg.sent_at > map[key]) map[key] = msg.sent_at;
    }
    return map;
  }, [messages, currentUser.id]);

  const channelOrderCompare = (
    type: 'g' | 'd',
    idA: string,
    idB: string,
    nameA: string,
    nameB: string
  ): number => {
    const ta = lastActivity[`${type}:${idA}`];
    const tb = lastActivity[`${type}:${idB}`];
    if (!ta && !tb) return nameA.localeCompare(nameB);
    if (!ta) return 1;
    if (!tb) return -1;
    if (ta !== tb) return ta > tb ? -1 : 1;
    return nameA.localeCompare(nameB);
  };

  const orderedGroupes = React.useMemo(() => {
    const q = searchContact.trim().toLowerCase();
    return visibleGroupes
      .filter((g) => !q || g.nom_groupe.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => channelOrderCompare('g', a.id, b.id, a.nom_groupe, b.nom_groupe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGroupes, lastActivity, searchContact]);

  const orderedDirects = React.useMemo(() => {
    const q = searchContact.trim().toLowerCase();
    return allMembres
      .filter((m) => m.id !== currentUser.id)
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.prenom} ${m.nom} ${m.username || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice()
      .sort((a, b) =>
        channelOrderCompare('d', a.id, b.id, `${a.prenom} ${a.nom}`, `${b.prenom} ${b.nom}`)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMembres, currentUser.id, lastActivity, searchContact]);

  // Groupes Messenger (créés librement) vs groupes officiels de l'application
  const orderedMessengerGroupes = orderedGroupes.filter((g) => g.is_messenger);
  const orderedOfficialGroupes = orderedGroupes.filter((g) => !g.is_messenger);
  const canManageActiveGroup = canManageMessengerGroup(activeGroup, currentUser);

  const manageGroup = manageGroupId ? allGroupes.find((g) => g.id === manageGroupId) : null;
  const manageGroupOwner = isMessengerGroupOwner(manageGroup, currentUser.id);
  const manageGroupAdmin = isMessengerGroupAdmin(manageGroup, currentUser.id);
  const canManageGroupSettings = Boolean(manageGroup && (manageGroupOwner || isAdmin(currentUser)));
  const canManageGroupPhoto = Boolean(manageGroup && (canManageGroupSettings || manageGroupAdmin));
  const canManageGroupMembers = canManageGroupSettings;
  const canManageGroupAdmins = canManageGroupSettings;
  const canAddGroupMembers = Boolean(manageGroup && (canManageGroupSettings || manageGroupAdmin));

  // Handle local image file selection with canvas compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const compressedDataUrl = await compressImage(file, 800, 800, 0.75);
      const sizeKb = Math.round(compressedDataUrl.length / 1024);

      setStagedImage({
        dataUrl: compressedDataUrl,
        fileName: file.name,
        fileSizeKb: sizeKb
      });
    } catch (err) {
      console.error('Erreur compression image:', err);
      alert(t('chat.imageProcessError'));
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  // Remove staged image
  const handleRemoveStagedImage = () => {
    setStagedImage(null);
  };

  // Photo du groupe Messenger (compressée puis envoyée sur le stockage média).
  const handleGroupPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingGroupPhoto(true);
      const compressed = await compressImage(file, 512, 512, 0.78);
      const uploaded = await uploadDataUrl(compressed, 'image');
      setManagePhotoUrl(uploaded || compressed);
    } catch (err) {
      console.error('Erreur photo groupe:', err);
      alert(t('chat.imageProcessError'));
    } finally {
      setIsProcessingGroupPhoto(false);
      e.target.value = '';
    }
  };

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !stagedImage) return;

    // The picture is stored locally/synced immediately as its own base64 row
    // so the message appears without waiting for the storage upload. The
    // upload then runs in the background and replaces the row with a fast CDN
    // URL when it succeeds.
    setIsProcessingImage(true);
    const imageUrlToSend = stagedImage?.dataUrl;
    const attachmentPayload = stagedImage ? {
      file_url: imageUrlToSend,
      file_name: stagedImage.fileName,
      file_type: 'image' as const
    } : undefined;
    const replyPayload = replyingTo ? {
      id: replyingTo.id,
      sender_id: replyingTo.sender_id,
      text: getMessagePreviewText(replyingTo)
    } : undefined;

    const sentMessage = activeChannelType === 'group'
      ? StorageService.sendMessage(
          currentUser.id,
          inputText.trim(),
          undefined,
          activeChannelId,
          imageUrlToSend,
          attachmentPayload,
          replyPayload
        )
      : StorageService.sendMessage(
          currentUser.id,
          inputText.trim(),
          activeChannelId,
          undefined,
          imageUrlToSend,
          attachmentPayload,
          replyPayload
        );

    setInputText('');
    setStagedImage(null);
    setReplyingTo(null);
    setIsProcessingImage(false);
    onRefreshMessages();

    if (stagedImage && sentMessage.image_ref) {
      const imageRef = sentMessage.image_ref;
      const dataUrl = stagedImage.dataUrl;
      void uploadDataUrl(dataUrl, 'image').then((url) => {
        if (!url) return;
        StorageService.moveMessageImage(imageRef, url);
        onRefreshMessages();
      }).catch(() => { /* the synced base64 row already carries the picture */ });
    }
  };

  // Bouton « J'aime » rapide quand le champ est vide (comme Messenger).
  const handleQuickLike = () => {
    if (isProcessingImage) return;
    const replyPayload = replyingTo ? {
      id: replyingTo.id,
      sender_id: replyingTo.sender_id,
      text: getMessagePreviewText(replyingTo)
    } : undefined;
    if (activeChannelType === 'group') {
      StorageService.sendMessage(
        currentUser.id,
        '👍',
        undefined,
        activeChannelId,
        undefined,
        undefined,
        replyPayload
      );
    } else {
      StorageService.sendMessage(
        currentUser.id,
        '👍',
        activeChannelId,
        undefined,
        undefined,
        undefined,
        replyPayload
      );
    }
    setReplyingTo(null);
    onRefreshMessages();
  };

  // Create Messenger Group
  const handleCreateMessengerGroup = async () => {
    if (!newGroupName.trim() || newGroupMemberIds.length === 0) {
      alert(t('chat.groupCreationError')); // Ensure at least one member and name
      return;
    }
    await StorageService.createMessengerGroupe(newGroupName, newGroupMemberIds, currentUser.id);
    setShowCreateGroup(false);
    setNewGroupName('');
    setNewGroupMemberIds([]);
    onRefreshGroupes();
  };

  // Manage Group
  const handleManageGroup = async () => {
    if (!manageGroupId) return;
    const group = allGroupes.find((g) => g.id === manageGroupId);
    if (!group) {
      setManageGroupId(null);
      return;
    }
    const owner = group.chef_id === currentUser.id;
    const appAdmin = isAdmin(currentUser);
    const groupAdmin = (group.admin_ids || []).includes(currentUser.id);
    const canSettings = owner || appAdmin;
    const canPhoto = canSettings || groupAdmin;

    // Members first, then admins, so a newly added admin is already a member.
    const nextMembers = canSettings
      ? manageMemberIds
      : [...new Set([...(group.membre_ids || []), ...manageMemberIds])];
    if (canSettings || groupAdmin) {
      await StorageService.updateMessengerGroupeMembers(manageGroupId, nextMembers);
    }

    if (canSettings) {
      if (manageName.trim() && manageName.trim() !== group.nom_groupe) {
        await StorageService.renameMessengerGroupe(manageGroupId, manageName.trim());
      }
      const memberSet = new Set([...nextMembers, group.chef_id]);
      const nextAdmins = manageAdminIds.filter((id) => memberSet.has(id));
      await StorageService.updateMessengerGroupeAdmins(manageGroupId, nextAdmins);
    }

    if (canPhoto && managePhotoUrl !== group.photo_url) {
      await StorageService.setMessengerGroupePhoto(manageGroupId, managePhotoUrl);
    }

    setManageGroupId(null);
    setManageName('');
    setManageMemberIds([]);
    setManageAdminIds([]);
    setManagePhotoUrl(undefined);
    onRefreshGroupes();
  };

  // Edit Message
  const handleEditMessage = async () => {
    if (editingMessage) {
      await StorageService.editMessage(editingMessage.id, editingText);
      setEditingMessage(null);
      setEditingText('');
      onRefreshMessages();
    }
  };

  return (
    <div className={`animate-fade-in chat-container-wrapper${isMobileConversation ? ' chat-mobile-conversation' : ''}`} style={{
      padding: '16px 20px',
      maxWidth: '1240px',
      margin: '0 auto',
      height: 'calc(100dvh - 130px)',
      minHeight: '480px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Container Card */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        
        {/* LEFT CONTACTS / CHANNELS COLUMN */}
        <div className="chat-sidebar" style={{
          width: '310px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(0, 0, 0, 0.12)',
          flexShrink: 0
        }}>
          {/* Header search */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>{t('chat.title')}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ position: 'relative', flexGrow: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder={t('chat.searchPlaceholder')}
                  value={searchContact}
                  onChange={(e) => setSearchContact(e.target.value)}
                  className="form-input"
                  style={{ padding: '7px 12px 7px 30px', fontSize: '0.82rem' }}
                />
              </div>
              <button onClick={() => setShowCreateGroup(true)} title={t('chat.newGroup')}>  
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>

            {/* Membres en ligne : accès direct à leur discussion */}
            {onlineMembers.length > 0 && (
              <div style={{ padding: '2px 2px 10px', marginBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)', padding: '2px 8px 8px', textTransform: 'uppercase' }}>
                  {t('chat.onlineNow', { count: onlineMembers.length })}
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 4px 4px' }}>
                  {onlineMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openDirectChannel(m.id)}
                      title={`${m.prenom} ${m.nom} - ${t('chat.onlineStatus')}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        width: '58px'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                          alt={m.prenom}
                          style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981' }}
                        />
                        <span style={{
                          position: 'absolute',
                          right: '1px',
                          bottom: '1px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#10b981',
                          border: '2px solid var(--bg-secondary)'
                        }} />
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-main)',
                        maxWidth: '58px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {m.prenom}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onlineMembers.length === 0 && allMembres.length > 1 && (
              <div style={{
                padding: '2px 8px 10px',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '4px'
              }}>
                {t('chat.noOneOnline')}
              </div>
            )}

            {/* Groupes Messenger (discussion libre, sans impact sur les
                cotisations / présences) */}
            {orderedMessengerGroupes.length > 0 && (
              <>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)', padding: '6px 10px', textTransform: 'uppercase' }}>
                  {t('chat.messengerGroupsSection', { count: orderedMessengerGroupes.length })}
                </div>
                {orderedMessengerGroupes.map((g) => {
                  const isSelected = activeChannelType === 'group' && activeChannelId === g.id;
                  const unread = unreadGroupCount(g.id);
                  const lastMsg = lastChannelMessage('group', g.id);
                  const lastSender = lastMsg ? allMembres.find((m) => m.id === lastMsg.sender_id) : undefined;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setActiveChannelType('group');
                        setActiveChannelId(g.id);
                        setIsMobileConversation(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid var(--border-gold)' : '1px solid transparent',
                        background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: 'var(--text-main)',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        marginBottom: '2px'
                      }}
                    >
                      {g.photo_url ? (
                        <img
                          src={g.photo_url}
                          alt={g.nom_groupe}
                          style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(245, 158, 11, 0.25))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#c4b5fd',
                          flexShrink: 0
                        }}>
                          <MessageSquare size={18} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: isSelected || unread > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.nom_groupe}
                        </div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: unread > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {lastMsg
                            ? `${lastSender?.id === currentUser.id ? t('chat.youPrefix') + ' : ' : lastSender ? lastSender.prenom + ' : ' : ''}${previewText(lastMsg)}`
                            : t('chat.groupMembersCount', { count: (g.membre_ids || []).length })}
                        </div>
                      </div>
                      {unread > 0 && (
                        <span style={{
                          flexShrink: 0,
                          minWidth: '20px',
                          height: '20px',
                          padding: '0 6px',
                          borderRadius: '999px',
                          background: '#ef4444',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Groupes officiels */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', padding: '12px 10px 6px', textTransform: 'uppercase' }}>
              {t('chat.groupsSection', { count: orderedOfficialGroupes.length })}
            </div>

            {orderedOfficialGroupes.map((g) => {
              const isSelected = activeChannelType === 'group' && activeChannelId === g.id;
              const chef = allMembres.find((m) => m.id === g.chef_id);
              const unread = unreadGroupCount(g.id);
              const lastMsg = lastChannelMessage('group', g.id);
              const lastSender = lastMsg ? allMembres.find((m) => m.id === lastMsg.sender_id) : undefined;

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setActiveChannelType('group');
                    setActiveChannelId(g.id);
                    setIsMobileConversation(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--border-gold)' : '1px solid transparent',
                    background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: 'var(--text-main)',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6',
                    flexShrink: 0
                  }}>
                    <Users size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: isSelected || unread > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.nom_groupe}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: unread > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {lastMsg
                        ? `${lastSender?.id === currentUser.id ? t('chat.youPrefix') + ' : ' : lastSender ? lastSender.prenom + ' : ' : ''}${previewText(lastMsg)}`
                        : t('chat.chefLabel', { name: chef ? chef.prenom : t('chat.designated') })}
                    </div>
                  </div>
                  {unread > 0 && (
                    <span style={{
                      flexShrink: 0,
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Direct Messages Section */}
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', padding: '12px 10px 6px', textTransform: 'uppercase' }}>
              {t('chat.directMessages')}
            </div>

            {orderedDirects.map((m) => {
              const isSelected = activeChannelType === 'direct' && activeChannelId === m.id;
              const unread = unreadDirectCount(m.id);
              const lastMsg = lastChannelMessage('direct', m.id);
              const online = isMemberOnline(presence, m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveChannelType('direct');
                    setActiveChannelId(m.id);
                    setIsMobileConversation(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid var(--border-gold)' : '1px solid transparent',
                    background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: 'var(--text-main)',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginBottom: '2px'
                  }}
                >
<div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                        alt={m.prenom}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff' }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '0',
                        right: '0',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: online ? '#10b981' : '#6b7280',
                        border: '2px solid var(--bg-secondary)'
                      }} title={online ? t('chat.onlineStatus') : t('chat.offlineStatus')} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: isSelected || unread > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.prenom} {m.nom}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: unread > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {lastMsg
                        ? `${lastMsg.sender_id === currentUser.id ? t('chat.youPrefix') + ' : ' : ''}${previewText(lastMsg)}`
                        : (m.role === 'chef' ? t('common.role.chef') : m.role === 'super_chef' ? t('common.role.superChef') : m.role === 'admin' ? t('common.role.admin') : t('common.role.member'))}
                    </div>
                  </div>

                  {unread > 0 && (
                    <span style={{
                      flexShrink: 0,
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              );
            })}

          </div>
        </div>

        {/* RIGHT ACTIVE CHAT CONVERSATION */}
        <div className="chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          
          {/* Channel Header */}
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setIsMobileConversation(false)}
                className="btn btn-ghost chat-back-btn"
                style={{ padding: '6px', flexShrink: 0 }}
                title={t('chat.title')}
              >
                <ArrowLeft size={18} />
              </button>

              {activeChannelType === 'group' ? (
                activeGroup?.photo_url ? (
                  <img
                    src={activeGroup.photo_url}
                    alt={activeGroup.nom_groupe}
                    onClick={openManageGroup}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      objectFit: 'cover',
                      flexShrink: 0,
                      cursor: canManageActiveGroup ? 'pointer' : 'default'
                    }}
                  />
                ) : (
                  <div
                    onClick={openManageGroup}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6',
                      flexShrink: 0,
                      cursor: canManageActiveGroup ? 'pointer' : 'default'
                    }}
                  >
                    <Users size={20} />
                  </div>
                )
              ) : (
                <img
                  src={activePeer?.photo_url || DEFAULT_AVATAR_IMAGE}
                  alt=""
                  onClick={() => activePeer && openMemberProfile(activePeer.id)}
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
                />
              )}

              <div
                onClick={() => activeChannelType === 'direct' && activePeer && openMemberProfile(activePeer.id)}
                style={{ minWidth: 0, flex: 1, overflow: 'hidden', cursor: activeChannelType === 'direct' ? 'pointer' : 'default' }}
              >
                <div style={{ fontSize: '0.98rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeChannelType === 'group' ? activeGroup?.nom_groupe : `${activePeer?.prenom} ${activePeer?.nom}`}
                </div>
                <div style={{
                  fontSize: '0.72rem',
                  color: activeChannelType === 'group' ? 'var(--text-muted)' : isPeerOnline ? '#10b981' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  {typingLabel ? (
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{typingLabel}</span>
                  ) : activeChannelType === 'group' ? (
                    activeGroup?.is_messenger
                      ? t('chat.messengerGroupSubtitle', { count: (activeGroup.membre_ids || []).length })
                      : t('chat.groupSubtitle')
                  ) : (
                    <>
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: isPeerOnline ? '#10b981' : '#6b7280',
                        display: 'inline-block',
                        flexShrink: 0
                      }} />
                      {isPeerOnline ? t('chat.onlineStatus') : t('chat.offlineStatus')}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', flexShrink: 0, gap: '6px' }}>
              {activeChannelType === 'direct' && activePeer && onStartVoiceCall && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={voiceCallBusy}
                  style={{
                    padding: '6px',
                    color: voiceCallBusy ? 'var(--text-dim)' : '#10b981',
                    opacity: voiceCallBusy ? 0.5 : 1
                  }}
                  title={t('calls.start')}
                  aria-label={t('calls.start')}
                  onClick={() => onStartVoiceCall(activePeer.id)}
                >
                  <Phone size={16} />
                </button>
              )}
              {activeChannelType === 'direct' && activePeer && onStartVideoCall && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={voiceCallBusy}
                  style={{
                    padding: '6px',
                    color: voiceCallBusy ? 'var(--text-dim)' : '#0ea5e9',
                    opacity: voiceCallBusy ? 0.5 : 1
                  }}
                  title={t('calls.startVideo')}
                  aria-label={t('calls.startVideo')}
                  onClick={() => onStartVideoCall(activePeer.id)}
                >
                  <Video size={16} />
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding: '6px',
                  color: bubbleEnabled ? 'var(--accent-gold)' : 'var(--text-muted)'
                }}
                title={bubbleEnabled ? t('chat.bubbleDisable') : t('chat.bubbleEnable')}
                aria-label={bubbleEnabled ? t('chat.bubbleDisable') : t('chat.bubbleEnable')}
                onClick={() => { void handleToggleBubble(); }}
              >
                <MessageSquare size={16} />
              </button>
              <span className="badge badge-gold chat-header-badge" style={{ fontSize: '0.65rem' }}>
                {activeChannelType === 'group' && activeGroup?.is_messenger
                  ? t('chat.messengerGroupBadge')
                  : t('chat.groupBadge')}
              </span>
              {canManageActiveGroup && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--text-muted)' }}
                  title={t('chat.manageGroup')}
                  onClick={openManageGroup}
                >
                  <Settings size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div data-image-rev={imageTick} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {channelMessages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
                <div style={{ fontWeight: 600 }}>{t('chat.emptyTitle')}</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                  {t('chat.emptySubtitle')}
                </div>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                const sender = allMembres.find((m) => m.id === msg.sender_id);
                const hasImage = Boolean(msg.image_url || msg.image_ref || (msg.file_type === 'image' && msg.file_url));
                const imageUrl = resolveMessageImage(msg);
                const readByOthers = (msg.read_by || []).filter((id) => id !== currentUser.id).length;
                const isGroupChannel = activeChannelType === 'group';
                const replySender = msg.reply_to_sender_id
                  ? allMembres.find((m) => m.id === msg.reply_to_sender_id)
                  : undefined;
                const replySenderName = msg.reply_to_sender_id === currentUser.id
                  ? t('chat.youPrefix')
                  : replySender
                    ? `${replySender.prenom} ${replySender.nom}`
                    : '';

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: '8px'
                    }}
                  >
                    {!isMe && (
                      <img
                        src={sender?.photo_url || DEFAULT_AVATAR_IMAGE}
                        alt=""
                        onClick={() => sender && openMemberProfile(sender.id)}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', marginBottom: '4px', flexShrink: 0, cursor: 'pointer' }}
                      />
                    )}

                    <div
                      className="chat-bubble"
                      onPointerDown={(event) => {
                        if (event.pointerType === 'mouse' && event.button !== 0) return;
                        startMessageSwipe(msg, event.clientX, event.clientY);
                      }}
                      onPointerMove={(event) => moveMessageSwipe(msg, event.clientX, event.clientY)}
                      onPointerUp={endMessageSwipe}
                      onPointerCancel={endMessageSwipe}
                      onPointerLeave={endMessageSwipe}
                      onClickCapture={(event) => {
                        if (Date.now() - lastSwipeAtRef.current < 400) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      style={{
                        minWidth: '128px',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        borderBottomRightRadius: isMe ? '3px' : '16px',
                        borderBottomLeftRadius: !isMe ? '3px' : '16px',
                        background: isMe
                          ? '#10b981'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: isMe ? '#ffffff' : 'var(--text-main)',
                        fontSize: 'clamp(0.92rem, 2.5vw, 1.02rem)',
                        lineHeight: 1.55,
                        boxShadow: 'var(--shadow-sm)',
                        wordBreak: 'break-word',
                        maxWidth: '86%',
                        marginBottom: '6px',
                        touchAction: 'pan-y',
                        transform: swipeMessageId === msg.id ? `translateX(${swipeOffset}px)` : undefined,
                        transition: swipeMessageId === msg.id ? 'none' : 'transform 0.18s ease',
                        cursor: 'grab'
                      }}
                    >
                      {!isMe && (
                        <div
                          onClick={() => sender && openMemberProfile(sender.id)}
                          style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '4px', cursor: 'pointer' }}
                        >
                          {sender?.prenom} {sender?.nom}
                        </div>
                      )}

                      {!msg.is_deleted && msg.reply_to_text && (
                        <div style={{
                          borderLeft: `3px solid ${isMe ? 'rgba(255, 255, 255, 0.72)' : 'var(--accent-gold)'}`,
                          background: isMe ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.07)',
                          borderRadius: '7px',
                          padding: '6px 9px',
                          marginBottom: '7px',
                          fontSize: '0.78rem',
                          lineHeight: 1.35
                        }}>
                          <div style={{ fontWeight: 700, opacity: 0.9, marginBottom: '2px' }}>
                            {replySenderName || t('chat.replyTo')}
                          </div>
                          <div style={{
                            opacity: 0.82,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {msg.reply_to_text}
                          </div>
                        </div>
                      )}

                      {msg.is_deleted ? (
                        <div style={{ fontStyle: 'italic', opacity: 0.65, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Trash2 size={13} />
                          {t('chat.deletedMessage')}
                        </div>
                      ) : (
                        <>
                          {/* Display image with lightbox zoom */}
                          {hasImage && imageUrl && (
                            <div style={{ position: 'relative', marginBottom: '8px', overflow: 'hidden', borderRadius: '10px' }}>
                              <img
                                src={imageUrl}
                                alt={t('chat.sentImageAlt')}
                                onClick={() => setLightboxImageUrl(imageUrl)}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: '100%',
                                  maxHeight: '320px',
                                  objectFit: 'cover',
                                  borderRadius: '10px',
                                  cursor: 'zoom-in',
                                  display: 'block',
                                  border: isMe ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setLightboxImageUrl(imageUrl)}
                                style={{
                                  position: 'absolute',
                                  bottom: '6px',
                                  right: '6px',
                                  background: 'rgba(0, 0, 0, 0.65)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.68rem'
                                }}
                                title={t('chat.viewFullscreenTitle')}
                              >
                                <Maximize2 size={12} />
                                <span>{t('chat.fullscreen')}</span>
                              </button>
                            </div>
                          )}

                          {/* Image payload still syncing in its dedicated row */}
                          {hasImage && !imageUrl && (
                            <div style={{
                              padding: '10px',
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px dashed var(--border-color)',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              marginBottom: msg.message ? '8px' : '0'
                            }}>
                              📷 {t('chat.unreadPreviewImage')}…
                            </div>
                          )}
                          {msg.message && (
                            <div style={{ whiteSpace: 'pre-wrap', fontWeight: isMe ? 500 : 400 }}>
                              {msg.message}
                            </div>
                          )}
                          {msg.is_edited && (
                            <div style={{ fontSize: '0.64rem', opacity: 0.65, marginTop: '2px' }}>
                              ({t('chat.editedLabel')})
                            </div>
                          )}
                        </>
                      )}

                      {/* Footer time & read checkmark + actions */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '5px',
                        fontSize: '0.66rem',
                        color: isMe ? 'rgba(7, 13, 30, 0.72)' : 'var(--text-dim)',
                        marginTop: '4px'
                      }}>
                        <span>{msg.sent_at ? msg.sent_at.slice(-5) : ''}</span>

                        {isMe && !msg.is_deleted && (
                          isGroupChannel ? (
                            <span
                              title={t('chat.readByCount', { count: readByOthers })}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              <CheckCheck size={13} />
                              {readByOthers > 0 ? t('chat.readByCount', { count: readByOthers }) : t('chat.sentStatus')}
                            </span>
                          ) : (
                            <span
                              title={msg.status === 'read' ? t('chat.readStatus') : t('chat.sentStatus')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              {msg.status === 'read' ? <CheckCheck size={13} /> : <Check size={13} />}
                              <span>{msg.status === 'read' ? t('chat.readByYou') : t('chat.sentStatus')}</span>
                            </span>
                          )
                        )}

                        {isMe && !msg.is_deleted && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            {msg.message && (
                              <button
                                type="button"
                                title={t('chat.editMessageTitle')}
                                onClick={() => {
                                  setEditingMessage(msg);
                                  setEditingText(msg.message || '');
                                }}
                                style={{
                                  background: 'rgba(0,0,0,0.12)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '2px',
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  display: 'inline-flex'
                                }}
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            <button
                              type="button"
                              title={t('chat.deleteMessageTitle')}
                              onClick={() => {
                                if (window.confirm(t('chat.confirmDeleteMessage'))) {
                                  StorageService.deleteMessage(msg.id);
                                  onRefreshMessages();
                                }
                              }}
                              style={{
                                background: 'rgba(0,0,0,0.12)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '2px',
                                cursor: 'pointer',
                                color: 'inherit',
                                display: 'inline-flex'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {typingLabel && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                padding: '2px 4px'
              }}>
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                {typingLabel}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Staged Attachment Preview Banner */}
          {stagedImage && (
            <div style={{
              padding: '10px 18px',
              background: 'rgba(245, 158, 11, 0.12)',
              borderTop: '1px solid var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={stagedImage.dataUrl}
                    alt={t('chat.stagedImageAlt')}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '2px solid var(--accent-gold)'
                    }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t('chat.stagedImageLabel', { name: stagedImage.fileName })}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {t('chat.stagedImageMeta', { size: stagedImage.fileSizeKb })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemoveStagedImage}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%', color: '#ef4444' }}
                title={t('chat.removeImageTitle')}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Processing image indicator */}
          {isProcessingImage && (
            <div style={{
              padding: '8px 18px',
              background: 'rgba(59, 130, 246, 0.1)',
              fontSize: '0.78rem',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="animate-pulse-glow">⏳</span>
              <span>{t('chat.optimizingImage')}</span>
            </div>
          )}

          {/* Aperçu de la réponse en cours */}
          {replyingTo && (
            <div style={{
              padding: '10px 18px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderTop: '1px solid var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ flex: 1, minWidth: 0, borderLeft: '3px solid var(--accent-gold)', paddingLeft: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                  {t('chat.replyingTo', { name: getMessageSenderName(replyingTo) })}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {getMessagePreviewText(replyingTo)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
                title={t('chat.cancelReply')}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Bottom message input form */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              background: 'rgba(0, 0, 0, 0.2)'
            }}
          >
            {/* Hidden file input for images */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageFileChange}
              style={{ display: 'none' }}
              accept="image/*"
            />

            {/* Prominent Image Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-ghost"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: stagedImage ? 'var(--accent-gold)' : 'var(--text-main)',
                border: stagedImage ? '1px solid var(--border-gold)' : '1px solid var(--border-color)'
              }}
              title={t('chat.addImageTitle')}
            >
              <ImageIcon size={18} />
              <span style={{ fontSize: '0.8rem', display: 'none' }} className="image-btn-text">{t('chat.imageButton')}</span>
            </button>

            {/* Input message text */}
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={
                stagedImage 
                  ? t('chat.imageCaptionPlaceholder')
                  : t('chat.messagePlaceholder', { name: activeChannelType === 'group' ? activeGroup?.nom_groupe ?? '' : activePeer?.prenom ?? '' })
              }
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value.trim()) notifyTyping();
              }}
              className="form-input"
              style={{
                flex: 1,
                fontSize: '0.92rem',
                lineHeight: 1.45,
                minHeight: '46px',
                maxHeight: '132px',
                padding: '12px 14px',
                resize: 'none',
                overflowY: 'auto'
              }}
            />

            {/* Like rapide quand le champ est vide, sinon icône d'envoi
                uniquement (style Messenger / Facebook). */}
            {!inputText.trim() && !stagedImage ? (
              <button
                type="button"
                onClick={handleQuickLike}
                className="btn btn-primary"
                disabled={isProcessingImage}
                title={t('chat.quickLike')}
                aria-label={t('chat.quickLike')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ThumbsUp size={18} />
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isProcessingImage}
                title={t('chat.send')}
                aria-label={t('chat.send')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Send size={18} />
              </button>
            )}
          </form>

        </div>

      </div>

      {/* ===== MODALE : MODIFIER UN MESSAGE ===== */}
      {editingMessage && (
        <div
          onClick={() => { setEditingMessage(null); setEditingText(''); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 96,
            background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <form
            onSubmit={(event) => { event.preventDefault(); void handleEditMessage(); }}
            onClick={(event) => event.stopPropagation()}
            className="glass-card"
            style={{ width: 'min(460px, 100%)', padding: '20px', borderRadius: '18px' }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '1.02rem' }}>{t('chat.editMessageTitle')}</h3>
            <textarea
              autoFocus
              value={editingText}
              onChange={(event) => setEditingText(event.target.value)}
              className="form-input"
              rows={3}
              maxLength={2000}
              style={{ resize: 'vertical', minHeight: '90px' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!editingText.trim()}>
                {t('chat.editMessageSave')}
              </button>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setEditingMessage(null); setEditingText(''); }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== MODALE : NOUVEAU GROUPE MESSENGER ===== */}
      {showCreateGroup && (
        <div
          onClick={() => setShowCreateGroup(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 96,
            background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <form
            onSubmit={(event) => { event.preventDefault(); void handleCreateMessengerGroup(); }}
            onClick={(event) => event.stopPropagation()}
            className="glass-card"
            style={{ width: 'min(520px, 100%)', maxHeight: '88dvh', overflowY: 'auto', padding: '20px', borderRadius: '18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('chat.newGroupTitle')}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => setShowCreateGroup(false)} title={t('common.close')}>
                <X size={18} />
              </button>
            </div>

            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('chat.newGroupName')}
            </label>
            <input
              type="text"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="form-input"
              placeholder={t('chat.newGroupNamePlaceholder')}
              maxLength={80}
              style={{ marginTop: '6px', marginBottom: '16px' }}
            />

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
              {t('chat.newGroupMembers')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
              {allMembres
                .filter((m) => m.id !== currentUser.id && m.is_approved !== false && !m.is_blocked)
                .map((m) => {
                  const checked = newGroupMemberIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '10px', cursor: 'pointer',
                        background: checked ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--border-gold)' : 'var(--border-color)'}`
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setNewGroupMemberIds((ids) =>
                          ids.includes(m.id) ? ids.filter((id) => id !== m.id) : [...ids, m.id]
                        )}
                      />
                      <img
                        src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                        alt=""
                        style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: checked ? 700 : 500 }}>
                        {m.prenom} {m.nom}
                      </span>
                    </label>
                  );
                })}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={!newGroupName.trim() || newGroupMemberIds.length === 0}
              >
                <Plus size={16} />
                {t('chat.newGroupCreate')}
              </button>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreateGroup(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== MODALE : GÉRER UN GROUPE MESSENGER ===== */}
      {manageGroupId && (
        <div
          onClick={() => setManageGroupId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 96,
            background: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <form
            onSubmit={(event) => { event.preventDefault(); void handleManageGroup(); }}
            onClick={(event) => event.stopPropagation()}
            className="glass-card"
            style={{ width: 'min(520px, 100%)', maxHeight: '88dvh', overflowY: 'auto', padding: '20px', borderRadius: '18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('chat.manageGroupTitle')}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => setManageGroupId(null)} title={t('common.close')}>
                <X size={18} />
              </button>
            </div>

            {/* Photo du groupe */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{
                position: 'relative',
                width: '72px',
                height: '72px',
                borderRadius: '18px',
                overflow: 'hidden',
                flexShrink: 0,
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6'
              }}>
                {managePhotoUrl ? (
                  <img
                    src={managePhotoUrl}
                    alt={t('chat.groupPhotoAlt')}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Users size={30} />
                )}
                {isProcessingGroupPhoto && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', color: '#fff'
                  }}>
                    …
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{t('chat.groupPhoto')}</div>
                {canManageGroupPhoto ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      ref={groupPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleGroupPhotoChange}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                      onClick={() => groupPhotoInputRef.current?.click()}
                      disabled={isProcessingGroupPhoto}
                    >
                      <ImageIcon size={14} /> {t('chat.changeGroupPhoto')}
                    </button>
                    {managePhotoUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: '0.76rem', color: '#f87171' }}
                        onClick={() => setManagePhotoUrl(undefined)}
                      >
                        <Trash2 size={14} /> {t('chat.removeGroupPhoto')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {t('chat.photoAdminOnly')}
                  </div>
                )}
              </div>
            </div>

            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('chat.newGroupName')}
            </label>
            <input
              type="text"
              value={manageName}
              onChange={(event) => setManageName(event.target.value)}
              className="form-input"
              maxLength={80}
              disabled={!canManageGroupSettings}
              style={{
                marginTop: '6px',
                marginBottom: '16px',
                opacity: canManageGroupSettings ? 1 : 0.7
              }}
            />

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
              {t('chat.newGroupMembers')}
            </div>
            {!canManageGroupMembers && canAddGroupMembers && (
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>
                {t('chat.adminAddOnlyHint')}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
              {allMembres
                .filter((m) => m.is_approved !== false && !m.is_blocked)
                .map((m) => {
                  const isOwner = manageGroup?.chef_id === m.id;
                  const isExisting = Boolean(
                    isOwner ||
                      m.id === currentUser.id ||
                      (manageGroup?.membre_ids || []).includes(m.id)
                  );
                  const checked = manageMemberIds.includes(m.id) || isOwner || m.id === currentUser.id;
                  const locked =
                    isOwner ||
                    m.id === currentUser.id ||
                    (!canManageGroupMembers && (isExisting || !canAddGroupMembers));
                  const isGroupAdmin = !isOwner && checked && manageAdminIds.includes(m.id);
                  const canToggleAdmin = canManageGroupAdmins && checked && !isOwner && !locked;
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '10px',
                        cursor: locked ? 'default' : 'pointer',
                        opacity: locked ? 0.75 : 1,
                        background: checked ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                        border: `1px solid ${checked ? 'var(--border-gold)' : 'var(--border-color)'}`
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => setManageMemberIds((ids) =>
                          ids.includes(m.id) ? ids.filter((id) => id !== m.id) : [...ids, m.id]
                        )}
                      />
                      <img
                        src={m.photo_url || DEFAULT_AVATAR_IMAGE}
                        alt=""
                        style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: checked ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {m.prenom} {m.nom}
                        {isOwner && (
                          <span className="badge badge-gold" style={{ fontSize: '0.6rem' }}>
                            <Crown size={10} /> {t('chat.groupOwner')}
                          </span>
                        )}
                        {isGroupAdmin && (
                          <span className="badge badge-gold" style={{ fontSize: '0.6rem' }}>
                            <ShieldCheck size={10} /> {t('chat.adminBadge')}
                          </span>
                        )}
                      </span>
                      {canToggleAdmin && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          title={isGroupAdmin ? t('chat.removeAdmin') : t('chat.makeAdmin')}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setManageAdminIds((ids) =>
                              ids.includes(m.id)
                                ? ids.filter((id) => id !== m.id)
                                : [...ids, m.id]
                            );
                          }}
                          style={{
                            padding: '4px',
                            color: isGroupAdmin ? 'var(--accent-gold)' : 'var(--text-muted)'
                          }}
                        >
                          <Crown size={16} />
                        </button>
                      )}
                    </label>
                  );
                })}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!manageName.trim()}>
                {t('chat.saveGroup')}
              </button>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setManageGroupId(null)}>
                {t('common.cancel')}
              </button>
            </div>

            {canManageGroupSettings && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ width: '100%', marginTop: '10px', background: '#dc2626', color: '#fff' }}
                onClick={() => {
                  if (!window.confirm(t('chat.confirmDeleteGroup'))) return;
                  StorageService.deleteMessengerGroupe(manageGroupId);
                  setManageGroupId(null);
                  const fallback = visibleGroupes.find((g) => g.id !== manageGroupId);
                  setActiveChannelType(fallback ? 'group' : 'direct');
                  setActiveChannelId(fallback?.id || directFallbackId);
                  if (fallback) setIsMobileConversation(true);
                  else setIsMobileConversation(false);
                  onRefreshGroupes();
                  onRefreshMessages();
                }}
              >
                <Trash2 size={16} />
                {t('chat.deleteGroup')}
              </button>
            )}
          </form>
        </div>
      )}

      {/* LIGHTBOX MODAL FOR FULL SCREEN IMAGE VIEW */}
      {lightboxImageUrl && (
        <div 
          onClick={() => setLightboxImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-45px',
              right: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => downloadMedia(lightboxImageUrl, 'image_chat_groupe.jpg')}
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.78rem', color: '#ffffff' }}
                title={t('chat.downloadImageTitle')}
              >
                <Download size={16} />
                <span>{t('common.download')}</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%', color: '#ffffff' }}
                title={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <img
              src={lightboxImageUrl}
              alt={t('chat.fullImageAlt')}
              style={{
                maxWidth: '90vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        .chat-bubble {
          max-width: min(78%, 640px);
        }
        .chat-back-btn {
          display: none !important;
        }
        @media (max-width: 768px) {
          /* Facebook-style: the conversation uses the whole area between the
             top navbar and the bottom navigation, with no wasted gutters. */
          .chat-container-wrapper {
            height: calc(100dvh - 128px - env(safe-area-inset-bottom, 0px)) !important;
            min-height: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .chat-container-wrapper > .glass-card {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
          }
          .chat-container-wrapper [data-image-rev] {
            padding: 10px 12px !important;
          }
          .chat-bubble {
            max-width: 86% !important;
          }
          .chat-sidebar {
            width: 100% !important;
            border-right: none !important;
          }
          .chat-main {
            display: none !important;
          }
          .chat-container-wrapper.chat-mobile-conversation .chat-sidebar {
            display: none !important;
          }
          .chat-container-wrapper.chat-mobile-conversation .chat-main {
            display: flex !important;
          }
          .chat-container-wrapper.chat-mobile-conversation .chat-back-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Groupe, Membre, Publication, PublicationEvent, Story, ReactionType } from '../types';
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  Image as ImageIcon,
  X,
  Loader2,
  Trash2,
  User,
  Plus,
  Download,
  Clock,
  Eye,
  RefreshCw,
  Type,
  Smile,
  AtSign,
  Move,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Ticket
} from 'lucide-react';
import {
  REACTION_OPTIONS,
  getReactionOption,
  getReactionType,
  getReactionCounts,
  getReactionEntries
} from '../utils/reactions';
import { StorageService } from '../utils/storage';
import { fetchStoryImageIfMissing, fetchPublicationImageIfMissing } from '../utils/supabaseSync';
import { compressImage } from '../utils/imageCompressor';
import { uploadDataUrl, downloadMedia } from '../utils/media';
import { canViewPublication, getVisibleGroupIds, isAdmin, isChef } from '../utils/permissions';
import { openMemberProfile } from '../utils/memberProfileNav';
import { useLanguage } from '../i18n';
import { getPublicShareUrl } from '../lib/appConfig';
import {
  detectPublicationTopics,
  getInterestScore,
  getInterestWeights,
  recordTopicInterest,
  type InterestWeights
} from '../utils/feedRanking';
import {
  BuyTicketModal,
  EventTicketSummary,
  ManageEventTicketsModal
} from '../components/EventTicketModals';

interface PublicationsViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  allGroupes: Groupe[];
  publications: Publication[];
  stories: Story[];
  onRefreshPublications: () => void;
  onRefreshStories: () => void;
}

interface StagedImage {
  dataUrl: string;
  fileName: string;
  fileSizeKb: number;
}

interface StoryGroup {
  auteurId: string;
  stories: Story[];
}

interface StoryViewerState {
  stories: Story[];
  index: number;
}

// Interface pour les éléments ajoutés sur la story
interface StoryOverlay {
  id: string;
  type: 'text' | 'sticker' | 'tag';
  content: string;
  x: number;
  y: number;
  color?: string;
  bgColor?: string;
}

const PAGE_SIZE = 4;
const STORY_DURATION_MS = 5000;
const DWELL_TIME_MS = 10_000;
const STICKERS = ['❤️', '🔥', '😂', '😍', '👏', '🙌', '✨', '🎉', '😎', '🥳'];

const ROLE_TRANSLATION_KEYS: Record<Membre['role'], string> = {
  admin: 'common.role.admin',
  super_chef: 'common.role.superChef',
  chef: 'common.role.chef',
  membre: 'common.role.member'
};

function MemberAvatar({ membre, size }: { membre?: Membre; size: number }) {
  if (membre?.photo_url) {
    return (
      <img
        src={membre.photo_url}
        alt={`${membre.prenom} ${membre.nom}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid var(--border-gold)',
          flexShrink: 0
        }}
      />
    );
  }

  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)',
      color: '#ffffff',
      fontWeight: 800,
      fontSize: `${Math.max(12, size * 0.38)}px`,
      flexShrink: 0
    }}>
      <User size={Math.max(13, Math.round(size * 0.44))} strokeWidth={2.4} />
    </div>
  );
}

function StoryCard({
  membre,
  seen,
  imageUrl,
  label,
  onClick,
  create = false
}: {
  membre?: Membre;
  seen: boolean;
  imageUrl?: string;
  label: string;
  onClick: () => void;
  create?: boolean;
}) {
  const ring = seen
    ? 'linear-gradient(135deg, #4b5563, #6b7280)'
    : 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        width: '108px',
        height: '174px',
        flexShrink: 0,
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        background: '#0b1220',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {create ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, rgba(245, 158, 11, 0.32), rgba(139, 92, 246, 0.28), rgba(7, 13, 30, 1))'
        }} />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          decoding="async"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, rgba(245, 158, 11, 0.5), rgba(139, 92, 246, 0.5))'
        }} />
      )}

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.04) 38%, rgba(0, 0, 0, 0.82) 100%)'
      }} />

      {create ? (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#070d1e',
          border: '2px solid var(--bg-primary)'
        }}>
          <Plus size={22} />
        </div>
      ) : (
        <div style={{
          position: 'absolute',
          top: '9px',
          left: '9px',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          padding: '2px',
          background: ring,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)'
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#0b1220' }}>
            <MemberAvatar membre={membre} size={38} />
          </div>
        </div>
      )}

      <span style={{
        position: 'absolute',
        left: '9px',
        right: '9px',
        bottom: '9px',
        color: '#ffffff',
        fontSize: '0.72rem',
        fontWeight: 700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textShadow: '0 1px 4px rgba(0, 0, 0, 0.85)'
      }}>
        {label}
      </span>
    </button>
  );
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export const PublicationsView: React.FC<PublicationsViewProps> = ({
  currentUser,
  allMembres,
  allGroupes,
  publications,
  stories: propsStories,
  onRefreshPublications,
  onRefreshStories
}) => {
  const { t, language } = useLanguage();

  // État local pour l'affichage instantané des stories
  const [localStories, setLocalStories] = useState<Story[]>(propsStories);
  // Pictures of stories are stored in their own synced rows, so they are
  // resolved here and shared by the story cards and the viewer.
  const [storyImages, setStoryImages] = useState<Record<string, string>>({});
  // Same scheme for publications: metadata in PUBLICATIONS, picture in its
  // own synced row, resolved here so it appears on every device.
  const [publicationImages, setPublicationImages] = useState<Record<string, string>>({});
  useEffect(() => {
    setLocalStories(prev => {
      const newLocalStories = prev.filter(
        localStory => !propsStories.some(propStory => propStory.id === localStory.id)
      );
      return [...newLocalStories, ...propsStories];
    });
  }, [propsStories]);

  const composerGroupes = getVisibleGroupIds(currentUser, allGroupes)
    .map((id) => allGroupes.find((g) => g.id === id))
    .filter((g): g is Groupe => Boolean(g));
  const [composerOpen, setComposerOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [audience, setAudience] = useState<'all' | 'group'>('all');
  const [targetGroupeId, setTargetGroupeId] = useState(composerGroupes[0]?.id || '');
  const [stagedImage, setStagedImage] = useState<StagedImage | null>(null);
  const canManageTickets = isAdmin(currentUser) || isChef(currentUser);
  const [eventMode, setEventMode] = useState(false);
  const [eventNom, setEventNom] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLieu, setEventLieu] = useState('');
  const [eventPrix, setEventPrix] = useState('');
  const [eventMobileMoney, setEventMobileMoney] = useState('');
  const [buyTicketFor, setBuyTicketFor] = useState<Publication | null>(null);
  const [manageTicketsFor, setManageTicketsFor] = useState<Publication | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [openCommentIds, setOpenCommentIds] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTargetByPublication, setReplyTargetByPublication] = useState<Record<string, string | null>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  // Reactions Facebook-style : menu long-press sur le bouton J'aime + liste
  // des membres qui ont reagi a une publication.
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [reactorsModal, setReactorsModal] = useState<{
    title: string;
    entries: Array<{ membre?: Membre; type: ReactionType }>;
  } | null>(null);

  // Stories States
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyImage, setStoryImage] = useState<StagedImage | null>(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [storyOverlays, setStoryOverlays] = useState<StoryOverlay[]>([]);
  const [, setIsCompressingStory] = useState(false);
  const [isPublishingStory, setIsPublishingStory] = useState(false);
  const [storyViewer, setStoryViewer] = useState<StoryViewerState | null>(null);
  const [storyReplyDraft, setStoryReplyDraft] = useState('');
  const [storyReplyFocused, setStoryReplyFocused] = useState(false);
  const [storyManuallyPaused, setStoryManuallyPaused] = useState(false);
  // Auto-advance is paused manually or while the member writes a reply.
  const isStoryPaused = storyManuallyPaused || storyReplyFocused || storyReplyDraft.trim().length > 0;
  const storyTimerRemainingRef = useRef(STORY_DURATION_MS);
  const storyTimerStartedAtRef = useRef<number | null>(null);
  const storyTimerStoryIdRef = useRef<string | null>(null);

  // Story Studio States
  const [activeTool, setActiveTool] = useState<'none' | 'text' | 'sticker' | 'tag'>('none');
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBgColor, setTextBgColor] = useState('#8b5cf6');
  const [tagSearch, setTagSearch] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const storyCanvasRef = useRef<HTMLDivElement>(null);

  // Fil d'actualité : compteur de nouveautés (style Facebook)
  const [feedSeenUpTo, setFeedSeenUpTo] = useState<number>(() =>
    publications.reduce(
      (max, publication) => Math.max(max, new Date(publication.created_at).getTime()),
      0
    )
  );
  const feedInitRef = useRef(feedSeenUpTo > 0);

  const [interestWeights, setInterestWeights] = useState<InterestWeights>(
    () => getInterestWeights(currentUser.id)
  );
  const dwellTimersRef = useRef<Map<string, number>>(new Map());
  const dwellRecordedRef = useRef<Set<string>>(new Set());
  const pendingInterestResortRef = useRef(false);
  const pendingWeightsRef = useRef<InterestWeights | null>(null);

  useEffect(() => {
    setInterestWeights(getInterestWeights(currentUser.id));
  }, [currentUser.id]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const storiesSectionRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const formatRelativeDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return t('publications.relative.now');
    if (diff < 3_600_000) return t('publications.relative.minutes', { count: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('publications.relative.hours', { count: Math.floor(diff / 3_600_000) });
    if (diff < 604_800_000) return t('publications.relative.days', { count: Math.floor(diff / 86_400_000) });

    const locale = language === 'en' ? 'en-GB' : language === 'mg' ? 'mg-MG' : 'fr-FR';
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCount = (count: number, base: 'likes' | 'comments' | 'shares'): string =>
    t(`publications.stats.${base}.${count > 1 ? 'plural' : 'single'}`, { count });

  const permittedPublications = useMemo(
    () => publications.filter((publication) => canViewPublication(currentUser, publication, allGroupes)),
    [publications, currentUser, allGroupes]
  );

  const newestPublicationTime = useMemo(
    () => permittedPublications.reduce(
      (max, publication) => Math.max(max, new Date(publication.created_at).getTime()),
      0
    ),
    [permittedPublications]
  );

  useEffect(() => {
    if (feedInitRef.current) return;
    if (newestPublicationTime <= 0) return;
    feedInitRef.current = true;
    setFeedSeenUpTo(newestPublicationTime);
  }, [newestPublicationTime]);

  const newPostsCount = useMemo(
    () => permittedPublications.filter(
      (publication) =>
        publication.auteur_id !== currentUser.id &&
        new Date(publication.created_at).getTime() > feedSeenUpTo
    ).length,
    [permittedPublications, currentUser.id, feedSeenUpTo]
  );

  const sortedPublications = useMemo(() => {
    const now = Date.now();
    const feedInitialized = feedInitRef.current || feedSeenUpTo > 0;
    const score = (publication: Publication): number => {
      const ageHours = Math.max(0, (now - new Date(publication.created_at).getTime()) / 3_600_000);
      const engagement =
        publication.liked_by.length * 2 +
        publication.commentaires.length * 3 +
        publication.partages * 4;
      const interestBoost = getInterestScore(publication, interestWeights) * 6;
      const groupBoost =
        publication.groupe_id && publication.groupe_id === currentUser.groupe_id ? 3 : 1;
      return ((engagement + 1 + interestBoost) * groupBoost) / Math.pow(ageHours + 2, 1.25);
    };
    return permittedPublications
      .filter((publication) =>
        !feedInitialized ||
        publication.auteur_id === currentUser.id ||
        new Date(publication.created_at).getTime() <= feedSeenUpTo
      )
      .slice()
      .sort((a, b) => {
        const diff = score(b) - score(a);
        if (Math.abs(diff) > 1e-9) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [permittedPublications, currentUser, interestWeights, feedSeenUpTo]);

  // Filtre des stories actives
  const activeStories = useMemo(
    () => localStories
      .filter((story) => {
        if (!story.expires_at) return true;
        const exp = new Date(story.expires_at).getTime();
        return isNaN(exp) || exp > Date.now();
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [localStories]
  );

  const ownStories = useMemo(
    () => activeStories.filter((story) => story.auteur_id === currentUser.id),
    [activeStories, currentUser.id]
  );

  useEffect(() => {
    const resolveImages = async () => {
      const refs = Array.from(new Set(
        localStories.map((story) => story.image_ref).filter((ref): ref is string => Boolean(ref))
      ));
      // Parallel fetches: one slow picture never blocks the others.
      await Promise.all(refs.map(async (ref) => {
        if (storyImages[ref]) return;
        const local = StorageService.getStoryImage(ref);
        if (local) {
          setStoryImages((prev) => (prev[ref] ? prev : { ...prev, [ref]: local }));
          return;
        }
        const remote = await fetchStoryImageIfMissing(ref);
        if (remote) {
          setStoryImages((prev) => (prev[ref] ? prev : { ...prev, [ref]: remote }));
        }
      }));
    };
    void resolveImages();
  }, [localStories, storyImages]);

  const getStoryImageSrc = useCallback((story?: Story): string | undefined => {
    if (!story) return undefined;
    if (story.image_ref && storyImages[story.image_ref]) return storyImages[story.image_ref];
    // A realtime image-row event can land before the next state map update:
    // read the freshly stored copy directly so the picture never waits.
    if (story.image_ref) {
      const stored = StorageService.getStoryImage(story.image_ref);
      if (stored) return stored;
    }
    if (story.image_url) return story.image_url;
    return undefined;
  }, [storyImages]);

  useEffect(() => {
    const resolveImages = async () => {
      // Only the posts currently rendered are resolved: downloading pictures
      // of older posts in advance competes with the visible ones on mobile
      // data and makes the feed feel much slower.
      const refs = Array.from(new Set(
        sortedPublications
          .slice(0, visibleCount)
          .map((publication) => publication.image_ref)
          .filter((ref): ref is string => Boolean(ref))
      ));
      // Parallel fetches: one slow picture never blocks the others.
      await Promise.all(refs.map(async (ref) => {
        if (publicationImages[ref]) return;
        const local = StorageService.getPublicationImage(ref);
        if (local) {
          setPublicationImages((prev) => (prev[ref] ? prev : { ...prev, [ref]: local }));
          return;
        }
        const remote = await fetchPublicationImageIfMissing(ref);
        if (remote) {
          setPublicationImages((prev) => (prev[ref] ? prev : { ...prev, [ref]: remote }));
        }
      }));
    };
    void resolveImages();
  }, [sortedPublications, visibleCount, publicationImages]);

  const getPublicationImageSrc = (publication: Publication): string | undefined => {
    if (publication.image_ref && publicationImages[publication.image_ref]) {
      return publicationImages[publication.image_ref];
    }
    if (publication.image_ref) {
      const stored = StorageService.getPublicationImage(publication.image_ref);
      if (stored) return stored;
    }
    if (publication.image_url) return publication.image_url;
    if (publication.image_ref) return publicationImages[publication.image_ref];
    return undefined;
  };

  const orderedStoryGroups = useMemo<StoryGroup[]>(() => {
    const map = new Map<string, Story[]>();
    activeStories.forEach((story) => {
      if (story.auteur_id === currentUser.id) return;
      const list = map.get(story.auteur_id) || [];
      list.push(story);
      map.set(story.auteur_id, list);
    });
    return [...map.entries()]
      .map(([auteurId, list]) => ({ auteurId, stories: list }))
      .sort((a, b) => {
        const aUnseen = a.stories.some((story) => !story.seen_by.includes(currentUser.id)) ? 1 : 0;
        const bUnseen = b.stories.some((story) => !story.seen_by.includes(currentUser.id)) ? 1 : 0;
        if (aUnseen !== bUnseen) return bUnseen - aUnseen;
        const aLast = new Date(a.stories[a.stories.length - 1]?.created_at || 0).getTime();
        const bLast = new Date(b.stories[b.stories.length - 1]?.created_at || 0).getTime();
        return bLast - aLast;
      });
  }, [activeStories, currentUser.id]);

  // Une seule liste continue : on passe naturellement d'un membre au suivant
  // quand une story se termine (comme sur Facebook / Instagram).
  const storySequence = useMemo<Story[]>(
    () => [
      ...ownStories,
      ...orderedStoryGroups.flatMap((group) => group.stories)
    ],
    [ownStories, orderedStoryGroups]
  );

  const visiblePublications = sortedPublications.slice(0, visibleCount);
  const visibleIds = useMemo(
    () => visiblePublications.map((publication) => publication.id).join('|'),
    [visiblePublications]
  );

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= sortedPublications.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, sortedPublications.length));
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, sortedPublications.length]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ids = visibleIds ? visibleIds.split('|') : [];
    if (ids.length === 0) return;

    const timers = dwellTimersRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (!element.id.startsWith('publication-')) return;
          const publicationId = element.id.slice('publication-'.length);

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (dwellRecordedRef.current.has(publicationId) || timers.has(publicationId)) return;
            const publication = publications.find((item) => item.id === publicationId);
            if (!publication || publication.auteur_id === currentUser.id) return;
            const timer = window.setTimeout(() => {
              timers.delete(publicationId);
              const topics = detectPublicationTopics(publication);
              if (topics.length === 0) return;
              dwellRecordedRef.current.add(publicationId);
              pendingWeightsRef.current = recordTopicInterest(currentUser.id, topics);
              pendingInterestResortRef.current = true;
            }, DWELL_TIME_MS);
            timers.set(publicationId, timer);
          } else {
            const timer = timers.get(publicationId);
            if (timer !== undefined) {
              window.clearTimeout(timer);
              timers.delete(publicationId);
            }
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );

    ids.forEach((publicationId) => {
      const element = document.getElementById(`publication-${publicationId}`);
      if (element) observer.observe(element);
    });

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [visibleIds, publications, currentUser.id]);

  useEffect(() => {
    const handleScroll = () => {
      if (!pendingInterestResortRef.current) return;
      pendingInterestResortRef.current = false;
      if (pendingWeightsRef.current) {
        setInterestWeights(pendingWeightsRef.current);
        pendingWeightsRef.current = null;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getAuthor = (id: string) => allMembres.find((membre) => membre.id === id);

  const showTemporaryMessage = (message: string) => {
    setShareMessage(message);
    window.setTimeout(() => setShareMessage(null), 2800);
  };

  const openPreview = (src: string) => {
    setPreviewLoading(true);
    setPreviewImage(src);
  };

  useEffect(() => {
    if (!previewImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewImage]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('publications.errors.selectImage'));
      event.target.value = '';
      return;
    }

    setIsCompressing(true);
    try {
      // Keep uploads light: the picture is sent as base64 in a synced row and
      // a smaller JPEG reaches other phones in seconds instead of minutes.
      const dataUrl = await compressImage(file, 900, 900, 0.7);
      setStagedImage({
        dataUrl,
        fileName: file.name,
        fileSizeKb: Math.round((dataUrl.length * 0.75) / 1024)
      });
    } catch {
      alert(t('publications.errors.prepareImage'));
    } finally {
      setIsCompressing(false);
      event.target.value = '';
    }
  };

  const handleStoryImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('publications.errors.selectImage'));
      event.target.value = '';
      return;
    }

    setIsCompressingStory(true);
    try {
      const dataUrl = await compressImage(file, 720, 1280, 0.65);
      setStoryImage({
        dataUrl,
        fileName: file.name,
        fileSizeKb: Math.round((dataUrl.length * 0.75) / 1024)
      });
    } catch {
      alert(t('publications.errors.prepareImage'));
    } finally {
      setIsCompressingStory(false);
      event.target.value = '';
    }
  };

  // --- LOGIQUE OVERLAYS ---
  const addOverlay = (type: 'text' | 'sticker' | 'tag', content: string, extra?: { color?: string, bgColor?: string }) => {
    if (!content.trim()) return;
    const newOverlay: StoryOverlay = {
      id: `ov-${Date.now()}`,
      type,
      content,
      x: 50,
      y: 50,
      color: extra?.color || '#ffffff',
      bgColor: extra?.bgColor || (type === 'text' ? 'rgba(0,0,0,0.5)' : 'transparent'),
    };
    setStoryOverlays([...storyOverlays, newOverlay]);
    setTextInput('');
    setTagSearch('');
    setActiveTool('none');
  };

  const removeOverlay = (id: string) => setStoryOverlays(storyOverlays.filter(o => o.id !== id));

  // --- DRAG & DROP ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    setActiveDragId(id);
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const rect = storyCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const ov = storyOverlays.find(o => o.id === id);
    if (!ov) return;

    const startPctX = ov.x;
    const startPctY = ov.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const newPctX = startPctX + (dx / rect.width) * 100;
      const newPctY = startPctY + (dy / rect.height) * 100;

      setStoryOverlays(prev => prev.map(o =>
        o.id === id ? { ...o, x: Math.max(5, Math.min(95, newPctX)), y: Math.max(5, Math.min(95, newPctY)) } : o
      ));
    };

    const handlePointerUp = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      // On garde activeDragId pour la corbeille
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
  };

  const closeStoryComposer = () => {
    setStoryComposerOpen(false);
    setStoryImage(null);
    setStoryCaption('');
    setStoryOverlays([]);
    setActiveTool('none');
    setActiveDragId(null);
  };

  // --- PUBLIER UNE STORY (MISE À JOUR) ---
  const handlePublishStory = (event?: React.MouseEvent | React.FormEvent) => {
    if (event) event.preventDefault();
    if (!storyImage) return;

    setIsPublishingStory(true);
    try {
      const localDataUrl = storyImage.dataUrl;
      const captionData = JSON.stringify({ text: storyCaption, overlays: storyOverlays });

      // Publish immediately with the local/base64 row: the story is visible at
      // once and leaves for other devices without waiting for the storage
      // upload. The upload then swaps the row for a fast CDN URL.
      const savedStory = StorageService.addStory(
        currentUser.id,
        localDataUrl,
        captionData,
        localDataUrl
      );
      if (savedStory.image_ref) {
        setStoryImages((prev) => ({ ...prev, [savedStory.image_ref!]: localDataUrl }));
      }

      setLocalStories(prev => [savedStory, ...prev.filter(s => s.id !== savedStory.id)]);
      setStoryViewer({ stories: [savedStory], index: 0 });
      closeStoryComposer();
      onRefreshStories();
      storiesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showTemporaryMessage(t('publications.success.published'));

      if (savedStory.image_ref) {
        const imageRef = savedStory.image_ref;
        void uploadDataUrl(localDataUrl, 'image').then((url) => {
          if (url) StorageService.replaceStoryImage(imageRef, url);
        }).catch(() => { /* the synced base64 row already carries the picture */ });
      }
    } catch (error) {
      console.error(error);
      alert(t('publications.stories.error'));
    } finally {
      setIsPublishingStory(false);
    }
  };

  const openStoryGroup = (groupStories: Story[]) => {
    if (!groupStories.length) return;
    const startIndex = storySequence.findIndex((story) => story.id === groupStories[0].id);
    setStoryViewer({
      stories: storySequence.length ? storySequence : groupStories,
      index: startIndex >= 0 ? startIndex : 0
    });
  };

  const closeStoryViewer = () => setStoryViewer(null);

  const storyNext = () => {
    setStoryViewer((viewer) => {
      if (!viewer) return viewer;
      if (viewer.index + 1 < viewer.stories.length) {
        return { ...viewer, index: viewer.index + 1 };
      }
      return null;
    });
  };

  const storyPrev = () => {
    setStoryViewer((viewer) => {
      if (!viewer) return viewer;
      if (viewer.index > 0) {
        return { ...viewer, index: viewer.index - 1 };
      }
      return viewer;
    });
  };

  const handleDeleteStory = (storyId: string) => {
    if (!window.confirm(t('publications.confirmDelete'))) return;
    StorageService.deleteStory(storyId);
    setLocalStories(prev => prev.filter(s => s.id !== storyId));
    setStoryViewer((viewer) => {
      if (!viewer) return viewer;
      const remaining = viewer.stories.filter((story) => story.id !== storyId);
      if (!remaining.length) return null;
      return { stories: remaining, index: Math.min(viewer.index, remaining.length - 1) };
    });
    onRefreshStories();
  };

  const replaceLocalStory = (updated: Story) => {
    setLocalStories((prev) => {
      if (!prev.some((story) => story.id === updated.id)) return prev;
      return prev.map((story) => (story.id === updated.id ? updated : story));
    });
  };

  const handleStoryReaction = (storyId: string, reaction: ReactionType) => {
    const updated = StorageService.toggleStoryReaction(storyId, currentUser.id, reaction);
    if (updated) replaceLocalStory(updated);
    onRefreshStories();
  };

  const handleSendStoryReply = (event: React.FormEvent, story: Story) => {
    event.preventDefault();
    const texte = storyReplyDraft.trim();
    if (!texte) return;

    const reply = StorageService.addStoryReply(story.id, currentUser.id, texte);
    if (reply) {
      const updated = StorageService.getStories().find((item) => item.id === story.id);
      if (updated) replaceLocalStory(updated);
    }
    // Comme sur Facebook, la reponse part aussi en message prive a l'auteur.
    if (story.auteur_id !== currentUser.id) {
      StorageService.sendMessage(
        currentUser.id,
        t('publications.stories.replyMessage', { text: texte }),
        story.auteur_id
      );
    }
    setStoryReplyDraft('');
    setStoryReplyFocused(false);
    onRefreshStories();
    showTemporaryMessage(t('publications.stories.replySent'));
  };

  useEffect(() => {
    setStoryReplyDraft('');
    setStoryReplyFocused(false);
  }, [storyViewer?.index, storyViewer?.stories]);

  useEffect(() => {
    if (!storyViewer) return;
    const next = storyViewer.stories[storyViewer.index + 1];
    const nextImage = getStoryImageSrc(next);
    if (nextImage) {
      const image = new window.Image();
      image.src = nextImage;
    }
  }, [storyViewer, storyImages, getStoryImageSrc]);

  useEffect(() => {
    if (!storyViewer) {
      storyTimerStoryIdRef.current = null;
      storyTimerRemainingRef.current = STORY_DURATION_MS;
      storyTimerStartedAtRef.current = null;
      setStoryManuallyPaused(false);
      return;
    }
    const current = storyViewer.stories[storyViewer.index];
    if (!current) return;
    if (!current.seen_by.includes(currentUser.id)) {
      StorageService.markStorySeen(current.id, currentUser.id);
    }

    // Reset the countdown when a different story becomes active.
    if (storyTimerStoryIdRef.current !== current.id) {
      storyTimerStoryIdRef.current = current.id;
      storyTimerRemainingRef.current = STORY_DURATION_MS;
      storyTimerStartedAtRef.current = null;
    }

    if (isStoryPaused) {
      // Freeze the remaining time while the reply field is being used.
      if (storyTimerStartedAtRef.current !== null) {
        const elapsed = Date.now() - storyTimerStartedAtRef.current;
        storyTimerRemainingRef.current = Math.max(0, storyTimerRemainingRef.current - elapsed);
        storyTimerStartedAtRef.current = null;
      }
      return;
    }

    const remaining = Math.max(1, storyTimerRemainingRef.current);
    storyTimerStartedAtRef.current = Date.now();
    const timer = window.setTimeout(storyNext, remaining);
    return () => {
      window.clearTimeout(timer);
      if (storyTimerStartedAtRef.current !== null) {
        const elapsed = Date.now() - storyTimerStartedAtRef.current;
        storyTimerRemainingRef.current = Math.max(0, storyTimerRemainingRef.current - elapsed);
        storyTimerStartedAtRef.current = null;
      }
    };
  }, [storyViewer, currentUser.id, isStoryPaused]);

  const handlePublish = (event: React.FormEvent) => {
    event.preventDefault();
    const content = newContent.trim();
    if (!content && !stagedImage && !eventMode) return;

    let eventPayload: PublicationEvent | undefined;
    if (eventMode) {
      const prix = Math.max(0, Number(eventPrix) || 0);
      if (!eventNom.trim() || !eventDate.trim() || !eventLieu.trim() || !eventMobileMoney.trim() || prix <= 0) {
        showTemporaryMessage(t('publications.event.priceRequired'));
        return;
      }
      eventPayload = {
        nom: eventNom.trim(),
        date: eventDate.trim(),
        lieu: eventLieu.trim(),
        prix_billet: Math.round(prix),
        numero_mobile_money: eventMobileMoney.trim()
      };
    }

    setIsPublishing(true);
    try {
      const publicationAudience = audience === 'group' && targetGroupeId ? 'group' : 'all';
      const localDataUrl = stagedImage?.dataUrl;
      // Same as stories: show the post at once with its synced base64 row and
      // upload in the background, then swap in the CDN URL.
      const savedPublication = StorageService.createPublication(
        currentUser.id,
        content || eventPayload?.nom || '',
        localDataUrl,
        publicationAudience,
        targetGroupeId || undefined,
        localDataUrl,
        eventPayload
      );
      if (savedPublication.image_ref && localDataUrl) {
        setPublicationImages((prev) => ({
          ...prev,
          [savedPublication.image_ref as string]: localDataUrl
        }));
      }
      setNewContent('');
      setStagedImage(null);
      setEventMode(false);
      setEventNom('');
      setEventDate('');
      setEventLieu('');
      setEventPrix('');
      setEventMobileMoney('');
      setComposerOpen(false);
      setVisibleCount((count) => Math.max(count, PAGE_SIZE));
      onRefreshPublications();
      showTemporaryMessage(t('publications.success.published'));

      if (savedPublication.image_ref && localDataUrl) {
        const imageRef = savedPublication.image_ref;
        void uploadDataUrl(localDataUrl, 'image').then((url) => {
          if (url) StorageService.replacePublicationImage(imageRef, url);
        }).catch(() => { /* the synced base64 row already carries the picture */ });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleLike = (publicationId: string) => {
    StorageService.togglePublicationLike(publicationId, currentUser.id);
    onRefreshPublications();
  };

  const handlePublicationReaction = (publicationId: string, reaction: ReactionType) => {
    StorageService.togglePublicationReaction(publicationId, currentUser.id, reaction);
    setReactionMenuId(null);
    onRefreshPublications();
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startReactionLongPress = (publicationId: string) => {
    cancelLongPress();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setReactionMenuId(publicationId);
    }, 450);
  };

  const handleLikeButtonClick = (event: React.MouseEvent, publicationId: string) => {
    if (longPressTriggeredRef.current) {
      // The click follows the long-press release: keep the reaction menu open.
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }
    setReactionMenuId(null);
    handleToggleLike(publicationId);
  };

  const openReactorsModal = (publication: Publication) => {
    const entries = getReactionEntries(publication.liked_by, publication.reactions)
      .map((entry) => ({ membre: getAuthor(entry.membreId), type: entry.type }));
    setReactorsModal({
      title: t('publications.reactions.title'),
      entries
    });
  };

  useEffect(() => {
    if (!reactionMenuId) return;
    const closeMenu = () => setReactionMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [reactionMenuId]);

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
  }, []);

  const handleToggleComments = (publicationId: string) => {
    setOpenCommentIds((ids) => ids.includes(publicationId)
      ? ids.filter((id) => id !== publicationId)
      : [...ids, publicationId]
    );
  };

  const handleAddComment = (event: React.FormEvent, publicationId: string) => {
    event.preventDefault();
    const draft = (commentDrafts[publicationId] || '').trim();
    if (!draft) return;

    StorageService.addPublicationComment(publicationId, currentUser.id, draft);
    setCommentDrafts((drafts) => ({ ...drafts, [publicationId]: '' }));
    onRefreshPublications();
  };

  const handleAddReply = (event: React.FormEvent, publicationId: string, parentCommentId: string) => {
    event.preventDefault();
    const draft = (replyDrafts[parentCommentId] || '').trim();
    if (!draft) return;

    StorageService.addPublicationComment(publicationId, currentUser.id, draft, parentCommentId);
    setReplyDrafts((drafts) => ({ ...drafts, [parentCommentId]: '' }));
    setReplyTargetByPublication((targets) => ({ ...targets, [publicationId]: null }));
    onRefreshPublications();
  };

  const handleDeletePublication = (publication: Publication) => {
    if (!window.confirm(t('publications.confirmDelete'))) return;

    StorageService.deletePublication(publication.id);
    setOpenCommentIds((ids) => ids.filter((id) => id !== publication.id));
    setCommentDrafts((drafts) => {
      const next = { ...drafts };
      delete next[publication.id];
      return next;
    });
    onRefreshPublications();
    showTemporaryMessage(t('publications.success.deleted'));
  };

  const handleShare = async (publication: Publication) => {
    const author = getAuthor(publication.auteur_id);
    const authorName = author ? `${author.prenom} ${author.nom}` : t('publications.share.memberFallback');
    const text = t('publications.share.text', { author: authorName, content: publication.contenu }).trim();
    const url = getPublicShareUrl(`/#publication-${publication.id}`);

    try {
      if (navigator.share) {
        await navigator.share({ title: t('publications.share.title'), text, url });
      } else {
        await copyText(`${text}\n${url}`);
        showTemporaryMessage(t('publications.share.linkCopied'));
      }

      StorageService.incrementPublicationShares(publication.id);
      onRefreshPublications();
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      try {
        await copyText(`${text}\n${url}`);
        StorageService.incrementPublicationShares(publication.id);
        onRefreshPublications();
        showTemporaryMessage(t('publications.share.linkCopied'));
      } catch {
        alert(t('publications.errors.shareFailed'));
      }
    }
  };

  // Helper pour lire les overlays
  const parseStoryCaption = (story: Story): { text: string, overlays: StoryOverlay[] } => {
    try {
      if (story.caption?.startsWith('{')) {
        const parsed = JSON.parse(story.caption);
        return { text: parsed.text || '', overlays: parsed.overlays || [] };
      }
    } catch { /* ignore */ }
    return { text: story.caption || '', overlays: [] };
  };

  return (
    <div className="animate-fade-in publications-feed" style={{ padding: '24px 16px 40px', maxWidth: '760px', margin: '0 auto' }}>

      <div ref={storiesSectionRef} className="glass-card" style={{ padding: '14px 12px', marginBottom: '18px', scrollMarginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {t('publications.stories.title')}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {t('publications.stories.expires')}
          </span>
        </div>

        <div className="stories-strip" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', scrollSnapType: 'x proximity' }}>
          <StoryCard
            create
            seen={false}
            label={t('publications.stories.create')}
            onClick={() => setStoryComposerOpen(true)}
          />

          {ownStories.length > 0 && (
            <StoryCard
              membre={currentUser}
              seen={false}
              imageUrl={getStoryImageSrc(ownStories[ownStories.length - 1])}
              label={t('publications.stories.yourStory')}
              onClick={() => openStoryGroup(ownStories)}
            />
          )}

          {orderedStoryGroups.map((group) => {
            const author = getAuthor(group.auteurId);
            const seen = group.stories.every((story) => story.seen_by.includes(currentUser.id));
            return (
              <StoryCard
                key={group.auteurId}
                membre={author}
                seen={seen}
                imageUrl={getStoryImageSrc(group.stories[group.stories.length - 1])}
                label={author ? author.prenom : t('common.member')}
                onClick={() => openStoryGroup(group.stories)}
              />
            );
          })}

          {ownStories.length === 0 && orderedStoryGroups.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0 8px' }}>
              {t('publications.stories.empty')}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '14px 16px',
          marginBottom: '22px',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-main)',
          fontFamily: 'inherit'
        }}
      >
        <MemberAvatar membre={currentUser} size={44} />
        <span style={{
          flex: 1,
          minWidth: 0,
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid var(--border-color)',
          borderRadius: '999px',
          padding: '11px 16px',
          color: 'var(--text-muted)',
          fontSize: '0.88rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {t('publications.composer.placeholder', { name: currentUser.prenom })}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem', fontWeight: 700, flexShrink: 0 }}>
          <ImageIcon size={20} />
          <span className="composer-photo-label">{t('publications.composer.photo')}</span>
        </span>
      </button>

      {newPostsCount > 0 && (
        <div style={{
          position: 'sticky',
          top: '74px',
          zIndex: 20,
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '14px'
        }}>
          <button
            type="button"
            onClick={() => {
              setFeedSeenUpTo(Math.max(Date.now(), newestPublicationTime));
              setVisibleCount(PAGE_SIZE);
              onRefreshPublications();
              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            }}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '9px 16px', borderRadius: '999px', boxShadow: 'var(--shadow-lg)' }}
          >
            <RefreshCw size={15} />
            <span>
              {newPostsCount > 1
                ? t('publications.newPosts.many', { count: newPostsCount })
                : t('publications.newPosts.one')} · {t('publications.newPosts.refresh')}
            </span>
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {visiblePublications.map((publication) => {
          const author = getAuthor(publication.auteur_id);
          const myReaction = getReactionType(publication.reactions, publication.liked_by, currentUser.id);
          const isLiked = Boolean(myReaction);
          const myReactionOption = getReactionOption(myReaction);
          const reactionSummary = getReactionCounts(publication.liked_by, publication.reactions);
          const activeReactionOptions = REACTION_OPTIONS.filter((option) => reactionSummary.counts[option.type] > 0);
          const commentsOpen = openCommentIds.includes(publication.id);
          const likeCount = reactionSummary.total;
          const commentCount = publication.commentaires.length;
          const canDelete = publication.auteur_id === currentUser.id || isAdmin(currentUser);
          const imageSrc = getPublicationImageSrc(publication);

          return (
            <article
              key={publication.id}
              id={`publication-${publication.id}`}
              className="glass-card publication-post"
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => author && openMemberProfile(author.id)}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: author ? 'pointer' : 'default', flexShrink: 0 }}
                  title={author ? t('profile.viewProfile') : undefined}
                >
                  <MemberAvatar membre={author} size={46} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong
                      onClick={() => author && openMemberProfile(author.id)}
                      style={{ fontSize: '0.94rem', cursor: author ? 'pointer' : 'default' }}
                    >
                      {author ? `${author.prenom} ${author.nom}` : t('publications.deletedMember')}
                    </strong>
                    {author && (
                      <span className="badge badge-purple" style={{ fontSize: '0.62rem', padding: '2px 7px' }}>
                        {t(ROLE_TRANSLATION_KEYS[author.role])}
                      </span>
                    )}
                    {publication.event && (
                      <span className="badge badge-gold" style={{ fontSize: '0.62rem', padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Ticket size={11} />
                        {t('publications.event.badge')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                    {formatRelativeDate(publication.created_at)} ·{' '}
                    {publication.audience === 'group' && publication.groupe_id
                      ? t('publications.audience.groupPost', {
                        group: allGroupes.find((g) => g.id === publication.groupe_id)?.nom_groupe || ''
                      })
                      : t('publications.publicPost')}
                  </div>
                </div>
                {publication.auteur_id === currentUser.id && (
                  <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '3px 8px' }}>
                    {t('publications.you')}
                  </span>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeletePublication(publication)}
                    className="btn btn-ghost"
                    style={{ padding: '7px', color: '#ef4444' }}
                    title={t('publications.deleteTitle')}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>

              {publication.contenu && (
                <div style={{
                  padding: '0 18px 16px',
                  fontSize: '0.92rem',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {publication.contenu}
                </div>
              )}

              {publication.event && (
                <>
                  <EventTicketSummary publication={publication} />
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    padding: '0 18px 16px'
                  }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1, minWidth: '150px', padding: '10px' }}
                      onClick={() => setBuyTicketFor(publication)}
                      disabled={publication.event.prix_billet <= 0 || !publication.event.numero_mobile_money}
                    >
                      <Ticket size={16} />
                      <span>{t('publications.event.buyTicket')}</span>
                    </button>
                    {canManageTickets && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '10px 14px' }}
                        onClick={() => setManageTicketsFor(publication)}
                      >
                        <Ticket size={16} style={{ color: '#f59e0b' }} />
                        <span>{t('publications.event.manageTickets')}</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {imageSrc && (
                <button
                  type="button"
                  onClick={() => openPreview(imageSrc)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: '#050a16',
                    cursor: 'zoom-in',
                    maxHeight: 'min(72dvh, 640px)',
                    overflow: 'hidden'
                  }}
                  title={t('publications.image.enlarge')}
                >
                  <img
                    src={imageSrc}
                    alt={t('publications.image.alt')}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                </button>
              )}

              {!imageSrc && publication.image_ref && (
                <div style={{
                  width: '100%',
                  minHeight: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-muted)',
                  fontSize: '0.82rem'
                }}>
                  <Loader2 size={26} className="animate-pulse-glow" />
                  <span>{t('publications.image.loading')}</span>
                </div>
              )}

              {(likeCount > 0 || commentCount > 0 || publication.partages > 0) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                  padding: '10px 18px',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  {likeCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => openReactorsModal(publication)}
                      title={t('publications.reactions.seeWho')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--text-muted)',
                        font: 'inherit',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                        {activeReactionOptions.map((option) => (
                          <span key={option.type} style={{ fontSize: '0.95rem', lineHeight: 1 }}>{option.emoji}</span>
                        ))}
                      </span>
                      <span>{formatCount(likeCount, 'likes')}</span>
                    </button>
                  ) : <span> </span>}
                  <span>
                    {commentCount > 0 ? formatCount(commentCount, 'comments') : ''}
                    {commentCount > 0 && publication.partages > 0 ? ' · ' : ''}
                    {publication.partages > 0 ? formatCount(publication.partages, 'shares') : ''}
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  {reactionMenuId === publication.id && (
                    <div
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 9px',
                        borderRadius: '999px',
                        background: 'var(--bg-secondary, #1f2937)',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-lg)'
                      }}
                    >
                      {REACTION_OPTIONS.map((option) => (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => handlePublicationReaction(publication.id, option.type)}
                          title={t(option.labelKey)}
                          aria-label={t(option.labelKey)}
                          style={{
                            fontSize: '1.35rem',
                            lineHeight: 1,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            transform: myReaction === option.type ? 'scale(1.22)' : 'scale(1)',
                            transition: 'transform 0.12s ease'
                          }}
                        >
                          {option.emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(event) => handleLikeButtonClick(event, publication.id)}
                    onPointerDown={() => startReactionLongPress(publication.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={(event) => event.preventDefault()}
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: myReactionOption?.color || 'var(--text-muted)',
                      fontSize: '0.82rem',
                      padding: '8px 6px'
                    }}
                  >
                    {myReactionOption ? (
                      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{myReactionOption.emoji}</span>
                    ) : (
                      <Heart size={18} style={{ fill: isLiked ? '#ef4444' : 'none' }} />
                    )}
                    <span>{myReactionOption ? t(myReactionOption.labelKey) : t('publications.action.like')}</span>
                    {likeCount > 0 && <span style={{ fontSize: '0.72rem' }}>({likeCount})</span>}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleComments(publication.id)}
                  className="btn btn-ghost"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: commentsOpen ? 'var(--accent-gold)' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    padding: '8px 6px'
                  }}
                >
                  <MessageCircle size={18} />
                  <span>{t('publications.action.comment')}</span>
                  {commentCount > 0 && <span style={{ fontSize: '0.72rem' }}>({commentCount})</span>}
                </button>

                <button
                  type="button"
                  onClick={() => handleShare(publication)}
                  className="btn btn-ghost"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    padding: '8px 6px'
                  }}
                >
                  <Share2 size={18} />
                  <span>{t('common.share')}</span>
                  {publication.partages > 0 && <span style={{ fontSize: '0.72rem' }}>({publication.partages})</span>}
                </button>
              </div>

              {commentsOpen && (
                <div style={{
                  padding: '14px 18px 18px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'rgba(0, 0, 0, 0.12)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                    {commentCount === 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {t('publications.comments.empty')}
                      </div>
                    )}

                    {publication.commentaires
                      .filter((comment) => !comment.parent_comment_id || !publication.commentaires.some((c) => c.id === comment.parent_comment_id))
                      .map((comment) => {
                        const commentAuthor = getAuthor(comment.auteur_id);
                        const replies = publication.commentaires.filter((c) => c.parent_comment_id === comment.id);
                        const replyTarget = replyTargetByPublication[publication.id];
                        return (
                          <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                              <button
                                type="button"
                                onClick={() => commentAuthor && openMemberProfile(commentAuthor.id)}
                                style={{ border: 'none', background: 'none', padding: 0, cursor: commentAuthor ? 'pointer' : 'default', flexShrink: 0 }}
                                title={commentAuthor ? t('profile.viewProfile') : undefined}
                              >
                                <MemberAvatar membre={commentAuthor} size={34} />
                              </button>
                              <div style={{
                                flex: 1,
                                minWidth: 0,
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '10px 12px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <strong
                                    onClick={() => commentAuthor && openMemberProfile(commentAuthor.id)}
                                    style={{ fontSize: '0.8rem', cursor: commentAuthor ? 'pointer' : 'default' }}
                                  >
                                    {commentAuthor ? `${commentAuthor.prenom} ${commentAuthor.nom}` : t('common.member')}
                                  </strong>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                    {formatRelativeDate(comment.created_at)}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.84rem', marginTop: '3px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {comment.contenu}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setReplyTargetByPublication((targets) => ({ ...targets, [publication.id]: replyTarget === comment.id ? null : comment.id }))}
                                  className="btn btn-ghost"
                                  style={{ marginTop: '6px', padding: '2px 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                                >
                                  {t('publications.comments.reply')}
                                </button>
                              </div>
                            </div>

                            {replies.length > 0 && (
                              <div style={{ marginLeft: '44px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px solid var(--border-color)', paddingLeft: '10px' }}>
                                {replies.map((reply) => {
                                  const replyAuthor = getAuthor(reply.auteur_id);
                                  return (
                                    <div key={reply.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                      <MemberAvatar membre={replyAuthor} size={28} />
                                      <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                          <strong style={{ fontSize: '0.76rem' }}>{replyAuthor ? `${replyAuthor.prenom} ${replyAuthor.nom}` : t('common.member')}</strong>
                                          <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)' }}>{formatRelativeDate(reply.created_at)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.82rem', marginTop: '2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{reply.contenu}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {replyTarget === comment.id && (
                              <form onSubmit={(event) => handleAddReply(event, publication.id, comment.id)} style={{ marginLeft: '44px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MemberAvatar membre={currentUser} size={28} />
                                <input
                                  type="text"
                                  value={replyDrafts[comment.id] || ''}
                                  onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: event.target.value }))}
                                  className="form-input"
                                  placeholder={t('publications.comments.replyPlaceholder')}
                                  maxLength={500}
                                  autoFocus
                                />
                                <button type="submit" className="btn btn-primary" disabled={!(replyDrafts[comment.id] || '').trim()} style={{ padding: '8px 10px' }} title={t('publications.comments.send')}>
                                  <Send size={14} />
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => setReplyTargetByPublication((targets) => ({ ...targets, [publication.id]: null }))} style={{ padding: '8px' }} title={t('common.cancel')}>
                                  <X size={14} />
                                </button>
                              </form>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  <form
                    onSubmit={(event) => handleAddComment(event, publication.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <MemberAvatar membre={currentUser} size={34} />
                    <input
                      type="text"
                      value={commentDrafts[publication.id] || ''}
                      onChange={(event) => setCommentDrafts((drafts) => ({
                        ...drafts,
                        [publication.id]: event.target.value
                      }))}
                      className="form-input"
                      placeholder={t('publications.comments.placeholder')}
                      maxLength={500}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!(commentDrafts[publication.id] || '').trim()}
                      style={{ padding: '10px 12px' }}
                      title={t('publications.comments.send')}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}

        {sortedPublications.length === 0 && (
          <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <MessageCircle size={38} style={{ color: 'var(--text-dim)', marginBottom: '10px' }} />
            <h3 style={{ margin: 0 }}>{t('publications.empty.title')}</h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('publications.empty.description')}
            </p>
          </div>
        )}

        {visibleCount < sortedPublications.length && (
          <div ref={loadMoreRef} style={{ textAlign: 'center', padding: '20px' }}>
            <button
              type="button"
              onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, sortedPublications.length))}
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem' }}
            >
              <Loader2 size={16} className="animate-pulse-glow" />
              <span>{t('publications.loadMore')}</span>
            </button>
          </div>
        )}
      </div>

      {composerOpen && (
        <div
          onClick={() => setComposerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 93,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <form
            onSubmit={handlePublish}
            onClick={(event) => event.stopPropagation()}
            className="glass-card"
            style={{
              width: 'min(560px, 100%)',
              maxHeight: '92dvh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '18px',
              overflow: 'hidden',
              padding: 0
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('publications.composer.title')}</h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="btn btn-ghost"
                style={{ padding: '6px' }}
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: '16px 20px',
              overflowY: 'auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MemberAvatar membre={currentUser} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                    {currentUser.prenom} {currentUser.nom}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {audience === 'group' && targetGroupeId
                      ? composerGroupes.find((g) => g.id === targetGroupeId)?.nom_groupe || t('publications.audience.group')
                      : t('publications.audience.all')}
                  </div>
                </div>
              </div>

              <textarea
                value={newContent}
                onChange={(event) => setNewContent(event.target.value)}
                className="form-input"
                rows={5}
                maxLength={3000}
                placeholder={t('publications.composer.placeholder', { name: currentUser.prenom })}
                style={{ resize: 'vertical', minHeight: '120px' }}
              />

              {stagedImage && (
                <div style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  background: '#050a16'
                }}>
                  <img
                    src={stagedImage.dataUrl}
                    alt={stagedImage.fileName}
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => setStagedImage(null)}
                    className="btn btn-ghost"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '6px',
                      borderRadius: '50%',
                      background: 'rgba(7, 13, 30, 0.8)',
                      color: '#ffffff'
                    }}
                    title={t('publications.composer.removeImage')}
                  >
                    <X size={16} />
                  </button>
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(7, 13, 30, 0.85)'
                  }}>
                    {t('publications.composer.fileInfo', { name: stagedImage.fileName, size: stagedImage.fileSizeKb })}
                  </div>
                </div>
              )}

              {composerGroupes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {t('publications.audience.label')}
                  </span>
                  <select
                    value={audience}
                    onChange={(event) => setAudience(event.target.value as 'all' | 'group')}
                    className="form-select"
                    style={{ width: 'auto', fontSize: '0.8rem', padding: '7px 10px' }}
                  >
                    <option value="all">{t('publications.audience.all')}</option>
                    <option value="group">{t('publications.audience.group')}</option>
                  </select>
                  {audience === 'group' && composerGroupes.length > 1 && (
                    <select
                      value={targetGroupeId}
                      onChange={(event) => setTargetGroupeId(event.target.value)}
                      className="form-select"
                      style={{ width: 'auto', fontSize: '0.8rem', padding: '7px 10px' }}
                    >
                      {composerGroupes.map((g) => (
                        <option key={g.id} value={g.id}>{g.nom_groupe}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {canManageTickets && (
                <div style={{
                  border: '1px dashed var(--border-gold)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  background: eventMode ? 'rgba(245, 158, 11, 0.08)' : 'transparent'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={eventMode}
                      onChange={(checkboxEvent) => setEventMode(checkboxEvent.target.checked)}
                    />
                    <Ticket size={15} style={{ color: '#f59e0b' }} />
                    <span>{t('publications.event.specialToggle')}</span>
                  </label>

                  {eventMode && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '8px'
                    }}>
                      <input
                        type="text"
                        className="form-input"
                        value={eventNom}
                        onChange={(inputEvent) => setEventNom(inputEvent.target.value)}
                        placeholder={t('publications.event.nom')}
                        maxLength={80}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={eventDate}
                        onChange={(inputEvent) => setEventDate(inputEvent.target.value)}
                        placeholder={`${t('publications.event.date')} (2026-12-31 19:00)`}
                        maxLength={40}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={eventLieu}
                        onChange={(inputEvent) => setEventLieu(inputEvent.target.value)}
                        placeholder={t('publications.event.lieu')}
                        maxLength={120}
                      />
                      <input
                        type="number"
                        min={0}
                        className="form-input"
                        value={eventPrix}
                        onChange={(inputEvent) => setEventPrix(inputEvent.target.value)}
                        placeholder={`${t('publications.event.prix')} (Ar)`}
                      />
                      <input
                        type="tel"
                        className="form-input"
                        value={eventMobileMoney}
                        onChange={(inputEvent) => setEventMobileMoney(inputEvent.target.value)}
                        placeholder={t('publications.event.mobileMoney')}
                        maxLength={30}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                  disabled={isCompressing}
                >
                  {isCompressing ? <Loader2 size={16} className="animate-pulse-glow" /> : <ImageIcon size={16} style={{ color: '#10b981' }} />}
                  <span>{isCompressing ? t('publications.composer.compressing') : t('publications.composer.addImage')}</span>
                </button>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {newContent.length}/3000
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPublishing || isCompressing || (!newContent.trim() && !stagedImage && !eventMode)}
                style={{ opacity: isPublishing || isCompressing || (!newContent.trim() && !stagedImage && !eventMode) ? 0.55 : 1 }}
              >
                {isPublishing ? <Loader2 size={16} className="animate-pulse-glow" /> : <Send size={16} />}
                <span>{t('common.publish')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {buyTicketFor && (
        <BuyTicketModal
          publication={buyTicketFor}
          currentUser={currentUser}
          onClose={() => setBuyTicketFor(null)}
          onSubmitted={onRefreshPublications}
        />
      )}

      {manageTicketsFor && (
        <ManageEventTicketsModal
          publication={manageTicketsFor}
          currentUser={currentUser}
          allMembres={allMembres}
          onClose={() => setManageTicketsFor(null)}
          onRefresh={onRefreshPublications}
        />
      )}

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="publication-lightbox"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: '#000000',
            cursor: 'zoom-out',
            overflow: 'hidden'
          }}
        >
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            right: '10px',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                downloadMedia(previewImage, 'publication.jpg');
              }}
              className="btn btn-ghost"
              style={{
                color: '#ffffff',
                padding: '10px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.14)',
                backdropFilter: 'blur(8px)'
              }}
              title={t('publications.image.download')}
            >
              <Download size={20} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPreviewImage(null);
              }}
              className="btn btn-ghost"
              style={{
                color: '#ffffff',
                padding: '10px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.14)',
                backdropFilter: 'blur(8px)'
              }}
              title={t('common.close')}
            >
              <X size={22} />
            </button>
          </div>

          {previewLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#e5e7eb',
              fontSize: '0.82rem',
              pointerEvents: 'none'
            }}>
              <Loader2 size={30} className="animate-pulse-glow" />
              <span>{t('publications.image.loading')}</span>
            </div>
          )}

          <img
            src={previewImage}
            alt={t('publications.image.previewAlt')}
            onClick={(event) => event.stopPropagation()}
            onLoad={() => setPreviewLoading(false)}
            onError={() => setPreviewLoading(false)}
            decoding="async"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: previewLoading ? 0 : 1,
              transition: 'opacity 0.18s ease'
            }}
          />
        </div>
      )}

      {/* ===== CRÉATION D'UNE STORY (STUDIO COMPLET) ===== */}
      {storyComposerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', color: '#fff', zIndex: 1000, position: 'relative' }}>
            <button type="button" onClick={closeStoryComposer} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            <span style={{ fontWeight: 'bold' }}>Créer une story</span>
            <button
              type="button"
              onClick={() => handlePublishStory()}
              disabled={!storyImage || isPublishingStory}
              style={{ background: 'none', border: 'none', color: (!storyImage || isPublishingStory) ? '#555' : '#10b981', fontWeight: 'bold', cursor: (!storyImage || isPublishingStory) ? 'not-allowed' : 'pointer' }}
            >
              {isPublishingStory ? 'Publication...' : 'Publier'}
            </button>
          </div>

          <div
            ref={storyCanvasRef}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setActiveDragId(null); }}
            style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            {storyImage ? (
              <>
                <img src={storyImage.dataUrl} alt="Story" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} />

                {storyOverlays.map(ov => (
                  <div key={ov.id}
                    onPointerDown={(e) => handlePointerDown(e, ov.id)}
                    style={{
                      position: 'absolute', top: `${ov.y}%`, left: `${ov.x}%`, transform: 'translate(-50%, -50%)',
                      color: ov.color, backgroundColor: ov.bgColor, padding: ov.type === 'text' ? '8px 16px' : '0',
                      borderRadius: '8px', fontSize: ov.type === 'text' ? '1.5rem' : '3rem', fontWeight: 'bold',
                      cursor: activeDragId === ov.id ? 'grabbing' : 'grab', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      touchAction: 'none', userSelect: 'none',
                      border: activeDragId === ov.id ? '2px dashed #fff' : '2px solid transparent',
                      zIndex: activeDragId === ov.id ? 50 : 1
                    }}
                  >
                    {ov.type === 'tag' ? (
                      <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fff' }}>
                        <AtSign size={16} /> {ov.content}
                      </div>
                    ) : ov.content}

                    {/* Bouton supprimer flottant */}
                    {activeDragId === ov.id && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeOverlay(ov.id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '-50px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#ef4444',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #fff',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                          cursor: 'pointer',
                          zIndex: 100
                        }}
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <button type="button" onClick={() => storyFileInputRef.current?.click()} style={{ width: '80%', height: '50%', border: '2px dashed #555', borderRadius: '16px', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer' }}>
                <ImageIcon size={48} />
                <span style={{ marginTop: '16px' }}>Sélectionner une image</span>
              </button>
            )}
            <input ref={storyFileInputRef} type="file" accept="image/*" onChange={handleStoryImageChange} style={{ display: 'none' }} />
          </div>

          {storyImage && (
            <div style={{ padding: '16px', background: '#111', color: '#fff', zIndex: 100, position: 'relative' }}>
              <div style={{ marginBottom: '8px', fontSize: '0.7rem', color: '#aaa', textAlign: 'center' }}>
                <Move size={12} style={{ display: 'inline', marginRight: '4px' }} /> Touchez et glissez pour déplacer
              </div>

              {activeTool === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Votre texte..." style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#222', color: '#fff' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} title="Couleur texte" style={{ width: '40px', height: '40px', border: 'none', background: 'transparent' }} />
                    <input type="color" value={textBgColor} onChange={e => setTextBgColor(e.target.value)} title="Couleur fond" style={{ width: '40px', height: '40px', border: 'none', background: 'transparent' }} />
                    <button type="button" onClick={() => addOverlay('text', textInput, { color: textColor, bgColor: textBgColor })} style={{ background: '#3b82f6', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', color: '#fff', flex: 1, border: 'none', cursor: 'pointer' }}>Ajouter</button>
                    <button type="button" onClick={() => setActiveTool('none')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                  </div>
                </div>
              )}

              {activeTool === 'sticker' && (
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
                  {STICKERS.map(s => <button type="button" key={s} onClick={() => addOverlay('sticker', s)} style={{ fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer' }}>{s}</button>)}
                  <button type="button" onClick={() => setActiveTool('none')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                </div>
              )}

              {activeTool === 'tag' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <input type="text" value={tagSearch} onChange={e => setTagSearch(e.target.value)} placeholder="Chercher un membre..." style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#222', color: '#fff' }} />
                  <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                    {allMembres.filter(m => m.id !== currentUser.id && (m.prenom.toLowerCase().includes(tagSearch.toLowerCase()) || m.nom.toLowerCase().includes(tagSearch.toLowerCase()))).map(m => (
                      <button type="button" key={m.id} onClick={() => addOverlay('tag', `${m.prenom} ${m.nom}`)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#222', width: '100%', color: '#fff', border: 'none', borderBottom: '1px solid #333', cursor: 'pointer' }}>
                        <MemberAvatar membre={m} size={24} /> <span>{m.prenom} {m.nom}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setActiveTool('none')} style={{ color: '#ef4444', alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer' }}>Annuler</button>
                </div>
              )}

              {activeTool === 'none' && (
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                  <button type="button" onClick={() => setActiveTool('text')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Type size={24} /><span style={{ fontSize: '0.7rem' }}>Texte</span></button>
                  <button type="button" onClick={() => setActiveTool('sticker')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Smile size={24} /><span style={{ fontSize: '0.7rem' }}>Sticker</span></button>
                  <button type="button" onClick={() => setActiveTool('tag')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><AtSign size={24} /><span style={{ fontSize: '0.7rem' }}>Identifier</span></button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== VISIONNEUSE DE STORIES ===== */}
      {storyViewer && (() => {
        const viewerStory = storyViewer.stories[storyViewer.index];
        if (!viewerStory) return null;
        // Read the freshest copy so a reaction/reply updates immediately
        // without resetting the auto-advance timer.
        const currentStory = localStories.find((story) => story.id === viewerStory.id) || viewerStory;
        const author = getAuthor(currentStory.auteur_id);
        const isOwn = currentStory.auteur_id === currentUser.id;
        const myStoryReaction = getReactionType(currentStory.reactions, [], currentUser.id);
        const storyReactions = getReactionCounts([], currentStory.reactions);
        const replyCount = currentStory.replies?.length || 0;
        const { text, overlays } = parseStoryCaption(currentStory);
        // Segments de progression du membre affiché (et non de toute la
        // séquence) : la lecture continue quand on passe au membre suivant.
        const authorStories = storyViewer.stories.filter(
          (story) => story.auteur_id === currentStory.auteur_id
        );
        const authorStoryIndex = authorStories.findIndex(
          (story) => story.id === currentStory.id
        );

        return (
          <div
            onClick={closeStoryViewer}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 95,
              background: 'rgba(0, 0, 0, 0.96)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="story-viewer-frame"
            >
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                right: '10px',
                display: 'flex',
                gap: '4px',
                zIndex: 2
              }}>
                {authorStories.map((story, index) => (
                  <div
                    key={story.id}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '2px',
                      background: 'rgba(255, 255, 255, 0.35)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      key={index === authorStoryIndex ? `${story.id}-active` : story.id}
                      className={index === authorStoryIndex ? 'story-progress-fill' : ''}
                      style={{
                        height: '100%',
                        width: index < authorStoryIndex ? '100%' : index === authorStoryIndex ? undefined : '0%',
                        background: '#ffffff',
                        animationPlayState: index === authorStoryIndex && isStoryPaused ? 'paused' : 'running'
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{
                position: 'absolute',
                top: '22px',
                left: '12px',
                right: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 2
              }}>
                <div
                  onClick={(event) => {
                    if (!author) return;
                    event.stopPropagation();
                    openMemberProfile(author.id);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: author ? 'pointer' : 'default' }}
                >
                  <MemberAvatar membre={author} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {author ? `${author.prenom} ${author.nom}` : t('common.member')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.75)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {formatRelativeDate(currentStory.created_at)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setStoryManuallyPaused((paused) => !paused);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: '#ffffff' }}
                  title={storyManuallyPaused ? t('common.play') : t('common.pause')}
                  aria-label={storyManuallyPaused ? t('common.play') : t('common.pause')}
                >
                  {storyManuallyPaused ? <Play size={18} /> : <Pause size={18} />}
                </button>
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStory(currentStory.id)}
                    className="btn btn-ghost"
                    style={{ padding: '6px', color: '#f87171' }}
                    title={t('publications.stories.delete')}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeStoryViewer}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: '#ffffff' }}
                  title={t('common.close')}
                >
                  <X size={20} />
                </button>
              </div>

              <img
                src={getStoryImageSrc(currentStory) || ''}
                alt={t('publications.image.alt')}
                onClick={(event) => {
                  event.stopPropagation();
                  // While writing, a tap closes the keyboard instead of
                  // skipping the story by accident.
                  if (storyReplyDraft.trim()) {
                    setStoryReplyFocused(false);
                    return;
                  }
                  storyNext();
                }}
                title={t('common.next')}
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: 'block', cursor: 'pointer' }}
              />

              {/* Rendu des Overlays */}
              {overlays.map(ov => (
                <div key={ov.id} style={{
                  position: 'absolute', top: `${ov.y}%`, left: `${ov.x}%`, transform: 'translate(-50%, -50%)',
                  color: ov.color, backgroundColor: ov.bgColor, padding: ov.type === 'text' ? '8px 16px' : '0',
                  borderRadius: '8px', fontSize: ov.type === 'text' ? '1.5rem' : '3rem', fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)', pointerEvents: 'none'
                }}>
                  {ov.type === 'tag' ? (
                    <div style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fff' }}>
                      <AtSign size={16} /> {ov.content}
                    </div>
                  ) : ov.content}
                </div>
              ))}

              {text && (
                <div style={{
                  position: 'absolute',
                  bottom: '158px',
                  left: '14px',
                  right: '14px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  textShadow: '0 1px 6px rgba(0, 0, 0, 0.9)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textAlign: 'center'
                }}>
                  {text}
                </div>
              )}

              {/* Zones tactiles larges, comme sur Facebook */}
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); storyPrev(); }}
                aria-label={t('common.previous')}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '34%', background: 'transparent', border: 'none', cursor: 'pointer' }}
              />
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); storyNext(); }}
                aria-label={t('common.next')}
                style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '34%', background: 'transparent', border: 'none', cursor: 'pointer' }}
              />

              {/* Fleches precedent / suivant visibles */}
              {storyViewer.index > 0 && (
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); storyPrev(); }}
                  aria-label={t('common.previous')}
                  title={t('common.previous')}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '8px',
                    transform: 'translateY(-50%)',
                    zIndex: 3,
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.45)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {storyViewer.index < storyViewer.stories.length - 1 && (
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); storyNext(); }}
                  aria-label={t('common.next')}
                  title={t('common.next')}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '8px',
                    transform: 'translateY(-50%)',
                    zIndex: 3,
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.45)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <ChevronRight size={22} />
                </button>
              )}

              <div style={{
                position: 'absolute',
                bottom: '124px',
                right: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: '0.72rem',
                zIndex: 2
              }}>
                <Eye size={13} /> {t('publications.stories.viewers', { count: currentStory.seen_by.length })}
                {replyCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <MessageCircle size={12} /> {t('publications.stories.replies', { count: replyCount })}
                  </span>
                )}
              </div>

              {/* Reactions sur la story, comme sur Facebook */}
              <div style={{
                position: 'absolute',
                bottom: '72px',
                left: 0,
                right: 0,
                zIndex: 3,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 9px',
                    borderRadius: '999px',
                    background: 'rgba(15, 23, 42, 0.62)',
                    backdropFilter: 'blur(8px)',
                    pointerEvents: 'auto'
                  }}
                >
                  {REACTION_OPTIONS.map((option) => {
                    const active = myStoryReaction === option.type;
                    const count = storyReactions.counts[option.type];
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => handleStoryReaction(currentStory.id, option.type)}
                        title={t(option.labelKey)}
                        aria-label={t(option.labelKey)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: active ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
                          border: 'none',
                          borderRadius: '999px',
                          padding: '4px 7px',
                          color: '#ffffff',
                          cursor: 'pointer',
                          transform: active ? 'scale(1.1)' : 'scale(1)',
                          transition: 'transform 0.12s ease'
                        }}
                      >
                        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{option.emoji}</span>
                        {count > 0 && <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reponse a la story : enregistree et envoyee en message prive */}
              <form
                onSubmit={(event) => handleSendStoryReply(event, currentStory)}
                onClick={(event) => event.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  left: '12px',
                  right: '12px',
                  zIndex: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <MemberAvatar membre={currentUser} size={34} />
                <input
                  type="text"
                  value={storyReplyDraft}
                  onChange={(event) => setStoryReplyDraft(event.target.value)}
                  onFocus={() => setStoryReplyFocused(true)}
                  onBlur={() => setStoryReplyFocused(false)}
                  placeholder={t('publications.stories.replyPlaceholder')}
                  maxLength={500}
                  className="form-input"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.14)',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    color: '#ffffff'
                  }}
                />
                <button
                  type="submit"
                  disabled={!storyReplyDraft.trim()}
                  title={t('publications.stories.replySend')}
                  style={{
                    width: '40px',
                    height: '40px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: 'none',
                    background: storyReplyDraft.trim() ? '#10b981' : 'rgba(255, 255, 255, 0.18)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: storyReplyDraft.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Send size={17} />
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* LISTE DES MEMBRES QUI ONT REAGI */}
      {reactorsModal && (
        <div
          onClick={() => setReactorsModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 96,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="glass-card"
            style={{
              width: 'min(420px, 100%)',
              maxHeight: '80dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '16px 18px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{reactorsModal.title}</h3>
              <button
                type="button"
                onClick={() => setReactorsModal(null)}
                className="btn btn-ghost"
                style={{ padding: '6px' }}
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '8px 10px 14px' }}>
              {reactorsModal.entries.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('publications.reactions.empty')}
                </div>
              )}
              {reactorsModal.entries.map(({ membre, type }) => {
                const option = getReactionOption(type);
                return (
                  <button
                    key={`${membre?.id || 'unknown'}-${type}`}
                    type="button"
                    onClick={() => {
                      if (membre) {
                        setReactorsModal(null);
                        openMemberProfile(membre.id);
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: membre ? 'pointer' : 'default',
                      textAlign: 'left'
                    }}
                  >
                    <MemberAvatar membre={membre} size={38} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', fontWeight: 600 }}>
                      {membre ? `${membre.prenom} ${membre.nom}` : t('publications.deletedMember')}
                    </span>
                    <span title={option ? t(option.labelKey) : undefined} style={{ fontSize: '1.2rem', lineHeight: 1 }}>
                      {option?.emoji || '\u{1F44D}'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes storyProgress { from { width: 0%; } to { width: 100%; } }
        .story-progress-fill { animation: storyProgress ${STORY_DURATION_MS}ms linear forwards; }
        .stories-strip { scrollbar-width: thin; }
        .stories-strip::-webkit-scrollbar { height: 4px; }
        .stories-strip > * { scroll-snap-align: start; }
        .story-viewer-frame {
          position: relative;
          width: min(440px, 100vw);
          height: min(92dvh, 860px);
          border-radius: 14px;
          overflow: hidden;
          background: #000;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 600px) {
          .story-viewer-frame { width: 100vw; height: 100dvh; border-radius: 0; }
        }
        @media (max-width: 480px) {
          .composer-photo-label { display: none; }
        }
      `}</style>

      {shareMessage && (
        <div style={{
          position: 'fixed',
          bottom: '86px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.82rem',
          fontWeight: 700,
          boxShadow: 'var(--shadow-lg)',
          whiteSpace: 'nowrap'
        }}>
          {shareMessage}
        </div>
      )}
    </div>
  );
};
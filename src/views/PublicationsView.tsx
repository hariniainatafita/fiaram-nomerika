import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Groupe, Membre, Publication, Story } from '../types';
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
  RefreshCw
} from 'lucide-react';
import { StorageService } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { uploadDataUrl, downloadMedia } from '../utils/media';
import { canViewPublication, getVisibleGroupIds, isAdmin } from '../utils/permissions';
import { useLanguage } from '../i18n';

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

const PAGE_SIZE = 4;
const STORY_DURATION_MS = 5000;

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

function StoryRing({ membre, seen }: { membre?: Membre; seen: boolean }) {
  const ring = seen
    ? 'linear-gradient(135deg, #4b5563, #6b7280)'
    : 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)';
  return (
    <div style={{
      width: '64px',
      height: '64px',
      borderRadius: '50%',
      padding: '2px',
      background: ring,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <MemberAvatar membre={membre} size={56} />
    </div>
  );
}

const storyTileStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  width: '78px',
  padding: 0
};

const storyLabelStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--text-muted)',
  maxWidth: '78px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600
};

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
  stories,
  onRefreshPublications,
  onRefreshStories
}) => {
  const { t, language } = useLanguage();
  const composerGroupes = getVisibleGroupIds(currentUser, allGroupes)
    .map((id) => allGroupes.find((g) => g.id === id))
    .filter((g): g is Groupe => Boolean(g));
  const [newContent, setNewContent] = useState('');
  const [audience, setAudience] = useState<'all' | 'group'>('all');
  const [targetGroupeId, setTargetGroupeId] = useState(composerGroupes[0]?.id || '');
  const [stagedImage, setStagedImage] = useState<StagedImage | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [openCommentIds, setOpenCommentIds] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  // Stories
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyImage, setStoryImage] = useState<StagedImage | null>(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [isCompressingStory, setIsCompressingStory] = useState(false);
  const [isPublishingStory, setIsPublishingStory] = useState(false);
  const [storyViewer, setStoryViewer] = useState<StoryViewerState | null>(null);

  // Fil d'actualité : compteur de nouveautés (style Facebook)
  const [feedSeenUpTo, setFeedSeenUpTo] = useState<number>(() =>
    publications.reduce(
      (max, publication) => Math.max(max, new Date(publication.created_at).getTime()),
      0
    )
  );
  const feedInitRef = useRef(feedSeenUpTo > 0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
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

  // Fil d'actualité « à la Facebook » : les publications qui suscitent de
  // l'engagement (j'aime, commentaires, partages) remontent, avec une prime à
  // la fraîcheur. Une publication qui reçoit un j'aime remonte donc aussitôt
  // dans le fil, au lieu de rester bloquée tout en bas.
  const sortedPublications = useMemo(() => {
    const now = Date.now();
    const score = (publication: Publication): number => {
      const ageHours = Math.max(0, (now - new Date(publication.created_at).getTime()) / 3_600_000);
      const engagement =
        publication.liked_by.length * 2 +
        publication.commentaires.length * 3 +
        publication.partages * 4;
      return (engagement + 1) / Math.pow(ageHours + 2, 1.25);
    };
    return publications
      .filter((publication) => canViewPublication(currentUser, publication, allGroupes))
      .slice()
      .sort((a, b) => {
        const diff = score(b) - score(a);
        if (Math.abs(diff) > 1e-9) return diff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [publications, currentUser, allGroupes]);

  const newestPublicationTime = useMemo(
    () => sortedPublications.reduce(
      (max, publication) => Math.max(max, new Date(publication.created_at).getTime()),
      0
    ),
    [sortedPublications]
  );

  // À l'ouverture du fil, on mémorise l'état courant : seules les vraies
  // nouveautés déclenchent la bannière « nouvelles publications ».
  useEffect(() => {
    if (feedInitRef.current) return;
    if (newestPublicationTime <= 0) return;
    feedInitRef.current = true;
    setFeedSeenUpTo(newestPublicationTime);
  }, [newestPublicationTime]);

  const newPostsCount = sortedPublications.filter(
    (publication) =>
      publication.auteur_id !== currentUser.id &&
      new Date(publication.created_at).getTime() > feedSeenUpTo
  ).length;

  // Stories actives (expirent après 24 h) regroupées par auteur.
  const activeStories = useMemo(
    () => stories
      .filter((story) => new Date(story.expires_at).getTime() > Date.now())
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [stories]
  );

  const ownStories = useMemo(
    () => activeStories.filter((story) => story.auteur_id === currentUser.id),
    [activeStories, currentUser.id]
  );

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

  const visiblePublications = sortedPublications.slice(0, visibleCount);

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

  const getAuthor = (id: string) => allMembres.find((membre) => membre.id === id);

  const showTemporaryMessage = (message: string) => {
    setShareMessage(message);
    window.setTimeout(() => setShareMessage(null), 2800);
  };

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
      const dataUrl = await compressImage(file, 1200, 1200, 0.78);
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
      const dataUrl = await compressImage(file, 1080, 1920, 0.82);
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

  const closeStoryComposer = () => {
    setStoryComposerOpen(false);
    setStoryImage(null);
    setStoryCaption('');
  };

  const handlePublishStory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!storyImage) return;

    setIsPublishingStory(true);
    try {
      const imageUrl = (await uploadDataUrl(storyImage.dataUrl, 'image')) ?? storyImage.dataUrl;
      StorageService.addStory(currentUser.id, imageUrl, storyCaption);
      closeStoryComposer();
      onRefreshStories();
      showTemporaryMessage(t('publications.success.published'));
    } catch {
      alert(t('publications.stories.error'));
    } finally {
      setIsPublishingStory(false);
    }
  };

  const openStoryGroup = (groupStories: Story[]) => {
    if (!groupStories.length) return;
    setStoryViewer({ stories: groupStories, index: 0 });
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
    setStoryViewer((viewer) => {
      if (!viewer) return viewer;
      const remaining = viewer.stories.filter((story) => story.id !== storyId);
      if (!remaining.length) return null;
      return { stories: remaining, index: Math.min(viewer.index, remaining.length - 1) };
    });
    onRefreshStories();
  };

  // Marque la story affichée comme vue puis avance automatiquement (5 s).
  useEffect(() => {
    if (!storyViewer) return;
    const current = storyViewer.stories[storyViewer.index];
    if (!current) return;
    if (!current.seen_by.includes(currentUser.id)) {
      StorageService.markStorySeen(current.id, currentUser.id);
    }
    const timer = window.setTimeout(storyNext, STORY_DURATION_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyViewer, currentUser.id]);

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = newContent.trim();
    if (!content && !stagedImage) return;

    setIsPublishing(true);
    try {
      const publicationAudience = audience === 'group' && targetGroupeId ? 'group' : 'all';
      // L'image part vers R2 ; si indisponible on garde la base64 interne.
      const imageUrl = stagedImage
        ? (await uploadDataUrl(stagedImage.dataUrl, 'image') ?? stagedImage.dataUrl)
        : undefined;
      StorageService.createPublication(
        currentUser.id,
        content,
        imageUrl,
        publicationAudience,
        targetGroupeId || undefined
      );
      setNewContent('');
      setStagedImage(null);
      setVisibleCount((count) => Math.max(count, PAGE_SIZE));
      onRefreshPublications();
      showTemporaryMessage(t('publications.success.published'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleLike = (publicationId: string) => {
    StorageService.togglePublicationLike(publicationId, currentUser.id);
    onRefreshPublications();
  };

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
    const url = `${window.location.origin}${window.location.pathname}#publication-${publication.id}`;

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

  return (
    <div className="animate-fade-in" style={{ padding: '24px 16px 40px', maxWidth: '760px', margin: '0 auto' }}>

      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-gold">{t('publications.badge')}</span>
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('publications.title')}</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('publications.subtitle')}
        </p>
      </div>

      {/* ===== ZONE STORIES (style Facebook, expire en 24 h) ===== */}
      <div className="glass-card" style={{ padding: '14px 12px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {t('publications.stories.title')}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> {t('publications.stories.expires')}
          </span>
        </div>

        <div className="stories-strip" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button type="button" onClick={() => setStoryComposerOpen(true)} style={storyTileStyle}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '2px dashed var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Plus size={22} style={{ color: 'var(--accent-gold)' }} />
            </div>
            <span style={storyLabelStyle}>{t('publications.stories.create')}</span>
          </button>

          {ownStories.length > 0 && (
            <button type="button" onClick={() => openStoryGroup(ownStories)} style={storyTileStyle}>
              <StoryRing membre={currentUser} seen={false} />
              <span style={storyLabelStyle}>{t('publications.stories.yourStory')}</span>
            </button>
          )}

          {orderedStoryGroups.map((group) => {
            const author = getAuthor(group.auteurId);
            const seen = group.stories.every((story) => story.seen_by.includes(currentUser.id));
            return (
              <button
                key={group.auteurId}
                type="button"
                onClick={() => openStoryGroup(group.stories)}
                style={storyTileStyle}
              >
                <StoryRing membre={author} seen={seen} />
                <span style={storyLabelStyle}>{author ? author.prenom : t('common.member')}</span>
              </button>
            );
          })}

          {ownStories.length === 0 && orderedStoryGroups.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0 8px' }}>
              {t('publications.stories.empty')}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handlePublish}
        className="glass-card"
        style={{ padding: '20px', marginBottom: '22px' }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <MemberAvatar membre={currentUser} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              className="form-input"
              rows={3}
              maxLength={3000}
              placeholder={t('publications.composer.placeholder', { name: currentUser.prenom })}
              style={{ resize: 'vertical', minHeight: '86px' }}
            />

            {stagedImage && (
              <div style={{
                position: 'relative',
                marginTop: '12px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                background: '#050a16'
              }}>
                <img
                  src={stagedImage.dataUrl}
                  alt={stagedImage.fileName}
                  style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', display: 'block' }}
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '12px'
              }}>
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

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)'
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
                disabled={isPublishing || isCompressing || (!newContent.trim() && !stagedImage)}
                style={{ opacity: isPublishing || isCompressing || (!newContent.trim() && !stagedImage) ? 0.55 : 1 }}
              >
                {isPublishing ? <Loader2 size={16} className="animate-pulse-glow" /> : <Send size={16} />}
                <span>{t('common.publish')}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

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
              setFeedSeenUpTo(Date.now());
              setVisibleCount(PAGE_SIZE);
              onRefreshPublications();
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
          const isLiked = publication.liked_by.includes(currentUser.id);
          const commentsOpen = openCommentIds.includes(publication.id);
          const likeCount = publication.liked_by.length;
          const commentCount = publication.commentaires.length;
          const canDelete = publication.auteur_id === currentUser.id || isAdmin(currentUser);

          return (
            <article
              key={publication.id}
              id={`publication-${publication.id}`}
              className="glass-card"
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MemberAvatar membre={author} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.94rem' }}>
                      {author ? `${author.prenom} ${author.nom}` : t('publications.deletedMember')}
                    </strong>
                    {author && (
                      <span className="badge badge-purple" style={{ fontSize: '0.62rem', padding: '2px 7px' }}>
                        {t(ROLE_TRANSLATION_KEYS[author.role])}
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

              {publication.image_url && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(publication.image_url || null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 0,
                    border: 'none',
                    background: '#050a16',
                    cursor: 'zoom-in'
                  }}
                  title={t('publications.image.enlarge')}
                >
                  <img
                    src={publication.image_url}
                    alt={t('publications.image.alt')}
                    loading="lazy"
                    style={{
                      width: '100%',
                      maxHeight: '600px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </button>
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
                  <span>
                    {likeCount > 0 ? formatCount(likeCount, 'likes') : ' '}
                  </span>
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
                <button
                  type="button"
                  onClick={() => handleToggleLike(publication.id)}
                  className="btn btn-ghost"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: isLiked ? '#ef4444' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    padding: '8px 6px'
                  }}
                >
                  <Heart size={18} style={{ fill: isLiked ? '#ef4444' : 'none' }} />
                  <span>{t('publications.action.like')}</span>
                  {likeCount > 0 && <span style={{ fontSize: '0.72rem' }}>({likeCount})</span>}
                </button>

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

                    {publication.commentaires.map((comment) => {
                      const commentAuthor = getAuthor(comment.auteur_id);
                      return (
                        <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <MemberAvatar membre={commentAuthor} size={34} />
                          <div style={{
                            flex: 1,
                            minWidth: 0,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '0.8rem' }}>
                                {commentAuthor ? `${commentAuthor.prenom} ${commentAuthor.nom}` : t('common.member')}
                              </strong>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                {formatRelativeDate(comment.created_at)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.84rem', marginTop: '3px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {comment.contenu}
                            </div>
                          </div>
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

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0, 0, 0, 0.94)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            cursor: 'zoom-out'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{
              position: 'fixed',
              top: '14px',
              right: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 2
            }}>
              <button
                type="button"
                onClick={() => downloadMedia(previewImage, 'publication.jpg')}
                className="btn btn-ghost"
                style={{ color: '#ffffff', padding: '8px 12px', fontSize: '0.78rem' }}
                title={t('publications.image.download')}
              >
                <Download size={18} />
                <span>{t('common.download')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="btn btn-ghost"
                style={{ color: '#ffffff', padding: '8px' }}
                title={t('common.close')}
              >
                <X size={24} />
              </button>
            </div>
            <img
              src={previewImage}
              alt={t('publications.image.previewAlt')}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '10px'
              }}
            />
          </div>
        </div>
      )}

      {/* ===== CRÉATION D'UNE STORY ===== */}
      {storyComposerOpen && (
        <div
          onClick={closeStoryComposer}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 92,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <form
            onSubmit={handlePublishStory}
            onClick={(event) => event.stopPropagation()}
            className="glass-card"
            style={{ width: 'min(460px, 100%)', padding: '20px', borderRadius: '18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('publications.stories.create')}</h3>
              <button type="button" onClick={closeStoryComposer} className="btn btn-ghost" style={{ padding: '6px' }} title={t('common.close')}>
                <X size={18} />
              </button>
            </div>

            <input
              ref={storyFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleStoryImageChange}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => storyFileInputRef.current?.click()}
              style={{
                width: '100%',
                minHeight: '180px',
                borderRadius: '14px',
                border: '1px dashed var(--border-gold)',
                background: 'rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              {storyImage ? (
                <img
                  src={storyImage.dataUrl}
                  alt={t('publications.stories.addPhoto')}
                  style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  {isCompressingStory ? <Loader2 size={26} className="animate-pulse-glow" /> : <ImageIcon size={26} />}
                  {isCompressingStory ? t('publications.composer.compressing') : t('publications.stories.addPhoto')}
                </span>
              )}
            </button>

            <input
              type="text"
              value={storyCaption}
              onChange={(event) => setStoryCaption(event.target.value)}
              maxLength={120}
              className="form-input"
              placeholder={t('publications.stories.caption')}
              style={{ marginTop: '12px' }}
            />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!storyImage || isCompressingStory || isPublishingStory}
              style={{ width: '100%', marginTop: '12px' }}
            >
              {isPublishingStory ? <Loader2 size={16} className="animate-pulse-glow" /> : <Plus size={16} />}
              <span>{t('publications.stories.publish')}</span>
            </button>
          </form>
        </div>
      )}

      {/* ===== VISIONNEUSE DE STORIES ===== */}
      {storyViewer && (() => {
        const currentStory = storyViewer.stories[storyViewer.index];
        if (!currentStory) return null;
        const author = getAuthor(currentStory.auteur_id);
        const isOwn = currentStory.auteur_id === currentUser.id;
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
              style={{
                position: 'relative',
                width: 'min(440px, 100vw)',
                height: 'min(88dvh, 800px)',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#000',
                display: 'flex',
                flexDirection: 'column'
              }}
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
                {storyViewer.stories.map((story, index) => (
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
                      key={index === storyViewer.index ? `${story.id}-active` : story.id}
                      className={index === storyViewer.index ? 'story-progress-fill' : ''}
                      style={{
                        height: '100%',
                        width: index < storyViewer.index ? '100%' : index === storyViewer.index ? undefined : '0%',
                        background: '#ffffff'
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
                <MemberAvatar membre={author} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {author ? `${author.prenom} ${author.nom}` : t('common.member')}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.75)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} /> {formatRelativeDate(currentStory.created_at)}
                  </div>
                </div>
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
                src={currentStory.image_url || ''}
                alt={t('publications.image.alt')}
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
              />

              {currentStory.caption && (
                <div style={{
                  position: 'absolute',
                  bottom: '18px',
                  left: '14px',
                  right: '14px',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  textShadow: '0 1px 6px rgba(0, 0, 0, 0.9)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {currentStory.caption}
                </div>
              )}

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

              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: '0.72rem',
                zIndex: 2
              }}>
                <Eye size={13} /> {t('publications.stories.viewers', { count: currentStory.seen_by.length })}
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes storyProgress { from { width: 0%; } to { width: 100%; } }
        .story-progress-fill { animation: storyProgress ${STORY_DURATION_MS}ms linear forwards; }
        .stories-strip { scrollbar-width: thin; }
        .stories-strip::-webkit-scrollbar { height: 4px; }
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

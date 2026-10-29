import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Membre, Publication } from '../types';
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  Image as ImageIcon,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import { StorageService } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { isAdmin } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface PublicationsViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  publications: Publication[];
  onRefreshPublications: () => void;
}

interface StagedImage {
  dataUrl: string;
  fileName: string;
  fileSizeKb: number;
}

const PAGE_SIZE = 4;

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
      {membre?.prenom?.charAt(0).toUpperCase() || 'M'}
    </div>
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
  publications,
  onRefreshPublications
}) => {
  const { t, language } = useLanguage();
  const [newContent, setNewContent] = useState('');
  const [stagedImage, setStagedImage] = useState<StagedImage | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [openCommentIds, setOpenCommentIds] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const sortedPublications = useMemo(
    () => [...publications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    [publications]
  );

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

  const handlePublish = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = newContent.trim();
    if (!content && !stagedImage) return;

    setIsPublishing(true);
    try {
      StorageService.createPublication(currentUser.id, content, stagedImage?.dataUrl);
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
                    {formatRelativeDate(publication.created_at)} · {t('publications.publicPost')}
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
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out'
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="btn btn-ghost"
            style={{ position: 'fixed', top: '20px', right: '20px', color: '#ffffff', padding: '8px' }}
            title={t('common.close')}
          >
            <X size={24} />
          </button>
          <img
            src={previewImage}
            alt={t('publications.image.previewAlt')}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '10px' }}
          />
        </div>
      )}

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

import React, { useEffect, useMemo, useState } from 'react';
import { Membre, Publication, Story } from '../types';
import {
  X,
  LayoutGrid,
  Activity,
  Heart,
  MessageCircle,
  Image as ImageIcon,
  ImagePlus,
  Sparkles,
  Send,
  Phone,
  Video
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { StorageService } from '../utils/storage';
import { fetchPublicationImageIfMissing, fetchStoryImageIfMissing } from '../utils/supabaseSync';
import { useLanguage } from '../i18n';

interface MemberProfileModalProps {
  membre: Membre;
  currentUser: Membre;
  publications: Publication[];
  stories: Story[];
  onClose: () => void;
  onOpenChat: (membreId: string) => void;
  onStartVoiceCall?: (membreId: string) => void;
  onStartVideoCall?: (membreId: string) => void;
  voiceCallBusy?: boolean;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  membre,
  currentUser,
  publications,
  stories,
  onClose,
  onOpenChat,
  onStartVoiceCall,
  onStartVideoCall,
  voiceCallBusy
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'posts' | 'activity'>('posts');
  const [imageTick, setImageTick] = useState(0);

  const roleLabel = (role: Membre['role']) =>
    t(
      role === 'super_chef'
        ? 'common.role.superChef'
        : role === 'chef'
          ? 'common.role.chef'
          : role === 'admin'
            ? 'common.role.admin'
            : 'common.role.member'
    );

  const memberPublications = useMemo(
    () => publications
      .filter((p) => p.auteur_id === membre.id)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [publications, membre.id]
  );

  const memberStories = useMemo(
    () => stories.filter((s) => s.auteur_id === membre.id),
    [stories, membre.id]
  );

  const publicationImageSrc = (publication: Publication): string | undefined => {
    const stored = publication.image_ref
      ? StorageService.getPublicationImage(publication.image_ref)
      : undefined;
    return stored || publication.image_url;
  };

  const storyImageSrc = (story: Story): string | undefined => {
    const stored = story.image_ref ? StorageService.getStoryImage(story.image_ref) : undefined;
    return stored || story.image_url;
  };

  useEffect(() => {
    let cancelled = false;
    const resolveMissing = async () => {
      let changed = false;
      for (const publication of memberPublications) {
        if (!publication.image_ref || StorageService.getPublicationImage(publication.image_ref)) continue;
        if (await fetchPublicationImageIfMissing(publication.image_ref)) changed = true;
      }
      for (const story of memberStories) {
        if (!story.image_ref || StorageService.getStoryImage(story.image_ref)) continue;
        if (await fetchStoryImageIfMissing(story.image_ref)) changed = true;
      }
      if (changed && !cancelled) setImageTick((n) => n + 1);
    };
    void resolveMissing();
    return () => {
      cancelled = true;
    };
  }, [memberPublications, memberStories]);

  const activityItems = (() => {
    type Item = {
      id: string;
      date: string;
      kind: 'post' | 'story' | 'comment' | 'like';
      text: string;
      detail?: string;
      image?: string;
    };

    const items: Item[] = [];
    for (const publication of publications) {
      if (publication.auteur_id === membre.id) {
        items.push({
          id: `post_${publication.id}`,
          date: publication.created_at,
          kind: 'post',
          text: t('profile.activity.posted'),
          detail: publication.contenu,
          image: publicationImageSrc(publication)
        });
      }
      for (const comment of publication.commentaires || []) {
        if (comment.auteur_id === membre.id) {
          items.push({
            id: `comment_${comment.id}`,
            date: comment.created_at,
            kind: 'comment',
            text: t('profile.activity.commented'),
            detail: comment.contenu
          });
        }
      }
      if (publication.liked_by.includes(membre.id)) {
        items.push({
          id: `like_${publication.id}`,
          date: publication.created_at,
          kind: 'like',
          text: t('profile.activity.liked'),
          detail: publication.contenu
        });
      }
    }
    for (const story of memberStories) {
      items.push({
        id: `story_${story.id}`,
        date: story.created_at,
        kind: 'story',
        text: t('profile.activity.story'),
        image: storyImageSrc(story)
      });
    }
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
  })();

  const isSelf = membre.id === currentUser.id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: 0,
          position: 'relative',
          borderRadius: '18px'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 3,
            padding: '8px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#ffffff'
          }}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <X size={18} />
        </button>

        {/* Cover */}
        <div style={{
          position: 'relative',
          height: 'clamp(130px, 24vw, 220px)',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 55%, #d97706 100%)'
        }}>
          {membre.cover_url && (
            <img
              src={membre.cover_url}
              alt={t('profile.cover.alt')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>

        {/* Identity */}
        <div style={{ padding: '0 20px 16px' }}>
          <div className="member-profile-identity" style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginTop: '-44px', flexWrap: 'wrap' }}>
            <img
              className="member-profile-avatar"
              src={membre.photo_url || DEFAULT_AVATAR_IMAGE}
              alt={`${membre.prenom} ${membre.nom}`}
              style={{
                width: '104px',
                height: '104px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid var(--bg-primary)',
                boxShadow: 'var(--shadow-md)',
                background: 'var(--bg-primary)',
                flexShrink: 0
              }}
            />

            <div className="member-profile-name" style={{ flex: 1, minWidth: '200px', paddingBottom: '4px' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.45rem', lineHeight: 1.2 }}>
                {membre.prenom} {membre.nom}
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--accent-gold)' }}>{roleLabel(membre.role).toUpperCase()}</strong>
                {' · '}
                <span style={{ fontFamily: 'monospace' }}>{membre.code_unique}</span>
                {' · '}
                {t('profile.posts.count', { count: memberPublications.length })}
              </div>
            </div>

            {!isSelf && (
              <div className="member-profile-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChat(membre.id);
                    onClose();
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '10px 14px' }}
                >
                  <Send size={15} />
                  <span>{t('members.sendMessage')}</span>
                </button>
                {onStartVoiceCall && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartVoiceCall(membre.id);
                      onClose();
                    }}
                    disabled={voiceCallBusy}
                    className="btn btn-ghost"
                    title={t('calls.start')}
                    aria-label={t('calls.start')}
                    style={{
                      fontSize: '0.85rem',
                      padding: '10px 14px',
                      color: voiceCallBusy ? 'var(--text-dim)' : '#10b981',
                      opacity: voiceCallBusy ? 0.5 : 1
                    }}
                  >
                    <Phone size={15} />
                    <span>{t('calls.start')}</span>
                  </button>
                )}
                {onStartVideoCall && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartVideoCall(membre.id);
                      onClose();
                    }}
                    disabled={voiceCallBusy}
                    className="btn btn-ghost"
                    title={t('calls.startVideo')}
                    aria-label={t('calls.startVideo')}
                    style={{
                      fontSize: '0.85rem',
                      padding: '10px 14px',
                      color: voiceCallBusy ? 'var(--text-dim)' : '#0ea5e9',
                      opacity: voiceCallBusy ? 0.5 : 1
                    }}
                  >
                    <Video size={15} />
                    <span>{t('calls.startVideo')}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick info */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 18px',
            marginTop: '14px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            {membre.telephone && <span>{membre.telephone}</span>}
            {membre.email && <span>{membre.email}</span>}
            {membre.created_at && <span>{t('members.memberSince')}: {membre.created_at}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '6px 12px',
          borderTop: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--bg-card, var(--bg-primary))'
        }}>
          {([
            { id: 'posts' as const, label: t('profile.tabs.posts'), icon: <LayoutGrid size={16} /> },
            { id: 'activity' as const, label: t('profile.tabs.activity'), icon: <Activity size={16} /> }
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ flex: 1, fontSize: '0.85rem', padding: '9px 12px' }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: '16px' }}>
          {activeTab === 'posts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {memberPublications.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ImagePlus size={34} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.posts.emptyTitle')}</div>
                </div>
              ) : (
                memberPublications.map((publication) => {
                  const imageSrc = publicationImageSrc(publication);
                  return (
                    <article key={`${publication.id}-${imageTick}`} className="glass-card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <img
                          src={membre.photo_url || DEFAULT_AVATAR_IMAGE}
                          alt={membre.prenom}
                          style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                            {membre.prenom} {membre.nom}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(publication.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {publication.contenu && (
                        <p style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {publication.contenu}
                        </p>
                      )}
                      {imageSrc && (
                        <img
                          src={imageSrc}
                          alt={t('profile.posts.imageAlt')}
                          style={{ width: '100%', maxHeight: '520px', objectFit: 'cover', borderRadius: '12px', display: 'block' }}
                        />
                      )}
                      <div style={{
                        display: 'flex',
                        gap: '18px',
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Heart size={15} /> {publication.liked_by.length}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MessageCircle size={15} /> {publication.commentaires?.length || 0}
                        </span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              {activityItems.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Activity size={34} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.activity.emptyTitle')}</div>
                </div>
              ) : (
                activityItems.map((item) => {
                  const Icon =
                    item.kind === 'like'
                      ? Heart
                      : item.kind === 'comment'
                        ? MessageCircle
                        : item.kind === 'story'
                          ? Sparkles
                          : ImageIcon;
                  return (
                    <div key={`${item.id}-${imageTick}`} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-gold)'
                      }}>
                        <Icon size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem' }}>
                          <strong>{membre.prenom}</strong> {item.text}
                        </div>
                        {item.detail && (
                          <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            “{item.detail}”
                          </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {new Date(item.date).toLocaleString()}
                        </div>
                      </div>
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

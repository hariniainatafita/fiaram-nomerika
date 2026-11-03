import React, { useState, useEffect, useRef } from 'react';
import { Membre, Groupe, Publication, Story } from '../types';
import { 
  Fingerprint, 
  Download, 
  CheckCircle2, 
  Camera,
  IdCard,
  Image as ImageIcon,
  Sparkles,
  X,
  LayoutGrid,
  Activity,
  Info,
  Heart,
  MessageCircle,
  ImagePlus,
  Pencil,
  Check
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import { StorageService } from '../utils/storage';

import { canManageBadges } from '../utils/permissions';
import { MemberBadgeModal } from '../components/MemberBadgeModal';
import { compressImage } from '../utils/imageCompressor';
import { uploadDataUrl } from '../utils/media';
import { fetchPublicationImageIfMissing, fetchStoryImageIfMissing } from '../utils/supabaseSync';
import { useLanguage } from '../i18n';

interface ProfileViewProps {
  currentUser: Membre;
  allGroupes: Groupe[];
  publications: Publication[];
  stories: Story[];
  onRefreshUser: () => void;
  onRefreshPublications: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=250',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=250',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=250',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=250',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=250'
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  allGroupes,
  publications,
  stories,
  onRefreshUser,
  onRefreshPublications
}) => {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'activity' | 'about'>('posts');
  const [imageTick, setImageTick] = useState(0);
  const canManageBadgeAccess = canManageBadges(currentUser);
  const { t } = useLanguage();

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

  // Edit info form
  const [nom, setNom] = useState(currentUser.nom);
  const [prenom, setPrenom] = useState(currentUser.prenom);
  const [telephone, setTelephone] = useState(currentUser.telephone || '');
  const [fingerprint, setFingerprint] = useState(currentUser.fingerprint_registered);
  const [photoUrl, setPhotoUrl] = useState(currentUser.photo_url || '');
  const [infoSavedMsg, setInfoSavedMsg] = useState(false);

  // Photo modal temp state
  const [tempPhotoUrl, setTempPhotoUrl] = useState(currentUser.photo_url || '');
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoSavedMsg, setPhotoSavedMsg] = useState(false);

  // Cover photo (Facebook-style banner)
  const [coverUrl, setCoverUrl] = useState(currentUser.cover_url || '');
  const [tempCoverUrl, setTempCoverUrl] = useState(currentUser.cover_url || '');
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [isCompressingCover, setIsCompressingCover] = useState(false);
  const [coverSavedMsg, setCoverSavedMsg] = useState(false);

  // Captions of the automatic photo publications (editable before saving).
  const [photoPostCaption, setPhotoPostCaption] = useState('');
  const [coverPostCaption, setCoverPostCaption] = useState('');
  const [editingPublicationId, setEditingPublicationId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState('');

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccessMsg, setPwSuccessMsg] = useState(false);

  // Sync photo and editable fields if current user updates
  useEffect(() => {
    if (currentUser.photo_url) {
      setPhotoUrl(currentUser.photo_url);
      setTempPhotoUrl((previous) => previous || currentUser.photo_url || '');
    }
  }, [currentUser.photo_url]);

  useEffect(() => {
    setNom(currentUser.nom);
    setPrenom(currentUser.prenom);
    setTelephone(currentUser.telephone || '');
    setFingerprint(currentUser.fingerprint_registered);
  }, [currentUser.id, currentUser.nom, currentUser.prenom, currentUser.telephone, currentUser.fingerprint_registered]);

  useEffect(() => {
    if (currentUser.cover_url) {
      setCoverUrl(currentUser.cover_url);
      setTempCoverUrl((previous) => previous || currentUser.cover_url || '');
    }
  }, [currentUser.cover_url]);

  // Own posts and activity shown on the profile, newest first.
  const myPublications = React.useMemo(
    () => publications
      .filter((p) => p.auteur_id === currentUser.id)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [publications, currentUser.id]
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

  // A picture stored in its dedicated sync row may arrive after the post/story
  // metadata: fetch it on demand, exactly like the main feed does.
  useEffect(() => {
    let cancelled = false;
    const resolveMissing = async () => {
      let changed = false;
      for (const publication of myPublications) {
        if (!publication.image_ref || StorageService.getPublicationImage(publication.image_ref)) continue;
        const image = await fetchPublicationImageIfMissing(publication.image_ref);
        if (image) changed = true;
      }
      for (const story of stories.filter((s) => s.auteur_id === currentUser.id)) {
        if (!story.image_ref || StorageService.getStoryImage(story.image_ref)) continue;
        const image = await fetchStoryImageIfMissing(story.image_ref);
        if (image) changed = true;
      }
      if (changed && !cancelled) setImageTick((n) => n + 1);
    };
    void resolveMissing();
    return () => {
      cancelled = true;
    };
  }, [myPublications, stories, currentUser.id]);

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
      if (publication.auteur_id === currentUser.id) {
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
        if (comment.auteur_id === currentUser.id) {
          items.push({
            id: `comment_${comment.id}`,
            date: comment.created_at,
            kind: 'comment',
            text: t('profile.activity.commented'),
            detail: comment.contenu
          });
        }
      }
      if (publication.liked_by.includes(currentUser.id)) {
        items.push({
          id: `like_${publication.id}`,
          date: publication.created_at,
          kind: 'like',
          text: t('profile.activity.liked'),
          detail: publication.contenu
        });
      }
    }
    for (const story of stories.filter((s) => s.auteur_id === currentUser.id)) {
      items.push({
        id: `story_${story.id}`,
        date: story.created_at,
        kind: 'story',
        text: t('profile.activity.story'),
        image: storyImageSrc(story)
      });
    }

    return items
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 60);
  })();

  const publishPhotoUpdate = (kind: 'profile' | 'cover', imageUrl: string, caption: string) => {
    const fallback = kind === 'profile'
      ? t('profile.autoPost.profilePhoto')
      : t('profile.autoPost.coverPhoto');
    const text = caption.trim() || fallback;
    StorageService.createPublication(
      currentUser.id,
      text,
      imageUrl,
      'all',
      undefined,
      imageUrl.startsWith('data:') ? imageUrl : undefined
    );
    onRefreshPublications();
  };

  const openPhotoEditor = () => {
    setTempPhotoUrl(photoUrl);
    setPhotoPostCaption(t('profile.autoPost.profilePhoto'));
    setShowPhotoModal(true);
  };

  const openCoverEditor = () => {
    setTempCoverUrl(coverUrl);
    setCoverPostCaption(t('profile.autoPost.coverPhoto'));
    setShowCoverModal(true);
  };

  const handleSaveCaption = (publicationId: string) => {
    StorageService.updatePublication(publicationId, editingCaption);
    setEditingPublicationId(null);
    setEditingCaption('');
    onRefreshPublications();
  };

  // Generate real QR Code onto the canvas
  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (cancelled) return;
        QRCode.toCanvas(
          canvas,
          currentUser.code_unique,
          {
            width: 220,
            margin: 2,
            color: {
              dark: '#070d1e',
              light: '#ffffff'
            }
          },
          (error) => {
            if (error) console.error(error);
          }
        );
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [currentUser.code_unique]);

  // Download QR code image
  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;
    const url = qrCanvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `QRCode_${currentUser.prenom}_${currentUser.code_unique}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle local image file upload & compression
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImage(file, 512, 512, 0.82);
      setTempPhotoUrl(compressedBase64);
    } catch (err) {
      console.error('Error compressing avatar image:', err);
      alert(t('profile.photo.compressError'));
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Save updated photo (and publish it automatically, like Facebook)
  const handleSavePhoto = async () => {
    if (!tempPhotoUrl) return;
    // La photo part vers R2 ; si indisponible on garde la base64 interne.
    const storedUrl = await uploadDataUrl(tempPhotoUrl, 'image') ?? tempPhotoUrl;
    const previous = currentUser.photo_url;
    const updated: Membre = {
      ...currentUser,
      photo_url: storedUrl
    };
    StorageService.updateMembre(updated);
    setPhotoUrl(storedUrl);
    setTempPhotoUrl(storedUrl);
    if (storedUrl !== previous) {
      publishPhotoUpdate('profile', storedUrl, photoPostCaption);
    }
    onRefreshUser();
    setPhotoSavedMsg(true);
    setTimeout(() => {
      setPhotoSavedMsg(false);
      setShowPhotoModal(false);
    }, 1200);
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingCover(true);
      const compressed = await compressImage(file, 1200, 450, 0.75);
      setTempCoverUrl(compressed);
    } catch (err) {
      console.error('Error compressing cover image:', err);
      alert(t('profile.cover.compressError'));
    } finally {
      setIsCompressingCover(false);
      e.target.value = '';
    }
  };

  const handleSaveCover = async () => {
    if (!tempCoverUrl) return;
    const storedUrl = await uploadDataUrl(tempCoverUrl, 'image') ?? tempCoverUrl;
    const previous = currentUser.cover_url;
    StorageService.updateMembre({ ...currentUser, cover_url: storedUrl });
    setCoverUrl(storedUrl);
    setTempCoverUrl(storedUrl);
    if (storedUrl !== previous) {
      publishPhotoUpdate('cover', storedUrl, coverPostCaption);
    }
    onRefreshUser();
    setCoverSavedMsg(true);
    setTimeout(() => {
      setCoverSavedMsg(false);
      setShowCoverModal(false);
    }, 1200);
  };

  // Save personal info
  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Membre = {
      ...currentUser,
      nom,
      prenom,
      telephone,
      fingerprint_registered: fingerprint
    };
    StorageService.updateMembre(updated);
    onRefreshUser();
    setInfoSavedMsg(true);
    setTimeout(() => setInfoSavedMsg(false), 3000);
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert(t('profile.password.mismatch'));
      return;
    }
    if (newPassword.length < 4) {
      alert(t('profile.password.tooShort'));
      return;
    }
    try {
      // The local hash is the authoritative sign-in path on this app. The
      // change never depends on a Supabase Auth session (which does not
      // exist for accounts created inside the app).
      const currentOk = await StorageService.verifyMembrePassword(currentUser.id, oldPassword);
      if (!currentOk) {
        alert(t('profile.password.wrongCurrent'));
        return;
      }
      await StorageService.setPasswordHash(currentUser.id, newPassword);
    } catch (error) {
      console.error('Impossible de modifier le mot de passe:', error);
      alert(t('profile.password.saveError'));
      return;
    }

    onRefreshUser();
    setPwSuccessMsg(true);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPwSuccessMsg(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* FACEBOOK-STYLE HEADER: COVER + AVATAR + TABS */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '18px' }}>
        <div style={{
          position: 'relative',
          height: 'clamp(150px, 26vw, 250px)',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 55%, #d97706 100%)'
        }}>
          {coverUrl && (
            <img
              src={coverUrl}
              alt={t('profile.cover.alt')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
          <button
            type="button"
            onClick={openCoverEditor}
            className="btn btn-ghost"
            style={{
              position: 'absolute',
              right: '12px',
              bottom: '12px',
              background: 'rgba(0, 0, 0, 0.55)',
              color: '#ffffff',
              fontSize: '0.8rem',
              padding: '8px 12px',
              backdropFilter: 'blur(6px)'
            }}
          >
            <Camera size={15} />
            <span>{t('profile.cover.change')}</span>
          </button>
        </div>

        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginTop: '-48px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={photoUrl || DEFAULT_AVATAR_IMAGE}
                alt={currentUser.prenom}
                style={{
                  width: '112px',
                  height: '112px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid var(--bg-primary)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'block',
                  background: 'var(--bg-primary)'
                }}
              />
              <button
                type="button"
                onClick={openPhotoEditor}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#070d1e',
                  border: '2px solid var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
                title={t('profile.photo.changeTitle')}
              >
                <Camera size={18} />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '220px', paddingBottom: '4px' }}>
              <span className="badge badge-gold" style={{ marginBottom: '6px', display: 'inline-block' }}>
                {t('profile.hero.badge')}
              </span>
              <h1 style={{ fontSize: '1.6rem', margin: '2px 0 4px', lineHeight: 1.15 }}>
                {currentUser.prenom} {currentUser.nom}
              </h1>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--accent-gold)' }}>{roleLabel(currentUser.role).toUpperCase()}</strong>
                {' · '}
                <span style={{ fontFamily: 'monospace' }}>{currentUser.code_unique}</span>
                {' · '}
                {t('profile.posts.count', { count: myPublications.length })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="glass-card" style={{ display: 'flex', gap: '4px', padding: '6px', marginBottom: '18px', overflowX: 'auto' }}>
        {([
          { id: 'posts' as const, label: t('profile.tabs.posts'), icon: <LayoutGrid size={16} /> },
          { id: 'activity' as const, label: t('profile.tabs.activity'), icon: <Activity size={16} /> },
          { id: 'about' as const, label: t('profile.tabs.about'), icon: <Info size={16} /> }
        ]).map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={selected ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ flex: 1, minWidth: 'max-content', fontSize: '0.85rem', padding: '10px 14px' }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PUBLICATIONS TAB */}
      {activeTab === 'posts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {myPublications.length === 0 ? (
            <div className="glass-card" style={{ padding: '42px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ImagePlus size={38} style={{ opacity: 0.5, marginBottom: '10px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.posts.emptyTitle')}</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>{t('profile.posts.emptyHint')}</div>
            </div>
          ) : (
            myPublications.map((publication) => {
              const imageSrc = publicationImageSrc(publication);
              return (
                <article key={`${publication.id}-${imageTick}`} className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <img
                      src={photoUrl || DEFAULT_AVATAR_IMAGE}
                      alt={currentUser.prenom}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                        {currentUser.prenom} {currentUser.nom}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(publication.created_at).toLocaleString()}
                        {publication.groupe_id ? ` · ${t('profile.posts.groupPost')}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPublicationId(publication.id);
                        setEditingCaption(publication.contenu);
                      }}
                      className="btn btn-ghost"
                      style={{ padding: '6px', marginLeft: 'auto', color: 'var(--accent-gold)', flexShrink: 0 }}
                      title={t('profile.posts.editCaption')}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>

                  {editingPublicationId === publication.id ? (
                    <div style={{ marginBottom: '10px' }}>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={editingCaption}
                        onChange={(e) => setEditingCaption(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                          onClick={() => handleSaveCaption(publication.id)}
                        >
                          <Check size={14} />
                          <span>{t('profile.posts.editCaptionSave')}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                          onClick={() => setEditingPublicationId(null)}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    publication.contenu && (
                      <p style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {publication.contenu}
                      </p>
                    )
                  )}

                  {imageSrc && (
                    <img
                      src={imageSrc}
                      alt={t('profile.posts.imageAlt')}
                      style={{
                        width: '100%',
                        maxHeight: '540px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        display: 'block'
                      }}
                    />
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
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

      {/* ACTIVITY TAB */}
      {activeTab === 'activity' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {activityItems.length === 0 ? (
            <div style={{ padding: '24px 4px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={36} style={{ opacity: 0.5, marginBottom: '10px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.activity.emptyTitle')}</div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>{t('profile.activity.emptyHint')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activityItems.map((item) => {
                const Icon =
                  item.kind === 'like'
                    ? Heart
                    : item.kind === 'comment'
                      ? MessageCircle
                      : item.kind === 'story'
                        ? Sparkles
                        : ImageIcon;
                const color =
                  item.kind === 'like'
                    ? '#ef4444'
                    : item.kind === 'comment'
                      ? '#3b82f6'
                      : item.kind === 'story'
                        ? '#a855f7'
                        : 'var(--accent-gold)';
                return (
                  <div key={`${item.id}-${imageTick}`} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color
                    }}>
                      <Icon size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <strong>{t('profile.activity.you')}</strong> {item.text}
                      </div>
                      {item.detail && (
                        <div style={{
                          fontSize: '0.82rem',
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
                        style={{ width: '54px', height: '54px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* LEFT COLUMN: QR CODE & DIGITAL BADGE */}
        <div className="glass-card-gold" style={{ padding: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Avatar with Camera Overlay */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <img
              src={photoUrl || DEFAULT_AVATAR_IMAGE}
              alt={currentUser.prenom}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--accent-gold)',
                boxShadow: 'var(--shadow-md)',
                display: 'block'
              }}
            />
            
            <button
              type="button"
              onClick={openPhotoEditor}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#070d1e',
                border: '2px solid var(--bg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s ease'
              }}
              title={t('profile.photo.changeTitle')}
            >
              <Camera size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={openPhotoEditor}
            className="btn btn-ghost"
            style={{ fontSize: '0.78rem', padding: '4px 10px', marginBottom: '12px', color: 'var(--accent-gold)' }}
          >
            <Camera size={14} />
            <span>{t('profile.photo.change')}</span>
          </button>

          <h2 style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>
            {currentUser.prenom} {currentUser.nom}
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('common.role')}: <strong style={{ color: 'var(--accent-gold)' }}>{roleLabel(currentUser.role).toUpperCase()}</strong>
          </div>

          {/* REAL QR CODE CANVAS */}
          <div style={{
            background: '#ffffff',
            padding: '12px',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            marginBottom: '14px',
            display: 'inline-block'
          }}>
            <canvas ref={qrCanvasRef} style={{ display: 'block' }} />
          </div>

          <div style={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '1rem',
            color: 'var(--accent-gold)',
            letterSpacing: '0.08em',
            marginBottom: '16px'
          }}>
            {currentUser.code_unique}
          </div>

          <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '280px' }}>
            {canManageBadgeAccess && (
              <button
                onClick={() => setShowBadgeModal(true)}
                className="btn btn-purple"
                style={{ flex: 1, fontSize: '0.82rem', padding: '10px 14px' }}
              >
                <IdCard size={16} />
                <span>{t('profile.badge.open')}</span>
              </button>
            )}
            <button
              onClick={handleDownloadQR}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '10px 14px' }}
              title={t('profile.photo.downloadQr')}
            >
              <Download size={16} />
            </button>
          </div>

          {/* Biometrics Status */}
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fingerprint size={18} style={{ color: fingerprint ? '#10b981' : '#f59e0b' }} />
              <span>{t('profile.fingerprint.label')}</span>
            </div>
            <strong style={{ color: fingerprint ? '#10b981' : '#f59e0b' }}>
              {fingerprint ? t('profile.fingerprint.registered') : t('profile.fingerprint.notRegistered')}
            </strong>
          </div>
        </div>

        {/* RIGHT COLUMN: EDIT INFO & CHANGE PASSWORD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Edit Info */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>{t('profile.editInfo.title')}</h3>

            {infoSavedMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{t('profile.editInfo.saved')}</span>
              </div>
            )}

            <form onSubmit={handleSaveInfo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('profile.editInfo.firstName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('profile.editInfo.lastName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('profile.editInfo.phone')}
                </label>
                <input
                  type="text"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={fingerprint}
                    onChange={(e) => setFingerprint(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }}
                  />
                  <span>{t('profile.editInfo.fingerprint')}</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                {t('profile.editInfo.save')}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '14px' }}>{t('profile.password.title')}</h3>

            {pwSuccessMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{t('profile.password.success')}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  {t('profile.password.current')}
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('profile.password.new')}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                    {t('profile.password.confirm')}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-ghost" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                {t('profile.password.submit')}
              </button>
            </form>
          </div>

        </div>

      </div>
      )}

      {/* PHOTO DE COUVERTURE MODAL */}
      {showCoverModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{ maxWidth: '640px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} style={{ color: 'var(--accent-gold)' }} />
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{t('profile.cover.modalTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            {coverSavedMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{t('profile.cover.saved')}</span>
              </div>
            )}

            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 6',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #1e3a8a, #7c3aed, #d97706)'
            }}>
              {tempCoverUrl && (
                <img
                  src={tempCoverUrl}
                  alt={t('profile.cover.selectedAlt')}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {isCompressingCover && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '0.8rem'
                }}>
                  {t('profile.photo.compressing')}
                </div>
              )}
            </div>

            <input
              type="file"
              ref={coverFileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCoverFileUpload}
            />

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.85rem' }}
                disabled={isCompressingCover}
              >
                <ImageIcon size={16} />
                <span>{t('profile.cover.upload')}</span>
              </button>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('profile.cover.urlLabel')}
              </label>
              <input
                type="text"
                placeholder={t('profile.cover.urlPlaceholder')}
                value={tempCoverUrl}
                onChange={(e) => setTempCoverUrl(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('profile.posts.captionLabel')}
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={coverPostCaption}
                onChange={(e) => setCoverPostCaption(e.target.value)}
                placeholder={t('profile.posts.captionPlaceholder')}
                className="form-input"
                style={{ fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleSaveCover}
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={isCompressingCover || !tempCoverUrl}
              >
                {t('profile.cover.save')}
              </button>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                className="btn btn-ghost"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO DE PROFIL MODAL */}
      {showPhotoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} style={{ color: 'var(--accent-gold)' }} />
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{t('profile.photo.modalTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="btn btn-ghost"
                style={{ padding: '6px', borderRadius: '50%' }}
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>

            {photoSavedMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{t('profile.photo.saved')}</span>
              </div>
            )}

            {/* Current Selected Preview */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={tempPhotoUrl}
                  alt={t('profile.photo.selectedAlt')}
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--accent-gold)',
                    boxShadow: 'var(--shadow-md)'
                  }}
                />
                {isCompressing && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.75rem'
                  }}>
                    {t('profile.photo.compressing')}
                  </div>
                )}
              </div>
            </div>

            {/* Upload from file button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoFileUpload}
            />

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.85rem' }}
                disabled={isCompressing}
              >
                <ImageIcon size={16} />
                <span>{t('profile.photo.upload')}</span>
              </button>
            </div>

            {/* Custom URL Input */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('profile.photo.urlLabel')}
              </label>
              <input
                type="text"
                placeholder={t('profile.photo.urlPlaceholder')}
                value={tempPhotoUrl}
                onChange={(e) => setTempPhotoUrl(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* Presets Gallery */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--accent-gold)' }} />
                <span>{t('profile.photo.presets')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {PRESET_AVATARS.map((preset, index) => {
                  const isSelected = tempPhotoUrl === preset;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setTempPhotoUrl(preset)}
                      style={{
                        padding: '3px',
                        borderRadius: '50%',
                        border: isSelected ? '2px solid var(--accent-gold)' : '2px solid transparent',
                        background: 'transparent',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img
                        src={preset}
                        alt={t('profile.photo.presetAlt', { index: index + 1 })}
                        style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t('profile.posts.captionLabel')}
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={photoPostCaption}
                onChange={(e) => setPhotoPostCaption(e.target.value)}
                placeholder={t('profile.posts.captionPlaceholder')}
                className="form-input"
                style={{ fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleSavePhoto}
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={isCompressing || !tempPhotoUrl}
              >
                {t('profile.photo.save')}
              </button>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="btn btn-ghost"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBadgeModal && canManageBadgeAccess && (
        <MemberBadgeModal
          membre={currentUser}
          allGroupes={allGroupes}
          onClose={() => setShowBadgeModal(false)}
        />
      )}

    </div>
  );
};


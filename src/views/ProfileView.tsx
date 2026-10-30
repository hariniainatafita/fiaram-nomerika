import React, { useState, useEffect, useRef } from 'react';
import { Membre, Groupe } from '../types';
import { 
  Fingerprint, 
  Download, 
  CheckCircle2, 
  Camera,
  IdCard,
  Image as ImageIcon,
  Sparkles,
  X
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';
import QRCode from 'qrcode';
import { StorageService } from '../utils/storage';
import { canManageBadges } from '../utils/permissions';
import { MemberBadgeModal } from '../components/MemberBadgeModal';
import { compressImage } from '../utils/imageCompressor';
import { uploadDataUrl } from '../utils/media';
import { useLanguage } from '../i18n';

interface ProfileViewProps {
  currentUser: Membre;
  allGroupes: Groupe[];
  onRefreshUser: () => void;
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
  onRefreshUser
}) => {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
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

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccessMsg, setPwSuccessMsg] = useState(false);

  // Sync photo if current user updates
  useEffect(() => {
    if (currentUser.photo_url) {
      setPhotoUrl(currentUser.photo_url);
    }
  }, [currentUser.photo_url]);

  // Generate real QR Code onto the canvas
  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
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
    }
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
      const compressedBase64 = await compressImage(file, 900, 900, 0.9);
      setTempPhotoUrl(compressedBase64);
    } catch (err) {
      console.error('Error compressing avatar image:', err);
      alert(t('profile.photo.compressError'));
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Save updated photo
  const handleSavePhoto = async () => {
    if (!tempPhotoUrl) return;
    // La photo part vers R2 ; si indisponible on garde la base64 interne.
    const storedUrl = await uploadDataUrl(tempPhotoUrl, 'image') ?? tempPhotoUrl;
    const updated: Membre = {
      ...currentUser,
      photo_url: storedUrl
    };
    StorageService.updateMembre(updated);
    setPhotoUrl(tempPhotoUrl);
    onRefreshUser();
    setPhotoSavedMsg(true);
    setTimeout(() => {
      setPhotoSavedMsg(false);
      setShowPhotoModal(false);
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
      photo_url: photoUrl,
      fingerprint_registered: fingerprint
    };
    StorageService.updateMembre(updated);
    onRefreshUser();
    setInfoSavedMsg(true);
    setTimeout(() => setInfoSavedMsg(false), 3000);
  };

  // Change password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert(t('profile.password.mismatch'));
      return;
    }
    const updated: Membre = {
      ...currentUser,
      password: newPassword
    };
    StorageService.updateMembre(updated);
    onRefreshUser();
    setPwSuccessMsg(true);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPwSuccessMsg(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-gold">{t('profile.hero.badge')}</span>
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('profile.title')}</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('profile.subtitle')}
        </p>
      </div>

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
              onClick={() => {
                setTempPhotoUrl(photoUrl);
                setShowPhotoModal(true);
              }}
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
            onClick={() => {
              setTempPhotoUrl(photoUrl);
              setShowPhotoModal(true);
            }}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px', position: 'relative' }}>
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


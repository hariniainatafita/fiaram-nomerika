import React, { useEffect, useRef, useState } from 'react';
import { Membre, Groupe, BadgeStyle, BadgeColors } from '../types';
import { Download, Printer, X, Sparkles, Edit3, Check, Upload, Palette, RotateCcw } from 'lucide-react';
import { StorageService } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { useLanguage } from '../i18n';
import {
  BADGE_STYLES,
  getBadgeConfig,
  getDefaultBadgeColors,
  renderBadgeDataUrl,
  renderBadgeOnCanvas
} from '../utils/badgeRenderer';

interface MemberBadgeModalProps {
  membre: Membre;
  allGroupes: Groupe[];
  onClose: () => void;
  onUpdateMembre?: (updated: Membre) => void;
}

export const MemberBadgeModal: React.FC<MemberBadgeModalProps> = ({
  membre: initialMembre,
  allGroupes,
  onClose,
  onUpdateMembre
}) => {
  const { t } = useLanguage();
  const [membre, setMembre] = useState<Membre>(initialMembre);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [selectedStyle, setSelectedStyle] = useState<BadgeStyle>(membre.badge_style || 'gold_royal');
  const [badgeColors, setBadgeColors] = useState<BadgeColors>(() => (
    membre.badge_colors || getDefaultBadgeColors(membre.badge_style || 'gold_royal')
  ));

  const [editNom, setEditNom] = useState(membre.nom);
  const [editPrenom, setEditPrenom] = useState(membre.prenom);
  const [editCin, setEditCin] = useState(membre.cin || '117 431 010 933');
  const [editProfession, setEditProfession] = useState(membre.profession || 'MEMBRE');
  const [editNumero, setEditNumero] = useState(membre.numero_badge || '007');
  const [editPhotoUrl, setEditPhotoUrl] = useState(membre.photo_url || '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const group = allGroupes.find(g => g.id === membre.groupe_id) || allGroupes[0];
  const styleConfig = getBadgeConfig(selectedStyle, badgeColors);
  const styleLabel = (styleId: BadgeStyle) => t(`badges.style.${styleId}`);

  useEffect(() => {
    let active = true;
    renderBadgeDataUrl(membre, group, selectedStyle, badgeColors, 2)
      .then(url => {
        if (active) setPreviewUrl(url);
      })
      .catch(error => {
        console.error('Badge preview error:', error);
      });
    return () => {
      active = false;
    };
  }, [membre, group, selectedStyle, badgeColors]);

  const persistMember = (updated: Membre) => {
    setMembre(updated);
    StorageService.updateMembre(updated);
    if (onUpdateMembre) onUpdateMembre(updated);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('badges.selectImage'));
      event.target.value = '';
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const result = await compressImage(file, 1200, 1200, 0.92);
      setEditPhotoUrl(result);
      persistMember({ ...membre, photo_url: result, badge_style: selectedStyle, badge_colors: badgeColors });
    } catch {
      alert(t('badges.photoPrepareError'));
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const handleSelectStyle = (styleId: BadgeStyle) => {
    const nextColors = getDefaultBadgeColors(styleId);
    setSelectedStyle(styleId);
    setBadgeColors(nextColors);
    persistMember({ ...membre, badge_style: styleId, badge_colors: nextColors });
  };

  const updateColor = (key: keyof BadgeColors, value: string) => {
    const nextColors = { ...badgeColors, [key]: value };
    setBadgeColors(nextColors);
    persistMember({ ...membre, badge_style: selectedStyle, badge_colors: nextColors });
  };

  const handleSaveEdits = () => {
    persistMember({
      ...membre,
      nom: editNom.toUpperCase().trim(),
      prenom: editPrenom.trim(),
      cin: editCin.trim(),
      profession: editProfession.toUpperCase().trim(),
      numero_badge: editNumero.trim(),
      photo_url: editPhotoUrl.trim() || membre.photo_url,
      badge_style: selectedStyle,
      badge_colors: badgeColors
    });
    setIsEditing(false);
  };

  const handleDownloadFullBadge = async () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const scale = 4;
      canvas.width = 320 * scale;
      canvas.height = 480 * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await renderBadgeOnCanvas(
        ctx,
        membre,
        group,
        getBadgeConfig(selectedStyle, badgeColors),
        0,
        0,
        canvas.width,
        canvas.height
      );

      StorageService.markBadgeGenerated(membre.id, selectedStyle, badgeColors);
      const updated = {
        ...membre,
        badge_generated: true,
        badge_style: selectedStyle,
        badge_colors: badgeColors
      };
      setMembre(updated);
      if (onUpdateMembre) onUpdateMembre(updated);

      const link = document.createElement('a');
      link.download = `Badge_${selectedStyle}_${membre.prenom}_${membre.code_unique}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Badge download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintBadge = async () => {
    try {
      const dataUrl = await renderBadgeDataUrl(membre, group, selectedStyle, badgeColors, 4);
      StorageService.markBadgeGenerated(membre.id, selectedStyle, badgeColors);
      const updated = {
        ...membre,
        badge_generated: true,
        badge_style: selectedStyle,
        badge_colors: badgeColors
      };
      setMembre(updated);
      if (onUpdateMembre) onUpdateMembre(updated);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${t('badges.printTitle', { name: `${membre.prenom} ${membre.nom}` })}</title>
            <style>
              @page { size: 80mm 120mm; margin: 0; }
              html, body { margin: 0; padding: 0; background: #fff; }
              img { width: 80mm; height: 120mm; display: block; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" />
            <script>window.onload = function() { window.print(); };</script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Badge print error:', error);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 16, 0.88)',
      backdropFilter: 'blur(10px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div
        className="glass-card modal-panel"
        style={{
          maxWidth: isEditing ? '850px' : '500px',
          width: '100%',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'linear-gradient(180deg, #0e182c 0%, #080f1e 100%)',
          border: `1.5px solid ${styleConfig.accentColor}88`,
          boxShadow: `0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px ${styleConfig.accentColor}44`,
          borderRadius: '24px',
          maxHeight: 'calc(100dvh - 16px)',
          overflowY: 'auto',
          transition: 'max-width 0.3s ease'
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: styleConfig.accentColor }} />
            <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>
              {t('badges.officialTitle')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-ghost"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                color: isEditing ? '#10b981' : styleConfig.accentColor,
                border: `1px solid ${styleConfig.accentColor}55`
              }}
              title={t('badges.editInfoTitle')}
            >
              <Edit3 size={14} />
              <span>{isEditing ? t('badges.closeEditing') : t('common.edit')}</span>
            </button>

            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: '50%', color: '#94a3b8' }}
              title={t('common.close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ width: '100%', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Palette size={14} style={{ color: styleConfig.accentColor }} />
            <span>{t('badges.badgeTemplate')}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', width: '100%' }}>
            {BADGE_STYLES.map(style => {
              const isCurrent = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => handleSelectStyle(style.id)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '10px',
                    border: isCurrent ? `2px solid ${style.accentColor}` : '1px solid rgba(255,255,255,0.1)',
                    background: isCurrent ? `${style.accentColor}25` : 'rgba(0,0,0,0.3)',
                    color: isCurrent ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})`,
                    boxShadow: isCurrent ? `0 0 10px ${style.accentColor}` : 'none'
                  }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: isCurrent ? 800 : 500, lineHeight: 1.1 }}>
                    {styleLabel(style.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ width: '100%', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Palette size={14} style={{ color: styleConfig.accentColor }} />
              {t('badges.customColors')}
            </span>
            <button
              type="button"
              onClick={() => {
                const nextColors = getDefaultBadgeColors(selectedStyle);
                setBadgeColors(nextColors);
                persistMember({ ...membre, badge_style: selectedStyle, badge_colors: nextColors });
              }}
              className="btn btn-ghost"
              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
            >
              <RotateCcw size={11} />
              {t('badges.reset')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {([
              ['primary', 'badges.color.primary'],
              ['accent', 'badges.color.accent'],
              ['background', 'badges.color.background'],
              ['text', 'badges.color.text']
            ] as Array<[keyof BadgeColors, string]>).map(([key, labelKey]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)'
                }}
              >
                <input
                  type="color"
                  value={badgeColors[key]}
                  onChange={(event) => updateColor(key, event.target.value)}
                  style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                />
                <span>{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          <div
            id="printable-badge"
            className="badge-preview"
            style={{
              width: '320px',
              height: '480px',
              position: 'relative',
              flexShrink: 0,
              borderRadius: '20px',
              boxShadow: `0 20px 50px rgba(0, 0, 0, 0.75), 0 0 30px ${styleConfig.accentColor}33`,
              overflow: 'hidden',
              background: styleConfig.bgGradMid
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t('badges.badgeOf', { name: `${membre.prenom} ${membre.nom}` })}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem'
              }}>
                {t('badges.previewLoading')}
              </div>
            )}

            {membre.badge_generated && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: '#10b981',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.65rem',
                fontWeight: 800,
                zIndex: 10
              }}>
                {t('badges.alreadyGenerated')}
              </div>
            )}
          </div>

          {isEditing && (
            <div className="badge-edit-panel" style={{
              flex: '1',
              minWidth: '280px',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '18px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: styleConfig.accentColor }}>
                {t('badges.badgeInfo')}
              </h4>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('common.name')} :</label>
                <input
                  type="text"
                  value={editNom}
                  onChange={(event) => setEditNom(event.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('common.firstName')} :</label>
                <input
                  type="text"
                  value={editPrenom}
                  onChange={(event) => setEditPrenom(event.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('badges.cin')}</label>
                <input
                  type="text"
                  value={editCin}
                  onChange={(event) => setEditCin(event.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('badges.professionFunction')}</label>
                <input
                  type="text"
                  value={editProfession}
                  onChange={(event) => setEditProfession(event.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('badges.badgeNumber')}</label>
                <input
                  type="text"
                  value={editNumero}
                  onChange={(event) => setEditNumero(event.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('badges.profilePhoto')}</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1 }}
                    disabled={isUploadingPhoto}
                  >
                    <Upload size={14} />
                    <span>{isUploadingPhoto ? t('badges.optimizing') : t('badges.changePhoto')}</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveEdits}
                className="btn btn-primary"
                style={{ marginTop: '8px', fontSize: '0.82rem', padding: '8px' }}
              >
                <Check size={14} />
                <span>{t('badges.saveChanges')}</span>
              </button>
            </div>
          )}
        </div>

        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleDownloadFullBadge}
            disabled={isDownloading}
            className="btn btn-primary"
            style={{
              fontSize: '0.85rem',
              padding: '10px 20px',
              background: `linear-gradient(135deg, ${styleConfig.primaryColor}, ${styleConfig.accentColor})`,
              color: '#070d1e',
              fontWeight: 800
            }}
          >
            <Download size={16} />
            <span>{isDownloading ? t('badges.generating') : t('badges.downloadBadge')}</span>
          </button>

          <button
            onClick={handlePrintBadge}
            className="btn btn-ghost"
            style={{
              fontSize: '0.85rem',
              padding: '10px 18px',
              border: `1px solid ${styleConfig.accentColor}55`,
              color: '#ffffff'
            }}
          >
            <Printer size={16} />
            <span>{t('common.print')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberBadgeModal;

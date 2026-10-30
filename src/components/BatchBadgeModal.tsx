import React, { useState } from 'react';
import { Membre, Groupe, BadgeStyle, BadgeColors } from '../types';
import {
  BADGE_STYLES,
  getBadgeConfig,
  getDefaultBadgeColors,
  generateA4BadgePages
} from '../utils/badgeRenderer';
import { StorageService } from '../utils/storage';
import { useLanguage } from '../i18n';
import {
  X,
  Printer,
  Download,
  CheckSquare,
  Square,
  CheckCircle2,
  RefreshCw,
  Layers,
  Palette,
  RotateCcw
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';

interface BatchBadgeModalProps {
  allMembres: Membre[];
  allGroupes: Groupe[];
  onClose: () => void;
  onRefreshMembres: () => void;
}

export const BatchBadgeModal: React.FC<BatchBadgeModalProps> = ({
  allMembres,
  allGroupes,
  onClose,
  onRefreshMembres
}) => {
  const { t } = useLanguage();
  const eligibleMembres = allMembres.filter(m => m.is_approved !== false);

  const [selectedStyle, setSelectedStyle] = useState<BadgeStyle>('gold_royal');
  const [colors, setColors] = useState<BadgeColors>(() => getDefaultBadgeColors('gold_royal'));
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'ungenerated' | 'generated'>('all');

  const styleConfig = getBadgeConfig(selectedStyle, colors);
  const styleLabel = (styleId: BadgeStyle) => t(`badges.style.${styleId}`);

  const filteredList = eligibleMembres.filter(m => {
    if (filterMode === 'ungenerated') return !m.badge_generated;
    if (filterMode === 'generated') return m.badge_generated;
    return true;
  });

  const selectedMembers = eligibleMembres.filter(m => selectedMemberIds.includes(m.id));

  const handleSelectStyle = (styleId: BadgeStyle) => {
    setSelectedStyle(styleId);
    setColors(getDefaultBadgeColors(styleId));
  };

  const updateColor = (key: keyof BadgeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleToggleMember = (membre: Membre) => {
    if (selectedMemberIds.includes(membre.id)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== membre.id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, membre.id]);
    }
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredList.map(m => m.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedMemberIds.includes(id));
    if (allSelected) {
      setSelectedMemberIds(selectedMemberIds.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedMemberIds(Array.from(new Set([...selectedMemberIds, ...visibleIds])));
    }
  };

  const handleGenerateA4 = async (mode: 'png' | 'pdf') => {
    if (selectedMembers.length === 0) {
      alert(t('badges.selectAtLeastOne'));
      return;
    }

    setIsProcessing(true);
    try {
      const pages = await generateA4BadgePages(selectedMembers, allGroupes, styleConfig);
      const pageDataUrls = pages.map(page => page.toDataURL('image/png'));

      selectedMembers.forEach(membre => {
        StorageService.markBadgeGenerated(membre.id, selectedStyle, colors);
      });

      const stamp = Date.now();
      if (mode === 'png') {
        pageDataUrls.forEach((dataUrl, index) => {
          const link = document.createElement('a');
          const suffix = pageDataUrls.length > 1 ? `_page_${index + 1}` : '';
          link.download = `Badges_A4_${selectedStyle}${suffix}_${stamp}.png`;
          link.href = dataUrl;
          link.click();
        });
      } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const pageImages = pageDataUrls
            .map((dataUrl, index) => `<div class="page"><img src="${dataUrl}" alt="${t('badges.sheetAlt', { number: index + 1 })}" /></div>`)
            .join('');
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>${t('badges.printSheetsTitle')}</title>
              <style>
                @page { size: A4 portrait; margin: 0; }
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; background: #fff; }
                .page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
                .page:last-child { page-break-after: auto; }
                .page img { width: 100%; height: 100%; display: block; object-fit: contain; }
              </style>
            </head>
            <body>
              ${pageImages}
              <script>
                window.onload = function() { window.print(); };
              </script>
            </body>
            </html>
          `);
          printWindow.document.close();
        }
      }

      onRefreshMembres();
      setPreviewPages(pageDataUrls);
      setSelectedMemberIds([]);
      alert(t('badges.batchSuccess', { count: selectedMembers.length, pages: pageDataUrls.length }));
    } catch (error) {
      console.error('Batch badge error:', error);
      alert(t('badges.batchError'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.9)',
      backdropFilter: 'blur(10px)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div
        className="glass-card modal-panel"
        style={{
          maxWidth: '980px',
          width: '100%',
          maxHeight: 'calc(100dvh - 16px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0e1728 0%, #070d18 100%)',
          border: `1.5px solid ${styleConfig.accentColor}66`,
          borderRadius: '20px',
          boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 35px ${styleConfig.accentColor}25`,
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${styleConfig.primaryColor}, ${styleConfig.accentColor})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070d18'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff' }}>
                {t('badges.batchTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {t('badges.batchSubtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost"
            title={t('common.close')}
            aria-label={t('common.close')}
            style={{ padding: '8px', borderRadius: '50%', color: '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: styleConfig.accentColor }}>
                {t('badges.stepTemplate')}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {t('badges.templatePrefix')} <strong>{styleLabel(selectedStyle)}</strong>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {BADGE_STYLES.map(style => {
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => handleSelectStyle(style.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: isSelected ? `2px solid ${style.accentColor}` : '1px solid rgba(255,255,255,0.1)',
                      background: isSelected ? `${style.accentColor}25` : 'rgba(0,0,0,0.3)',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})`,
                      boxShadow: isSelected ? `0 0 12px ${style.accentColor}` : 'none'
                    }} />
                    <span style={{ fontSize: '0.74rem', fontWeight: isSelected ? 800 : 600 }}>
                      {styleLabel(style.id)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: styleConfig.accentColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Palette size={15} />
                {t('badges.stepColors')}
              </span>
              <button
                type="button"
                onClick={() => setColors(getDefaultBadgeColors(selectedStyle))}
                className="btn btn-ghost"
                style={{ fontSize: '0.72rem', padding: '4px 10px' }}
              >
                <RotateCcw size={12} />
                {t('badges.templateColors')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
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
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  <input
                    type="color"
                    value={colors[key]}
                    onChange={(event) => updateColor(key, event.target.value)}
                    style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                  />
                  <span>{t(labelKey)}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: styleConfig.accentColor }}>
                {t('badges.stepMembers', { count: selectedMemberIds.length })}
              </span>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterMode('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    background: filterMode === 'all' ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                    color: filterMode === 'all' ? '#000' : '#cbd5e1',
                    border: 'none',
                    fontWeight: 700
                  }}
                >
                  {t('badges.filterAll', { count: eligibleMembres.length })}
                </button>

                <button
                  onClick={() => setFilterMode('ungenerated')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    background: filterMode === 'ungenerated' ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                    color: filterMode === 'ungenerated' ? '#000' : '#cbd5e1',
                    border: 'none',
                    fontWeight: 700
                  }}
                >
                  {t('badges.filterUngenerated', { count: eligibleMembres.filter(m => !m.badge_generated).length })}
                </button>

                <button
                  onClick={() => setFilterMode('generated')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    background: filterMode === 'generated' ? '#10b981' : 'rgba(255,255,255,0.05)',
                    color: filterMode === 'generated' ? '#000' : '#cbd5e1',
                    border: 'none',
                    fontWeight: 700
                  }}
                >
                  {t('badges.filterGenerated', { count: eligibleMembres.filter(m => m.badge_generated).length })}
                </button>

                <button
                  onClick={handleSelectAllVisible}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                >
                  {t('badges.selectAll')}
                </button>

                {selectedMemberIds.length > 0 && (
                  <button
                    onClick={() => setSelectedMemberIds([])}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', color: '#ef4444' }}
                  >
                    {t('badges.deselectAll')}
                  </button>
                )}
              </div>
            </div>

            <div style={{
              maxHeight: '280px',
              overflowY: 'auto',
              overflowX: 'auto',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.25)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '8px 12px', width: '40px' }}>{t('badges.colSelect')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('common.member')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('common.code')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('common.group')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('badges.noMemberFilter')}
                      </td>
                    </tr>
                  ) : (
                    filteredList.map(membre => {
                      const isChecked = selectedMemberIds.includes(membre.id);
                      const groupe = allGroupes.find(g => g.id === membre.groupe_id);

                      return (
                        <tr
                          key={membre.id}
                          onClick={() => handleToggleMember(membre)}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            background: isChecked ? `${styleConfig.accentColor}14` : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            {isChecked ? (
                              <CheckSquare size={18} style={{ color: styleConfig.accentColor }} />
                            ) : (
                              <Square size={18} style={{ color: 'var(--text-dim)' }} />
                            )}
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img
                                src={membre.photo_url || DEFAULT_AVATAR_IMAGE}
                                alt={membre.prenom}
                                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                              <div>
                                <span style={{ fontWeight: 700, color: '#ffffff' }}>{membre.prenom} {membre.nom}</span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{membre.profession || t('common.member')}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: styleConfig.accentColor, fontWeight: 700 }}>
                            {membre.code_unique}
                          </td>

                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {groupe?.nom_groupe || t('badges.unassigned')}
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            {membre.badge_generated ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="badge badge-green" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle2 size={11} />
                                  {t('badges.generated')}
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (window.confirm(t('badges.resetConfirm', { name: `${membre.prenom} ${membre.nom}` }))) {
                                      StorageService.resetBadgeGenerated(membre.id);
                                      onRefreshMembres();
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                  title={t('badges.resetStatus')}
                                >
                                  <RefreshCw size={12} />
                                </button>
                              </div>
                            ) : (
                              <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>
                                {t('badges.toGenerate')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              {t('badges.alreadyGeneratedHint')}
            </div>
          </div>

          {previewPages.length > 0 && (
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <img
                src={previewPages[0]}
                alt={t('badges.sheetPreviewAlt')}
                style={{ width: '80px', height: '113px', objectFit: 'contain', border: '1px solid #ffffff' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#10b981' }}>
                  {t('badges.sheetsReady')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('badges.sheetsInfo', { count: previewPages.length })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {t('badges.selectionLabel')} <strong style={{ color: styleConfig.accentColor }}>{selectedMemberIds.length}</strong>
            {' '}• {t('badges.sheetsLabel')} <strong>{Math.ceil(selectedMemberIds.length / 4) || 0}</strong>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleGenerateA4('png')}
              disabled={isProcessing || selectedMemberIds.length === 0}
              className="btn btn-ghost"
              style={{
                fontSize: '0.82rem',
                padding: '8px 16px',
                border: `1px solid ${styleConfig.accentColor}66`,
                color: '#ffffff'
              }}
            >
              <Download size={15} />
              <span>{t('badges.pngHd')}</span>
            </button>

            <button
              onClick={() => handleGenerateA4('pdf')}
              disabled={isProcessing || selectedMemberIds.length === 0}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '8px 20px',
                background: `linear-gradient(135deg, ${styleConfig.primaryColor}, ${styleConfig.accentColor})`,
                color: '#070d18',
                fontWeight: 800
              }}
            >
              <Printer size={15} />
              <span>{isProcessing ? t('badges.generating') : t('badges.printSheets')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

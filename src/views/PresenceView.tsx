import React, { useState, useEffect, useRef } from 'react';
import { Membre, Presence, StatutPresence, MethodePresence } from '../types';
import { 
  QrCode, 
  Fingerprint, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Download, 
  Search, 
  Sparkles,
  Camera,
  CameraOff,
  FlipHorizontal,
  Upload,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StorageService } from '../utils/storage';
import { Html5Qrcode } from 'html5-qrcode';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audio';
import { canValidateAnyPresence, canValidatePresence } from '../utils/permissions';
import { useLanguage } from '../i18n';

interface PresenceViewProps {
  currentUser: Membre;
  allMembres: Membre[];
  presences: Presence[];
  onRefreshPresences: () => void;
}

export const PresenceView: React.FC<PresenceViewProps> = ({
  currentUser,
  allMembres,
  presences,
  onRefreshPresences
}) => {
  const { t } = useLanguage();
  const canValidate = canValidateAnyPresence(currentUser);
  const allGroupes = StorageService.getGroupes();
  const manageableMembres = canValidate
    ? allMembres.filter((m) => canValidatePresence(currentUser, m, allGroupes))
    : [currentUser];
  const manageableMembreIds = new Set(manageableMembres.map((m) => m.id));
  const visiblePresences = canValidate
    ? presences.filter((p) => manageableMembreIds.has(p.membre_id))
    : presences.filter((p) => p.membre_id === currentUser.id);

  const statusLabel = (statut: StatutPresence) => {
    if (statut === 'present') return t('common.status.present');
    if (statut === 'retard') return t('common.status.late');
    return t('common.status.absent');
  };

  const methodLabel = (methode: MethodePresence) => {
    if (methode === 'qr_code') return t('common.method.qr');
    if (methode === 'empreinte') return t('common.method.fingerprint');
    return t('common.method.manual');
  };

  // State for active tab: 'scanner', 'biometrie', 'manuel', 'historique'
  const [activeTab, setActiveTab] = useState<'scanner' | 'biometrie' | 'manuel' | 'historique'>(
    canValidate ? 'scanner' : 'historique'
  );

  // Live Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScannedResult, setLastScannedResult] = useState<{
    membre: Membre;
    timestamp: string;
    statut: StatutPresence;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number } | null>(null);
  const presenceScannerId = 'presence-live-camera-feed';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scanner manual input
  const [scannedCode, setScannedCode] = useState('');
  const [selectedStatut, setSelectedStatut] = useState<StatutPresence>('present');
  const [pointageSuccessMessage, setPointageSuccessMessage] = useState<string | null>(null);

  // Filters for history
  const [searchMember, setSearchMember] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Manual pointage state
  const [manualMembreId, setManualMembreId] = useState(manageableMembres[0]?.id || currentUser.id);

  // Handle Pointage (QR Code / Manual) — Chef/Admin only
  const handlePointage = (targetMembreId: string, methode: MethodePresence) => {
    const target = allMembres.find((m) => m.id === targetMembreId);
    if (!target) {
      alert(t('presence.error.memberNotFound'));
      return;
    }

    if (!canValidate) {
      alert(t('presence.error.noPermission'));
      return;
    }

    if (!canValidatePresence(currentUser, target, allGroupes)) {
      alert(t('presence.error.outsideScope'));
      return;
    }

    StorageService.pointPresence(target.id, selectedStatut, methode);
    onRefreshPresences();

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });

    setPointageSuccessMessage(t('presence.success.pointage', {
      name: `${target.prenom} ${target.nom}`,
      status: statusLabel(selectedStatut),
      method: methodLabel(methode)
    }));

    setTimeout(() => {
      setPointageSuccessMessage(null);
    }, 4500);
  };

  // Live Camera Scanner Methods
  const startCameraScanner = async (mode = facingMode) => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(presenceScannerId);
      }
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      await html5QrCodeRef.current.start(
        { facingMode: mode },
        { fps: 15, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (decodedText) => {
          handleCameraDecodedText(decodedText);
        },
        () => {}
      );
      setIsCameraActive(true);
    } catch (err: unknown) {
      console.error('Camera start error in PresenceView:', err);
      setIsCameraActive(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError(t('presence.camera.permissionError'));
      } else {
        setCameraError(t('presence.camera.startError'));
      }
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.debug('Error stopping presence camera', e);
      }
    }
    setIsCameraActive(false);
  };

  // Flip camera (front / back)
  const handleToggleFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (isCameraActive) {
      startCameraScanner(next);
    }
  };

  // Process decoded code from camera
  const handleCameraDecodedText = (decodedText: string) => {
    const now = Date.now();
    // Debounce duplicate scans within 2.5s for the same code
    if (lastScannedCodeRef.current && 
        lastScannedCodeRef.current.code === decodedText && 
        now - lastScannedCodeRef.current.time < 2500) {
      return;
    }
    lastScannedCodeRef.current = { code: decodedText, time: now };

    const clean = decodedText.trim().toLowerCase();
    const found = allMembres.find(
      (m) => m.code_unique.toLowerCase() === clean ||
             m.id.toLowerCase() === clean ||
             (m.cin && m.cin.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) ||
             clean.includes(m.code_unique.toLowerCase())
    );

    if (found) {
      playScanSuccessSound();
      handlePointage(found.id, 'qr_code');

      const d = new Date();
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      setLastScannedResult({
        membre: found,
        timestamp: timeStr,
        statut: selectedStatut
      });
    } else {
      playScanErrorSound();
    }
  };

  // Clean up camera on tab switch or unmount
  useEffect(() => {
    if (activeTab !== 'scanner' && html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().catch(() => {});
      setIsCameraActive(false);
    }
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [activeTab]);

  // Scan from photo file
  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(presenceScannerId);
      }
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        setIsCameraActive(false);
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      handleCameraDecodedText(decodedText);
    } catch {
      playScanErrorSound();
      alert(t('presence.error.qrImageUnreadable'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Handle Scan QR Input simulation
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode.trim()) return;

    const found = allMembres.find(
      (m) => m.code_unique.toLowerCase() === scannedCode.trim().toLowerCase() ||
             m.id.toLowerCase() === scannedCode.trim().toLowerCase() ||
             m.prenom.toLowerCase().includes(scannedCode.trim().toLowerCase())
    );

    if (found) {
      handlePointage(found.id, 'qr_code');
      setScannedCode('');
    } else {
      alert(t('presence.error.codeNotFound', { code: scannedCode }));
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      t('presence.csv.id'),
      t('presence.csv.fullName'),
      t('presence.csv.code'),
      t('presence.csv.dateTime'),
      t('presence.csv.status'),
      t('presence.csv.method')
    ];
    const rows = visiblePresences.map((p) => {
      const m = allMembres.find((mbr) => mbr.id === p.membre_id);
      return [
        p.id,
        m ? `${m.prenom} ${m.nom}` : p.membre_id,
        m ? m.code_unique : '',
        p.date_pointage,
        statusLabel(p.statut),
        methodLabel(p.methode)
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${t('presence.export.filePrefix')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered presence list
  const filteredPresences = visiblePresences.filter((p) => {
    const m = allMembres.find((mbr) => mbr.id === p.membre_id);
    const nameMatch = m 
      ? `${m.prenom} ${m.nom} ${m.code_unique}`.toLowerCase().includes(searchMember.toLowerCase())
      : true;
    const statutMatch = filterStatut === 'all' || p.statut === filterStatut;
    const monthMatch = filterMonth === 'all' || p.date_pointage.includes(`-${filterMonth.padStart(2, '0')}-`);
    return nameMatch && statutMatch && monthMatch;
  });

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-gold">{t('presence.badge')}</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', margin: '6px 0 0' }}>{t('presence.title')}</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {canValidate
              ? t('presence.subtitle.manager')
              : t('presence.subtitle.member')}
          </p>
        </div>

        <button 
          onClick={exportCSV} 
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Download size={16} />
          <span>{t('presence.exportCsv')}</span>
        </button>
      </div>

      {/* Success alert */}
      {pointageSuccessMessage && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle2 size={22} />
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pointageSuccessMessage}</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px',
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        {canValidate && (
          <button
            onClick={() => setActiveTab('scanner')}
            className={`btn ${activeTab === 'scanner' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <Camera size={16} />
            <span>{t('presence.tabs.scanner')}</span>
          </button>
        )}

        {canValidate && (
          <button
            onClick={() => setActiveTab('biometrie')}
            className={`btn ${activeTab === 'biometrie' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <Fingerprint size={16} />
            <span>{t('presence.tabs.biometrics')}</span>
          </button>
        )}

        {canValidate && (
          <button
            onClick={() => setActiveTab('manuel')}
            className={`btn ${activeTab === 'manuel' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <UserCheck size={16} />
            <span>{t('presence.tabs.manual')}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('historique')}
          className={`btn ${activeTab === 'historique' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: '0.85rem', padding: '8px 16px' }}
        >
          <Clock size={16} />
          <span>{t('presence.tabs.history', { count: visiblePresences.length })}</span>
        </button>
      </div>

      {/* TAB 1: QR CODE SCANNER */}
      {activeTab === 'scanner' && canValidate && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* REAL LIVE CAMERA SCANNER */}
          <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={20} style={{ color: 'var(--accent-gold)' }} />
                  <span>{t('presence.scanner.title')}</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', textAlign: 'left' }}>
                  {t('presence.scanner.subtitle')}
                </p>
              </div>

              {/* Camera Activation Button */}
              {isCameraActive ? (
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="btn btn-ghost"
                  style={{ color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}
                >
                  <CameraOff size={15} />
                  <span>{t('common.stop')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startCameraScanner()}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem', gap: '6px' }}
                >
                  <Camera size={15} />
                  <span>{t('presence.scanner.startCamera')}</span>
                </button>
              )}
            </div>

            {/* Camera Viewfinder Box */}
            <div style={{
              width: '100%',
              maxWidth: '360px',
              minHeight: '260px',
              margin: '0 auto 16px',
              borderRadius: '20px',
              border: isCameraActive ? '2px solid #10b981' : '2px dashed var(--accent-gold)',
              background: '#040812',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: isCameraActive ? '0 0 25px rgba(16, 185, 129, 0.25)' : 'none'
            }}>
              {/* html5-qrcode video target */}
              <div id={presenceScannerId} style={{ width: '100%', minHeight: '250px' }} />

              {/* Viewfinder corner brackets */}
              <div style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                width: '22px',
                height: '22px',
                borderTop: '3px solid #d4af37',
                borderLeft: '3px solid #d4af37',
                pointerEvents: 'none',
                zIndex: 10
              }} />
              <div style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '22px',
                height: '22px',
                borderTop: '3px solid #d4af37',
                borderRight: '3px solid #d4af37',
                pointerEvents: 'none',
                zIndex: 10
              }} />
              <div style={{
                position: 'absolute',
                bottom: '14px',
                left: '14px',
                width: '22px',
                height: '22px',
                borderBottom: '3px solid #d4af37',
                borderLeft: '3px solid #d4af37',
                pointerEvents: 'none',
                zIndex: 10
              }} />
              <div style={{
                position: 'absolute',
                bottom: '14px',
                right: '14px',
                width: '22px',
                height: '22px',
                borderBottom: '3px solid #d4af37',
                borderRight: '3px solid #d4af37',
                pointerEvents: 'none',
                zIndex: 10
              }} />

              {/* Laser animation when camera is active */}
              {isCameraActive && (
                <div style={{
                  position: 'absolute',
                  left: '15%',
                  right: '15%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #10b981, #ffffff, #10b981, transparent)',
                  boxShadow: '0 0 10px #10b981, 0 0 20px #10b981',
                  animation: 'laserScan 2s ease-in-out infinite',
                  pointerEvents: 'none',
                  zIndex: 9
                }} />
              )}

              {/* Initial placeholder when camera is not started */}
              {!isCameraActive && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(5, 12, 24, 0.95)',
                  padding: '20px',
                  zIndex: 8
                }}>
                  <QrCode size={75} style={{ color: 'rgba(212, 175, 55, 0.4)', marginBottom: '12px' }} />
                  <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 700, marginBottom: '6px' }}>
                    {t('presence.scanner.readyTitle')}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '14px' }}>
                    {t('presence.scanner.readySubtitle')}
                  </div>
                  <button
                    type="button"
                    onClick={() => startCameraScanner()}
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem', padding: '8px 16px' }}
                  >
                    <Camera size={16} />
                    <span>{t('presence.scanner.startScanner')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Camera error message */}
            {cameraError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontSize: '0.8rem',
                marginBottom: '12px',
                textAlign: 'left'
              }}>
                {cameraError}
              </div>
            )}

            {/* Camera controls toolbar */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {isCameraActive && (
                <button
                  type="button"
                  onClick={handleToggleFacing}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <FlipHorizontal size={14} />
                  <span>{t('presence.scanner.flip', { side: facingMode === 'environment' ? t('presence.scanner.side.back') : t('presence.scanner.side.front') })}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                <Upload size={14} />
                <span>{t('presence.scanner.uploadImage')}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleScanImageFile}
                style={{ display: 'none' }}
              />
            </div>

            {/* Last Scanned Member Toast/Card */}
            {lastScannedResult && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(7, 16, 30, 0.95))',
                border: '1.5px solid #10b981',
                borderRadius: '14px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                textAlign: 'left',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(16, 185, 129, 0.25)',
                animation: 'fadeIn 0.25s ease-out'
              }}>
                <img
                  src={lastScannedResult.membre.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={lastScannedResult.membre.prenom}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>
                    {t('presence.scanner.verifiedAt', { time: lastScannedResult.timestamp })}
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff' }}>
                    {lastScannedResult.membre.prenom} {lastScannedResult.membre.nom}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#d4af37' }}>
                    {lastScannedResult.membre.profession || t('common.member')} • {t('presence.scanner.badgeNumber', { number: lastScannedResult.membre.numero_badge || '007' })}
                  </div>
                </div>
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: lastScannedResult.statut === 'present' ? 'rgba(16, 185, 129, 0.2)' : lastScannedResult.statut === 'retard' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: lastScannedResult.statut === 'present' ? '#34d399' : lastScannedResult.statut === 'retard' ? '#fbbf24' : '#f87171',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  textTransform: 'uppercase'
                }}>
                  {statusLabel(lastScannedResult.statut)}
                </div>
              </div>
            )}

            {/* Status selector */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 700 }}>
                {t('presence.scanner.statusSelectLabel')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedStatut('present')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedStatut === 'present' ? '2px solid #10b981' : '1px solid var(--border-color)',
                    background: selectedStatut === 'present' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    color: selectedStatut === 'present' ? '#10b981' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem'
                  }}
                >
                  {t('presence.statusOption.present')}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatut('retard')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedStatut === 'retard' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                    background: selectedStatut === 'retard' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    color: selectedStatut === 'retard' ? '#f59e0b' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem'
                  }}
                >
                  {t('presence.statusOption.late')}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedStatut('absent')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: selectedStatut === 'absent' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    background: selectedStatut === 'absent' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: selectedStatut === 'absent' ? '#ef4444' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem'
                  }}
                >
                  {t('presence.statusOption.absent')}
                </button>
              </div>
            </div>

            {/* Quick manual scan input */}
            <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder={t('presence.scanner.codePlaceholder')}
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.9rem' }}
              />
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                {t('presence.scanner.submitCode')}
              </button>
            </form>
          </div>

          {/* Quick list of members to click-and-point directly */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{t('presence.quick.title')}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              {t('presence.quick.subtitle')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {manageableMembres.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={m.photo_url}
                      alt={m.prenom}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                        {m.prenom} {m.nom}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold)' }}>
                        {m.code_unique}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setSelectedStatut('present');
                        handlePointage(m.id, 'qr_code');
                      }}
                      className="btn btn-success"
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      title={t('presence.quick.markPresent')}
                    >
                      {t('common.status.present')}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStatut('retard');
                        handlePointage(m.id, 'qr_code');
                      }}
                      className="btn btn-primary"
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      title={t('presence.quick.markLate')}
                    >
                      {t('common.status.late')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BIOMETRIE (EMPREINTE DIGITALE) */}
      {activeTab === 'biometrie' && canValidate && (
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            border: '2px solid rgba(139, 92, 246, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#a78bfa'
          }}>
            <Fingerprint size={42} />
          </div>

          <h3 style={{ fontSize: '1.3rem', margin: '0 0 8px' }}>
            {t('presence.biometrics.title')}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
            {t('presence.biometrics.subtitle')}
          </p>

          <div style={{
            width: '180px',
            height: '180px',
            margin: '0 auto 24px',
            borderRadius: '50%',
            border: '3px solid #8b5cf6',
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'rgba(15, 23, 42, 0.5)'
          }}
          onClick={() => {
            // Pick current user or prompt
            handlePointage(currentUser.id, 'empreinte');
          }}
          title={t('presence.biometrics.tapTitle')}
          >
            <Fingerprint size={80} style={{ color: '#a78bfa', animation: 'pulseGlow 2s infinite' }} />
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {t('presence.biometrics.memberLabel')} <strong style={{ color: 'var(--text-main)' }}>{currentUser.prenom} {currentUser.nom}</strong> ({currentUser.fingerprint_registered ? t('presence.biometrics.fingerprintRegistered') : t('presence.biometrics.fingerprintNotRegistered')})
          </div>

          <button
            onClick={() => handlePointage(currentUser.id, 'empreinte')}
            className="btn btn-purple"
            style={{ padding: '12px 28px', fontSize: '0.95rem' }}
          >
            <Sparkles size={18} />
            <span>{t('presence.biometrics.confirm')}</span>
          </button>
        </div>
      )}

      {/* TAB 3: MANUEL POINTAGE */}
      {activeTab === 'manuel' && canValidate && (
        <div className="glass-card" style={{ padding: '28px', maxWidth: '650px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{t('presence.manual.title')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {t('presence.manual.subtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                {t('presence.manual.memberLabel')}
              </label>
              <select
                className="form-select"
                value={manualMembreId}
                onChange={(e) => setManualMembreId(e.target.value)}
              >
                {manageableMembres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prenom} {m.nom} — ({m.code_unique})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                {t('presence.manual.statusLabel')}
              </label>
              <select
                className="form-select"
                value={selectedStatut}
                onChange={(e) => setSelectedStatut(e.target.value as StatutPresence)}
              >
                <option value="present">{t('presence.statusOption.present')}</option>
                <option value="retard">{t('presence.statusOption.late')}</option>
                <option value="absent">{t('presence.statusOption.absent')}</option>
              </select>
            </div>

            <button
              onClick={() => handlePointage(manualMembreId, 'manuel')}
              className="btn btn-primary"
              style={{ marginTop: '10px', padding: '12px' }}
            >
              <CheckCircle2 size={18} />
              <span>{t('presence.manual.submit')}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORIQUE DES PRESENCES */}
      {activeTab === 'historique' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          
          {/* Filters Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder={t('presence.history.searchPlaceholder')}
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="form-select"
            >
              <option value="all">{t('presence.history.allStatuses')}</option>
              <option value="present">{t('presence.history.presentOnly')}</option>
              <option value="retard">{t('presence.history.lateOnly')}</option>
              <option value="absent">{t('presence.history.absentOnly')}</option>
            </select>

            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="form-select"
            >
              <option value="all">{t('presence.history.allMonths')}</option>
              <option value="10">{t('presence.history.monthOption', { month: t('common.month.10'), number: '10' })}</option>
              <option value="09">{t('presence.history.monthOption', { month: t('common.month.9'), number: '09' })}</option>
              <option value="08">{t('presence.history.monthOption', { month: t('common.month.8'), number: '08' })}</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '10px 12px' }}>{t('presence.table.member')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('presence.table.dateTime')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('presence.table.status')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('presence.table.method')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPresences.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t('presence.history.empty')}
                    </td>
                  </tr>
                ) : (
                  filteredPresences.map((p) => {
                    const m = allMembres.find((mbr) => mbr.id === p.membre_id);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={m?.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60'}
                              alt=""
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                              <div style={{ fontWeight: 700 }}>{m?.prenom} {m?.nom}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m?.code_unique}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {p.date_pointage}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {p.statut === 'present' ? (
                            <span className="badge badge-green"><CheckCircle2 size={12} /> {statusLabel(p.statut)}</span>
                          ) : p.statut === 'retard' ? (
                            <span className="badge badge-gold"><Clock size={12} /> {statusLabel(p.statut)}</span>
                          ) : (
                            <span className="badge badge-red"><XCircle size={12} /> {statusLabel(p.statut)}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {methodLabel(p.methode)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};

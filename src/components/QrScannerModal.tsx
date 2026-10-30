import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Membre, StatutPresence } from '../types';
import { StorageService } from '../utils/storage';
import { playScanSuccessSound, playScanErrorSound } from '../utils/audio';
import { canValidatePresence } from '../utils/permissions';
import { useLanguage } from '../i18n';
import confetti from 'canvas-confetti';
import { 
  X, 
  Camera, 
  FlipHorizontal, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Search,
  UserCheck,
  Clock
} from 'lucide-react';
import { DEFAULT_AVATAR_IMAGE } from '../utils/defaultAvatar';

const STATUS_LABEL_KEYS: Record<StatutPresence, string> = {
  present: 'common.status.present',
  retard: 'common.status.late',
  absent: 'common.status.absent'
};

interface QrScannerModalProps {
  onClose: () => void;
  currentUser: Membre;
  allMembres?: Membre[];
  onPresenceMarked?: (membre: Membre, statut: StatutPresence) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  onClose,
  currentUser,
  allMembres: propMembres,
  onPresenceMarked
}) => {
  const { t } = useLanguage();
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedStatut, setSelectedStatut] = useState<StatutPresence>('present');
  const [manualCode, setManualCode] = useState<string>('');
  
  // Last scanned member result
  const [scannedResult, setScannedResult] = useState<{
    membre: Membre;
    timestamp: string;
    statut: StatutPresence;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerContainerId = 'qr-modal-scanner-viewport';

  // Load all members from storage if not passed in props
  const membersList = propMembres && propMembres.length > 0 
    ? propMembres 
    : StorageService.getMembres();

  // Find member from QR code text
  const matchMemberFromCode = (rawCode: string): Membre | null => {
    const clean = rawCode.trim().toLowerCase();
    return membersList.find((m) => {
      if (m.code_unique.toLowerCase() === clean) return true;
      if (m.id.toLowerCase() === clean) return true;
      if (m.cin && m.cin.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) return true;
      // In case QR contains JSON like { "code": "..." }
      if (clean.includes(m.code_unique.toLowerCase())) return true;
      return false;
    }) || null;
  };

  // Handle successful scan
  const handleDecodedCode = (decodedText: string) => {
    const targetMember = matchMemberFromCode(decodedText);

    if (targetMember && !canValidatePresence(currentUser, targetMember, StorageService.getGroupes())) {
      playScanErrorSound();
      alert(t('scanner.error.noPermission'));
      return;
    }

    if (targetMember) {
      // Success feedback
      playScanSuccessSound();
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Record presence in storage
      StorageService.pointPresence(targetMember.id, selectedStatut, 'qr_code');

      if (onPresenceMarked) {
        onPresenceMarked(targetMember, selectedStatut);
      }

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      setScannedResult({
        membre: targetMember,
        timestamp: timeStr,
        statut: selectedStatut
      });

      // Pause or stop current scan to display member card
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.pause(true);
      }
    } else {
      playScanErrorSound();
      alert(t('scanner.error.codeNotFound', { code: decodedText }));
    }
  };

  // Start Camera
  const startScanner = async (cameraIdOrFacing?: string | { facingMode: 'environment' | 'user' } | { deviceId: { exact: string } }) => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }

      // If already scanning, stop first
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const config = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0
      };

      const cameraParam = cameraIdOrFacing || (selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode });

      await html5QrCodeRef.current.start(
        cameraParam as string | MediaTrackConstraints,
        config,
        (decodedText) => {
          handleDecodedCode(decodedText);
        },
        () => {
          // ignore frame errors
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error('Erreur camAcra:', err);
      setIsScanning(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError(t('scanner.camera.permissionError'));
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError(t('scanner.camera.notFound'));
      } else {
        setCameraError(t('scanner.camera.startError'));
      }
    }
  };

  // Stop camera
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.debug('Error stopping scanner', e);
      }
    }
    setIsScanning(false);
  };

  // Initialize cameras and start
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          // Prefer back camera if available
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('arriere') || d.label.toLowerCase().includes('environment'));
          const initialId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(initialId);
          startScanner({ deviceId: { exact: initialId } });
        } else {
          startScanner({ facingMode: 'environment' });
        }
      })
      .catch((err) => {
        console.warn('GetCameras fallback:', err);
        startScanner({ facingMode: 'environment' });
      });

    return () => {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch camera toggle (front / back)
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startScanner({ facingMode: nextMode });
  };

  // Scan from photo file
  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }
      // If scanning camera, stop first
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      handleDecodedCode(decodedText);
    } catch {
      playScanErrorSound();
      alert(t('scanner.error.qrImageUnreadable'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Manual code entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedCode(manualCode.trim());
    setManualCode('');
  };

  // Resume scanning for next member
  const handleScanNext = () => {
    setScannedResult(null);
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.resume();
      } catch {
        startScanner();
      }
    } else {
      startScanner();
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 11, 22, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div 
        className="glass-card modal-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(180deg, #0e1a30 0%, #080f1e 100%)',
          border: '1.5px solid rgba(212, 175, 55, 0.45)',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(212, 175, 55, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #d4af37, #f7d070)',
              color: '#07101e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.35)'
            }}>
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: '#ffffff' }}>
                {t('scanner.title')}
              </h3>
              <div style={{ fontSize: '0.72rem', color: '#d4af37', fontWeight: 600 }}>
                {t('scanner.subtitle')}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '50%', color: '#94a3b8' }}
            title={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Selection Buttons */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.04em' }}>
            {t('scanner.statusSelectLabel')}
          </div>
          <div className="scanner-status-row" style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setSelectedStatut('present')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '10px',
                border: selectedStatut === 'present' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedStatut === 'present' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedStatut === 'present' ? '#34d399' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s ease'
              }}
            >
              <UserCheck size={14} />
              <span>{t('common.status.present')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatut('retard')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '10px',
                border: selectedStatut === 'retard' ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedStatut === 'retard' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedStatut === 'retard' ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s ease'
              }}
            >
              <Clock size={14} />
              <span>{t('common.status.late')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatut('absent')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '10px',
                border: selectedStatut === 'absent' ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedStatut === 'absent' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedStatut === 'absent' ? '#f87171' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s ease'
              }}
            >
              <X size={14} />
              <span>{t('common.status.absent')}</span>
            </button>
          </div>
        </div>

        {/* SCANNED RESULT POPUP OVERLAY */}
        {scannedResult ? (
          <div style={{
            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(7, 16, 30, 0.95))',
            border: '2px solid #10b981',
            borderRadius: '18px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.3)',
            animation: 'fadeIn 0.3s ease-out',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.5)'
            }}>
              <CheckCircle2 size={30} />
            </div>

            <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('scanner.verified')}
            </div>

            {/* Member Card preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '14px 0', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>
              <img
                src={scannedResult.membre.photo_url || DEFAULT_AVATAR_IMAGE}
                alt={scannedResult.membre.prenom}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #d4af37'
                }}
              />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  {scannedResult.membre.prenom} {scannedResult.membre.nom}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#d4af37', fontWeight: 700 }}>
                  {scannedResult.membre.profession || t('common.member')} • {t('scanner.badgeNumber', { number: scannedResult.membre.numero_badge || '007' })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {t('scanner.codeLabel')} <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 700 }}>{scannedResult.membre.code_unique}</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#e2e8f0', marginBottom: '16px' }}>
              {t('scanner.entryTime')} <strong>{scannedResult.timestamp}</strong> — {t('scanner.resultStatusLabel')} <span style={{ 
                color: scannedResult.statut === 'present' ? '#34d399' : scannedResult.statut === 'retard' ? '#fbbf24' : '#f87171',
                fontWeight: 800 
              }}>
                {t(STATUS_LABEL_KEYS[scannedResult.statut]).toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleScanNext}
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '0.88rem' }}
              >
                <RefreshCw size={16} />
                <span>{t('scanner.scanNext')}</span>
              </button>

              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ padding: '10px 16px', fontSize: '0.88rem' }}
              >
                {t('scanner.done')}
              </button>
            </div>
          </div>
        ) : (
          /* SCANNER VIEWFINDER BOX */
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <div 
              style={{
                width: '100%',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#040812',
                border: '2px solid rgba(212, 175, 55, 0.4)',
                position: 'relative',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* html5-qrcode video viewport container */}
              <div 
                id={scannerContainerId} 
                style={{ width: '100%', minHeight: '250px' }} 
              />

              {/* Decorative Corner Aim Marks */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                width: '24px',
                height: '24px',
                borderTop: '3px solid #d4af37',
                borderLeft: '3px solid #d4af37',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '24px',
                height: '24px',
                borderTop: '3px solid #d4af37',
                borderRight: '3px solid #d4af37',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                width: '24px',
                height: '24px',
                borderBottom: '3px solid #d4af37',
                borderLeft: '3px solid #d4af37',
                pointerEvents: 'none'
              }} />
              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '24px',
                height: '24px',
                borderBottom: '3px solid #d4af37',
                borderRight: '3px solid #d4af37',
                pointerEvents: 'none'
              }} />

              {/* Laser animation */}
              {isScanning && (
                <div style={{
                  position: 'absolute',
                  left: '15%',
                  right: '15%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #d4af37, #ffffff, #d4af37, transparent)',
                  boxShadow: '0 0 10px #d4af37, 0 0 20px #f59e0b',
                  animation: 'laserScan 2.2s ease-in-out infinite',
                  pointerEvents: 'none'
                }} />
              )}
            </div>

            {/* Camera error message if permission blocked */}
            {cameraError && (
              <div style={{
                marginTop: '10px',
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>{t('scanner.camera.notice')}</div>
                  <div>{cameraError}</div>
                  <button 
                    onClick={() => startScanner()} 
                    className="btn btn-ghost" 
                    style={{ fontSize: '0.75rem', padding: '4px 8px', marginTop: '6px', color: '#ffffff', border: '1px solid #ef4444' }}
                  >
                    {t('scanner.retry')}
                  </button>
                </div>
              </div>
            )}

            {/* Camera Controls row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', gap: '8px', flexWrap: 'wrap' }}>
              {/* Camera Switch button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '6px' }}
                title={t('scanner.changeCameraTitle')}
              >
                <FlipHorizontal size={14} />
                <span>{t('scanner.flip', { side: t(facingMode === 'environment' ? 'scanner.side.back' : 'scanner.side.front') })}</span>
              </button>

              {/* Upload image file button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '6px 12px', gap: '6px' }}
                title={t('scanner.uploadImageTitle')}
              >
                <Upload size={14} />
                <span>{t('scanner.uploadImage')}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleScanImageFile}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Manual Code Input Bar */}
        <div style={{
          marginTop: 'auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '12px'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
            {t('scanner.manualCodeLabel')}
          </div>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder={t('scanner.manualPlaceholder')}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="form-input"
                style={{
                  fontSize: '0.85rem',
                  paddingLeft: '32px',
                  background: 'rgba(0, 0, 0, 0.3)'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              {t('common.confirm')}
            </button>
          </form>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes laserScan {
            0% { top: 12%; opacity: 0.2; }
            50% { top: 88%; opacity: 1; }
            100% { top: 12%; opacity: 0.2; }
          }
          #${scannerContainerId} video {
            border-radius: 14px;
            object-fit: cover !important;
            width: 100% !important;
          }
        `}</style>
      </div>
    </div>
  );
};

export default QrScannerModal;

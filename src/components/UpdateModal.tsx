import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, Smartphone, X } from 'lucide-react';
import { useLanguage } from '../i18n';
import {
  AppUpdater,
  AppUpdateManifest,
  fetchAppUpdateManifest,
  getAppUpdateManifestUrl,
  getCurrentAppVersion,
  isAppUpdaterAvailable,
  resolveApkUrl
} from '../utils/appUpdate';
import {
  applyPendingBundle,
  checkLiveUpdate,
  getCurrentWebBundle
} from '../utils/liveUpdate';
import { REMOTE_APP_URL } from '../lib/appConfig';
import { supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import { getSyncStatus } from '../utils/supabaseSync';
import { StorageService } from '../utils/storage';

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'installing' | 'permission' | 'error';

interface DiagResult {
  online: boolean;
  realtime: string;
  lastHydrateAt: number | null;
  lastHydrateError: string | null;
  server: string;
  database: string;
  members: number;
  messages: number;
  storageKb: number;
  storageWrite: boolean;
  memberImagesPending: number;
  memberImagesFetched: number;
  memberImageError: string | null;
}

interface UpdateModalProps {
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [manifest, setManifest] = useState<AppUpdateManifest | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [currentVersionCode, setCurrentVersionCode] = useState(0);
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [message, setMessage] = useState('');
  const [webStatus, setWebStatus] = useState<'idle' | 'checking' | 'updated' | 'none' | 'error'>('idle');
  const [webBundles, setWebBundles] = useState<{ current: string | null; next: string | null } | null>(null);
  const [diag, setDiag] = useState<DiagResult | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  // Play Store builds do not allow in-app APK installation, so the plugin
  // reports "no update" even when the public manifest is newer.
  const [selfUpdateAvailable, setSelfUpdateAvailable] = useState(true);
  const [selfUpdateSupported, setSelfUpdateSupported] = useState(true);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setStatus('checking');
    setMessage('');
    try {
      const [latest, current] = await Promise.all([
        fetchAppUpdateManifest(),
        getCurrentAppVersion()
      ]);
      setSelfUpdateSupported(current.selfUpdate !== false);
      if (isAppUpdaterAvailable()) {
        try {
          const info = await AppUpdater.checkForUpdate({
            updateUrl: getAppUpdateManifestUrl()
          });
          setSelfUpdateAvailable(Boolean(info.available));
          if (typeof info.selfUpdate === 'boolean') {
            setSelfUpdateSupported(info.selfUpdate);
          }
        } catch {
          setSelfUpdateAvailable(false);
        }
      }
      setManifest(latest);
      setCurrentVersionCode(current.versionCode);
      setCurrentVersion(
        current.versionName && current.versionName !== 'web'
          ? current.versionName
          : 'web'
      );
      setStatus('idle');
    } catch {
      setStatus('error');
      setMessage(t('update.error'));
    } finally {
      checkingRef.current = false;
    }
  }, [t]);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (!isAppUpdaterAvailable()) return;
    void getCurrentWebBundle().then(setWebBundles).catch(() => setWebBundles(null));
  }, []);

  const isNative = isAppUpdaterAvailable();
  // Sur Android on ne propose l'installation que si le manifeste est plus
  // recent que l'APK installe. Sur le web, le bouton telecharge l'APK.
  const storeManaged = isNative && !selfUpdateSupported;
  const hasUpdate = Boolean(manifest) && (
    isNative ? !storeManaged && selfUpdateAvailable && manifest!.versionCode > currentVersionCode : true
  );
  const upToDate = Boolean(manifest) && isNative && !storeManaged && !hasUpdate && status === 'idle';

  const install = async () => {
    if (!manifest) return;
    const apkUrl = resolveApkUrl(manifest.apkUrl);
    if (!isNative) {
      window.open(apkUrl, '_blank', 'noopener');
      return;
    }
    setStatus('downloading');
    setMessage('');
    try {
      const result = await AppUpdater.downloadAndInstall({ apkUrl });
      if (result.needsPermission) {
        setStatus('permission');
        return;
      }
      setStatus('installing');
    } catch {
      setStatus('error');
      setMessage(t('update.error'));
    }
  };

  const checkWebUpdate = async () => {
    setWebStatus('checking');
    try {
      const result = await checkLiveUpdate(true, false);
      setWebStatus(result.updated ? 'updated' : 'none');
      setWebBundles(await getCurrentWebBundle());
    } catch {
      setWebStatus('error');
    }
  };

  const applyWebUpdate = async () => {
    await applyPendingBundle();
  };

  const runDiagnostics = async () => {
    setDiagRunning(true);
    const status = getSyncStatus();
    const testFetch = async (url: string, headers?: Record<string, string>) => {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 12000);
        const response = await fetch(url, {
          headers,
          cache: 'no-store',
          signal: controller.signal
        });
        window.clearTimeout(timer);
        return `HTTP ${response.status}`;
      } catch (error) {
        return `ERREUR ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    const server = await testFetch(`${REMOTE_APP_URL}/bundle.json`);
    const database = supabaseUrl && supabaseAnonKey
      ? await testFetch(`${supabaseUrl}/rest/v1/app_state?select=key&limit=1`, {
          apikey: supabaseAnonKey
        })
      : 'non configure';

    let storageKb = -1;
    try {
      let bytes = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;
        bytes += key.length + (localStorage.getItem(key)?.length ?? 0);
      }
      storageKb = Math.round(bytes / 1024);
    } catch {
      storageKb = -1;
    }

    let storageWrite = false;
    try {
      localStorage.setItem('fiaram_diag_test', '1');
      localStorage.removeItem('fiaram_diag_test');
      storageWrite = true;
    } catch {
      storageWrite = false;
    }

    // Re-download outdated avatars/covers now so the diagnostic reports a real
    // result instead of the state left by the last background poll.
    await StorageService.hydrateMemberImages();
    const images = getSyncStatus();

    setDiag({
      online: typeof navigator !== 'undefined' ? navigator.onLine : false,
      realtime: status.realtime,
      lastHydrateAt: status.lastHydrateAt,
      lastHydrateError: status.lastHydrateError,
      server,
      database,
      members: StorageService.getMembres().length,
      messages: StorageService.getMessages().length,
      storageKb,
      storageWrite,
      memberImagesPending: images.memberImagesPending,
      memberImagesFetched: images.memberImagesFetched,
      memberImageError: images.memberImageError
    });
    setDiagRunning(false);
  };

  const statusLabel = status === 'checking'
    ? t('update.checking')
    : status === 'downloading'
      ? t('update.downloading')
      : status === 'installing'
        ? t('update.installing')
        : status === 'permission'
          ? t('update.permissionButton')
          : t('update.download');

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3700,
        background: 'rgba(3, 7, 18, 0.86)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-card animate-fade-in update-modal-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(460px, 100%)',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '22px',
          borderRadius: '20px',
          background: 'linear-gradient(180deg, #0e1728 0%, #070d18 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.42)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            flexShrink: 0,
            borderRadius: '13px',
            background: 'linear-gradient(135deg, rgba(245,158,11,.25), rgba(139,92,246,.22))',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {status === 'checking'
              ? <RefreshCw size={21} style={{ animation: 'fiaram-spin 0.9s linear infinite' }} />
              : upToDate
                ? <CheckCircle2 size={21} />
                : <Smartphone size={21} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.08rem' }}>{t('update.title')}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {t('update.platformHint')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '50%', color: '#94a3b8' }}
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('update.currentVersion')}</span>
            <strong>{currentVersion || '…'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('update.latestVersion')}</span>
            <strong style={{ color: 'var(--accent-gold)' }}>
              {manifest ? manifest.versionName || manifest.versionCode : '…'}
            </strong>
          </div>
        </div>

        {manifest?.notes && (
          <div style={{
            marginTop: '12px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '4px' }}>
              {t('update.notesTitle')}
            </div>
            {manifest.notes}
          </div>
        )}

        {status === 'error' && message && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#f87171', lineHeight: 1.45 }}>
            {message}
          </div>
        )}

        {status === 'permission' && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#fbbf24', lineHeight: 1.45 }}>
            {t('update.permission')}
          </div>
        )}

        {status === 'installing' && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#34d399', lineHeight: 1.45 }}>
            {t('update.installing')}
          </div>
        )}

        {upToDate && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#34d399', lineHeight: 1.45 }}>
            {t('update.upToDate')}
          </div>
        )}

        {storeManaged && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#60a5fa', lineHeight: 1.45 }}>
            {t('update.playStoreManaged')}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px', marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
            onClick={() => void (hasUpdate ? install() : check())}
            disabled={status === 'checking' || status === 'downloading' || status === 'installing'}
          >
            {hasUpdate ? <Download size={16} /> : <RefreshCw size={16} />}
            <span>{hasUpdate ? statusLabel : t('update.checkButton')}</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
            onClick={() => void check()}
            disabled={status === 'checking' || status === 'downloading'}
            title={t('update.checkButton')}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {isNative && (
          <div style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5, minWidth: 0 }}>
              <div>{t('update.webBundle')} :</div>
              <code
                style={{
                  display: 'block',
                  marginTop: '2px',
                  fontSize: '0.7rem',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all'
                }}
              >
                {webBundles?.current || t('update.webBundleEmbedded')}
              </code>
              {webBundles?.next ? (
                <div style={{ marginTop: '4px', overflowWrap: 'anywhere', wordBreak: 'break-all' }}>
                  → {webBundles.next}
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {webStatus === 'updated'
                ? t('update.webReady')
                : webStatus === 'none'
                  ? t('update.webUpToDate')
                  : t('update.webUpdate')}
            </div>
            {webStatus === 'updated' ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                onClick={() => void applyWebUpdate()}
              >
                <RefreshCw size={16} />
                <span>{t('update.webApply')}</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                onClick={() => void checkWebUpdate()}
                disabled={webStatus === 'checking'}
              >
                <RefreshCw size={16} />
                <span>{webStatus === 'checking' ? t('update.webChecking') : t('update.webUpdate')}</span>
              </button>
            )}

            <div style={{
              marginTop: '6px',
              paddingTop: '10px',
              borderTop: '1px dashed var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              fontSize: '0.68rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.72rem' }}>
                {t('update.diagTitle')}
              </div>
              <div>
                {t('update.diagNetwork')} : {diag ? (diag.online ? t('update.diagOnline') : t('update.diagOffline')) : '—'}
              </div>
              <div>
                {t('update.diagRealtime')} : {diag?.realtime ?? getSyncStatus().realtime}
              </div>
              <div>
                {t('update.diagLastSync')} : {diag?.lastHydrateAt ? new Date(diag.lastHydrateAt).toLocaleTimeString() : t('update.diagNever')}
                {diag?.lastHydrateError ? ` (${diag.lastHydrateError})` : ''}
              </div>
              <div>{t('update.diagServer')} : {diag?.server ?? '—'}</div>
              <div>{t('update.diagDatabase')} : {diag?.database ?? '—'}</div>
              <div>
                {t('update.diagStorage')} : {diag ? `${diag.storageKb < 0 ? '?' : diag.storageKb} Ko ${diag.storageWrite ? 'OK' : t('update.diagFull')}` : '—'}
              </div>
              <div>{t('update.diagData')} : {diag ? `${diag.members} / ${diag.messages}` : '—'}</div>
              <div>
                {t('update.diagPhotos')} : {diag
                  ? `${diag.memberImagesFetched}/${diag.memberImagesPending}${diag.memberImageError ? ` (${diag.memberImageError})` : ''}`
                  : '—'}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void runDiagnostics()}
                disabled={diagRunning}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginTop: '2px' }}
              >
                <RefreshCw size={15} />
                <span>{diagRunning ? t('update.diagRunning') : t('update.diagRun')}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => window.location.reload()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
              >
                <RefreshCw size={15} />
                <span>{t('update.diagReload')}</span>
              </button>
            </div>
          </div>
        )}

        {!isNative && (
          <div style={{
            marginTop: '10px',
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px'
          }}>
            <CheckCircle2 size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span>{t('update.webHint')}</span>
          </div>
        )}
      </div>
      <style>{`@keyframes fiaram-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../i18n';
import {
  AppUpdater,
  AppUpdateInfo,
  CHECK_APP_UPDATE_EVENT,
  dismissAppUpdate,
  getAppUpdateManifestUrl,
  isAppUpdaterAvailable,
  isAppUpdateDismissed
} from '../utils/appUpdate';
import { StorageService } from '../utils/storage';
import { addNotification } from '../utils/notifications';

type UpdateStatus = 'idle' | 'downloading' | 'installing' | 'permission' | 'error';

export const AppUpdateBanner: React.FC = () => {
  const { t } = useLanguage();
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [notice, setNotice] = useState('');
  const checkingRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 5000);
  }, []);

  const runCheck = useCallback(async (manual: boolean) => {
    if (!isAppUpdaterAvailable() || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const result = await AppUpdater.checkForUpdate({
        updateUrl: getAppUpdateManifestUrl()
      });
      if (!result.available) {
        if (manual) showNotice(t('update.upToDate'));
        return;
      }

      const user = StorageService.getCurrentUser();
      if (user) {
        addNotification(user.id, {
          id: `update:apk:${result.latestVersionCode}`,
          kind: 'update',
          title: t('notifications.update.title'),
          body: t('notifications.update.body', {
            version: result.latestVersionName || String(result.latestVersionCode)
          }),
          targetView: 'update'
        });
      }

      if (!manual && isAppUpdateDismissed(result.latestVersionCode)) return;
      setInfo(result);
      setStatus('idle');
      setNotice('');
    } catch {
      if (manual) showNotice(t('update.error'));
    } finally {
      checkingRef.current = false;
    }
  }, [showNotice, t]);

  useEffect(() => {
    if (!isAppUpdaterAvailable()) return;
    void runCheck(false);

    const handleManualCheck = () => {
      setInfo(null);
      void runCheck(true);
    };
    window.addEventListener(CHECK_APP_UPDATE_EVENT, handleManualCheck);
    return () => window.removeEventListener(CHECK_APP_UPDATE_EVENT, handleManualCheck);
  }, [runCheck]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && status === 'installing') {
        setStatus('idle');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [status]);

  const close = () => {
    if (info) dismissAppUpdate(info.latestVersionCode);
    setInfo(null);
    setStatus('idle');
  };

  const update = async () => {
    if (!info || status === 'downloading') return;
    setStatus('downloading');
    try {
      const result = await AppUpdater.downloadAndInstall({ apkUrl: info.apkUrl });
      if (result.needsPermission) {
        setStatus('permission');
        return;
      }
      setStatus('installing');
    } catch {
      setStatus('error');
    }
  };

  if (!isAppUpdaterAvailable()) return null;
  if (!info && !notice) return null;

  const buttonLabel = status === 'downloading'
    ? t('update.downloading')
    : status === 'permission'
      ? t('update.permissionButton')
      : status === 'installing'
        ? t('update.installing')
        : t('update.download');

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 3600,
        width: 'min(430px, calc(100vw - 20px))',
        padding: '14px',
        borderRadius: '16px',
        background: 'var(--bg-secondary, #101828)',
        border: '1px solid var(--border-gold, rgba(245,158,11,.5))',
        boxShadow: '0 12px 38px rgba(0,0,0,0.45)',
        color: 'var(--text-main, #f8fafc)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            flexShrink: 0,
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.16)',
            color: 'var(--accent-gold, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {notice && !info ? <RefreshCw size={19} /> : <Download size={19} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '3px' }}>
            {info ? t('update.title') : notice}
          </div>

          {info && (
            <>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)', lineHeight: 1.45 }}>
                {t('update.newVersion', { version: info.latestVersionName })}
              </div>
              {info.notes && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #9ca3af)', marginTop: '4px', lineHeight: 1.4 }}>
                  {info.notes}
                </div>
              )}
              {status === 'permission' && (
                <div style={{ fontSize: '0.74rem', color: '#fbbf24', marginTop: '6px', lineHeight: 1.45 }}>
                  {t('update.permission')}
                </div>
              )}
              {status === 'installing' && (
                <div style={{ fontSize: '0.74rem', color: '#34d399', marginTop: '6px', lineHeight: 1.45 }}>
                  {t('update.installing')}
                </div>
              )}
              {status === 'error' && (
                <div style={{ fontSize: '0.74rem', color: '#f87171', marginTop: '6px', lineHeight: 1.45 }}>
                  {t('update.error')}
                </div>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          title={t('common.close')}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-dim, #6b7280)',
            padding: '2px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <X size={17} />
        </button>
      </div>

      {info && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, fontSize: '0.8rem', padding: '9px 12px' }}
            onClick={() => void update()}
            disabled={status === 'downloading' || status === 'installing'}
          >
            {buttonLabel}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '9px 12px' }}
            onClick={close}
          >
            {t('update.later')}
          </button>
        </div>
      )}
    </div>
  );
};

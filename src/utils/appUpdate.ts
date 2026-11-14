import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  PLAY_STORE_URL,
  REMOTE_APP_URL,
  isNativeApp,
  resolveServerUrl
} from '../lib/appConfig';

export const CHECK_APP_UPDATE_EVENT = 'pronumtld:check-app-update';
export const OPEN_APP_UPDATE_EVENT = 'pronumtld:open-app-update';
const DISMISSED_VERSION_KEY = 'fn_app_update_dismissed_version';

export interface AppUpdateInfo {
  available: boolean;
  currentVersionCode: number;
  currentVersionName: string;
  latestVersionCode: number;
  latestVersionName: string;
  notes: string;
  apkUrl: string;
  selfUpdate?: boolean;
}

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
  selfUpdate?: boolean;
}

export interface AppUpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes: string;
}

export interface AppUpdaterPlugin {
  checkForUpdate(options: { updateUrl: string }): Promise<AppUpdateInfo>;
  downloadAndInstall(options: { apkUrl: string }): Promise<{
    started: boolean;
    needsPermission?: boolean;
  }>;
  getVersion(): Promise<AppVersionInfo>;
  openPlayStore(): Promise<void>;
}

export const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export function isAppUpdaterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export { PLAY_STORE_URL };

/**
 * Ouvre la fiche Google Play. Sur Android on passe par le plugin natif
 * (Intent market://) pour garantir l'ouverture du Play Store ; sur le web on
 * ouvre simplement la page publique.
 */
export function openPlayStoreListing(): void {
  if (isAppUpdaterAvailable()) {
    void AppUpdater.openPlayStore().catch(() => {
      window.open(PLAY_STORE_URL, '_blank', 'noopener');
    });
    return;
  }
  window.open(PLAY_STORE_URL, '_blank', 'noopener');
}

export function getAppUpdateManifestUrl(): string {
  // In the Android app the bundled assets live on https://localhost, so the
  // manifest must be read from the public platform to actually see releases.
  const base = isNativeApp() ? REMOTE_APP_URL : window.location.origin;
  return new URL('update.json', `${base}/`).toString();
}

export function resolveApkUrl(apkUrl: string): string {
  return resolveServerUrl(apkUrl);
}

export async function fetchAppUpdateManifest(): Promise<AppUpdateManifest> {
  const response = await fetch(getAppUpdateManifestUrl(), { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as Partial<AppUpdateManifest>;
  if (!data || typeof data.apkUrl !== 'string' || !data.apkUrl) {
    throw new Error('Manifeste de mise a jour invalide');
  }
  return {
    versionCode: Number(data.versionCode) || 0,
    versionName: typeof data.versionName === 'string' ? data.versionName : '',
    apkUrl: data.apkUrl,
    notes: typeof data.notes === 'string' ? data.notes : ''
  };
}

export async function getCurrentAppVersion(): Promise<AppVersionInfo> {
  if (isAppUpdaterAvailable()) {
    try {
      return await AppUpdater.getVersion();
    } catch {
      /* plugin indisponible : on retombe sur le web */
    }
  }
  return { versionCode: 0, versionName: 'web', selfUpdate: false };
}

export function requestAppUpdateCheck(): void {
  window.dispatchEvent(new Event(CHECK_APP_UPDATE_EVENT));
}

export function openAppUpdateModal(): void {
  window.dispatchEvent(new Event(OPEN_APP_UPDATE_EVENT));
}

export function dismissAppUpdate(versionCode: number): void {
  try {
    window.localStorage.setItem(DISMISSED_VERSION_KEY, String(versionCode));
  } catch {
    /* stockage indisponible */
  }
}

export function isAppUpdateDismissed(versionCode: number): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_VERSION_KEY) === String(versionCode);
  } catch {
    return false;
  }
}

import { Capacitor, registerPlugin } from '@capacitor/core';

export const CHECK_APP_UPDATE_EVENT = 'fiaram:check-app-update';
const DISMISSED_VERSION_KEY = 'fn_app_update_dismissed_version';

export interface AppUpdateInfo {
  available: boolean;
  currentVersionCode: number;
  currentVersionName: string;
  latestVersionCode: number;
  latestVersionName: string;
  notes: string;
  apkUrl: string;
}

export interface AppUpdaterPlugin {
  checkForUpdate(options: { updateUrl: string }): Promise<AppUpdateInfo>;
  downloadAndInstall(options: { apkUrl: string }): Promise<{
    started: boolean;
    needsPermission?: boolean;
  }>;
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
}

export const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export function isAppUpdaterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function getAppUpdateManifestUrl(): string {
  return new URL('update.json', `${window.location.origin}/`).toString();
}

export function requestAppUpdateCheck(): void {
  window.dispatchEvent(new Event(CHECK_APP_UPDATE_EVENT));
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

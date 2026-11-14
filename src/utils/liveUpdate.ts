import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { isNativeApp, REMOTE_APP_URL } from '../lib/appConfig';
import { StorageService } from './storage';
import { addNotification, removeNotification } from './notifications';
import { translate } from '../i18n';

interface LiveUpdateManifest {
  bundleId: string;
  url: string;
  checksum?: string;
  minNativeVersionCode?: number;
  notes?: string;
}

const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'dev';
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const APPLY_DELAY_MS = 1_500;

let lastCheckAt = 0;
let inFlight: Promise<{ updated: boolean; bundleId?: string }> | null = null;

/**
 * Appelé le plus tôt possible au démarrage pour éviter un rollback automatique
 * si un bundle OTA précédent a été appliqué.
 */
export async function markLiveUpdateReady(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LiveUpdate.ready();
  } catch (error) {
    console.warn('LiveUpdate.ready a échoué', error);
  }
}

function isCallInProgress(): boolean {
  return Boolean(document.querySelector('[data-pronumtld-call-active="true"]'));
}

/**
 * Applique le bundle déjà téléchargé. Le rechargement est ignoré pendant un
 * appel vocal pour ne pas couper la conversation : le bundle sera appliqué au
 * prochain démarrage.
 */
export async function getCurrentWebBundle(): Promise<{
  current: string | null;
  next: string | null;
}> {
  if (!isNativeApp()) return { current: null, next: null };
  try {
    const [current, next] = await Promise.all([
      LiveUpdate.getCurrentBundle(),
      LiveUpdate.getNextBundle()
    ]);
    return { current: current.bundleId, next: next.bundleId };
  } catch {
    return { current: null, next: null };
  }
}

export async function applyPendingBundle(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const next = await LiveUpdate.getNextBundle();
    if (!next.bundleId) return false;
    if (isCallInProgress()) return false;
    await LiveUpdate.reload();
    return true;
  } catch (error) {
    console.warn('Application du bundle web impossible', error);
    return false;
  }
}

/**
 * Vérifie le manifeste web puis télécharge le bundle OTA uniquement si son
 * identifiant diffère de celui déjà installé. Quand `apply` vaut true, le
 * bundle est appliqué dans la foulée : la nouvelle interface apparaît sans
 * attendre un redémarrage manuel de l'application.
 */
export async function checkLiveUpdate(
  force = false,
  apply = false
): Promise<{ updated: boolean; bundleId?: string }> {
  if (!isNativeApp()) return { updated: false };
  const now = Date.now();
  if (!force && now - lastCheckAt < CHECK_INTERVAL_MS) return { updated: false };
  if (inFlight) return inFlight;

  lastCheckAt = now;
  inFlight = (async () => {
    try {
      const response = await fetch(`${REMOTE_APP_URL}/bundle.json?t=${now}`, {
        cache: 'no-store'
      });
      if (!response.ok) return { updated: false };

      const manifest = (await response.json()) as LiveUpdateManifest;
      if (!manifest?.bundleId || !manifest?.url) return { updated: false };

      const current = await LiveUpdate.getCurrentBundle();
      const currentId = current.bundleId;
      const user = StorageService.getCurrentUser();

      // L'APK embarque déjà exactement ce build : inutile de le re-télécharger.
      if (
        (!currentId || currentId === 'public') &&
        APP_BUILD_ID !== 'dev' &&
        manifest.bundleId === APP_BUILD_ID
      ) {
        return { updated: false };
      }

      if (currentId === manifest.bundleId) {
        if (user) removeNotification(user.id, `update:ota:${manifest.bundleId}`);
        return { updated: false };
      }

      // Le bundle est déjà téléchargé et attend le prochain démarrage : on
      // l'applique si demandé au lieu de le télécharger une seconde fois.
      const next = await LiveUpdate.getNextBundle();
      if (next.bundleId === manifest.bundleId) {
        if (apply) {
          window.setTimeout(() => {
            void applyPendingBundle();
          }, APPLY_DELAY_MS);
        }
        return { updated: true, bundleId: manifest.bundleId };
      }

      if (manifest.minNativeVersionCode) {
        const version = await LiveUpdate.getVersionCode();
        if (Number(version.versionCode) < manifest.minNativeVersionCode) {
          console.warn(
            `Bundle ${manifest.bundleId} ignoré : APK ${version.versionCode} < ${manifest.minNativeVersionCode}`
          );
          return { updated: false };
        }
      }

      await LiveUpdate.downloadBundle({
        url: manifest.url,
        bundleId: manifest.bundleId,
        checksum: manifest.checksum
      });
      await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
      if (user) {
        addNotification(user.id, {
          id: `update:ota:${manifest.bundleId}`,
          kind: 'update',
          title: translate('notifications.ota.title'),
          body: translate('notifications.ota.body'),
          targetView: 'publications'
        });
      }
      if (apply) {
        window.setTimeout(() => {
          void applyPendingBundle();
        }, APPLY_DELAY_MS);
      }
      return { updated: true, bundleId: manifest.bundleId };
    } catch (error) {
      console.warn('Vérification du bundle web impossible', error);
      return { updated: false };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

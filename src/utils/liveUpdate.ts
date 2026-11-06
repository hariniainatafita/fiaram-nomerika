import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { isNativeApp, REMOTE_APP_URL } from '../lib/appConfig';

interface LiveUpdateManifest {
  bundleId: string;
  url: string;
  checksum?: string;
  minNativeVersionCode?: number;
  notes?: string;
}

const APP_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'dev';
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

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

/**
 * Vérifie le manifeste web puis télécharge le bundle OTA uniquement si son
 * identifiant diffère de celui déjà installé. Le bundle est appliqué au
 * prochain démarrage de l'application ; aucune nouvelle APK n'est nécessaire.
 */
export async function checkLiveUpdate(force = false): Promise<{ updated: boolean; bundleId?: string }> {
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

      // L'APK embarque déjà exactement ce build : inutile de le re-télécharger.
      if (
        (!currentId || currentId === 'public') &&
        APP_BUILD_ID !== 'dev' &&
        manifest.bundleId === APP_BUILD_ID
      ) {
        return { updated: false };
      }

      if (currentId === manifest.bundleId) return { updated: false };

      if (manifest.minNativeVersionCode) {
        const version = await LiveUpdate.getVersionCode();
        if (Number(version.versionCode) < manifest.minNativeVersionCode) return { updated: false };
      }

      await LiveUpdate.downloadBundle({
        url: manifest.url,
        bundleId: manifest.bundleId,
        checksum: manifest.checksum
      });
      await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
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

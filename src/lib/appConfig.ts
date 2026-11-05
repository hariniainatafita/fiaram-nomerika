import { Capacitor } from '@capacitor/core';

// Adresse publique de la plateforme. L'application Android embarque tous ses
// fichiers (HTML, JS, CSS, images) et n'utilise donc plus le reseau pour
// s'ouvrir. Les services qui restent en ligne (upload R2, medias, manifeste de
// mise a jour) doivent cependant pointer vers le site public, pas vers
// l'origine locale du WebView (https://localhost).
export const REMOTE_APP_URL = 'https://hariniainatafita.github.io/fiaram-nomerika';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Origine a utiliser pour les appels a l'API et les URLs de medias relatives.
 * Sur le web on reste sur l'origine courante ; dans l'application Android
 * embarquee on cible la plateforme publique.
 */
export function getServerOrigin(): string {
  if (isNativeApp()) return REMOTE_APP_URL;
  return typeof window !== 'undefined' ? window.location.origin : REMOTE_APP_URL;
}

export function resolveServerUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  try {
    return new URL(path, `${getServerOrigin()}/`).toString();
  } catch {
    return path;
  }
}

export function getPublicShareUrl(path = '/'): string {
  return new URL(path, `${REMOTE_APP_URL}/`).toString();
}

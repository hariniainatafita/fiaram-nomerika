import { StorageService } from './storage';

// Telechargement des fichiers (photos, audios, documents) une seule fois, puis
// lecture depuis le cache du telephone. L'application Android embarque deja
// tous ses fichiers HTML/JS/CSS : ce cache ne concerne que les medias partages
// par les membres, afin de ne pas consommer de donnees a chaque ouverture.

const CACHE_NAME = 'fiaram-offline-media-v1';
const LAST_PREFETCH_KEY = 'fiaram_offline_prefetch_at';
const PREFETCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface OfflineCacheStats {
  count: number;
  bytes: number;
}

export interface PrecacheResult extends OfflineCacheStats {
  total: number;
  cached: number;
  failed: number;
}

function isRemoteUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function addUrl(target: Set<string>, url?: string): void {
  if (isRemoteUrl(url)) target.add(url);
}

/** Toutes les URLs de medias actuellement connues sur cet appareil. */
export function collectMediaUrls(): string[] {
  const urls = new Set<string>();
  try {
    StorageService.getMembres().forEach((membre) => {
      addUrl(urls, membre.photo_url);
      addUrl(urls, membre.cover_url);
    });
    StorageService.getPublications().forEach((publication) => {
      addUrl(urls, publication.image_url);
      addUrl(urls, StorageService.getPublicationImage(publication.id));
    });
    StorageService.getStories().forEach((story) => {
      addUrl(urls, story.image_url);
      addUrl(urls, StorageService.getStoryImage(story.id));
    });
    StorageService.getMessages().forEach((message) => {
      addUrl(urls, message.image_url);
      addUrl(urls, message.file_url);
      addUrl(urls, message.audio_url);
      addUrl(urls, StorageService.getMessageImage(message.id));
    });
    StorageService.getEvenements().forEach((evenement) => {
      addUrl(urls, evenement.image_url);
    });
    StorageService.getChansons().forEach((chanson) => {
      addUrl(urls, chanson.fichier_audio);
      addUrl(urls, chanson.fichier_pdf);
    });
  } catch {
    /* donnees locales incompletes : on renvoie ce qui a ete trouve */
  }
  return [...urls];
}

async function cacheUrl(url: string): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') {
      const response = await fetch(url, { cache: 'force-cache' });
      return response.ok;
    }
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return true;
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return false;
    await cache.put(url, response.clone());
    return true;
  } catch {
    return false;
  }
}

export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  if (typeof caches === 'undefined') return { count: 0, bytes: 0 };
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    let bytes = 0;
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      const length = response.headers.get('content-length');
      if (length && Number.isFinite(Number(length))) {
        bytes += Number(length);
      } else {
        try {
          bytes += (await response.clone().blob()).size;
        } catch {
          /* taille inconnue */
        }
      }
    }
    return { count: requests.length, bytes };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

/**
 * Telecharge tous les medias connus dans le cache local.
 * Les fichiers deja presents ne sont pas retelecharges.
 */
export async function precacheAllMedia(
  onProgress?: (done: number, total: number) => void
): Promise<PrecacheResult> {
  const urls = collectMediaUrls();
  let cached = 0;
  let failed = 0;
  for (let index = 0; index < urls.length; index += 1) {
    const ok = await cacheUrl(urls[index]);
    if (ok) cached += 1;
    else failed += 1;
    onProgress?.(index + 1, urls.length);
  }
  const stats = await getOfflineCacheStats();
  return { total: urls.length, cached, failed, ...stats };
}

export async function clearOfflineCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* cache deja vide */
  }
}

/**
 * Telechargement automatique en arriere-plan, au plus une fois par jour.
 * Le delai evite de relancer des dizaines de requetes a chaque ouverture.
 */
export async function autoPrecacheIfNeeded(): Promise<PrecacheResult | null> {
  try {
    const last = Number(window.localStorage.getItem(LAST_PREFETCH_KEY) || 0);
    if (last && Date.now() - last < PREFETCH_INTERVAL_MS) return null;
    window.localStorage.setItem(LAST_PREFETCH_KEY, String(Date.now()));
  } catch {
    return null;
  }
  return precacheAllMedia();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Mo';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

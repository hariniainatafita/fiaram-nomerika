// Envoi des fichiers média vers la fonction Pages `/api/upload`, qui choisit
// automatiquement le premier stockage disponible (R2, puis R2 secondaire, puis
// fournisseurs S3 déclarés dans `MEDIA_S3`). Si toute la chaîne échoue, on
// bascule sur le bucket Supabase. En dernier recours, la valeur undefined est
// retournée et l'appelant conserve son mode interne (data URL) — aucune
// régression possible : les médias ne sont pas perdus, simplement localisés.

import { supabaseDirect } from '../lib/supabase';
import { getServerOrigin, resolveServerUrl } from '../lib/appConfig';

export type MediaKind = 'image' | 'audio' | 'document';

const MEDIA_BUCKET = 'fiaram-media';
const MAX_BYTES = 25 * 1024 * 1024;
const R2_UPLOAD_TIMEOUT_MS = 30_000;

// A missing R2 binding answers 404/500/503 on every request: remember it for
// the session so each upload does not waste a doomed round-trip before falling
// back to Supabase Storage.
let r2Unavailable = false;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'application/pdf': 'pdf'
};

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIndex);
  const mime = header.slice(5).split(';')[0] || 'application/octet-stream';
  const base = dataUrl.slice(commaIndex + 1);
  const bin = atob(base);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function buildObjectKey(kind: MediaKind, mime: string): string {
  const ext = MIME_EXTENSIONS[mime] || 'bin';
  return `${kind}_m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
}

// The function returns a relative `/media/<key>` URL for R2, or an absolute URL
// when a failover S3 provider stored the file. Normalise both to absolute so
// the value keeps working whatever origin reads it (pages.dev, Android WebView).
function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return resolveServerUrl(url);
}

async function uploadToR2(blob: Blob, kind: MediaKind): Promise<string | undefined> {
  if (r2Unavailable) return undefined;
  const ext = MIME_EXTENSIONS[blob.type] || 'bin';
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', blob, `media.${ext}`);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), R2_UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(`${getServerOrigin()}/api/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    if (!res.ok) {
      // 404/500/503 mean the Pages function or its whole storage chain is
      // absent; 403 means a misconfigured origin. Do not retry on every upload.
      if ([403, 404, 500, 503].includes(res.status)) r2Unavailable = true;
      console.warn('Téléversement média refusé:', res.status);
      return undefined;
    }
    const payload = await res.json() as { url?: unknown; provider?: unknown };
    const url = typeof payload?.url === 'string' ? payload.url : undefined;
    if (!url || !(url.startsWith('/media/') || /^https?:\/\//i.test(url))) {
      r2Unavailable = true;
      return undefined;
    }
    return absoluteMediaUrl(url);
  } catch (error) {
    console.warn('Téléversement R2 indisponible:', error);
    return undefined;
  } finally {
    window.clearTimeout(timer);
  }
}

async function uploadToSupabase(blob: Blob, kind: MediaKind): Promise<string | undefined> {
  if (!supabaseDirect) return undefined;
  const key = buildObjectKey(kind, blob.type);
  const { error } = await supabaseDirect.storage
    .from(MEDIA_BUCKET)
    .upload(key, blob, { contentType: blob.type || 'application/octet-stream' });
  if (error) {
    console.warn('Téléversement Supabase refusé:', error.message);
    return undefined;
  }
  const { data } = supabaseDirect.storage.from(MEDIA_BUCKET).getPublicUrl(key);
  return data?.publicUrl ?? undefined;
}

async function storeBlob(blob: Blob, kind: MediaKind): Promise<string | undefined> {
  const r2Url = await uploadToR2(blob, kind);
  if (r2Url) return r2Url;
  return uploadToSupabase(blob, kind);
}

export async function uploadDataUrl(dataUrl: string, kind: MediaKind = 'image'): Promise<string | undefined> {
  if (!dataUrl.startsWith('data:')) return undefined;
  const blob = dataUrlToBlob(dataUrl);
  if (blob.size > MAX_BYTES) return undefined;
  return storeBlob(blob, kind);
}

export async function uploadFile(file: File, kind: MediaKind): Promise<string | undefined> {
  if (file.size > MAX_BYTES) return undefined;
  return storeBlob(file, kind);
}

/**
 * Télécharge un média (data URL interne ou URL distante) comme le fait
 * Facebook : le fichier est récupéré puis proposé au téléchargement.
 * En cas de blocage CORS, le média s'ouvre dans un nouvel onglet.
 */
export async function downloadMedia(url: string, fileName = 'fiaram-media.jpg'): Promise<void> {
  try {
    let href = url;
    let objectUrl: string | undefined;
    if (url.startsWith('data:')) {
      objectUrl = URL.createObjectURL(dataUrlToBlob(url));
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error('download failed');
      objectUrl = URL.createObjectURL(await response.blob());
    }
    href = objectUrl;
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1500);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

// Envoi des fichiers média vers le stockage de fichiers Supabase (bucket public).
// La fonction retourne une URL https publique du fichier ; si le stockage
// n'est pas disponible (bucket « fiaram-media » pas encore créé, réseau
// coupé), la valeur undefined est retournée et l'appelant conserve son mode
// interne (data URL) — aucune régression possible : les médias ne sont pas
// perdus, simplement localisés. Si un jour Cloudflare R2 est activé, seule
// cette fonction change : le reste de l'application ne voit que des URL.

import { supabase } from '../lib/supabase';

export type MediaKind = 'image' | 'audio' | 'document';

const MEDIA_BUCKET = 'fiaram-media';
const MAX_BYTES = 25 * 1024 * 1024;

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

async function storeBlob(blob: Blob, kind: MediaKind): Promise<string | undefined> {
  if (!supabase) {
    console.warn('Stockage média indisponible: Supabase non configuré');
    return undefined;
  }
  const key = buildObjectKey(kind, blob.type);
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(key, blob, { contentType: blob.type || 'application/octet-stream' });
  if (error) {
    console.warn('Téléversement média refusé:', error.message);
    return undefined;
  }
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(key);
  return data?.publicUrl ?? undefined;
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

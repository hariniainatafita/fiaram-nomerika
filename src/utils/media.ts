// Envoi des fichiers média vers le stockage R2 via la fonction interne /api/upload.
// La fonction retourne une URL relative /media/<clé>.
// Si le réseau ou la fonction n'est pas joignable, la valeur undefined est
// retournée et l'appelant conserve son mode localhost (data URL) — aucune
// régression possible : les médias ne sont pas perdus, simplement localisés.

export type MediaKind = 'image' | 'audio' | 'document';

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

async function postFormData(formData: FormData): Promise<string | undefined> {
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      console.warn('Téléversement média refusé:', res.status);
      return undefined;
    }
    const payload = await res.json() as { url?: unknown };
    const url = typeof payload?.url === 'string' ? payload.url : undefined;
    return url && url.startsWith('/media/') ? url : undefined;
  } catch (error) {
    console.warn('Téléversement média indisponible:', error);
    return undefined;
  }
}

export async function uploadDataUrl(dataUrl: string, kind: MediaKind = 'image'): Promise<string | undefined> {
  if (!dataUrl.startsWith('data:')) return undefined;
  const blob = dataUrlToBlob(dataUrl);
  if (blob.size > MAX_BYTES) return undefined;
  const ext = MIME_EXTENSIONS[blob.type] || 'bin';
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', blob, `media.${ext}`);
  return postFormData(formData);
}

export async function uploadFile(file: File, kind: MediaKind): Promise<string | undefined> {
  if (file.size > MAX_BYTES) return undefined;
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file, file.name);
  return postFormData(formData);
}

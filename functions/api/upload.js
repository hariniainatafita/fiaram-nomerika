// Réception des médias depuis le navigateur, écriture directe dans le bucket R2.
// Le reçu envoyé au client est une URL relative /media/<clé> qui sera ensuite
// servie par la fonction functions/media/[key].js.

const ALLOWED_MIME = {
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

const MAX_BYTES = 25 * 1024 * 1024;

function startsWith(seq, bytes, offset = 0) {
  if (seq.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (seq[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function sniffMime(bytes) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0x47, 0x49, 0x46])) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return 'audio/mpeg';
  if (startsWith(bytes, [0xff, 0xfb]) || startsWith(bytes, [0xff, 0xf3]) || startsWith(bytes, [0xff, 0xf2])) return 'audio/mpeg';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)) return 'audio/wav';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  return null;
}

function isSameHost(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let originHost;
  let requestHost;
  try {
    originHost = new URL(origin).host;
    requestHost = new URL(request.url).host;
  } catch {
    return false;
  }
  if (originHost === requestHost) return true;
  if (originHost.endsWith('.pages.dev') && requestHost.endsWith('fiaram-nomerika.pages.dev')) return true;
  return false;
}

export async function onRequestPost({ request, env }) {
  if (!env.MEDIA) {
    return Response.json({ error: 'stockage non configure' }, { status: 500 });
  }
  if (!isSameHost(request)) {
    return Response.json({ error: 'origine refusee' }, { status: 403 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'corps invalide' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'fichier manquant' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'fichier trop volumineux (25 Mo max)' }, { status: 413 });
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const mime = sniffMime(bytes);
  if (!mime) {
    return Response.json({ error: 'type de fichier refuse' }, { status: 415 });
  }

  let kind = String(form.get('kind') || 'image');
  if (!['image', 'audio', 'document'].includes(kind)) kind = 'image';
  const key = `${kind}_m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${ALLOWED_MIME[mime]}`;
  try {
    await env.MEDIA.put(key, buf, {
      httpMetadata: { contentType: mime },
      customMetadata: { uploaded_at: new Date().toISOString() }
    });
  } catch {
    return Response.json({ error: 'stockage indisponible' }, { status: 503 });
  }

  return Response.json({ key, url: `/media/${key}`, size: bytes.length, contentType: mime });
}

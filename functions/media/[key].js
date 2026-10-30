// Diffusion publique des fichiers médias stockés dans R2.
// URL de lecture : /media/<clé>  (ex /media/image_m_1730000000_ab12cd34.jpg)
// Gère GET, HEAD et les requêtes avec plage de lecture (lecture audio progressive).

const MEDIA_KEY_RE = /^(image|audio|document)_m_[0-9a-z]+_[0-9a-z]{8}\.(jpg|png|webp|gif|mp3|ogg|wav|m4a|pdf)$/;

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match) return undefined;
  const startRaw = match[1];
  const endRaw = match[2];
  let start;
  let end;
  if (startRaw === '') {
    if (endRaw === '') return undefined;
    const suffix = parseInt(endRaw, 10);
    if (Number.isNaN(suffix) || suffix <= 0) return undefined;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(startRaw, 10);
    end = endRaw === '' ? size - 1 : Math.min(parseInt(endRaw, 10), size - 1);
  }
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return undefined;
  return { offset: start, length: end - start + 1 };
}

const baseHeaders = (meta) => ({
  'content-type': meta.httpMetadata?.contentType || 'application/octet-stream',
  'cache-control': 'public, max-age=31536000, immutable',
  etag: meta.httpEtag,
  'accept-ranges': 'bytes'
});

export async function onRequestGet({ request, env }) {
  if (!env.MEDIA) return new Response('stockage non configure', { status: 500 });

  const key = request.params?.key;
  if (typeof key !== 'string' || !MEDIA_KEY_RE.test(key)) {
    return new Response('fichier introuvable', { status: 404 });
  }

  const meta = await env.MEDIA.head(key);
  if (!meta) return new Response('fichier introuvable', { status: 404 });

  const rangeHeader = request.headers.get('range');
  const part = rangeHeader ? parseRange(rangeHeader, meta.size) : undefined;

  if (!part) {
    const obj = await env.MEDIA.get(key);
    if (!obj) return new Response('fichier introuvable', { status: 404 });
    return new Response(obj.body, {
      status: 200,
      headers: { ...baseHeaders(meta), 'content-length': String(obj.size) }
    });
  }

  const obj = await env.MEDIA.get(key, { range: { offset: part.offset, length: part.length } });
  if (!obj) return new Response('fichier introuvable', { status: 404 });
  return new Response(obj.body, {
    status: 206,
    headers: {
      ...baseHeaders(meta),
      'content-range': `bytes ${part.offset}-${part.offset + part.length - 1}/${meta.size}`,
      'content-length': String(part.length)
    }
  });
}

export async function onRequestHead({ request, env }) {
  if (!env.MEDIA) return new Response('stockage non configure', { status: 500 });

  const key = request.params?.key;
  if (typeof key !== 'string' || !MEDIA_KEY_RE.test(key)) {
    return new Response('fichier introuvable', { status: 404 });
  }

  const meta = await env.MEDIA.head(key);
  if (!meta) return new Response('fichier introuvable', { status: 404 });
  return new Response(null, {
    status: 200,
    headers: { ...baseHeaders(meta), 'content-length': String(meta.size) }
  });
}

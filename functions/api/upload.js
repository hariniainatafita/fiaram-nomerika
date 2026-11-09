// Réception des médias depuis le navigateur.
//
// Chaîne de stockage avec bascule automatique (failover) :
//   1. bindings R2 `MEDIA`, puis `MEDIA_2`, `MEDIA_3` (si présents) ;
//   2. fournisseurs compatibles S3 déclarés dans `MEDIA_S3` (JSON), par ex.
//      Backblaze B2, Wasabi, IDrive e2… dans l'ordre du tableau ;
//   3. le client bascule ensuite sur Supabase Storage si tout échoue.
//
// Chaque fournisseur est essayé dans l'ordre : si l'un est plein ou refuse
// l'écriture (quota, 403, panne), on passe automatiquement au suivant. Le reçu
// contient une URL relative `/media/<clé>` pour R2 (servie par
// functions/media/[key].js) ou une URL absolue pour un fournisseur S3.

import { AwsClient } from 'aws4fetch';

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

// The Android app runs from https://localhost inside the Capacitor WebView, so
// its uploads are cross-origin. Allow those origins explicitly instead of
// relying on a same-host check that only works for the website.
const CAPACITOR_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost',
  'http://localhost'
]);

function isAllowedRequest(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (CAPACITOR_ORIGINS.has(origin)) return true;
  return isSameHost(request);
}

function corsHeaders(request) {
  const headers = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin'
  };
  const origin = request.headers.get('origin');
  if (origin && isAllowedRequest(request)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

// --- Fournisseurs de stockage ------------------------------------------------

function r2Bindings(env) {
  return [env.MEDIA, env.MEDIA_2, env.MEDIA_3].filter(Boolean);
}

let s3Cache = { raw: '', providers: [] };

function s3Providers(env) {
  const raw = typeof env.MEDIA_S3 === 'string' ? env.MEDIA_S3.trim() : '';
  if (!raw) return [];
  if (s3Cache.raw === raw) return s3Cache.providers;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('MEDIA_S3: JSON invalide, fournisseurs S3 ignorés');
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const providers = list
    .filter((p) => p && p.bucket && p.accessKeyId && p.secretAccessKey && (p.endpoint || p.region))
    .map((p) => ({
      name: String(p.name || 's3'),
      endpoint: String(p.endpoint || `https://s3.${p.region}.backblazeb2.com`).replace(/\/+$/, ''),
      region: String(p.region || 'us-east-1'),
      bucket: String(p.bucket),
      accessKeyId: String(p.accessKeyId),
      secretAccessKey: String(p.secretAccessKey),
      publicUrl: String(p.publicUrl || '').replace(/\/+$/, '')
    }));
  s3Cache = { raw, providers };
  return providers;
}

async function putToR2(bucket, key, buf, mime) {
  await bucket.put(key, buf, {
    httpMetadata: { contentType: mime },
    customMetadata: { uploaded_at: new Date().toISOString() }
  });
  return { url: `/media/${key}`, provider: 'r2' };
}

async function putToS3(provider, key, buf, mime) {
  const client = new AwsClient({
    accessKeyId: provider.accessKeyId,
    secretAccessKey: provider.secretAccessKey,
    service: 's3',
    region: provider.region
  });
  const res = await client.fetch(`${provider.endpoint}/${provider.bucket}/${key}`, {
    method: 'PUT',
    body: buf,
    headers: { 'content-type': mime }
  });
  if (!res.ok) {
    throw new Error(`s3 ${res.status}`);
  }
  return {
    url: provider.publicUrl ? `${provider.publicUrl}/${key}` : `${provider.endpoint}/${provider.bucket}/${key}`,
    provider: provider.name
  };
}

// Essaye chaque fournisseur dans l'ordre. Le premier qui accepte l'écriture
// gagne ; les suivants ne sont sollicités qu'en cas d'échec (quota, panne).
async function storeWithFailover(env, key, buf, mime) {
  const r2s = r2Bindings(env);
  const s3s = s3Providers(env);
  if (r2s.length === 0 && s3s.length === 0) return null;

  const attempts = [
    ...r2s.map((bucket, index) => () => putToR2(bucket, key, buf, mime).then((r) => ({ ...r, provider: index === 0 ? 'r2' : `r2-${index + 1}` }))),
    ...s3s.map((provider) => () => putToS3(provider, key, buf, mime))
  ];

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      console.warn('Stockage média indisponible, bascule vers le suivant:', error);
    }
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request);
  if (!isAllowedRequest(request)) {
    return Response.json({ error: 'origine refusee' }, { status: 403, headers: cors });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'corps invalide' }, { status: 400, headers: cors });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'fichier manquant' }, { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'fichier trop volumineux (25 Mo max)' }, { status: 413, headers: cors });
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const mime = sniffMime(bytes);
  if (!mime) {
    return Response.json({ error: 'type de fichier refuse' }, { status: 415, headers: cors });
  }

  let kind = String(form.get('kind') || 'image');
  if (!['image', 'audio', 'document'].includes(kind)) kind = 'image';
  const key = `${kind}_m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${ALLOWED_MIME[mime]}`;

  const stored = await storeWithFailover(env, key, buf, mime);
  if (!stored) {
    return Response.json({ error: 'stockage non configure' }, { status: 500, headers: cors });
  }

  return Response.json(
    { key, url: stored.url, provider: stored.provider, size: bytes.length, contentType: mime },
    { headers: cors }
  );
}

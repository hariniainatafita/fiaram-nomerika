// Adaptateur Neon compatible avec le sous-ensemble PostgREST utilisé par
// l'application (`/rest/v1/app_state`). Il permet d'ajouter Neon comme
// fournisseur de données derrière le proxy de bascule
// (functions/api/db/[[path]].js) sans réécrire le client.
//
// Configuration Cloudflare Pages :
//   NEON_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
// ou, pour plusieurs projets Neon (bascule) :
//   NEON_DATABASE_URLS=["postgresql://.../db1","postgresql://.../db2"]
// Le chemin /api/neon/<index>/... sélectionne le projet (0 par défaut).
//
// Schéma SQL : supabase/neon-schema.sql

import { neon } from '@neondatabase/serverless';

const CAPACITOR_ORIGINS = new Set(['https://localhost', 'capacitor://localhost', 'http://localhost']);

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (CAPACITOR_ORIGINS.has(origin)) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    if (originHost === requestHost) return true;
    if (originHost.endsWith('.pages.dev') && requestHost.endsWith('fiaram-nomerika.pages.dev')) return true;
  } catch {
    return false;
  }
  return false;
}

function corsHeaders(request) {
  const headers = {
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS',
    'access-control-allow-headers':
      'apikey, authorization, content-type, prefer, accept, accept-profile, content-profile, x-client-info, x-supabase-api-version',
    'access-control-expose-headers': 'content-range, preference-applied',
    vary: 'origin'
  };
  const origin = request.headers.get('origin');
  if (origin && isAllowedOrigin(request)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

function json(request, status, payload, extraHeaders = {}) {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request), ...extraHeaders }
  });
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

let clientsCache = { raw: '', clients: [] };

function readClients(env) {
  const raw =
    (typeof env.NEON_DATABASE_URLS === 'string' && env.NEON_DATABASE_URLS.trim()) ||
    (typeof env.NEON_DATABASE_URL === 'string' && env.NEON_DATABASE_URL.trim()) ||
    '';
  if (!raw) return [];
  if (clientsCache.raw === raw) return clientsCache.clients;

  let urls;
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      urls = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.warn('NEON_DATABASE_URLS: JSON invalide');
      return [];
    }
  } else {
    urls = [raw];
  }
  const clients = urls
    .filter((url) => typeof url === 'string' && url.startsWith('postgres'))
    .map((url) => neon(url));
  clientsCache = { raw, clients };
  return clients;
}

function pickColumn(select, column) {
  if (!select || select === '*') return true;
  return select.split(',').map((part) => part.trim()).includes(column);
}

function projectRow(row, select) {
  const out = {};
  if (pickColumn(select, 'key')) out.key = row.key;
  if (pickColumn(select, 'value')) out.value = row.value;
  if (pickColumn(select, 'updated_at')) out.updated_at = row.updated_at;
  return out;
}

function eqValue(searchParams) {
  const raw = searchParams.get('key');
  if (typeof raw === 'string' && raw.startsWith('eq.')) return raw.slice(3);
  return null;
}

// PostgREST `in.(a,b,c)` utilisé par `.in('key', SYNCED_KEYS)` à l'hydratation.
function inValues(searchParams) {
  const raw = searchParams.get('key');
  if (typeof raw !== 'string' || !raw.startsWith('in.(') || !raw.endsWith(')')) return null;
  const inner = raw.slice(4, -1).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map((part) => part.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

function limitValue(searchParams) {
  const raw = Number.parseInt(searchParams.get('limit') || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) return 5000;
  return Math.min(raw, 5000);
}

function isSingle(request) {
  return (request.headers.get('accept') || '').includes('vnd.pgrst.object+json');
}

function wantsMinimal(request) {
  return (request.headers.get('prefer') || '').includes('return=minimal');
}

function pgrstError(request, status, code, message) {
  return json(request, status, { code, message, details: null, hint: null });
}

function normalizeRows(rows) {
  return rows.map((row) => {
    let value = row.value;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        /* keep the raw string */
      }
    }
    return { ...row, value };
  });
}

async function handleGet(sql, request, searchParams) {
  const select = searchParams.get('select') || '*';
  const key = eqValue(searchParams);
  const keys = inValues(searchParams);
  const limit = limitValue(searchParams);
  let rows;
  if (key) {
    rows = await sql`SELECT key, value, updated_at FROM app_state WHERE key = ${key} LIMIT 1`;
  } else if (keys) {
    rows = keys.length
      ? await sql`SELECT key, value, updated_at FROM app_state WHERE key = ANY(${keys}::text[]) ORDER BY updated_at ASC`
      : [];
  } else {
    rows = await sql`SELECT key, value, updated_at FROM app_state ORDER BY updated_at ASC LIMIT ${limit}`;
  }
  const projected = normalizeRows(rows).map((row) => projectRow(row, select));

  if (isSingle(request)) {
    if (projected.length !== 1) {
      return pgrstError(request, 406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned');
    }
    return json(request, 200, projected[0]);
  }
  return json(request, 200, projected, { 'content-range': `0-${Math.max(projected.length - 1, 0)}/${projected.length}` });
}

async function handleWrite(sql, request, method) {
  const searchParams = new URL(request.url).searchParams;
  const select = searchParams.get('select') || '*';
  const minimal = wantsMinimal(request);

  if (method === 'DELETE') {
    const key = eqValue(searchParams);
    if (!key) return pgrstError(request, 400, 'PGRST100', 'filtre key=eq.<clé> requis');
    const rows = await sql`DELETE FROM app_state WHERE key = ${key} RETURNING key, value, updated_at`;
    if (minimal) return json(request, 204, undefined);
    return json(request, 200, normalizeRows(rows).map((row) => projectRow(row, select)));
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return pgrstError(request, 400, 'PGRST102', 'corps JSON invalide');
  }
  const entries = Array.isArray(body) ? body : [body];
  if (entries.length === 0 || entries.some((entry) => !entry || typeof entry.key !== 'string')) {
    return pgrstError(request, 400, 'PGRST102', 'chaque entrée doit contenir une clé');
  }

  const updated = [];
  for (const entry of entries) {
    const updatedAt = typeof entry.updated_at === 'string' ? entry.updated_at : new Date().toISOString();
    const valueJson = JSON.stringify(entry.value ?? null);
    const rows = await sql`
      INSERT INTO app_state (key, value, updated_at)
      VALUES (${entry.key}, ${valueJson}::jsonb, ${updatedAt}::timestamptz)
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      RETURNING key, value, updated_at
    `;
    updated.push(...normalizeRows(rows));
  }

  if (minimal) {
    return json(request, 201, undefined, { 'preference-applied': 'resolution=merge-duplicates' });
  }
  const projected = updated.map((row) => projectRow(row, select));
  if (isSingle(request)) {
    if (projected.length !== 1) {
      return pgrstError(request, 406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned');
    }
    return json(request, 201, projected[0]);
  }
  return json(request, 201, projected);
}

export async function onRequest({ request, env, params }) {
  if (!isAllowedOrigin(request)) {
    return json(request, 403, { error: 'origine refusee' });
  }

  const clients = readClients(env);
  if (clients.length === 0) {
    return json(request, 503, { error: 'neon non configure' });
  }

  const segments = Array.isArray(params.path) ? [...params.path] : params.path ? [params.path] : [];
  let index = 0;
  if (segments.length > 1 && /^\d+$/.test(segments[0])) {
    index = Number(segments.shift());
  }
  const path = `/${segments.join('/')}`;
  if (path !== '/rest/v1/app_state') {
    return json(request, 404, { error: 'ressource inconnue' });
  }
  const sql = clients[index];
  if (!sql) {
    return json(request, 503, { error: 'projet neon indisponible' });
  }

  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return await handleGet(sql, request, new URL(request.url).searchParams);
    }
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
      return await handleWrite(sql, request, request.method);
    }
    return json(request, 405, { error: 'methode non supportee' });
  } catch (error) {
    console.error('Neon app_state:', error);
    return pgrstError(request, 500, 'PGRST500', 'erreur base de donnees');
  }
}

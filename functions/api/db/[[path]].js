// Proxy de données avec bascule multi-cloud.
//
// Le client Supabase (côté app) peut pointer son URL de données vers
// `/api/db`. Chaque requête REST (`/rest/v1/...`) est alors envoyée aux
// projets configurés dans `SUPABASE_PROJECTS`, dans l'ordre :
//   - lecture : premier projet qui répond (bascule si 402/quota, 429 ou 5xx) ;
//   - écriture : envoi à tous les projets (double écriture) pour garder les
//     copies synchronisées ; la première réponse réussie est renvoyée.
//
// `SUPABASE_PROJECTS` (variable Cloudflare Pages) accepte une URL simple ou un
// tableau JSON, par exemple :
//   ["https://xxxx.supabase.co","https://yyyy.supabase.co"]
//   [{"url":"https://xxxx.supabase.co","anonKey":"..."},{"url":"https://neon-proxy.example.com","anonKey":"..."}]
//
// Auth, Realtime et Storage restent branchés en direct sur le projet Supabase
// (voir src/lib/supabase.ts) : seul le trafic de données passe par ce proxy.

const CAPACITOR_ORIGINS = new Set(['https://localhost', 'capacitor://localhost', 'http://localhost']);

function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (CAPACITOR_ORIGINS.has(origin)) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(request.url).host;
    if (originHost === requestHost) return true;
    if (originHost.endsWith('.pages.dev') && requestHost.endsWith('pro-num-tld.pages.dev')) return true;
  } catch {
    return false;
  }
  return false;
}

function corsHeaders(request) {
  const headers = {
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS',
    'access-control-allow-headers':
      'apikey, authorization, content-type, prefer, accept, accept-profile, content-profile, x-client-info, x-supabase-api-version, range',
    'access-control-expose-headers': 'content-range, preference-applied, content-profile',
    vary: 'origin'
  };
  const origin = request.headers.get('origin');
  if (origin && isAllowedOrigin(request)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

let projectsCache = { raw: '', projects: [] };

function readProjects(env) {
  const raw = typeof env.SUPABASE_PROJECTS === 'string' ? env.SUPABASE_PROJECTS.trim() : '';
  if (raw) {
    if (projectsCache.raw === raw) return projectsCache.projects;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('SUPABASE_PROJECTS: JSON invalide');
      return [];
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const projects = list
      .map((entry) => (typeof entry === 'string' ? { url: entry } : entry))
      .filter((entry) => entry && typeof entry.url === 'string' && entry.url)
      .map((entry) => ({
        url: String(entry.url).replace(/\/+$/, ''),
        anonKey: typeof entry.anonKey === 'string' ? entry.anonKey : ''
      }));
    projectsCache = { raw, projects };
    return projects;
  }
  // Repli : ancienne variable serveur déjà utilisée par functions/api/push.js.
  if (typeof env.SUPABASE_URL === 'string' && env.SUPABASE_URL) {
    return [{ url: env.SUPABASE_URL.replace(/\/+$/, ''), anonKey: '' }];
  }
  return [];
}

function isRetryableStatus(status) {
  return status === 402 || status === 429 || status >= 500;
}

function buildHeaders(request, project) {
  const headers = new Headers();
  const clientApikey = request.headers.get('apikey') || '';
  for (const [name, value] of request.headers) {
    const lower = name.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'content-length' ||
      lower === 'connection' ||
      lower === 'upgrade' ||
      lower === 'cf-connecting-ip' ||
      lower === 'cf-ray' ||
      lower.startsWith('x-forwarded-') ||
      lower.startsWith('cf-')
    ) {
      continue;
    }
    headers.set(name, value);
  }
  const key = project.anonKey || clientApikey;
  if (key) {
    headers.set('apikey', key);
    const authorization = headers.get('authorization');
    if (!authorization || (clientApikey && authorization === `Bearer ${clientApikey}`)) {
      headers.set('authorization', `Bearer ${key}`);
    }
  }
  return headers;
}

async function forward(project, request, path, search, body) {
  const target = `${project.url}${path}${search}`;
  const headers = buildHeaders(request, project);
  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000)
  };
  if (body !== undefined) init.body = body;
  return fetch(target, init);
}

function cleanResponse(response, request) {
  const headers = new Headers();
  const blocked = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection']);
  for (const [name, value] of response.headers) {
    if (!blocked.has(name.toLowerCase())) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(corsHeaders(request))) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function errorResponse(request, status, message) {
  return Response.json({ error: message }, { status, headers: corsHeaders(request) });
}

async function readWithFailover(projects, request, path, search) {
  let lastResponse = null;
  for (const project of projects) {
    try {
      const response = await forward(project, request, path, search, undefined);
      if (!isRetryableStatus(response.status)) {
        return response;
      }
      console.warn(`Proxy données: ${project.url} → ${response.status}, bascule`);
      lastResponse = response;
      void response.body?.cancel();
    } catch (error) {
      console.warn(`Proxy données: ${project.url} injoignable`, error);
    }
  }
  return lastResponse;
}

async function writeWithReplication(projects, request, path, search, body) {
  const results = await Promise.allSettled(
    projects.map((project) => forward(project, request, path, search, body))
  );

  let success = null;
  let firstError = null;
  for (const result of results) {
    if (result.status === 'rejected') continue;
    const response = result.value;
    if (response.ok) {
      if (!success) success = response;
      else void response.body?.cancel();
    } else {
      if (!firstError || (!isRetryableStatus(response.status) && isRetryableStatus(firstError.status))) {
        if (firstError && firstError !== success) void firstError.body?.cancel();
        firstError = response;
      } else {
        void response.body?.cancel();
      }
    }
  }
  return success || firstError;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!isAllowedOrigin(request)) {
    return errorResponse(request, 403, 'origine refusee');
  }

  const projects = readProjects(env);
  if (projects.length === 0) {
    return errorResponse(request, 503, 'aucune base configuree');
  }

  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const path = `/${segments.join('/')}`;
  const url = new URL(request.url);
  const search = url.search;

  if (request.method === 'GET' || request.method === 'HEAD') {
    const response = await readWithFailover(projects, request, path, search);
    if (!response) return errorResponse(request, 502, 'bases injoignables');
    return cleanResponse(response, request);
  }

  const body = await request.arrayBuffer();
  const response = await writeWithReplication(projects, request, path, search, body);
  if (!response) return errorResponse(request, 502, 'bases injoignables');
  return cleanResponse(response, request);
}

// Envoi des notifications push Firebase quand un nouveau message est ecrit
// dans app_state. A brancher sur un Database Webhook Supabase :
//   table public.app_state, evenement UPDATE, URL /api/push
// Variables d'environnement Cloudflare Pages :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//   PUSH_WEBHOOK_SECRET (optionnel, envoye dans x-webhook-secret)

const MESSAGES_KEY = 'fiaram_messages_v2';
const GROUPS_KEY = 'fiaram_groupes_v2';
const MEMBERS_KEY = 'fiaram_membres_v2';
const TOKENS_KEY = 'fiaram_device_tokens_v1';

let cachedToken = null;
let cachedTokenExpiry = 0;

export async function onRequestPost({ request, env }) {
  if (env.PUSH_WEBHOOK_SECRET) {
    const provided = request.headers.get('x-webhook-secret');
    if (provided !== env.PUSH_WEBHOOK_SECRET) {
      return Response.json({ error: 'refuse' }, { status: 401 });
    }
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'corps invalide' }, { status: 400 });
  }

  const record = payload.record || payload.new || {};
  const previous = payload.old_record || payload.old || {};
  if (record.key !== MESSAGES_KEY) {
    return Response.json({ skipped: 'autre collection' });
  }

  const nextMessages = parseList(record.value);
  const oldMessages = parseList(previous.value);
  if (!nextMessages.length) return Response.json({ skipped: 'aucun message' });

  const known = new Set(oldMessages.map((message) => message && message.id).filter(Boolean));
  const fresh = nextMessages.filter((message) => {
    if (!message || !message.id || known.has(message.id)) return false;
    if (message.is_deleted) return false;
    if (!message.sender_id) return false;
    return true;
  });
  if (!fresh.length) return Response.json({ skipped: 'aucun nouveau message' });

  const config = readFirebaseConfig(env);
  if (!config) {
    return Response.json({ error: 'Firebase non configure' }, { status: 500 });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Supabase non configure' }, { status: 500 });
  }

  const [tokens, groups, members] = await Promise.all([
    readState(env, TOKENS_KEY, {}),
    readState(env, GROUPS_KEY, []),
    readState(env, MEMBERS_KEY, [])
  ]);

  const groupById = new Map(
    (Array.isArray(groups) ? groups : []).map((group) => [group.id, group])
  );
  const memberById = new Map(
    (Array.isArray(members) ? members : []).map((member) => [member.id, member])
  );

  let sent = 0;
  for (const message of fresh) {
    const sender = memberById.get(message.sender_id);
    const senderName = sender ? `${sender.prenom || ''} ${sender.nom || ''}`.trim() : 'Nouveau message';
    const group = message.group_id ? groupById.get(message.group_id) : null;
    const recipients = recipientsFor(message, group);
    if (!recipients.length) continue;

    const preview = previewText(message);
    const accessToken = await getAccessToken(config);

    for (const recipientId of recipients) {
      const deviceTokens = tokens[recipientId];
      if (!Array.isArray(deviceTokens)) continue;
      for (const token of deviceTokens) {
        if (typeof token !== 'string' || !token) continue;
        const ok = await sendFcm(config, accessToken, token, {
          type: 'message',
          messageId: message.id,
          senderId: message.sender_id,
          senderName: group ? `${senderName} · ${group.nom_groupe || ''}` : senderName,
          text: preview,
          peerId: message.group_id ? '' : message.sender_id,
          groupId: message.group_id || ''
        });
        if (ok) sent += 1;
      }
    }
  }

  return Response.json({ sent });
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function recipientsFor(message, group) {
  if (message.receiver_id) return [message.receiver_id];
  if (!group) return [];
  const ids = new Set();
  for (const id of group.membre_ids || []) {
    if (id && id !== message.sender_id) ids.add(id);
  }
  return [...ids];
}

function previewText(message) {
  if (message.message) return String(message.message);
  if (message.image_url || message.image_ref || message.file_type === 'image') return 'Photo';
  if (message.file_url || message.file_type === 'audio') return 'Fichier audio';
  if (message.file_type === 'document') return 'Document';
  return 'Nouveau message';
}

async function readState(env, key, fallback) {
  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`;
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) return fallback;
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) return fallback;
  const value = rows[0].value;
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function readFirebaseConfig(env) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return null;
  }
  return {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY
  };
}

async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiry > now + 60) return cachedToken;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: config.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const key = await importPrivateKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!response.ok) {
    throw new Error(`OAuth Firebase ${response.status}`);
  }
  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}

async function sendFcm(config, accessToken, token, data) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token,
          data,
          android: { priority: 'high' }
        }
      })
    }
  );
  return response.ok;
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

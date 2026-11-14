// Proxy de lecture du fil France 24. Le navigateur ne peut pas lire le RSS
// directement (CORS), donc la fonction le récupère côté serveur, le nettoie et
// renvoie un petit JSON. La recherche reste limitée aux contenus France 24.

const FEED_URL = 'https://www.france24.com/fr/rss';

function corsHeaders() {
  // Flux public en lecture seule : aucune donnee privee, donc toutes les
  // origines (web, APK https://localhost, apercu Pages) sont autorisees.
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(Number(dec)); } catch { return ''; }
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function pickTag(tag, block) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function pickAttr(tag, attr, block) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function stripHtml(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseFeed(xml) {
  const items = [];
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];
    const title = stripHtml(pickTag('title', block));
    const link = pickTag('link', block);
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: stripHtml(pickTag('description', block)).slice(0, 320),
      category: stripHtml(pickTag('category', block)),
      pubDate: pickTag('pubDate', block),
      image:
        pickAttr('media:content', 'url', block) ||
        pickAttr('media:thumbnail', 'url', block) ||
        pickAttr('enclosure', 'url', block)
    });
  }
  return items;
}

export async function onRequest(context) {
  const { request } = context;
  const cors = corsHeaders();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return Response.json({ error: 'methode non autorisee' }, { status: 405, headers: cors });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit')) || 24));

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    response = await fetch(FEED_URL, {
      headers: {
        'User-Agent': 'Pro-Num-TLD/1.0 (+https://pro-num-tld.pages.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      signal: controller.signal,
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    clearTimeout(timer);
  } catch {
    return Response.json({ error: 'france24 indisponible' }, { status: 502, headers: cors });
  }

  if (!response.ok) {
    return Response.json({ error: 'france24 indisponible' }, { status: 502, headers: cors });
  }

  const xml = await response.text();
  let items = parseFeed(xml);
  if (query) {
    items = items.filter((item) =>
      `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)
    );
  }
  items = items.slice(0, limit);

  return Response.json(
    {
      source: 'France 24',
      language: 'fr',
      query,
      count: items.length,
      items
    },
    {
      headers: {
        ...cors,
        'Cache-Control': 'public, max-age=300'
      }
    }
  );
}

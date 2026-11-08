// Base64 pictures live in their own localStorage rows. Parsing those rows on
// every render (feed, chat, stories) is expensive on phones, especially when a
// row holds several hundred kilobytes. This tiny module keeps the decoded
// strings in memory so a picture is only parsed once per session.
//
// Every code path that writes an image row must call `setCachedImageRow` (and
// removals call `clearCachedImageRow`) so the cache can never serve a stale
// value.

const cache = new Map<string, string>();
const missing = new Set<string>();

export function readCachedImageRow(key: string): string | undefined {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (missing.has(key)) return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      missing.add(key);
      return undefined;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string' && parsed) {
      cache.set(key, parsed);
      missing.delete(key);
      return parsed;
    }
  } catch {
    /* corrupted row: fall through and let the caller refetch it */
  }
  missing.add(key);
  return undefined;
}

export function setCachedImageRow(key: string, value: string): void {
  if (typeof value !== 'string' || !value) return;
  cache.set(key, value);
  missing.delete(key);
}

export function clearCachedImageRow(key: string): void {
  cache.delete(key);
  missing.add(key);
}

export function clearAllCachedImageRows(): void {
  cache.clear();
  missing.clear();
}

// Durable fallback: when localStorage was pruned (quota) or cleared, the
// picture is still in IndexedDB. Reading it here restores the fast paths so
// the feed keeps working even when Supabase / R2 are unreachable.
export async function readImageRowAsync(key: string): Promise<string | undefined> {
  const cached = readCachedImageRow(key);
  if (cached) return cached;
  const { idbGetImage } = await import('./imageStore');
  const stored = await idbGetImage(key);
  if (!stored) return undefined;
  setCachedImageRow(key, stored);
  try {
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    /* localStorage still saturated: the in-memory cache is enough */
  }
  return stored;
}

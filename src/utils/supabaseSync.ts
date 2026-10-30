import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STORAGE_KEYS, SYNCED_KEYS } from './storageKeys';

const TABLE = 'app_state';
const pushTimers: Record<string, number> = {};

type AnyRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function itemId(item: unknown): string | null {
  if (isPlainObject(item) && typeof item.id === 'string') return item.id;
  return null;
}

// Tombstoned (deleted) member ids known on this device: { memberId: isoDate }
function getLocalDeletedMemberIds(): AnyRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBRES_DELETED);
    const parsed = raw ? JSON.parse(raw) : null;
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Fields used to restore chronological order after a merge, newest first.
const SORT_FIELDS_DESC: Record<string, string> = {
  [STORAGE_KEYS.PRESENCES]: 'date_pointage',
  [STORAGE_KEYS.FINANCES]: 'date_operation',
  [STORAGE_KEYS.COTISATIONS]: 'date_paiement',
  [STORAGE_KEYS.PUBLICATIONS]: 'created_at'
};

// Chat messages must stay in strict chronological order (oldest first).
function sortMessagesAsc(list: unknown[]): unknown[] {
  return list.sort((a, b) => {
    const timeA = isPlainObject(a) && typeof a.sent_at === 'string' ? a.sent_at : '';
    const timeB = isPlainObject(b) && typeof b.sent_at === 'string' ? b.sent_at : '';
    if (timeA !== timeB) return timeA < timeB ? -1 : 1;
    const idA = String(itemId(a) ?? '');
    const idB = String(itemId(b) ?? '');
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}

/**
 * Union-merge two collections so that members / messages added on ANY device
 * are never wiped by a device that still holds an older snapshot.
 * Remote wins on shared ids (it carries the latest change), local-only items
 * are preserved, and known deleted members stay filtered out.
 */
function mergeKeyValues(key: string, local: unknown, remote: unknown): unknown {
  if (Array.isArray(local) && Array.isArray(remote)) {
    let localList: unknown[] = local;
    let remoteList: unknown[] = remote;

    if (key === STORAGE_KEYS.MEMBRES) {
      const tombstones = getLocalDeletedMemberIds();
      localList = local.filter(
        (item) => { const id = itemId(item); return id === null || !(id in tombstones); }
      );
      remoteList = remote.filter(
        (item) => { const id = itemId(item); return id === null || !(id in tombstones); }
      );
    }

    const merged: unknown[] = [];
    const seen = new Set<string>();
    const pushUnique = (item: unknown) => {
      const id = itemId(item);
      if (id === null) {
        merged.push(item);
        return;
      }
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(item);
      }
    };
    remoteList.forEach(pushUnique);
    localList.forEach(pushUnique);

    const sortField = SORT_FIELDS_DESC[key];
    if (sortField) {
      merged.sort((a, b) => {
        const valueA = isPlainObject(a) && typeof a[sortField] === 'string' ? a[sortField] as string : '';
        const valueB = isPlainObject(b) && typeof b[sortField] === 'string' ? b[sortField] as string : '';
        if (valueA !== valueB) return valueA < valueB ? 1 : -1;
        return String(itemId(b) ?? '').localeCompare(String(itemId(a) ?? ''));
      });
    }
    if (key === STORAGE_KEYS.MESSAGES) return sortMessagesAsc(merged);
    return merged;
  }

  if (isPlainObject(local) && isPlainObject(remote)) {
    // Maps (presence, deleted members, group reads, settings):
    // remote values win, local-only entries are preserved.
    return { ...local, ...remote };
  }

  // Remaining cases:
  // - local missing: adopt the remote value;
  // - remote missing: keep the local value;
  // - shape mismatch (e.g. realtime delivering JSONB as a string while the
  //   local value is a structured collection): keep the structured local
  //   value instead of destroying it with an unusable payload.
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (Array.isArray(local) || isPlainObject(local)) return local;
  return remote;
}

/**
 * Realtime payloads sometimes deliver JSONB columns as escaped strings.
 * Unwrap them so collections merge as structured data instead of raw text.
 */
function normalizeRemoteValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    if (isPlainObject(parsed) || Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string') {
      try {
        const inner = JSON.parse(parsed);
        return isPlainObject(inner) || Array.isArray(inner) ? inner : parsed;
      } catch {
        return parsed;
      }
    }
    return parsed;
  } catch {
    return value;
  }
}

function readLocalStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeMerged(key: string, remoteValue: unknown): void {
  const localValue = readLocalStorage(key);
  if (localValue === undefined) {
    try {
      localStorage.setItem(key, JSON.stringify(remoteValue));
    } catch (err) {
      console.error(`[Supabase] cannot store "${key}":`, err);
    }
    return;
  }
  try {
    // The local value is normalized as well: a previously corrupted value
    // (JSONB delivered as a string) is repaired during the next merge.
    localStorage.setItem(
      key,
      JSON.stringify(mergeKeyValues(key, normalizeRemoteValue(localValue), remoteValue))
    );
  } catch (err) {
    console.error(`[Supabase] cannot merge "${key}":`, err);
    try {
      localStorage.setItem(key, JSON.stringify(remoteValue));
    } catch { /* ignore */ }
  }
}

async function upsertKey(key: string, value: unknown): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) {
    console.warn(`[Supabase] push failed for "${key}":`, error.message);
  }
}

async function pushKeyNow(key: string): Promise<void> {
  const raw = localStorage.getItem(key);
  if (raw === null) return;
  try {
    await upsertKey(key, normalizeRemoteValue(JSON.parse(raw)));
  } catch {
    /* ignore malformed local value */
  }
}

/**
 * Load shared data from Supabase into localStorage before the app renders.
 * Remote rows are union-merged with the local snapshot so a session that kept
 * working offline can never lose accounts or messages on the next boot.
 * If a shared key does not exist remotely but exists locally, seed it up.
 */
export async function hydrateFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data, error } = await supabase.from(TABLE).select('key, value');
    if (error) {
      console.warn('[Supabase] hydrate failed:', error.message);
      return;
    }

    const remote = new Map<string, unknown>();
    (data ?? []).forEach((row: { key: string; value: unknown }) => {
      remote.set(row.key, row.value);
    });

    for (const key of SYNCED_KEYS) {
      if (remote.has(key)) {
        writeMerged(key, normalizeRemoteValue(remote.get(key)));
      } else if (localStorage.getItem(key) !== null) {
        await pushKeyNow(key);
      }
    }
  } catch (err) {
    console.warn('[Supabase] hydrate error:', err);
  }
}

/**
 * Debounced write-through: mirrors a localStorage collection to Supabase.
 */
export function pushKey(key: string, value: unknown): void {
  if (!isSupabaseConfigured || !supabase) return;
  if (!SYNCED_KEYS.includes(key)) return;
  if (pushTimers[key]) window.clearTimeout(pushTimers[key]);
  pushTimers[key] = window.setTimeout(() => {
    void upsertKey(key, value);
  }, 400);
}

/**
 * Remove a shared key from Supabase (used by full reset).
 */
export function deleteKey(key: string): void {
  if (!isSupabaseConfigured || !supabase) return;
  if (!SYNCED_KEYS.includes(key)) return;
  void supabase
    .from(TABLE)
    .delete()
    .eq('key', key)
    .then(({ error }) => {
      if (error) console.warn(`[Supabase] delete failed for "${key}":`, error.message);
    });
}

/**
 * Live updates: when another device changes shared data, merge it locally
 * instead of blindly overwriting, so shared accounts can never disappear.
 * Returns an unsubscribe function.
 */
export function subscribeToSupabase(onRemoteChange: (key: string) => void): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const client = supabase;

  const channel = client
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { key?: string };
          if (oldRow?.key) {
            localStorage.removeItem(oldRow.key);
            onRemoteChange(oldRow.key);
          }
          return;
        }
        const row = payload.new as { key?: string; value?: unknown };
        if (row?.key) {
          writeMerged(row.key, normalizeRemoteValue(row.value));
          onRemoteChange(row.key);
        }
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

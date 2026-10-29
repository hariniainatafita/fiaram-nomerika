import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SYNCED_KEYS } from './storageKeys';

const TABLE = 'app_state';
const pushTimers: Record<string, number> = {};

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
    await upsertKey(key, JSON.parse(raw));
  } catch {
    /* ignore malformed local value */
  }
}

/**
 * Load shared data from Supabase into localStorage before the app renders.
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
        localStorage.setItem(key, JSON.stringify(remote.get(key)));
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
 * Live updates: when another device changes shared data, mirror it locally.
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
          localStorage.setItem(row.key, JSON.stringify(row.value));
          onRemoteChange(row.key);
        }
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

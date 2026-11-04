import { STORAGE_KEYS, TOMBSTONE_FOR } from './storageKeys';

export type TombstoneMap = Record<string, number>;

// Old tombstones can be forgotten after a few months: by then every active
// device has received the deletion.
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function prune(map: TombstoneMap): TombstoneMap {
  const cutoff = Date.now() - MAX_AGE_MS;
  const cleaned: TombstoneMap = {};
  for (const [id, timestamp] of Object.entries(map)) {
    if (typeof timestamp === 'number' && timestamp >= cutoff) cleaned[id] = timestamp;
  }
  return cleaned;
}

export function readTombstones(tombstoneKey: string): TombstoneMap {
  try {
    const raw = localStorage.getItem(tombstoneKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: TombstoneMap = {};
    for (const [id, timestamp] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof timestamp === 'number') map[id] = timestamp;
    }
    return map;
  } catch {
    return {};
  }
}

/** Return the updated map so the caller can persist (and synchronise) it. */
export function markDeleted(
  collectionKey: string,
  ids: string[]
): { key: string; map: TombstoneMap } | null {
  const key = TOMBSTONE_FOR[collectionKey];
  if (!key) return null;
  const map = readTombstones(key);
  const now = Date.now();
  ids.forEach((id) => {
    if (id) map[id] = now;
  });
  return { key, map: prune(map) };
}

export function deletedIdsFor(collectionKey: string): Set<string> {
  const key = TOMBSTONE_FOR[collectionKey];
  if (!key) return new Set();
  return new Set(Object.keys(readTombstones(key)));
}

export function isTombstoneKey(key: string): boolean {
  return Object.values(TOMBSTONE_FOR).includes(key);
}

/**
 * Remove tombstoned items from the local collections as soon as the tombstone
 * arrives, so a stale local copy can never flash back in the UI.
 */
export function pruneDeletedFromCollections(): void {
  for (const [collectionKey, tombstoneKey] of Object.entries(TOMBSTONE_FOR)) {
    const deleted = readTombstones(tombstoneKey);
    if (Object.keys(deleted).length === 0) continue;
    try {
      const raw = localStorage.getItem(collectionKey);
      if (raw === null) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      const kept = list.filter((item) => {
        if (!item || typeof item !== 'object') return true;
        const id = (item as { id?: unknown }).id;
        return typeof id !== 'string' || !(id in deleted);
      });
      if (kept.length !== list.length) {
        localStorage.setItem(collectionKey, JSON.stringify(kept));
      }
    } catch {
      /* ignore malformed rows */
    }
  }

  // Quiz results have their own id: remove the ones attached to a deleted quiz.
  const deletedQuizzes = readTombstones(STORAGE_KEYS.QUIZZES_DELETED);
  if (Object.keys(deletedQuizzes).length > 0) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.QUIZ_RESULTS);
      if (raw !== null) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const kept = list.filter((item) => {
            if (!item || typeof item !== 'object') return true;
            const quizId = (item as { quiz_id?: unknown }).quiz_id;
            return typeof quizId !== 'string' || !(quizId in deletedQuizzes);
          });
          if (kept.length !== list.length) {
            localStorage.setItem(STORAGE_KEYS.QUIZ_RESULTS, JSON.stringify(kept));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
}

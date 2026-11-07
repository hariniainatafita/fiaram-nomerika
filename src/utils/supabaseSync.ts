import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STORAGE_KEYS, SYNCED_KEYS, PENDING_IMAGE_UPLOADS, isSyncedKey, isImageKey, isFeedImageKey, messageImageKey, storyImageKey, publicationImageKey, MEMBER_IMAGE_PREFIX, MEMBER_AVATAR_REF, MEMBER_COVER_REF, memberAvatarKey, memberCoverKey } from './storageKeys';
import { deletedIdsFor, isTombstoneKey, pruneDeletedFromCollections } from './tombstones';
import { readCachedImageRow, setCachedImageRow, clearCachedImageRow } from './imageRowCache';

const TABLE = 'app_state';

export interface SyncStatus {
  realtime: string;
  lastHydrateAt: number | null;
  lastHydrateError: string | null;
  memberImagesPending: number;
  memberImagesFetched: number;
  memberImageError: string | null;
}

let syncStatus: SyncStatus = {
  realtime: 'idle',
  lastHydrateAt: null,
  lastHydrateError: null,
  memberImagesPending: 0,
  memberImagesFetched: 0,
  memberImageError: null
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

function setSyncStatus(patch: Partial<SyncStatus>): void {
  syncStatus = { ...syncStatus, ...patch };
}

export function reportMemberImageProgress(pending: number, fetched: number): void {
  setSyncStatus({ memberImagesPending: pending, memberImagesFetched: fetched });
}
const pushTimers: Record<string, number> = {};

// Pushes stay disabled until the first successful hydration. Otherwise the
// default data seeded at boot (admin/admin, default names/photos) would be
// uploaded before the remote copy is merged and would overwrite the real
// profile edited by the user on another device.
let hydrationReady = false;
const queuedPushes = new Map<string, unknown>();

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

// Tombstoned (deleted or expired) story ids: { storyId: timestamp }
function getLocalDeletedStoryIds(): AnyRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STORIES_DELETED);
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
  [STORAGE_KEYS.PUBLICATIONS]: 'created_at',
  [STORAGE_KEYS.STORIES]: 'created_at',
  [STORAGE_KEYS.QUIZZES]: 'created_at',
  [STORAGE_KEYS.QUIZ_RESULTS]: 'completed_at'
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

function memberUpdatedAt(item: unknown): number {
  if (!isPlainObject(item) || typeof item.updated_at !== 'string') return 0;
  const time = Date.parse(item.updated_at);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Members need a date-aware merge: the account name, phone and profile photo
 * are edited by the user, so the most recently updated copy must win. A phone
 * that still holds the seeded default record (no `updated_at`) can therefore
 * never erase the real profile. When both copies have the same date, the
 * caller decides (remote wins on hydration, local wins when pushing).
 */
function mergeMemberLists(localList: unknown[], remoteList: unknown[], preferLocalOnTie: boolean): unknown[] {
  const tombstones = getLocalDeletedMemberIds();
  const keep = (item: unknown): boolean => {
    const id = itemId(item);
    return id === null || !(id in tombstones);
  };

  const byId = new Map<string, unknown>();
  const extras: unknown[] = [];

  for (const item of remoteList.filter(keep)) {
    const id = itemId(item);
    if (id === null) extras.push(item);
    else byId.set(id, item);
  }

  for (const item of localList.filter(keep)) {
    const id = itemId(item);
    if (id === null) {
      extras.push(item);
      continue;
    }
    const remote = byId.get(id);
    if (remote === undefined) {
      byId.set(id, item);
      continue;
    }
    const localTime = memberUpdatedAt(item);
    const remoteTime = memberUpdatedAt(remote);
    if (localTime > remoteTime || (localTime === remoteTime && preferLocalOnTie)) {
      // A device with an empty avatar must still pick up a profile photo set
      // elsewhere, even when its clock makes the local record look newer.
      const localMember = isPlainObject(item) ? item : null;
      const remoteMember = isPlainObject(remote) ? remote : null;
      const missingAvatar = localMember && !localMember.photo_url && remoteMember?.photo_url === MEMBER_AVATAR_REF;
      const missingCover = localMember && !localMember.cover_url && remoteMember?.cover_url === MEMBER_COVER_REF;
      if (localMember && remoteMember && (missingAvatar || missingCover)) {
        byId.set(id, {
          ...localMember,
          ...(missingAvatar ? { photo_url: remoteMember.photo_url } : {}),
          ...(missingCover ? { cover_url: remoteMember.cover_url } : {}),
          updated_at: remoteMember.updated_at ?? localMember.updated_at
        });
      } else {
        byId.set(id, item);
      }
    }
  }

  return [...byId.values(), ...extras];
}

/**
 * Union-merge two collections so that members / messages added on ANY device
 * are never wiped by a device that still holds an older snapshot.
 * Remote wins on shared ids (it carries the latest change), local-only items
 * are preserved, and known deleted members stay filtered out.
 */
function filterDeletedItems(key: string, list: unknown[]): unknown[] {
  const deleted = deletedIdsFor(key);
  const deletedQuizzes = key === STORAGE_KEYS.QUIZ_RESULTS
    ? deletedIdsFor(STORAGE_KEYS.QUIZZES)
    : null;
  if (deleted.size === 0 && !deletedQuizzes?.size) return list;
  return list.filter((item) => {
    const id = itemId(item);
    if (id !== null && deleted.has(id)) return false;
    if (deletedQuizzes && isPlainObject(item)
      && typeof item.quiz_id === 'string' && deletedQuizzes.has(item.quiz_id)) {
      return false;
    }
    return true;
  });
}

function groupUpdatedAt(item: unknown): number {
  if (!isPlainObject(item) || typeof item.updated_at !== 'string') return 0;
  const time = Date.parse(item.updated_at);
  return Number.isFinite(time) ? time : 0;
}

function readRecord(value: unknown): AnyRecord {
  return isPlainObject(value) ? value : {};
}

function recordTime(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Reactions are stored per member with a last-action timestamp. Merging two
 * copies picks the most recent action for every member, so a reaction added on
 * one device is never lost and a removal still wins over an older like.
 */
function mergeReactionState(kept: AnyRecord, other: AnyRecord): {
  reactions: AnyRecord;
  updates: AnyRecord;
} {
  const keptReactions = readRecord(kept.reactions);
  const otherReactions = readRecord(other.reactions);
  const keptUpdates = readRecord(kept.reactions_updated_at);
  const otherUpdates = readRecord(other.reactions_updated_at);

  const reactions: AnyRecord = {};
  const updates: AnyRecord = {};
  const ids = new Set<string>([
    ...Object.keys(keptReactions),
    ...Object.keys(otherReactions),
    ...Object.keys(keptUpdates),
    ...Object.keys(otherUpdates)
  ]);

  for (const id of ids) {
    const keptTime = recordTime(keptUpdates[id]);
    const otherTime = recordTime(otherUpdates[id]);
    const winner = otherTime > keptTime ? other : kept;
    const winnerReactions = readRecord(winner.reactions);
    const winnerUpdates = readRecord(winner.reactions_updated_at);
    const type = winnerReactions[id];
    if (typeof type === 'string') reactions[id] = type;
    if (typeof winnerUpdates[id] === 'string') updates[id] = winnerUpdates[id];
  }

  // Legacy likes only have liked_by (no reaction type, no timestamp).
  const legacyLiked = new Set<string>();
  for (const record of [kept, other]) {
    if (Array.isArray(record.liked_by)) {
      record.liked_by.forEach((id) => { if (typeof id === 'string') legacyLiked.add(id); });
    }
  }
  for (const id of legacyLiked) {
    if (!(id in reactions) && !(id in updates)) reactions[id] = 'like';
  }

  return { reactions, updates };
}

function mergeById(first: unknown, second: unknown, dateField: string): unknown[] {
  const items = new Map<string, unknown>();
  const push = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const id = itemId(item);
      if (id === null) continue;
      if (!items.has(id)) items.set(id, item);
    }
  };
  push(first);
  push(second);
  return [...items.values()].sort((a, b) => {
    const timeA = isPlainObject(a) && typeof a[dateField] === 'string' ? a[dateField] as string : '';
    const timeB = isPlainObject(b) && typeof b[dateField] === 'string' ? b[dateField] as string : '';
    return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
  });
}

function mergeStringLists(first: unknown, second: unknown): string[] {
  const ids = new Set<string>();
  for (const value of [first, second]) {
    if (Array.isArray(value)) {
      value.forEach((id) => { if (typeof id === 'string') ids.add(id); });
    }
  }
  return [...ids];
}

/**
 * Resolve two copies of the same item that arrived from different devices.
 * Groups keep the newest edit (membership included); messages are soft-deleted
 * and their read receipt is a list, so a deleted message stays deleted and
 * every "seen by" id is preserved even when the other copy is stale.
 */
function mergeDuplicateItem(key: string, kept: unknown, other: unknown): unknown {
  if (!isPlainObject(kept) || !isPlainObject(other)) return kept;

  // A group's name / chef / members can be edited from any device. The copy
  // carrying the newest `updated_at` wins, so a stale snapshot can never
  // remove a member who was added on another phone.
  if (key === STORAGE_KEYS.GROUPES) {
    const keptTime = groupUpdatedAt(kept);
    const otherTime = groupUpdatedAt(other);
    if (otherTime > keptTime) return other;
    if (keptTime > otherTime) return kept;
    // Legacy groups without a date: union the memberships instead of dropping
    // anyone.
    const ids = new Set<string>();
    for (const value of [kept.membre_ids, other.membre_ids]) {
      if (Array.isArray(value)) {
        value.forEach((id) => { if (typeof id === 'string') ids.add(id); });
      }
    }
    return {
      ...kept,
      ...(kept.is_messenger || other.is_messenger ? { is_messenger: true } : {}),
      ...(ids.size > 0 ? { membre_ids: [...ids] } : {})
    };
  }

  // Feed posts keep the union of likes/reactions and comments from every
  // device. Without this a stale push could erase a reaction added elsewhere.
  if (key === STORAGE_KEYS.PUBLICATIONS) {
    const { reactions, updates } = mergeReactionState(kept, other);
    return {
      ...other,
      ...kept,
      liked_by: Object.keys(reactions),
      reactions,
      reactions_updated_at: updates,
      commentaires: mergeById(kept.commentaires, other.commentaires, 'created_at'),
      partages: Math.max(Number(kept.partages) || 0, Number(other.partages) || 0)
    };
  }

  // Stories merge the same social data plus replies and viewers.
  if (key === STORAGE_KEYS.STORIES) {
    const { reactions, updates } = mergeReactionState(kept, other);
    return {
      ...other,
      ...kept,
      reactions,
      reactions_updated_at: updates,
      seen_by: mergeStringLists(kept.seen_by, other.seen_by),
      replies: mergeById(kept.replies, other.replies, 'created_at')
    };
  }

  if (key !== STORAGE_KEYS.MESSAGES) {
    return kept;
  }
  const deleted = kept.is_deleted === true || other.is_deleted === true;
  const readBy = new Set<string>();
  for (const value of [kept.read_by, other.read_by]) {
    if (Array.isArray(value)) {
      value.forEach((id) => { if (typeof id === 'string') readBy.add(id); });
    }
  }
  const { reactions, updates } = mergeReactionState(kept, other);
  return {
    ...kept,
    reactions,
    reactions_updated_at: updates,
    status: kept.status === 'read' || other.status === 'read' ? 'read' : kept.status,
    ...(deleted
      ? {
          is_deleted: true,
          message: '',
          image_url: undefined,
          file_url: undefined,
          audio_url: undefined,
          image_ref: undefined
        }
      : {}),
    ...(readBy.size > 0 ? { read_by: [...readBy] } : {})
  };
}

function mergeKeyValues(key: string, local: unknown, remote: unknown): unknown {
  if (Array.isArray(local) && Array.isArray(remote)) {
    let localList = filterDeletedItems(key, local);
    let remoteList = filterDeletedItems(key, remote);
    if (key === STORAGE_KEYS.MEMBRES) {
      return mergeMemberLists(localList, remoteList, false);
    }

    if (key === STORAGE_KEYS.STORIES) {
      const tombstones = getLocalDeletedStoryIds();
      localList = localList.filter(
        (item) => { const id = itemId(item); return id === null || !(id in tombstones); }
      );
      remoteList = remoteList.filter(
        (item) => { const id = itemId(item); return id === null || !(id in tombstones); }
      );
    }

    const merged: unknown[] = [];
    const indexById = new Map<string, number>();
    const pushUnique = (item: unknown) => {
      const id = itemId(item);
      if (id === null) {
        merged.push(item);
        return;
      }
      const existingIndex = indexById.get(id);
      if (existingIndex === undefined) {
        indexById.set(id, merged.length);
        merged.push(item);
        return;
      }
      merged[existingIndex] = mergeDuplicateItem(key, merged[existingIndex], item);
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
 * Merge used before pushing a local change to Supabase. Unlike the hydration
 * merge (where the remote copy wins), the local copy wins on shared ids here:
 * it is the change being pushed. Remote-only items are preserved so a device
 * holding an older snapshot can never wipe stories/publications created on
 * another device. This is what keeps a freshly published story visible for
 * every member instead of being erased by the next stale push.
 */
function mergeKeyValuesForPush(key: string, local: unknown, remote: unknown): unknown {
  if (Array.isArray(local) && Array.isArray(remote)) {
    const localList = filterDeletedItems(key, local);
    const remoteList = filterDeletedItems(key, remote);
    if (key === STORAGE_KEYS.MEMBRES) {
      return mergeMemberLists(localList, remoteList, true);
    }

    const tombstones = key === STORAGE_KEYS.STORIES
      ? getLocalDeletedStoryIds()
      : {};
    const keep = (item: unknown): boolean => {
      const id = itemId(item);
      return id === null || !(id in tombstones);
    };

    const merged: unknown[] = [];
    const indexById = new Map<string, number>();
    const pushUnique = (item: unknown) => {
      const id = itemId(item);
      if (id === null) {
        merged.push(item);
        return;
      }
      const existingIndex = indexById.get(id);
      if (existingIndex === undefined) {
        indexById.set(id, merged.length);
        merged.push(item);
        return;
      }
      merged[existingIndex] = mergeDuplicateItem(key, merged[existingIndex], item);
    };

    // Local first: the device that triggers the push owns the latest change.
    localList.filter(keep).forEach(pushUnique);
    remoteList.filter(keep).forEach(pushUnique);

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
    return { ...remote, ...local };
  }

  // Picture rows are content stored under a stable key. A profile photo edited
  // on another device replaces the same row, so the server copy must win: the
  // local copy is only a cache of an older picture.
  if (isImageKey(key) && typeof remote === 'string' && remote) return remote;

  return local;
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

// Rows currently being re-fetched after an oversized realtime payload was
// truncated: prevents duplicate concurrent requests for the same key.
const refetchingKeys = new Set<string>();

/**
 * Supabase Realtime silently drops the "value" of a row whose payload is
 * ~1MB or larger, so big collections (several messages with inline images)
 * would never update live. When such an event arrives, the row is fetched
 * over HTTP (no size limit) and merged instead of relying on the payload.
 */
async function refetchKey(key: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  if (refetchingKeys.has(key)) return;
  refetchingKeys.add(key);
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('key', key)
      .single();
    if (error) {
      console.warn(`[Supabase] refetch failed for "${key}":`, error.message);
      return;
    }
    if (data && 'value' in data) {
      writeMerged(key, normalizeRemoteValue(data.value));
    }
  } catch (err) {
    console.warn(`[Supabase] refetch error for "${key}":`, err);
  } finally {
    refetchingKeys.delete(key);
  }
}

const messageImageInflight = new Set<string>();

/**
 * A chat image lives in its own row (`fiaram_msgimg_<messageId>`). Realtime
 * only pushes it in live, so on-demand HTTP fetch guarantees the picture is
 * also available after a missed event / first connection.
 */
export async function fetchMessageImageIfMissing(messageId: string): Promise<string | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined;
  const key = messageImageKey(messageId);
  const cached = readCachedImageRow(key);
  if (cached) return cached;
  if (messageImageInflight.has(messageId)) return undefined;
  messageImageInflight.add(messageId);
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return undefined;
    const value = normalizeRemoteValue((data as { value?: unknown }).value);
    if (typeof value !== 'string' || !value) return undefined;
    setCachedImageRow(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`[Supabase] cannot store "${key}":`, err);
    }
    return value;
  } catch {
    return undefined;
  } finally {
    messageImageInflight.delete(messageId);
  }
}

const storyImageInflight = new Set<string>();

// A picture row is pushed a few hundred milliseconds after its metadata, and
// large base64 rows can take longer on mobile data. Keep retrying for about a
// minute so the viewer never waits for an unrelated event to show the picture.
const IMAGE_FETCH_DELAYS = [300, 700, 1500, 3000, 5000, 8000, 12000, 15000, 20000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Story pictures also live in their own row (`fiaram_storyimg_<storyId>`).
 * Members that only received the light STORIES metadata fetch the picture on
 * demand, which works even when the Realtime payload was too large.
 */
export async function fetchStoryImageIfMissing(storyId: string): Promise<string | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined;
  const key = storyImageKey(storyId);
  const cached = readCachedImageRow(key);
  if (cached) return cached;
  if (storyImageInflight.has(storyId)) return undefined;
  storyImageInflight.add(storyId);
  try {
    // The story metadata can arrive before its picture row (two debounced
    // pushes). Retry with backoff so a member never keeps an empty story.
    for (let attempt = 0; attempt <= IMAGE_FETCH_DELAYS.length; attempt++) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!error && data) {
        const value = normalizeRemoteValue((data as { value?: unknown }).value);
        if (typeof value === 'string' && value) {
          setCachedImageRow(key, value);
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (err) {
            console.error(`[Supabase] cannot store "${key}":`, err);
          }
          return value;
        }
      }
      if (attempt < IMAGE_FETCH_DELAYS.length) {
        await wait(IMAGE_FETCH_DELAYS[attempt]);
      }
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    storyImageInflight.delete(storyId);
  }
}

const memberImageInflight = new Set<string>();

/**
 * Profile / cover photos live in their own rows (`fiaram_memberimg_...`), so a
 * device can rebuild them on demand without downloading the whole members list
 * with inline base64 data.
 */
export async function fetchMemberImageIfMissing(
  memberId: string,
  kind: 'avatar' | 'cover',
  force = false
): Promise<string | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined;
  const key = kind === 'avatar' ? memberAvatarKey(memberId) : memberCoverKey(memberId);
  const cached = readCachedImageRow(key);
  if (cached && !force) return cached;

  let localValue = cached;
  if (!localValue) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string' && parsed) {
          localValue = parsed;
          setCachedImageRow(key, parsed);
          if (!force) return parsed;
        }
      } catch {
        /* corrupted row: refetch it */
      }
    }
  }

  if (memberImageInflight.has(key)) return localValue;
  memberImageInflight.add(key);
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) {
        setSyncStatus({ memberImageError: error.message });
      } else if (data) {
        const value = normalizeRemoteValue((data as { value?: unknown }).value);
        if (typeof value === 'string' && value) {
          setCachedImageRow(key, value);
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (err) {
            console.error(`[Supabase] cannot store "${key}":`, err);
          }
          setSyncStatus({ memberImageError: null });
          return value;
        }
      } else {
        setSyncStatus({ memberImageError: 'photo absente sur le serveur' });
      }
      if (attempt < 2) await wait(700);
    }
    // Never replace a working picture with a blank avatar when the network
    // fails: keep showing the cached copy until the next attempt.
    return localValue;
  } catch (err) {
    setSyncStatus({ memberImageError: err instanceof Error ? err.message : String(err) });
    return localValue;
  } finally {
    memberImageInflight.delete(key);
  }
}

const publicationImageInflight = new Set<string>();

/**
 * Publication pictures also live in their own row
 * (`fiaram_pubimg_<publicationId>`). Members that only received the light
 * PUBLICATIONS metadata fetch the picture on demand, so the image appears
 * even when the realtime payload was too large or the media bucket is absent.
 */
export async function fetchPublicationImageIfMissing(publicationId: string): Promise<string | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined;
  const key = publicationImageKey(publicationId);
  const cached = readCachedImageRow(key);
  if (cached) return cached;
  if (publicationImageInflight.has(publicationId)) return undefined;
  publicationImageInflight.add(publicationId);
  try {
    for (let attempt = 0; attempt <= IMAGE_FETCH_DELAYS.length; attempt++) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!error && data) {
        const value = normalizeRemoteValue((data as { value?: unknown }).value);
        if (typeof value === 'string' && value) {
          setCachedImageRow(key, value);
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (err) {
            console.error(`[Supabase] cannot store "${key}":`, err);
          }
          return value;
        }
      }
      if (attempt < IMAGE_FETCH_DELAYS.length) {
        await wait(IMAGE_FETCH_DELAYS[attempt]);
      }
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    publicationImageInflight.delete(publicationId);
  }
}

function writeMerged(key: string, remoteValue: unknown): void {
  // Apply picture rows to the in-memory cache first: the avatar must change
  // even when localStorage is saturated and cannot store the row.
  if (typeof remoteValue === 'string' && remoteValue && key.startsWith(MEMBER_IMAGE_PREFIX)) {
    setCachedImageRow(key, remoteValue);
  }
  const localValue = readLocalStorage(key);
  if (localValue === undefined) {
    try {
      // A collection arriving before its tombstone (or after the local copy
      // was cleared) must not bring back items deleted elsewhere.
      const value = Array.isArray(remoteValue)
        ? filterDeletedItems(key, remoteValue)
        : remoteValue;
      localStorage.setItem(key, JSON.stringify(value));
      if (isFeedImageKey(key) && typeof value === 'string') setCachedImageRow(key, value);
    } catch (err) {
      console.error(`[Supabase] cannot store "${key}":`, err);
    }
    if (isTombstoneKey(key)) pruneDeletedFromCollections();
    return;
  }
  try {
    // The local value is normalized as well: a previously corrupted value
    // (JSONB delivered as a string) is repaired during the next merge.
    const value = mergeKeyValues(key, normalizeRemoteValue(localValue), remoteValue);
    localStorage.setItem(key, JSON.stringify(value));
    if (isFeedImageKey(key) && typeof value === 'string') setCachedImageRow(key, value);
  } catch (err) {
    console.error(`[Supabase] cannot merge "${key}":`, err);
    try {
      localStorage.setItem(key, JSON.stringify(remoteValue));
      if (isFeedImageKey(key) && typeof remoteValue === 'string') {
        setCachedImageRow(key, remoteValue);
      }
    } catch { /* ignore */ }
  }
  if (isTombstoneKey(key)) pruneDeletedFromCollections();
}

async function upsertKey(key: string, value: unknown): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from(TABLE).upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) {
    console.warn(`[Supabase] push failed for "${key}":`, error.message);
    return false;
  }
  return true;
}

// Pictures written by the user are remembered until Supabase confirms the
// upload. If the app is refreshed/closed during a slow upload (or the network
// drops), the picture is retried on the next launch instead of being lost.
function readPendingImageKeys(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_IMAGE_UPLOADS);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function setImagePending(key: string, pending: boolean): void {
  try {
    const current = new Set(readPendingImageKeys());
    if (pending) current.add(key);
    else current.delete(key);
    if (current.size === 0) localStorage.removeItem(PENDING_IMAGE_UPLOADS);
    else localStorage.setItem(PENDING_IMAGE_UPLOADS, JSON.stringify([...current]));
  } catch {
    /* ignore */
  }
}

async function pushKeyNow(key: string, fallbackValue?: unknown): Promise<void> {
  if (!supabase) return;
  const initial = readLocalStorage(key);
  if (initial === undefined && fallbackValue === undefined) return;

  // Pictures are standalone rows: no merge is needed, and skipping the extra
  // SELECT halves the upload latency (and avoids downloading the previous
  // base64 before overwriting it).
  if (isImageKey(key)) {
    const value = initial === undefined ? fallbackValue : initial;
    if (value === undefined) return;
    setImagePending(key, true);
    try {
      if (await upsertKey(key, value)) setImagePending(key, false);
    } catch {
      /* stays pending for the next launch */
    }
    return;
  }

  try {
    // Read the current remote row first and merge, so items added by another
    // device (stories, posts, messages...) are never overwritten by a stale
    // local snapshot. Local values win on shared ids because they carry the
    // change being pushed.
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('key', key)
      .maybeSingle();

    // The local collection may have changed while the remote row was being
    // fetched (a second story published right after the first one): always
    // push the freshest local snapshot.
    const current = readLocalStorage(key);
    const localValue = current === undefined ? fallbackValue : current;
    if (localValue === undefined) return;

    if (error || !data) {
      await upsertKey(key, Array.isArray(localValue)
        ? filterDeletedItems(key, localValue)
        : localValue);
      return;
    }
    const remoteValue = normalizeRemoteValue((data as { value?: unknown }).value);
    const merged = mergeKeyValuesForPush(key, localValue, remoteValue);
    await upsertKey(key, merged);
  } catch {
    const current = readLocalStorage(key);
    const localValue = current === undefined ? fallbackValue : current;
    if (localValue !== undefined) {
      await upsertKey(key, Array.isArray(localValue)
        ? filterDeletedItems(key, localValue)
        : localValue);
    }
  }
}

function retryPendingImageUploads(): void {
  for (const key of readPendingImageKeys()) {
    let value: unknown;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        setImagePending(key, false);
        continue;
      }
      value = JSON.parse(raw);
    } catch {
      setImagePending(key, false);
      continue;
    }
    pushKey(key, value);
  }
}

/**
 * Load shared data from Supabase into localStorage before the app renders.
 * Remote rows are union-merged with the local snapshot so a session that kept
 * working offline can never lose accounts or messages on the next boot.
 * If a shared key does not exist remotely but exists locally, seed it up.
 */
export async function hydrateFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    hydrationReady = true;
    queuedPushes.clear();
    setSyncStatus({ lastHydrateError: 'Supabase non configure' });
    return;
  }
  try {
    // Only fetch the light shared collections. Per-item picture rows can be
    // huge (base64) and are resolved on demand, so downloading them at boot
    // would make the app (and the login screen) very slow on mobile data.
    const { data, error } = await supabase
      .from(TABLE)
      .select('key, value')
      .in('key', SYNCED_KEYS);
    if (error) {
      console.warn('[Supabase] hydrate failed:', error.message);
      setSyncStatus({ lastHydrateError: error.message });
      return;
    }

    const remote = new Map<string, unknown>();
    (data ?? []).forEach((row: { key: string; value: unknown }) => {
      remote.set(row.key, row.value);
    });

    for (const key of SYNCED_KEYS) {
      if (remote.has(key)) {
        writeMerged(key, normalizeRemoteValue(remote.get(key)));
        // Password hashes: a device may hold entries the remote row does not
        // have yet (accounts created offline on that phone). Push them back so
        // every member can sign in from every device.
        if (key === STORAGE_KEYS.PASSWORD_HASHES) {
          await pushKeyNow(key);
        }
      } else if (localStorage.getItem(key) !== null) {
        await pushKeyNow(key);
      }
    }

    // Hydration succeeded: it is now safe to write the changes that happened
    // while the app was booting (they were merged with the remote copy above).
    hydrationReady = true;
    for (const [key, value] of queuedPushes) {
      pushKey(key, value);
    }
    queuedPushes.clear();
    retryPendingImageUploads();
    setSyncStatus({ lastHydrateAt: Date.now(), lastHydrateError: null });
  } catch (err) {
    // Keep pushes disabled: the next successful hydration (on resume/online)
    // will merge the real remote data before anything is overwritten.
    console.warn('[Supabase] hydrate error:', err);
    setSyncStatus({ lastHydrateError: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Debounced write-through: mirrors a localStorage collection to Supabase.
 */
export function pushKey(key: string, value: unknown): void {
  if (!isSupabaseConfigured || !supabase) return;
  if (!isSyncedKey(key)) return;
  if (!hydrationReady) {
    // Never upload before the real remote data has been merged at boot.
    queuedPushes.set(key, value);
    return;
  }
  // Pictures start uploading immediately: a base64 row takes long enough
  // already, and waiting for a debounce makes it easy to lose the upload by
  // refreshing the page or closing the app.
  if (isImageKey(key)) {
    void pushKeyNow(key, value);
    return;
  }
  if (pushTimers[key]) window.clearTimeout(pushTimers[key]);
  pushTimers[key] = window.setTimeout(() => {
    void pushKeyNow(key, value);
  }, 400);
}

/**
 * Remove a shared key from Supabase (used by full reset).
 */
export function deleteKey(key: string): void {
  if (!isSupabaseConfigured || !supabase) return;
  if (!isSyncedKey(key)) return;
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
            if (isImageKey(oldRow.key)) clearCachedImageRow(oldRow.key);
            onRemoteChange(oldRow.key);
          }
          return;
        }
        const row = payload.new as { key?: string; value?: unknown };
        if (row?.key) {
          if (row.value === null || row.value === undefined) {
            // Payload too big for realtime: fetch the row over HTTP and merge.
            void refetchKey(row.key).then(() => onRemoteChange(row.key as string));
          } else {
            writeMerged(row.key, normalizeRemoteValue(row.value));
            onRemoteChange(row.key);
          }
        }
      }
    )
    .subscribe((status) => {
      setSyncStatus({ realtime: status });
    });

  return () => {
    void client.removeChannel(channel);
  };
}

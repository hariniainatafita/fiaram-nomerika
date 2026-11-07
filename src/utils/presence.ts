import { useEffect, useState } from 'react';
import { pushKey } from './supabaseSync';
import { STORAGE_KEYS } from './storageKeys';

export type PresenceMap = Record<string, number>;

// Presence is fresh while a heartbeat is running. The web app beats while it is
// open; on Android, the foreground background watcher keeps beating when the
// app is switched to another app. A positive timestamp is the last successful
// heartbeat; a negative timestamp is the explicit logout time. Both are
// compared by absolute value when devices merge their copies. A positive
// heartbeat older than ONLINE_FRESHNESS_MS is stale and shown offline.
const HEARTBEAT_MS = 30_000;
const REFRESH_MS = 15_000;
const ONLINE_FRESHNESS_MS = 90_000;

export function getPresenceMap(): PresenceMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESENCE_ONLINE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PresenceMap) : {};
  } catch {
    return {};
  }
}

function savePresenceMap(map: PresenceMap): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRESENCE_ONLINE, JSON.stringify(map));
  } catch {
    /* the remote push below still carries the change */
  }
  pushKey(STORAGE_KEYS.PRESENCE_ONLINE, map);
}

export function markOnline(memberId: string): PresenceMap {
  const map = getPresenceMap();
  map[memberId] = Date.now();
  savePresenceMap(map);
  return map;
}

export function markOffline(memberId: string): PresenceMap {
  const map = getPresenceMap();
  if (!memberId) return map;
  // Keep a negative marker instead of deleting the key: the merge on every
  // device can then tell that an explicit logout happened after the last beat.
  map[memberId] = -Date.now();
  savePresenceMap(map);
  return map;
}

export function isMemberOnline(map: PresenceMap, memberId?: string): boolean {
  if (!memberId) return false;
  const lastSeen = map[memberId];
  return typeof lastSeen === 'number'
    && lastSeen > 0
    && Date.now() - lastSeen <= ONLINE_FRESHNESS_MS;
}

/**
 * Keeps the current member flagged as online while the web app is open. On
 * Android, the foreground background watcher continues the same heartbeat in
 * the background. Closing the app stops the heartbeat; the member becomes
 * offline once the last heartbeat is stale. An explicit logout calls
 * `markOffline` immediately.
 */
export function usePresence(currentUserId?: string): PresenceMap {
  const [presence, setPresence] = useState<PresenceMap>(getPresenceMap);

  useEffect(() => {
    if (!currentUserId) return;

    const beat = () => {
      setPresence(markOnline(currentUserId));
    };

    beat();

    const heartbeat = window.setInterval(beat, HEARTBEAT_MS);
    const refresh = window.setInterval(() => setPresence(getPresenceMap()), REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        beat();
      }
    };

    const handleOnline = () => {
      beat();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.PRESENCE_ONLINE) {
        setPresence(getPresenceMap());
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUserId]);

  return presence;
}

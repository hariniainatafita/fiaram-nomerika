import { useEffect, useState } from 'react';
import { pushKey } from './supabaseSync';
import { STORAGE_KEYS } from './storageKeys';

export type PresenceMap = Record<string, number>;

// Facebook-style presence: an open browser keeps the user online, even when
// the tab is in the background (another site, another tab). Background tabs
// have their timers throttled to about once per minute, so the online window
// is wide enough to absorb that throttling. Only a real page close
// (pagehide / browser quit) removes the flag immediately.
const ONLINE_WINDOW_MS = 240_000;
const HEARTBEAT_MS = 30_000;
const REFRESH_MS = 15_000;

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
  localStorage.setItem(STORAGE_KEYS.PRESENCE_ONLINE, JSON.stringify(map));
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
  if (memberId in map) {
    delete map[memberId];
    savePresenceMap(map);
  }
  return map;
}

export function isMemberOnline(map: PresenceMap, memberId?: string, now = Date.now()): boolean {
  if (!memberId) return false;
  const lastSeen = map[memberId];
  return typeof lastSeen === 'number' && now - lastSeen < ONLINE_WINDOW_MS;
}

/**
 * Keeps the current member flagged as online while the browser is open —
 * visible tab OR background tab. The flag is only removed on a real page
 * close, or naturally once the heartbeat has been silent for long enough.
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
      // Coming back to the foreground: refresh immediately so nobody has to
      // wait up to a minute. Going to the background does NOT log out — the
      // interval keeps beating (throttled) and the wide online window covers
      // the gap.
      if (document.visibilityState === 'visible') {
        beat();
      }
    };

    const handleOnline = () => {
      beat();
    };

    const handlePageHide = () => {
      markOffline(currentUserId);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.PRESENCE_ONLINE) {
        setPresence(getPresenceMap());
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('storage', handleStorage);
      markOffline(currentUserId);
    };
  }, [currentUserId]);

  return presence;
}

import { STORAGE_KEYS } from './storageKeys';

export type AppNotificationKind =
  | 'publication'
  | 'reaction'
  | 'comment'
  | 'update'
  | 'message'
  | 'group'
  | 'event'
  | 'member';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
  targetView?: string;
  actorId?: string;
  actorPhoto?: string;
  peerId?: string;
  groupName?: string;
}

export type AppNotificationInput = Omit<AppNotification, 'createdAt' | 'read'> & {
  createdAt?: number;
  read?: boolean;
};

type NotificationStore = Record<string, AppNotification[]>;

const MAX_NOTIFICATIONS = 100;
const listeners = new Set<() => void>();
let memoryStore: NotificationStore | null = null;

function readStore(): NotificationStore {
  if (memoryStore) return memoryStore;
  if (typeof window === 'undefined') {
    memoryStore = {};
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) {
      memoryStore = {};
      return memoryStore;
    }
    const parsed = JSON.parse(raw) as unknown;
    memoryStore = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as NotificationStore)
      : {};
  } catch {
    memoryStore = {};
  }
  return memoryStore;
}

function writeStore(store: NotificationStore): void {
  memoryStore = store;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(store));
    } catch {
      // Storage can be full or disabled: the in-memory state still refreshes.
    }
  }
  listeners.forEach((listener) => listener());
}

function sortNotifications(list: AppNotification[]): AppNotification[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

function userNotifications(store: NotificationStore, userId: string): AppNotification[] {
  const list = store[userId];
  return Array.isArray(list) ? list : [];
}

function updateUserNotifications(
  userId: string,
  updater: (list: AppNotification[]) => AppNotification[]
): void {
  if (!userId) return;
  const store = readStore();
  store[userId] = sortNotifications(updater(userNotifications(store, userId))).slice(0, MAX_NOTIFICATIONS);
  writeStore(store);
}

export function getNotifications(userId: string): AppNotification[] {
  if (!userId) return [];
  const store = readStore();
  return sortNotifications(userNotifications(store, userId));
}

export function getUnreadNotificationCount(notifications: AppNotification[]): number {
  return notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);
}

export function addNotifications(userId: string, entries: AppNotificationInput[]): void {
  if (!userId || !entries.length) return;
  updateUserNotifications(userId, (list) => {
    const byId = new Map(list.map((notification) => [notification.id, notification]));
    entries.forEach((entry) => {
      const previous = byId.get(entry.id);
      byId.set(entry.id, {
        ...entry,
        createdAt: entry.createdAt ?? previous?.createdAt ?? Date.now(),
        read: entry.read ?? previous?.read ?? false
      });
    });
    return Array.from(byId.values());
  });
}

export function addNotification(userId: string, entry: AppNotificationInput): void {
  addNotifications(userId, [entry]);
}

export function markNotificationRead(userId: string, notificationId: string): void {
  updateUserNotifications(userId, (list) =>
    list.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    )
  );
}

export function markNotificationsReadByKinds(
  userId: string,
  kinds: AppNotificationKind[]
): void {
  const kindSet = new Set(kinds);
  updateUserNotifications(userId, (list) =>
    list.map((notification) =>
      kindSet.has(notification.kind) ? { ...notification, read: true } : notification
    )
  );
}

export function markAllNotificationsRead(userId: string): void {
  updateUserNotifications(userId, (list) =>
    list.map((notification) => (notification.read ? notification : { ...notification, read: true }))
  );
}

export function removeNotification(userId: string, notificationId: string): void {
  updateUserNotifications(userId, (list) =>
    list.filter((notification) => notification.id !== notificationId)
  );
}

export function clearNotifications(userId: string): void {
  if (!userId) return;
  const store = readStore();
  store[userId] = [];
  writeStore(store);
}

export function subscribeNotifications(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

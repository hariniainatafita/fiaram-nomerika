// Durable local store for base64 pictures (feed, stories, chat, profiles).
//
// localStorage is capped at ~5 MB on phones and the app prunes old picture
// rows when it is full, so a picture could disappear even though it was posted
// from this device. IndexedDB has a much larger quota and is not wiped by the
// localStorage cleanup, so it acts as the durable local copy: the feed can
// still render a picture when Supabase / R2 are unreachable.

const DB_NAME = 'pronumtld_images_v1';
const STORE = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGetImage(key: string): Promise<string | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === 'string' && value ? value : undefined);
      };
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbPutImage(key: string, value: string): Promise<boolean> {
  if (typeof value !== 'string' || !value) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbDeleteImage(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

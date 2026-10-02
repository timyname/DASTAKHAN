/** Storage access that never throws (private mode, blocked site data, quota errors). */

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** In-memory storage used for tests and as a fallback when localStorage is unavailable. */
export function createMemoryStorage(initial?: Record<string, string>): KeyValueStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

export interface BrowserStorage {
  storage: KeyValueStorage;
  /** False when localStorage is missing or throws; data then lives only in memory. */
  persistent: boolean;
}

/** Returns window.localStorage when it actually works, otherwise an in-memory fallback. */
export function getBrowserStorage(): BrowserStorage {
  try {
    const storage = globalThis.localStorage;
    if (!storage) throw new Error('localStorage missing');
    const probe = '__dastakhan_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return { storage, persistent: true };
  } catch {
    return { storage: createMemoryStorage(), persistent: false };
  }
}

export function safeGet(storage: KeyValueStorage, key: string): { ok: true; value: string | null } | { ok: false } {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch {
    return { ok: false };
  }
}

export function safeSet(storage: KeyValueStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(storage: KeyValueStorage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

import type { StateStorage } from "zustand/middleware";

/**
 * Where the app keeps its data.
 *
 * IndexedDB holds the state, backups and receipt photos: it is far roomier
 * than localStorage (~5 MB in Safari, shared with everything else). Data
 * written by earlier versions to localStorage is read once and moved over.
 * Without IndexedDB (tests, very old browsers) everything stays in
 * localStorage.
 */

const DB_NAME = "kapital";
const DB_VERSION = 1;
export const KV = "kv";
export const PHOTOS = "photos";

let dbPromise: Promise<IDBDatabase> | null = null;

export function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
        if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS);
      };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab upgraded the schema — reopen on next use.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB blocked"));
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
      })
  );
}

export const idb = {
  get: <T = unknown>(store: string, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
  set: (store: string, key: string, value: unknown) => run(store, "readwrite", (s) => s.put(value, key)).then(() => undefined),
  del: (store: string, key: string) => run(store, "readwrite", (s) => s.delete(key)).then(() => undefined),
  keys: (store: string) => run<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys()).then((k) => k.map(String))
};

/* ------------------------------------------------------------------ */
/*  Write health                                                       */
/* ------------------------------------------------------------------ */

type FailureListener = (error: unknown) => void;
const failureListeners = new Set<FailureListener>();
let lastWriteFailed = false;

/** Called when the state could not be saved anywhere. */
export function onStorageFailure(fn: FailureListener): () => void {
  failureListeners.add(fn);
  return () => failureListeners.delete(fn);
}

export function storageHealthy(): boolean {
  return !lastWriteFailed;
}

function reportFailure(error: unknown) {
  lastWriteFailed = true;
  failureListeners.forEach((fn) => fn(error));
}

/* ------------------------------------------------------------------ */
/*  Key-value storage for the persisted store                          */
/* ------------------------------------------------------------------ */

let foundStored = false;

/** Whether the last hydration found saved data (false on a first launch). */
export function hadStoredData(): boolean {
  return foundStored;
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  if (hasIDB()) {
    try {
      const v = await idb.get<string>(KV, key);
      if (typeof v === "string") return v;
    } catch {
      /* fall through to localStorage */
    }
  }
  return lsGet(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (hasIDB()) {
    try {
      await idb.set(KV, key, value);
      lastWriteFailed = false;
      // Moved: free the small localStorage quota for good.
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    } catch {
      /* try localStorage below */
    }
  }
  try {
    localStorage.setItem(key, value);
    lastWriteFailed = false;
  } catch (e) {
    reportFailure(e);
    throw e;
  }
}

export async function kvDel(key: string): Promise<void> {
  if (hasIDB()) {
    try {
      await idb.del(KV, key);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const appStorage: StateStorage = {
  async getItem(name) {
    const v = await kvGet(name);
    foundStored = v !== null;
    return v;
  },
  async setItem(name, value) {
    try {
      await kvSet(name, value);
    } catch {
      /* already reported */
    }
  },
  async removeItem(name) {
    await kvDel(name);
  }
};

/* ------------------------------------------------------------------ */
/*  Protection from eviction                                           */
/* ------------------------------------------------------------------ */

export interface StorageStatus {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

/** Asks the browser not to clear our data under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageStatus(): Promise<StorageStatus> {
  const out: StorageStatus = { persisted: null, usage: null, quota: null };
  try {
    if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      out.usage = e.usage ?? null;
      out.quota = e.quota ?? null;
    }
  } catch {
    /* unavailable */
  }
  return out;
}

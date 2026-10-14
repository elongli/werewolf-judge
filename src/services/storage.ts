/**
 * StorageAdapter：本地存储统一接口
 * H5：小数据 localStorage，对局全量 IndexedDB；二期小程序换 Taro.setStorage 实现（接口不变）
 * 禁止在 src/core 引用本文件
 */

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

/* ---------- localStorage（小数据：配置/排行） ---------- */
class LocalStorageAdapter implements StorageAdapter {
  async get(key: string) { return localStorage.getItem(key); }
  async set(key: string, value: string) { localStorage.setItem(key, value); }
  async remove(key: string) { localStorage.removeItem(key); }
  async keys(prefix = '') {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
}

/* ---------- IndexedDB（对局快照 games/{id}） ---------- */
const DB_NAME = 'werewolf-judge';
const STORE = 'games';

/** 单例连接：避免每次读写都 open 新连接（连接泄漏） */
let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // 连接被外部关闭/升级时清缓存，下次调用重开
    dbPromise.then((db) => {
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => db.close();
    }).catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

class IdbStorageAdapter implements StorageAdapter {
  async get(key: string) {
    const db = await openDb();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  async set(key: string, value: string) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async remove(key: string) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async keys(prefix = '') {
    const db = await openDb();
    return new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]).filter((k) => k.startsWith(prefix)));
      req.onerror = () => reject(req.error);
    });
  }
}

export const configStorage: StorageAdapter = new LocalStorageAdapter();
export const gameStorage: StorageAdapter = new IdbStorageAdapter();

export const GAME_KEY_PREFIX = 'games/';

export async function saveGameSnapshot(id: string, json: string): Promise<void> {
  await gameStorage.set(GAME_KEY_PREFIX + id, json);
}
export async function loadGameSnapshot(id: string): Promise<string | null> {
  return gameStorage.get(GAME_KEY_PREFIX + id);
}
export async function listGameIds(): Promise<string[]> {
  return (await gameStorage.keys(GAME_KEY_PREFIX)).map((k) => k.slice(GAME_KEY_PREFIX.length));
}

// IndexedDB 超軽量ラッパー（key-value）
const db = (() => {
  const DB_NAME = 'pwa-store';
  const STORE = 'kv';
  const VERSION = 1;

  let _dbp = null;

  const open = () => {
    if (_dbp) return _dbp;
    _dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbp;
  };

  const withStore = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let res;
      tx.oncomplete = () => resolve(res);
      tx.onerror = () => reject(tx.error);
      res = fn(store);
    });
  };

  return {
    async get(key) {
      return withStore('readonly', (store) => new Promise((resolve, reject) => {
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }));
    },
    async set(key, val) {
      return withStore('readwrite', (store) => new Promise((resolve, reject) => {
        const r = store.put(val, key);
        r.onsuccess = () => resolve(true);
        r.onerror = () => reject(r.error);
      }));
    },
    async del(key) {
      return withStore('readwrite', (store) => new Promise((resolve, reject) => {
        const r = store.delete(key);
        r.onsuccess = () => resolve(true);
        r.onerror = () => reject(r.error);
      }));
    },
    async clear() {
      return withStore('readwrite', (store) => new Promise((resolve, reject) => {
        const r = store.clear();
        r.onsuccess = () => resolve(true);
        r.onerror = () => reject(r.error);
      }));
    }
  };
})();

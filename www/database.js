/* LEVEL UP — IndexedDB wrapper, with a localStorage fallback. */
(() => {
  "use strict";
  const DB_NAME = "level-up-db";
  const DB_VERSION = 1;
  const STORE = "state";
  const KEY = "main";
  const fallbackKey = "level-up-state-v1";
  const defaults = () => ({
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    missions: [],
    completions: {},
    xpEvents: [],
    settings: { notifications: false },
    specialClaimed: {},
    profile: { totalXp: 0, streak: 0, lastActiveDate: null }
  });
  let dbPromise;
  function openDB() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    return dbPromise;
  }
  async function load() {
    const db = await openDB();
    if (!db) return parseFallback();
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result || parseFallback());
        req.onerror = () => resolve(parseFallback());
      } catch (_) { resolve(parseFallback()); }
    });
  }
  function parseFallback() {
    try { return JSON.parse(localStorage.getItem(fallbackKey)) || defaults(); }
    catch (_) { return defaults(); }
  }
  async function save(state) {
    const db = await openDB();
    if (!db) {
      localStorage.setItem(fallbackKey, JSON.stringify(state));
      return;
    }
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Salvataggio non riuscito"));
        tx.onabort = () => reject(tx.error || new Error("Salvataggio annullato"));
      } catch (e) { reject(e); }
    });
  }
  async function clear() {
    const db = await openDB();
    localStorage.removeItem(fallbackKey);
    if (!db) return;
    await new Promise(resolve => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch (_) { resolve(); }
    });
  }
  window.LevelDB = { defaults, load, save, clear };
})();
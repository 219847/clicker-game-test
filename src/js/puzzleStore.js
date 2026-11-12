const DB_NAME = "chess-puzzle-db";
const DB_VERSION = 1;
const STORE_NAME = "puzzles";

function normalizeRange(min, max) {
  const minValue = Number(min);
  const maxValue = Number(max);
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    throw new Error("Rating range values must be numbers");
  }
  return [Math.min(minValue, maxValue), Math.max(minValue, maxValue)];
}

export class PuzzleStore {
  constructor() {
    this.dbPromise = null;
  }

  async open() {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("rating", "rating", { unique: false });
          store.createIndex("colorOfUser", "colorOfUser", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async withStore(mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);

      let callbackResult;
      try {
        callbackResult = callback(store, transaction);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = () => resolve(callbackResult);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
    });
  }

  async hasPuzzle(id) {
    const puzzleId = Number(id);
    return this.withStore("readonly", (store) => {
      const request = store.getKey(puzzleId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result !== undefined);
        request.onerror = () => reject(request.error);
      });
    }).then((resultPromise) => resultPromise);
  }

  async putPuzzle(puzzle) {
    return this.withStore("readwrite", (store) => store.put(puzzle));
  }

  async countAll() {
    return this.withStore("readonly", (store) => {
      const request = store.count();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }).then((resultPromise) => resultPromise);
  }

  async getPuzzleById(id) {
    const puzzleId = Number(id);
    return this.withStore("readonly", (store) => {
      const request = store.get(puzzleId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }).then((resultPromise) => resultPromise);
  }

  async queryByRatingRange(minRating, maxRating, { limit = 50, offset = 0 } = {}) {
    const [minValue, maxValue] = normalizeRange(minRating, maxRating);
    return this.withStore("readonly", (store) => {
      const index = store.index("rating");
      const request = index.openCursor(IDBKeyRange.bound(minValue, maxValue));
      const results = [];
      let skipped = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || results.length >= limit) {
            resolve(results);
            return;
          }
          if (skipped < offset) {
            skipped += 1;
            cursor.continue();
            return;
          }
          results.push(cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    }).then((resultPromise) => resultPromise);
  }

  async queryByColor(colorOfUser, { limit = 50, offset = 0 } = {}) {
    return this.withStore("readonly", (store) => {
      const index = store.index("colorOfUser");
      const request = index.openCursor(IDBKeyRange.only(String(colorOfUser).toLowerCase()));
      const results = [];
      let skipped = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || results.length >= limit) {
            resolve(results);
            return;
          }
          if (skipped < offset) {
            skipped += 1;
            cursor.continue();
            return;
          }
          results.push(cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    }).then((resultPromise) => resultPromise);
  }

  async getRandomPuzzle() {
    const count = await this.countAll();
    if (count === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * count);
    return this.withStore("readonly", (store) => {
      const request = store.openCursor();
      let position = 0;
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(null);
            return;
          }

          if (position === randomIndex) {
            resolve(cursor.value);
            return;
          }

          position += 1;
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    }).then((resultPromise) => resultPromise);
  }
}

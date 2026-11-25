/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 157: storage adapters for the Workbook.  Both have the same four methods, so WorkbookModel (Workbook.js)
// does not care which one it has:
//
//   loadIndex()        -> Promise<{ entries: object[], meta: object }>   (the list, without the Song text)
//   getText(path)      -> Promise<string | undefined>
//   getAllTexts()      -> Promise<Map<path, text>>
//   commit(writes)     -> Promise<void>    ONE transaction: all the writes happen, or none do.
//                         write = { store: 'entries'|'songText'|'meta', op: 'put'|'delete'|'clear', key?, value? }
//
// Stores: `entries` (keyPath "path"), `songText` (key = path, value = the verbatim Song JSON text), `meta` (key "meta").

export const WORKBOOK_DB_NAME = 'infinite-neck-workbook';
export const WORKBOOK_DB_VERSION = 1;

const STORE_NAMES = ['entries', 'songText', 'meta'];

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** In-memory adapter: used by Jest, and by the App when IndexedDB is not available (nothing survives a reload). */
export function createMemoryAdapter() {
    let entries = new Map();   // path -> entry
    let texts = new Map();     // path -> text
    let meta = null;

    return {
        persistent: false,
        close() {},
        async loadIndex() {
            return { entries: [...entries.values()].map(clone), meta: clone(meta) || {} };
        },
        async getText(path) {
            return texts.get(path);
        },
        async getAllTexts() {
            return new Map(texts);
        },
        async commit(writes) {
            // work on copies and swap at the end, so a bad write leaves everything as it was
            const nextEntries = new Map(entries);
            const nextTexts = new Map(texts);
            let nextMeta = meta;
            for (const write of writes) {
                if (!STORE_NAMES.includes(write.store)) {
                    throw new Error(`Unknown store ${write.store}`);
                }
                if (write.store === 'meta') {
                    nextMeta = clone(write.value);
                } else {
                    const target = write.store === 'entries' ? nextEntries : nextTexts;
                    if (write.op === 'clear') {
                        target.clear();
                    } else if (write.op === 'delete') {
                        target.delete(write.key);
                    } else if (write.op === 'put') {
                        target.set(write.store === 'entries' ? write.value.path : write.key, write.store === 'entries' ? clone(write.value) : write.value);
                    } else {
                        throw new Error(`Unknown op ${write.op}`);
                    }
                }
            }
            entries = nextEntries;
            texts = nextTexts;
            meta = nextMeta;
        }
    };
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Workbook transaction aborted'));
    });
}

/** Deletes a whole database (an unmounted Workbook).  Resolves when it is gone or was never there. */
export function deleteIndexedDb(dbName, factory = globalThis.indexedDB) {
    return new Promise((resolve, reject) => {
        if (!factory) {
            resolve();
            return;
        }
        let request;
        try {
            request = factory.deleteDatabase(dbName);
        } catch (error) {
            reject(error);
            return;
        }
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error('Could not delete the Workbook database.'));
        request.onblocked = () => resolve();   // another tab still holds it open; it is deleted when that tab lets go
    });
}

/** IndexedDB adapter.  Rejects when the database cannot be opened (private modes, blocked storage).
 *  Sprint 158: `dbName` lets each mounted Workbook have its own database. */
export function openIndexedDbAdapter(factory = globalThis.indexedDB, dbName = WORKBOOK_DB_NAME) {
    return new Promise((resolve, reject) => {
        if (!factory) {
            reject(new Error('IndexedDB is not available.'));
            return;
        }
        let request;
        try {
            request = factory.open(dbName, WORKBOOK_DB_VERSION);
        } catch (error) {
            reject(error);
            return;
        }
        request.onupgradeneeded = () => {
            const db = request.result;
            db.createObjectStore('entries', { keyPath: 'path' });
            db.createObjectStore('songText');
            db.createObjectStore('meta');
        };
        request.onerror = () => reject(request.error || new Error('Could not open the Workbook database.'));
        request.onblocked = () => reject(new Error('The Workbook database is blocked by another tab.'));
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => db.close();
            resolve({
                persistent: true,
                close() {
                    db.close();
                },
                async loadIndex() {
                    const tx = db.transaction(['entries', 'meta'], 'readonly');
                    const entriesRequest = tx.objectStore('entries').getAll();
                    const metaRequest = tx.objectStore('meta').get('meta');
                    await transactionDone(tx);
                    return { entries: entriesRequest.result || [], meta: metaRequest.result || {} };
                },
                async getText(path) {
                    const tx = db.transaction('songText', 'readonly');
                    const result = requestToPromise(tx.objectStore('songText').get(path));
                    await transactionDone(tx);
                    return result;
                },
                async getAllTexts() {
                    const tx = db.transaction('songText', 'readonly');
                    const store = tx.objectStore('songText');
                    const keysRequest = store.getAllKeys();
                    const valuesRequest = store.getAll();
                    await transactionDone(tx);
                    const texts = new Map();
                    (keysRequest.result || []).forEach((key, index) => texts.set(key, valuesRequest.result[index]));
                    return texts;
                },
                async commit(writes) {
                    const tx = db.transaction(STORE_NAMES, 'readwrite');
                    const done = transactionDone(tx);
                    try {
                        for (const write of writes) {
                            const store = tx.objectStore(write.store);
                            if (write.op === 'clear') {
                                store.clear();
                            } else if (write.op === 'delete') {
                                store.delete(write.key);
                            } else if (write.store === 'entries') {
                                store.put(write.value);
                            } else {
                                store.put(write.value, write.key);
                            }
                        }
                    } catch (error) {
                        tx.abort();
                        await done.catch(() => {});
                        throw error;
                    }
                    await done;
                }
            });
        };
    });
}

import { INSTALLED_EXTENSION_LIMIT, type PackageStorage, type InstalledExtensionRecord, type StoredExtension } from './records';

/** Package receipts/documents only. Existing chat and preference owners are untouched. */
export class BrowserPackageStorage implements PackageStorage {
    private db: Promise<IDBDatabase> | null = null;
    constructor(private readonly name = 'cluaiz-extension-packages') {}
    private open() {
        if (!this.db) this.db = new Promise<IDBDatabase>((resolve, reject) => {
            if (!globalThis.indexedDB) { reject(new Error('Extension installation requires persistent IndexedDB storage.')); return; }
            const request = indexedDB.open(this.name, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore('records', { keyPath: 'id' });
                request.result.createObjectStore('documents');
            };
            request.onerror = () => { this.db = null; reject(request.error); };
            request.onblocked = () => { this.db = null; reject(new Error('Close other App tabs before upgrading extension storage.')); };
            request.onsuccess = () => {
                request.result.onversionchange = () => { request.result.close(); this.db = null; };
                resolve(request.result);
            };
        });
        return this.db;
    }
    async list(): Promise<InstalledExtensionRecord[]> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('records', 'readonly');
            const request = tx.objectStore('records').getAll();
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not read installed extensions.'));
        });
    }
    async read(id: string): Promise<StoredExtension | null> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['records', 'documents'], 'readonly');
            const request = tx.objectStore('records').get(id);
            let document: IDBRequest | undefined;
            request.onsuccess = () => { if (request.result) document = tx.objectStore('documents').get(request.result.documentHash); };
            tx.oncomplete = () => {
                if (!request.result) resolve(null);
                else if (typeof document?.result !== 'string') reject(new Error('Installed extension document is missing.'));
                else resolve({ record: request.result, html: document.result });
            };
            tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not read installed extension.'));
        });
    }
    async commit(id: string, expected: string | null, next: StoredExtension | null): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['records', 'documents'], 'readwrite');
            const records = tx.objectStore('records');
            const all = records.getAll();
            let error: Error | undefined;
            all.onsuccess = () => {
                const current = (all.result as InstalledExtensionRecord[]).find(record => record.id === id);
                if ((current?.revision ?? null) !== expected) error = new Error('Extension changed in another operation. Refresh before trying again.');
                else if (next && !current && all.result.length >= INSTALLED_EXTENSION_LIMIT) error = new Error('Installed extension limit reached.');
                if (error) { tx.abort(); return; }
                if (next) {
                    tx.objectStore('documents').put(next.html, next.record.documentHash);
                    records.put(next.record);
                } else records.delete(id);
                if (current && current.documentHash !== next?.record.documentHash
                    && !all.result.some((record: InstalledExtensionRecord) => record.id !== id && record.documentHash === current.documentHash)) {
                    tx.objectStore('documents').delete(current.documentHash);
                }
            };
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () => reject(error ?? tx.error ?? new Error('Extension installation was not saved.'));
        });
    }
    async close() { (await this.db)?.close(); this.db = null; }
}

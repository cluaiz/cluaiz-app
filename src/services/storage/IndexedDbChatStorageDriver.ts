import { IChatStorageDriver, SessionsIndex, SessionMetadata, SessionIndexItem } from './types';
import { ChatMessage } from '../../store/chat/useChatStore';

const DB_NAME = 'cluaiz_chat_storage';
const DB_VERSION = 1;

export class IndexedDbChatStorageDriver implements IChatStorageDriver {
    private dbPromise: Promise<IDBDatabase> | null = null;
    private memoryFallback: {
        index: SessionsIndex | null;
        meta: Record<string, SessionMetadata>;
        messages: Record<string, ChatMessage[]>;
        assets: Record<string, Blob>;
    } = {
        index: null,
        meta: {},
        messages: {},
        assets: {}
    };

    private getDb(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        if (typeof window === 'undefined' || !window.indexedDB) {
            return Promise.reject(new Error("IndexedDB is not supported in this environment"));
        }

        this.dbPromise = new Promise((resolve, reject) => {
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('sessions_index')) {
                    db.createObjectStore('sessions_index');
                }
                if (!db.objectStoreNames.contains('session_meta')) {
                    db.createObjectStore('session_meta');
                }
                if (!db.objectStoreNames.contains('session_messages')) {
                    db.createObjectStore('session_messages');
                }
                if (!db.objectStoreNames.contains('session_assets')) {
                    db.createObjectStore('session_assets');
                }
            };

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        return this.dbPromise;
    }

    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        try {
            const db = await this.getDb();
            return new Promise((resolve) => {
                const tx = db.transaction(['sessions_index', 'session_meta', 'session_messages'], 'readonly');
                const indexStore = tx.objectStore('sessions_index');
                const metaStore = tx.objectStore('session_meta');
                const msgStore = tx.objectStore('session_messages');

                const catalogReq = indexStore.get('catalog');
                const allMetaReq = metaStore.getAll();
                const allMsgKeysReq = msgStore.getAllKeys();

                tx.oncomplete = () => {
                    const catalog = catalogReq.result as SessionsIndex | undefined;
                    const allMeta = (allMetaReq.result || []) as SessionMetadata[];
                    const allMsgKeys = (allMsgKeysReq.result || []) as IDBValidKey[];

                    const existingMap = new Map<string, SessionIndexItem>();

                    // 1. Populate from catalog
                    if (catalog?.sessions && Array.isArray(catalog.sessions)) {
                        for (const s of catalog.sessions) {
                            if (s?.id) {
                                existingMap.set(s.id, {
                                    id: s.id,
                                    extensionId: s.extensionId,
                                    title: s.title || 'New Chat',
                                    createdAt: s.createdAt || Date.now(),
                                    updatedAt: s.updatedAt || Date.now(),
                                    lastMessagePreview: s.lastMessagePreview,
                                    messageCount: s.messageCount
                                });
                            }
                        }
                    }

                    // 2. Self-heal from session_meta
                    for (const m of allMeta) {
                        if (m?.id && !existingMap.has(m.id)) {
                            existingMap.set(m.id, {
                                id: m.id,
                                extensionId: m.extensionId,
                                title: m.title || 'New Chat',
                                createdAt: m.createdAt || Date.now(),
                                updatedAt: m.updatedAt || Date.now(),
                            });
                        }
                    }

                    // 3. Self-heal from all stored session messages keys
                    for (const rawKey of allMsgKeys) {
                        const key = String(rawKey);
                        if (key && !existingMap.has(key)) {
                            existingMap.set(key, {
                                id: key,
                                title: 'New Chat',
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            });
                        }
                    }

                    const mergedSessions = Array.from(existingMap.values());
                    if (mergedSessions.length > 0) {
                        const resolvedIndex: SessionsIndex = {
                            version: 1,
                            lastActiveSessionId: catalog?.lastActiveSessionId ?? null,
                            sessions: mergedSessions
                        };
                        this.memoryFallback.index = resolvedIndex;
                        resolve(resolvedIndex);
                        return;
                    }

                    resolve(catalog || this.memoryFallback.index);
                };

                tx.onerror = () => {
                    resolve(this.memoryFallback.index);
                };
            });
        } catch {
            return this.memoryFallback.index;
        }
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        this.memoryFallback.index = index;
        try {
            const db = await this.getDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('sessions_index', 'readwrite');
                const store = tx.objectStore('sessions_index');
                const req = store.put(index, 'catalog');
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn("[IDB] saveSessionsIndex fallback to memory:", err);
        }
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        try {
            const db = await this.getDb();
            return new Promise((resolve) => {
                const tx = db.transaction('session_meta', 'readonly');
                const store = tx.objectStore('session_meta');
                const req = store.get(sessionId);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(this.memoryFallback.meta[sessionId] || null);
            });
        } catch {
            return this.memoryFallback.meta[sessionId] || null;
        }
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        this.memoryFallback.meta[sessionId] = meta;
        try {
            const db = await this.getDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('session_meta', 'readwrite');
                const store = tx.objectStore('session_meta');
                const req = store.put(meta, sessionId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn("[IDB] saveSessionMetadata fallback to memory:", err);
        }
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        let allMessages: ChatMessage[] = [];
        try {
            const db = await this.getDb();
            allMessages = await new Promise((resolve) => {
                const tx = db.transaction('session_messages', 'readonly');
                const store = tx.objectStore('session_messages');
                const req = store.get(sessionId);
                req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
                req.onerror = () => resolve(this.memoryFallback.messages[sessionId] || []);
            });
        } catch {
            allMessages = this.memoryFallback.messages[sessionId] || [];
        }

        if (limit && limit > 0) {
            const startIdx = offset ? Math.max(0, allMessages.length - offset - limit) : Math.max(0, allMessages.length - limit);
            const endIdx = offset ? allMessages.length - offset : allMessages.length;
            return allMessages.slice(startIdx, endIdx);
        }

        return allMessages;
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        if (!this.memoryFallback.messages[sessionId]) {
            this.memoryFallback.messages[sessionId] = [];
        }
        const memIdx = this.memoryFallback.messages[sessionId].findIndex(m => m.id === message.id);
        if (memIdx >= 0) {
            this.memoryFallback.messages[sessionId][memIdx] = message;
        } else {
            this.memoryFallback.messages[sessionId].push(message);
        }

        try {
            const db = await this.getDb();
            const existingMessages = await this.loadSessionMessages(sessionId);
            const idx = existingMessages.findIndex(m => m.id === message.id);
            if (idx >= 0) {
                existingMessages[idx] = message;
            } else {
                existingMessages.push(message);
            }

            return new Promise((resolve, reject) => {
                const tx = db.transaction('session_messages', 'readwrite');
                const store = tx.objectStore('session_messages');
                const req = store.put(existingMessages, sessionId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn("[IDB] appendMessage fallback to memory:", err);
        }
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        this.memoryFallback.messages[sessionId] = [...messages];
        try {
            const db = await this.getDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('session_messages', 'readwrite');
                const store = tx.objectStore('session_messages');
                const req = store.put(messages, sessionId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn("[IDB] saveAllMessages fallback to memory:", err);
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        delete this.memoryFallback.meta[sessionId];
        delete this.memoryFallback.messages[sessionId];

        try {
            const db = await this.getDb();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(['session_meta', 'session_messages'], 'readwrite');
                tx.objectStore('session_meta').delete(sessionId);
                tx.objectStore('session_messages').delete(sessionId);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn("[IDB] deleteSession error:", err);
        }
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        const blob = data instanceof Blob ? data : new Blob([data as unknown as BlobPart]);
        const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const assetId = `${Date.now()}_${cleanName}`;
        const key = `${sessionId}:${assetId}`;
        const relativePath = `assets/${assetId}`;

        this.memoryFallback.assets[key] = blob;

        try {
            const db = await this.getDb();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction('session_assets', 'readwrite');
                const store = tx.objectStore('session_assets');
                const req = store.put(blob, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn("[IDB] saveAsset error:", err);
        }

        return relativePath;
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        const assetId = relativePath.replace(/^assets\//, '');
        const key = `${sessionId}:${assetId}`;

        const blob = this.memoryFallback.assets[key] || await (async () => {
            try {
                const db = await this.getDb();
                return new Promise<Blob | null>((resolve) => {
                    const tx = db.transaction('session_assets', 'readonly');
                    const store = tx.objectStore('session_assets');
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
            } catch {
                return null;
            }
        })();

        if (blob) {
            return URL.createObjectURL(blob);
        }
        return relativePath;
    }
}

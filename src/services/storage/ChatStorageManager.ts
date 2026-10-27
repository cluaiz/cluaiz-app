import { isTauri } from '../../core/tauri-api';
import { IChatStorageDriver, SessionsIndex, SessionMetadata, withoutSession } from './types';
import { TauriFsChatStorageDriver } from './TauriFsChatStorageDriver';
import { EngineFsChatStorageDriver } from './EngineFsChatStorageDriver';
import { IndexedDbChatStorageDriver } from './IndexedDbChatStorageDriver';
import { ChatMessage } from '../../store/chat/useChatStore';
import { useConnectionStore } from '../../store/engine/useConnectionStore';

/**
 * ChatStorageManager delegates storage operations dynamically based on runtime environment:
 * - On Desktop (Tauri): delegates to TauriFsChatStorageDriver (native filesystem).
 * - On Browser/Web: delegates to EngineFsChatStorageDriver (workspace-relative data/chats via shared CEP filesystem adapter).
 * - Offline Fallback: delegates to IndexedDbChatStorageDriver if Engine is unreachable.
 */
export class ChatStorageManager implements IChatStorageDriver {
    private primaryDriver: IChatStorageDriver;
    private fallbackDriver: IChatStorageDriver;
    private writes: Promise<unknown> = Promise.resolve();
    private generation = 0;
    private deleted = new Set<string>();

    private writable(id: string): void {
        if (this.deleted.has(id)) throw new Error('Chat was deleted; stale save refused');
    }

    private ordered<T>(operation: () => Promise<T>): Promise<T> {
        const started = this.generation;
        const task = this.writes.then(() => {
            if (started !== this.generation) throw new Error('Engine connection changed before queued chat storage operation');
            return operation();
        });
        this.writes = task.catch(() => {});
        return task;
    }

    private mirror(operation: (driver: IChatStorageDriver) => Promise<void>): Promise<void> {
        return this.ordered(async () => {
            const results = await Promise.allSettled([operation(this.primaryDriver), operation(this.fallbackDriver)]);
            for (const result of results) if (result.status === 'rejected') console.warn('[ChatStorageManager] Save failed:', result.reason);
            if (results.every(result => result.status === 'rejected')) throw new Error('Both chat storage saves failed');
        });
    }

    constructor() {
        useConnectionStore.subscribe((next, previous) => {
            if (next.protocol !== previous.protocol || next.host !== previous.host || next.port !== previous.port) {
                ++this.generation;
                this.deleted.clear();
            }
        });
        this.fallbackDriver = new IndexedDbChatStorageDriver();
        if (isTauri()) {
            this.primaryDriver = new TauriFsChatStorageDriver();
        } else {
            this.primaryDriver = new EngineFsChatStorageDriver();
        }
    }

    public getDriver(): IChatStorageDriver {
        return this.primaryDriver;
    }

    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        await this.writes;
        try {
            const index = await this.primaryDriver.loadSessionsIndex();
            if (index && Array.isArray(index.sessions) && index.sessions.length > 0) {
                return index;
            }
        } catch (e) {
            console.warn('[ChatStorageManager] Primary loadSessionsIndex failed, trying fallback:', e);
        }
        return this.fallbackDriver.loadSessionsIndex();
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        return this.mirror(driver => {
            let current = index;
            for (const id of this.deleted) current = withoutSession(current, id);
            return driver.saveSessionsIndex(current);
        });
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        await this.writes;
        try {
            const meta = await this.primaryDriver.loadSessionMetadata(sessionId);
            if (meta) return meta;
        } catch {}
        return this.fallbackDriver.loadSessionMetadata(sessionId);
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        return this.mirror(driver => { this.writable(sessionId); return driver.saveSessionMetadata(sessionId, meta); });
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        await this.writes;
        try {
            const msgs = await this.primaryDriver.loadSessionMessages(sessionId, limit, offset);
            if (msgs && msgs.length > 0) return msgs;
        } catch {}
        return this.fallbackDriver.loadSessionMessages(sessionId, limit, offset);
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        return this.mirror(driver => { this.writable(sessionId); return driver.appendMessage(sessionId, message); });
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        return this.mirror(driver => { this.writable(sessionId); return driver.saveAllMessages(sessionId, messages); });
    }

    async deleteSession(sessionId: string, assertCurrent = () => {}): Promise<void> {
        return this.ordered(async () => {
            assertCurrent();
            await this.primaryDriver.deleteSession(sessionId, assertCurrent);
            assertCurrent();
            await this.fallbackDriver.deleteSession(sessionId, assertCurrent);
            assertCurrent();
            this.deleted.add(sessionId);
        });
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        return this.ordered(async () => {
            this.writable(sessionId);
            try { return await this.primaryDriver.saveAsset(sessionId, fileName, data); }
            catch { return this.fallbackDriver.saveAsset(sessionId, fileName, data); }
        });
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        try {
            return await this.primaryDriver.resolveAssetUrl(sessionId, relativePath);
        } catch {
            return this.fallbackDriver.resolveAssetUrl(sessionId, relativePath);
        }
    }
}

export const chatStorageManager = new ChatStorageManager();

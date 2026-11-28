import { IChatStorageDriver, SessionsIndex, SessionMetadata, withoutSession } from './types';
import { EngineFsChatStorageDriver } from './EngineFsChatStorageDriver';
import { ChatMessage } from '../../store/chat/useChatStore';
import { useConnectionStore } from '../../store/engine/useConnectionStore';

/**
 * Chat history lives only in the Engine workspace (`data/chats`, read and written over CEP), on
 * desktop and in the browser. There is no second copy in browser storage or the App's own data
 * folder: a silent local fallback hid failed Engine reads and writes, so the sidebar showed a
 * different, almost empty list (2026-11-28). An Engine failure is now returned to the caller.
 */
export class ChatStorageManager implements IChatStorageDriver {
    private driver: IChatStorageDriver;
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

    constructor() {
        useConnectionStore.subscribe((next, previous) => {
            if (next.protocol !== previous.protocol || next.host !== previous.host || next.port !== previous.port) {
                ++this.generation;
                this.deleted.clear();
            }
        });
        this.driver = new EngineFsChatStorageDriver();
    }

    public getDriver(): IChatStorageDriver {
        return this.driver;
    }

    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        await this.writes;
        const index = await this.driver.loadSessionsIndex();
        if (!index) return null;
        let current = index;
        for (const id of this.deleted) current = withoutSession(current, id);
        return current;
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        return this.ordered(() => {
            let current = index;
            for (const id of this.deleted) current = withoutSession(current, id);
            return this.driver.saveSessionsIndex(current);
        });
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        await this.writes;
        return this.driver.loadSessionMetadata(sessionId);
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        return this.ordered(() => { this.writable(sessionId); return this.driver.saveSessionMetadata(sessionId, meta); });
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        await this.writes;
        return this.driver.loadSessionMessages(sessionId, limit, offset);
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        return this.ordered(() => { this.writable(sessionId); return this.driver.appendMessage(sessionId, message); });
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        return this.ordered(() => { this.writable(sessionId); return this.driver.saveAllMessages(sessionId, messages); });
    }

    async deleteSession(sessionId: string, assertCurrent = () => {}): Promise<void> {
        return this.ordered(async () => {
            assertCurrent();
            await this.driver.deleteSession(sessionId, assertCurrent);
            assertCurrent();
            this.deleted.add(sessionId);
        });
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        return this.ordered(() => { this.writable(sessionId); return this.driver.saveAsset(sessionId, fileName, data); });
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        return this.driver.resolveAssetUrl(sessionId, relativePath);
    }
}

export const chatStorageManager = new ChatStorageManager();

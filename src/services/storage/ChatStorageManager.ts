import { isTauri } from '../../core/tauri-api';
import { IChatStorageDriver, SessionIndexItem, SessionsIndex, SessionMetadata } from './types';
import { TauriFsChatStorageDriver } from './TauriFsChatStorageDriver';
import { IndexedDbChatStorageDriver } from './IndexedDbChatStorageDriver';
import { ChatMessage } from '../../store/chat/useChatStore';

/**
 * ChatStorageManager delegates storage operations dynamically based on runtime environment.
 * On Desktop (Tauri), it delegates to TauriFsChatStorageDriver (native filesystem JSONL + assets).
 * On Browser/Web, it delegates to IndexedDbChatStorageDriver (IndexedDB + binary Blobs).
 */
export class ChatStorageManager implements IChatStorageDriver {
    private driver: IChatStorageDriver;

    constructor() {
        if (isTauri()) {
            this.driver = new TauriFsChatStorageDriver();
        } else {
            this.driver = new IndexedDbChatStorageDriver();
        }
    }

    public getDriver(): IChatStorageDriver {
        return this.driver;
    }

    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        return this.driver.loadSessionsIndex();
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        return this.driver.saveSessionsIndex(index);
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        return this.driver.loadSessionMetadata(sessionId);
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        return this.driver.saveSessionMetadata(sessionId, meta);
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        return this.driver.loadSessionMessages(sessionId, limit, offset);
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        return this.driver.appendMessage(sessionId, message);
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        return this.driver.saveAllMessages(sessionId, messages);
    }

    async deleteSession(sessionId: string): Promise<void> {
        return this.driver.deleteSession(sessionId);
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        return this.driver.saveAsset(sessionId, fileName, data);
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        return this.driver.resolveAssetUrl(sessionId, relativePath);
    }
}

export const chatStorageManager = new ChatStorageManager();

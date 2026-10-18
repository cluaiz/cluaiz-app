import { isTauri } from '../../core/tauri-api';
import { IChatStorageDriver, SessionIndexItem, SessionsIndex, SessionMetadata } from './types';
import { TauriFsChatStorageDriver } from './TauriFsChatStorageDriver';
import { EngineFsChatStorageDriver } from './EngineFsChatStorageDriver';
import { IndexedDbChatStorageDriver } from './IndexedDbChatStorageDriver';
import { ChatMessage } from '../../store/chat/useChatStore';

/**
 * ChatStorageManager delegates storage operations dynamically based on runtime environment:
 * - On Desktop (Tauri): delegates to TauriFsChatStorageDriver (native filesystem).
 * - On Browser/Web: delegates to EngineFsChatStorageDriver (writes real files to C:\Users\Aryan\.cluaiz\data\ via /v1/fs/*).
 * - Offline Fallback: delegates to IndexedDbChatStorageDriver if Engine is unreachable.
 */
export class ChatStorageManager implements IChatStorageDriver {
    private primaryDriver: IChatStorageDriver;
    private fallbackDriver: IChatStorageDriver;

    constructor() {
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
        // Dual-write: write to real disk files, and keep fallback in sync
        this.fallbackDriver.saveSessionsIndex(index).catch(() => {});
        try {
            await this.primaryDriver.saveSessionsIndex(index);
        } catch (e) {
            console.warn('[ChatStorageManager] Primary saveSessionsIndex failed, saved to fallback:', e);
        }
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        try {
            const meta = await this.primaryDriver.loadSessionMetadata(sessionId);
            if (meta) return meta;
        } catch {}
        return this.fallbackDriver.loadSessionMetadata(sessionId);
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        this.fallbackDriver.saveSessionMetadata(sessionId, meta).catch(() => {});
        try {
            await this.primaryDriver.saveSessionMetadata(sessionId, meta);
        } catch (e) {
            console.warn('[ChatStorageManager] Primary saveSessionMetadata failed:', e);
        }
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        try {
            const msgs = await this.primaryDriver.loadSessionMessages(sessionId, limit, offset);
            if (msgs && msgs.length > 0) return msgs;
        } catch {}
        return this.fallbackDriver.loadSessionMessages(sessionId, limit, offset);
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        this.fallbackDriver.appendMessage(sessionId, message).catch(() => {});
        try {
            await this.primaryDriver.appendMessage(sessionId, message);
        } catch (e) {
            console.warn('[ChatStorageManager] Primary appendMessage failed:', e);
        }
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        this.fallbackDriver.saveAllMessages(sessionId, messages).catch(() => {});
        try {
            await this.primaryDriver.saveAllMessages(sessionId, messages);
        } catch (e) {
            console.warn('[ChatStorageManager] Primary saveAllMessages failed:', e);
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        this.fallbackDriver.deleteSession(sessionId).catch(() => {});
        try {
            await this.primaryDriver.deleteSession(sessionId);
        } catch (e) {
            console.warn('[ChatStorageManager] Primary deleteSession failed:', e);
        }
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        try {
            return await this.primaryDriver.saveAsset(sessionId, fileName, data);
        } catch {
            return this.fallbackDriver.saveAsset(sessionId, fileName, data);
        }
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

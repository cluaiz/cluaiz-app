import { IChatStorageDriver, SessionsIndex, SessionMetadata } from './types';
import { ChatMessage } from '../../store/chat/useChatStore';
import { http } from '../../api/client';

/**
 * EngineFsChatStorageDriver writes real JSON and JSONL files to the user's
 * physical filesystem directory (C:\Users\Aryan\.cluaiz\data\) via the Engine's
 * existing /v1/fs/write, /v1/fs/read, and /v1/fs/delete REST APIs.
 *
 * Uses the official centralized http client from src/api/client for zero hardcoding and full DRY.
 * Works identically across Web Browser (localhost:1420) and Desktop.
 */
export class EngineFsChatStorageDriver implements IChatStorageDriver {
    private async callFsApi<T = any>(endpoint: 'read' | 'write' | 'delete', body: Record<string, any>): Promise<T> {
        return http.post<T>(`/v1/fs/${endpoint}`, { ...body, caller: 'user' });
    }

    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        try {
            const res = await this.callFsApi('read', { path: 'data/chats/sessions_index.json' });
            if (res && res.content) {
                const parsed = JSON.parse(res.content) as SessionsIndex;
                if (parsed && Array.isArray(parsed.sessions)) {
                    return parsed;
                }
            }
        } catch {
            // Self-heal or first load returns null
        }
        return null;
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        await this.callFsApi('write', {
            path: 'data/chats/sessions_index.json',
            content: JSON.stringify(index, null, 2)
        });
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        try {
            const res = await this.callFsApi('read', { path: `data/chats/${sessionId}/meta.json` });
            if (res && res.content) {
                return JSON.parse(res.content) as SessionMetadata;
            }
        } catch {}
        return null;
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        await this.callFsApi('write', {
            path: `data/chats/${sessionId}/meta.json`,
            content: JSON.stringify(meta, null, 2)
        });
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        try {
            const res = await this.callFsApi('read', { path: `data/chats/${sessionId}/messages.jsonl` });
            if (!res || !res.content) return [];

            const lines = res.content.split('\n').filter((l: string) => l.trim().length > 0);
            const messages: ChatMessage[] = [];
            for (const line of lines) {
                try {
                    messages.push(JSON.parse(line) as ChatMessage);
                } catch {
                    // skip corrupted line
                }
            }

            if (limit && limit > 0) {
                const startIdx = offset ? Math.max(0, messages.length - offset - limit) : Math.max(0, messages.length - limit);
                const endIdx = offset ? messages.length - offset : messages.length;
                return messages.slice(startIdx, endIdx);
            }

            return messages;
        } catch {
            return [];
        }
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        const existing = await this.loadSessionMessages(sessionId);
        const idx = existing.findIndex(m => m.id === message.id);
        if (idx >= 0) {
            existing[idx] = message;
        } else {
            existing.push(message);
        }
        await this.saveAllMessages(sessionId, existing);
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        const content = messages.map(m => JSON.stringify(m)).join('\n') + (messages.length > 0 ? '\n' : '');
        await this.callFsApi('write', {
            path: `data/chats/${sessionId}/messages.jsonl`,
            content
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        try {
            await this.callFsApi('delete', { path: `data/chats/${sessionId}` });
        } catch (err) {
            console.warn(`[EngineFs] Failed deleting session folder data/chats/${sessionId}:`, err);
        }
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const assetId = `${Date.now()}_${cleanName}`;
        const relativePath = `assets/${assetId}`;

        let base64 = '';
        if (data instanceof Blob) {
            const buffer = await data.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            base64 = btoa(binary);
        } else {
            let binary = '';
            for (let i = 0; i < data.byteLength; i++) {
                binary += String.fromCharCode(data[i]);
            }
            base64 = btoa(binary);
        }

        await this.callFsApi('write', {
            path: `data/chats/${sessionId}/assets/${assetId}`,
            is_binary: true,
            content: base64
        });

        return relativePath;
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        return `${http.getBaseUrl()}/v1/fs/read?path=data/chats/${sessionId}/${cleanRel}`;
    }
}

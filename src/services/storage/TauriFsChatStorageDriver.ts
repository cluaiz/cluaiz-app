import { invoke } from '@tauri-apps/api/core';
import { IChatStorageDriver, SessionsIndex, SessionMetadata } from './types';
import { ChatMessage } from '../../store/chat/useChatStore';

export class TauriFsChatStorageDriver implements IChatStorageDriver {
    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        try {
            const raw = await invoke<string>('storage_load_sessions_index');
            if (!raw || raw.trim() === '') return null;
            return JSON.parse(raw) as SessionsIndex;
        } catch (err) {
            console.warn("[TauriStorage] Failed to load sessions index:", err);
            return null;
        }
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        try {
            const indexJson = JSON.stringify(index, null, 2);
            await invoke('storage_save_sessions_index', { indexJson });
        } catch (err) {
            console.error("[TauriStorage] Failed to save sessions index:", err);
            throw err;
        }
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        try {
            const raw = await invoke<string>('storage_load_session_metadata', { sessionId });
            if (!raw || raw.trim() === '') return null;
            return JSON.parse(raw) as SessionMetadata;
        } catch (err) {
            console.warn(`[TauriStorage] Failed to load metadata for session ${sessionId}:`, err);
            return null;
        }
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        try {
            const metadataJson = JSON.stringify(meta, null, 2);
            await invoke('storage_save_session_metadata', { sessionId, metadataJson });
        } catch (err) {
            console.error(`[TauriStorage] Failed to save metadata for session ${sessionId}:`, err);
            throw err;
        }
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        try {
            const rawLines = await invoke<string[]>('storage_load_session_messages', {
                sessionId,
                limit: limit || null,
                offset: offset || null
            });

            const messages: ChatMessage[] = [];
            for (const line of rawLines) {
                if (!line || line.trim() === '') continue;
                try {
                    const parsed = JSON.parse(line) as ChatMessage;
                    messages.push(parsed);
                } catch (parseErr) {
                    console.warn(`[TauriStorage] Skipped corrupted JSONL line in session ${sessionId}:`, parseErr);
                }
            }
            return messages;
        } catch (err) {
            console.warn(`[TauriStorage] Failed to load messages for session ${sessionId}:`, err);
            return [];
        }
    }

    async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
        try {
            const messageJson = JSON.stringify(message);
            await invoke('storage_append_message', { sessionId, messageJson });
        } catch (err) {
            console.error(`[TauriStorage] Failed to append message to session ${sessionId}:`, err);
            throw err;
        }
    }

    async saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
        try {
            const lines = messages.map(m => JSON.stringify(m)).join('\n') + (messages.length > 0 ? '\n' : '');
            await invoke('storage_save_session_messages', { sessionId, messagesJsonl: lines });
        } catch (err) {
            console.error(`[TauriStorage] Failed to save all messages for session ${sessionId}:`, err);
            throw err;
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        try {
            await invoke('storage_delete_session', { sessionId });
        } catch (err) {
            console.error(`[TauriStorage] Failed to delete session ${sessionId}:`, err);
            throw err;
        }
    }

    async saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string> {
        try {
            let bytes: number[];
            if (data instanceof Uint8Array) {
                bytes = Array.from(data);
            } else {
                const buffer = await data.arrayBuffer();
                bytes = Array.from(new Uint8Array(buffer));
            }

            const relativePath = await invoke<string>('storage_save_asset', {
                sessionId,
                fileName,
                bytes
            });
            return relativePath;
        } catch (err) {
            console.error(`[TauriStorage] Failed to save asset ${fileName} for session ${sessionId}:`, err);
            throw err;
        }
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        try {
            const fullPath = await invoke<string>('storage_resolve_asset_path', {
                sessionId,
                relativePath
            });
            // Convert to Tauri asset protocol URL for safe local webview rendering
            return `tauri://localhost/${encodeURIComponent(fullPath)}`;
        } catch {
            return relativePath;
        }
    }
}

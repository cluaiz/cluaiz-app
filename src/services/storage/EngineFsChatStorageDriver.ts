import { IChatStorageDriver, SessionsIndex, SessionMetadata } from './types';
import { ChatMessage } from '../../store/chat/useChatStore';
import { fsApi } from '../../api/engine/fs/fs.api';
import { CepError } from '../../api/client/cep';
import { toSniffedDataUri } from '../../utils/mimeSniffer';

/**
 * Browser history retains the existing workspace-relative data/chats layout.
 * The shared filesystem adapter owns CEP, authentication and wire translation.
 * Desktop uses its separate native storage driver through ChatStorageManager.
 */
export class EngineFsChatStorageDriver implements IChatStorageDriver {
    private sessionPath(sessionId: string, relativePath?: string): string {
        if (!sessionId || sessionId === '.' || sessionId === '..' || /[\\/:\0]/.test(sessionId)
            || (relativePath !== undefined && (relativePath.split('/').some(part => !part || part === '.' || part === '..')
                || /[\\:\0]/.test(relativePath)))) throw new Error('Invalid chat storage path');
        return `data/chats/${sessionId}${relativePath === undefined ? '' : `/${relativePath}`}`;
    }

    private missing(error: unknown): boolean {
        return error instanceof CepError && error.code === -32004
            && (error.data as { type?: string } | undefined)?.type === 'file_not_found';
    }

    private async readHistory(path: string) {
        try {
            const result = await fsApi.readFile({ path });
            if (result.is_binary) throw new Error('Stored chat history must be UTF-8 text');
            return result;
        } catch (error) {
            if (this.missing(error)) return null;
            throw error;
        }
    }

    async loadSessionsIndex(): Promise<SessionsIndex | null> {
        const res = await this.readHistory('data/chats/sessions_index.json');
        if (!res) return null;
        const parsed = JSON.parse(res.content) as SessionsIndex;
        if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('Stored chat catalog is invalid');
        return parsed;
    }

    async saveSessionsIndex(index: SessionsIndex): Promise<void> {
        await fsApi.writeFile({
            path: 'data/chats/sessions_index.json',
            content: JSON.stringify(index, null, 2)
        });
    }

    async loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
        const res = await this.readHistory(this.sessionPath(sessionId, 'meta.json'));
        if (!res) return null;
        const parsed = JSON.parse(res.content) as SessionMetadata;
        if (!parsed || parsed.id !== sessionId) throw new Error('Stored chat metadata does not match its session');
        return parsed;
    }

    async saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
        await fsApi.writeFile({
            path: this.sessionPath(sessionId, 'meta.json'),
            content: JSON.stringify(meta, null, 2)
        });
    }

    async loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
        const res = await this.readHistory(this.sessionPath(sessionId, 'messages.jsonl'));
        if (!res || !res.content) return [];

        const lines = res.content.split('\n').filter((l: string) => l.trim().length > 0);
        const messages: ChatMessage[] = [];
        for (const [index, line] of lines.entries()) {
            try {
                const message = JSON.parse(line) as ChatMessage;
                if (!message || typeof message.id !== 'string') throw new Error('Invalid stored message');
                messages.push(message);
            } catch {
                // Recover an interrupted trailing write, never discard unreadable history as empty.
                if (index !== lines.length - 1 || messages.length === 0) {
                    throw new Error('Stored chat messages are invalid');
                }
            }
        }

        if (limit && limit > 0) {
            const startIdx = offset ? Math.max(0, messages.length - offset - limit) : Math.max(0, messages.length - limit);
            const endIdx = offset ? messages.length - offset : messages.length;
            return messages.slice(startIdx, endIdx);
        }

        return messages;
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
        await fsApi.writeFile({
            path: this.sessionPath(sessionId, 'messages.jsonl'),
            content
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        try {
            await fsApi.deletePath({ path: this.sessionPath(sessionId) });
        } catch (err) {
            if (!this.missing(err)) throw err;
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

        await fsApi.writeFile({
            path: this.sessionPath(sessionId, relativePath),
            is_binary: true,
            content: base64
        });

        return relativePath;
    }

    async resolveAssetUrl(sessionId: string, relativePath: string): Promise<string> {
        const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        if (!cleanRel.startsWith('assets/')) throw new Error('Invalid chat asset path');
        const result = await fsApi.readFile({ path: this.sessionPath(sessionId, cleanRel), is_binary: true });
        return toSniffedDataUri(result.content, cleanRel.split('.').pop() || '');
    }
}

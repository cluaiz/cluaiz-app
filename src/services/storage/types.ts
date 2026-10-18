import { ChatMessage } from '../../store/chat/useChatStore';

export interface SessionIndexItem {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount?: number;
    lastMessagePreview?: string;
}

export interface SessionsIndex {
    version: number;
    lastActiveSessionId: string | null;
    sessions: SessionIndexItem[];
}

export interface SessionMetadata {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    model?: string;
    systemPrompt?: string;
}

export interface IChatStorageDriver {
    /**
     * Loads the lightweight sessions catalog for instant sidebar hydration.
     */
    loadSessionsIndex(): Promise<SessionsIndex | null>;

    /**
     * Atomically saves or updates the sessions catalog index.
     */
    saveSessionsIndex(index: SessionsIndex): Promise<void>;

    /**
     * Loads individual session metadata.
     */
    loadSessionMetadata(sessionId: string): Promise<SessionMetadata | null>;

    /**
     * Saves individual session metadata.
     */
    saveSessionMetadata(sessionId: string, meta: SessionMetadata): Promise<void>;

    /**
     * Loads messages from the session's messages.jsonl.
     * Guaranteed to safely recover from truncated/corrupted trailing lines.
     */
    loadSessionMessages(sessionId: string, limit?: number, offset?: number): Promise<ChatMessage[]>;

    /**
     * Appends an atomic completed message turn to messages.jsonl.
     */
    appendMessage(sessionId: string, message: ChatMessage): Promise<void>;

    /**
     * Atomically rewrites the session's messages.jsonl.
     * Used when messages are modified in-place (e.g. reactions, stars, highlights, deletes).
     */
    saveAllMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;

    /**
     * Completely removes a session folder and all its assets.
     */
    deleteSession(sessionId: string): Promise<void>;

    /**
     * Saves a binary asset (image, doc, audio) to the session's assets directory.
     * Returns the relative path reference (e.g., 'assets/img_123.png').
     */
    saveAsset(sessionId: string, fileName: string, data: Uint8Array | Blob): Promise<string>;

    /**
     * Resolves an asset's relative path to an accessible URL/URI for rendering.
     */
    resolveAssetUrl(sessionId: string, relativePath: string): Promise<string>;
}

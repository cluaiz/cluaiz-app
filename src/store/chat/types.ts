export interface CreateChatSessionOptions { incognito?: boolean; activate?: boolean; extensionId?: string; }

export interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' | 'system';
    text: string;
    thinking?: string;
    thinkingDuration?: number | string;
    postToolThinking?: string;
    postToolThinkingDuration?: number | string;
    toolCalls?: Array<{
        id: string;
        name: string;
        category?: string;
        arguments?: string;
        result?: string;
        logs?: string[];
        latencyMs?: number;
        status: 'running' | 'completed' | 'failed';
        iconSvg?: string;
    }>;
    permissionRequest?: {
        requestId: string;
        toolName: string;
        category?: string;
        parameters?: any;
        status: 'pending' | 'approved' | 'rejected' | 'timeout';
        feedback?: string;
    };
    time: string;
    date: number; // Stored as timestamp
    reactions?: string[];
    pinned?: boolean;
    isStarred?: boolean;
    highlights?: string[];
    telemetry?: {
        tps: string;
        elapsed: string;
        ttft: string;
        tokens: number;
    };
    attachments?: Array<{ name: string; size?: number; type?: string; previewUrl?: string }>;
    parts?: Array<{ type: string; [key: string]: any }>;
    replyTo?: {
        text: string;
        sender?: string;
    };
    finishReason?: string;
    contextReport?: any;
}

export interface ChatSession {
    id: string;
    /** App-owned package identity; absent on ordinary chats. Not an Engine credential. */
    extensionId?: string;
    title: string;
    avatar?: string;
    tags: string[];
    unread: number;
    pinned: boolean;
    pinnedAt?: number;
    favourite?: boolean;
    archived: boolean;
    /** When the chat was archived; the archive delete timer counts from here */
    archivedAt?: number;
    muted: boolean;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
    lastMessagePreview?: string;
    messageCount?: number;
    isIncognito?: boolean;
    lastEngineContext?: any;
    droppedBoundaryMessageId?: string;
}

export interface ChatStore {
    sessions: Record<string, ChatSession>;
    activeSessionId: string | null;
    isHydrated: boolean;
    isLoadingMessages: boolean;
    /** Chat whose answer is being generated now (it keeps streaming while another chat is open) */
    streamingSessionId: string | null;
    setStreamingSession: (sessionId: string | null) => void;

    // Actions
    hydrateFromStorage: () => Promise<void>;
    /** `incognito` = a private chat that is never written to storage */
    createNewSession: (initialTitle?: string, options?: CreateChatSessionOptions) => string;
    switchSession: (sessionId: string | null, syncUrl?: boolean) => Promise<void>;
    loadMessages: (sessionId: string) => Promise<void>;
    deleteSession: (sessionId: string) => void;
    finalizeAssistantMessage: (sessionId: string) => Promise<void>;

    addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'>) => void;
    appendTokenToLastMessage: (sessionId: string, token: string) => void;
    appendThinkingToLastMessage: (sessionId: string, token: string) => void;
    appendToolCallToLastMessage: (sessionId: string, toolCall: {
        id: string;
        name: string;
        category?: string;
        arguments?: string;
        status: 'running' | 'completed' | 'failed';
        iconSvg?: string;
    }) => void;
    updateToolResultOnLastMessage: (sessionId: string, toolResult: {
        id: string;
        name?: string;
        category?: string;
        status?: 'completed' | 'failed';
        latency_ms?: number;
        result?: string;
        logs?: string[];
        output_result?: any;
        iconSvg?: string;
    }) => void;
    attachTelemetryToLastMessage: (sessionId: string, telemetry: { tps: string; elapsed: string; ttft: string; tokens: number }) => void;
    setPermissionRequestOnLastMessage: (sessionId: string, req: {
        requestId: string;
        toolName: string;
        category?: string;
        parameters?: any;
        status: 'pending' | 'approved' | 'rejected' | 'timeout';
        feedback?: string;
    }) => void;
    resolvePermissionRequest: (sessionId: string, requestId: string, decision: 'approved' | 'rejected' | 'timeout', feedback?: string) => void;
    updateMessage: (sessionId: string, messageIndex: number, updater: (msg: ChatMessage) => ChatMessage) => void;
    deleteMessage: (sessionId: string, messageIndex: number) => void;
    updateSession: (sessionId: string, updater: (session: ChatSession) => ChatSession) => void;
    setSessionEngineContext: (sessionId: string, context: any, boundaryId?: string) => void;
    setLastMessageFinishReason: (sessionId: string, finishReason: string) => void;
}


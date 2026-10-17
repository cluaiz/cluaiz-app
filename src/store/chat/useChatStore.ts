import { create } from 'zustand';
import { currentChatPrefs } from './useChatPrefsStore';
import { chatStorageManager } from '../../services/storage/ChatStorageManager';
import { SessionIndexItem } from '../../services/storage/types';
import { inferChatTopicAndEmoji } from '../../utils/topicProber';

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
    title: string;
    avatar: string;
    tags: string[];
    unread: number;
    pinned: boolean;
    pinnedAt?: number;
    favourite: boolean;
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

interface ChatStore {
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
    createNewSession: (initialTitle?: string, options?: { incognito?: boolean }) => string;
    switchSession: (sessionId: string | null) => Promise<void>;
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
    fetchSessionsFromEngine: () => Promise<void>;
    setSessionEngineContext: (sessionId: string, context: any, boundaryId?: string) => void;
    setLastMessageFinishReason: (sessionId: string, finishReason: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Monotonic generation counter to prevent race conditions during rapid session switching
let sessionSwitchGeneration = 0;

const syncIndexToStorage = (sessions: Record<string, ChatSession>, activeId: string | null) => {
    const sessionList: SessionIndexItem[] = Object.values(sessions)
        .filter(s => !s.isIncognito)
        .map(s => {
        const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : undefined;
        let preview = s.lastMessagePreview || '';
        if (lastMsg) {
            preview = lastMsg.text ? lastMsg.text.slice(0, 60) : (lastMsg.thinking ? lastMsg.thinking.slice(0, 40) : '');
        }
        return {
            id: s.id,
            title: s.title,
            avatar: s.avatar,
            tags: s.tags,
            unread: s.unread,
            pinned: s.pinned,
            pinnedAt: s.pinnedAt,
            favourite: s.favourite,
            archived: s.archived,
            archivedAt: s.archivedAt,
            muted: s.muted,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messageCount: s.messages ? s.messages.length : (s.messageCount || 0),
            lastMessagePreview: preview || undefined
        };
    });

    chatStorageManager.saveSessionsIndex({
        version: 1,
        lastActiveSessionId: activeId,
        sessions: sessionList
    }).catch(err => console.warn("[ChatStore] Failed to save session index:", err));
};

const syncSessionMeta = (session: ChatSession) => {
    // Private chats are never written to storage
    if (session.isIncognito) return;
    chatStorageManager.saveSessionMetadata(session.id, {
        id: session.id,
        title: session.title,
        avatar: session.avatar,
        tags: session.tags,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        pinned: session.pinned,
        pinnedAt: session.pinnedAt,
        favourite: session.favourite,
        archived: session.archived,
        archivedAt: session.archivedAt,
        muted: session.muted
    }).catch(err => console.warn("[ChatStore] Failed to save session metadata:", err));
};

// Debounce helper to rewrite messages.jsonl when in-place modifications occur (reactions, stars, pins, deletes)
const syncTimers: Record<string, any> = {};
const scheduleMessagesSync = (sessionId: string, messages: ChatMessage[]) => {
    if (syncTimers[sessionId]) {
        clearTimeout(syncTimers[sessionId]);
    }
    syncTimers[sessionId] = setTimeout(() => {
        delete syncTimers[sessionId];
        chatStorageManager.saveAllMessages(sessionId, messages).catch(err => {
            console.error(`[ChatStore] Failed to save updated messages for session ${sessionId}:`, err);
        });
    }, 150);
};

export const useChatStore = create<ChatStore>()(
    (set, get) => ({
        sessions: {},
        activeSessionId: null,
        isHydrated: false,
        isLoadingMessages: false,
        streamingSessionId: null,
        setStreamingSession: (sessionId) => set({ streamingSessionId: sessionId }),

        hydrateFromStorage: async () => {
            try {
                const index = await chatStorageManager.loadSessionsIndex();
                if (index && index.sessions && index.sessions.length > 0) {
                    const sessionsMap: Record<string, ChatSession> = {};
                    for (const s of index.sessions) {
                        sessionsMap[s.id] = {
                            id: s.id,
                            title: s.title || 'Chat',
                            avatar: s.avatar || '🤖',
                            tags: s.tags || [],
                            unread: s.unread || 0,
                            pinned: Boolean(s.pinned),
                            pinnedAt: s.pinnedAt,
                            favourite: Boolean(s.favourite),
                            archived: Boolean(s.archived),
                            archivedAt: s.archivedAt,
                            muted: Boolean(s.muted),
                            createdAt: s.createdAt || Date.now(),
                            updatedAt: s.updatedAt || Date.now(),
                            lastMessagePreview: s.lastMessagePreview,
                            messageCount: s.messageCount || 0,
                            messages: [] // Loaded lazily on switchSession
                        };
                    }
                    // Only restore an active session if lastActiveSessionId is a valid existing session.
                    // If lastActiveSessionId is null (user was in New Chat), keep targetActiveId as null.
                    const targetActiveId = (index.lastActiveSessionId && sessionsMap[index.lastActiveSessionId])
                        ? index.lastActiveSessionId
                        : null;

                    set({
                        sessions: sessionsMap,
                        activeSessionId: targetActiveId,
                        isHydrated: true
                    });

                    // Proactively load messages for the active session if one exists
                    if (targetActiveId) {
                        get().switchSession(targetActiveId);
                    }
                } else {
                    // First boot or empty catalog: initialize single clean session
                    const id = generateId();
                    const defaultSession: ChatSession = {
                        id,
                        title: 'New Chat',
                        avatar: '🤖',
                        tags: [],
                        unread: 0,
                        pinned: false,
                        favourite: false,
                        archived: false,
                        muted: false,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        messages: [],
                    };
                    const initialSessions = { [id]: defaultSession };
                    set({
                        sessions: initialSessions,
                        activeSessionId: id,
                        isHydrated: true
                    });
                    syncSessionMeta(defaultSession);
                    syncIndexToStorage(initialSessions, id);
                }
            } catch (err) {
                console.error("[ChatStore] Storage hydration error:", err);
                set({ isHydrated: true });
            }
        },

        fetchSessionsFromEngine: async () => {
            const { cluaizEngine } = await import('../../core/engine');
            try {
                const sessionsArray = await cluaizEngine.fetchHistory();
                if (sessionsArray && sessionsArray.length > 0) {
                    const sessions: Record<string, ChatSession> = {};
                    sessionsArray.forEach(s => sessions[s.id] = s);
                    set({ sessions });
                }
            } catch (err) {
                console.error("Failed to fetch history from FFI:", err);
            }
        },

        createNewSession: (initialTitle?: string, options?: { incognito?: boolean }) => {
            const id = generateId();
            const newSession: ChatSession = {
                id,
                title: initialTitle || 'New Chat',
                avatar: '🤖',
                tags: [],
                unread: 0,
                pinned: false,
                favourite: false,
                archived: false,
                muted: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: [],
                isIncognito: options?.incognito || undefined,
            };

            const updatedSessions = { ...get().sessions, [id]: newSession };
            set({
                sessions: updatedSessions,
                activeSessionId: id,
            });

            syncSessionMeta(newSession);
            syncIndexToStorage(updatedSessions, id);
            return id;
        },

        switchSession: async (sessionId: string | null) => {
            const currentGen = ++sessionSwitchGeneration;
            // A normal chat keeps answering in the background; leaving a private chat stops its answer
            const streaming = get().streamingSessionId;
            if (get().activeSessionId !== sessionId && streaming && get().sessions[streaming]?.isIncognito) {
                try {
                    const { cluaizEngine } = await import('../../core/engine');
                    await cluaizEngine.stop();
                } catch { }
            }
            set({ activeSessionId: sessionId });

            if (!sessionId) {
                syncIndexToStorage(get().sessions, null);
                return;
            }

            syncIndexToStorage(get().sessions, sessionId);

            const session = get().sessions[sessionId];
            // If messages are not yet in memory, lazily load from disk/storage
            if (session && session.messages.length === 0) {
                set({ isLoadingMessages: true });
                try {
                    const messages = await chatStorageManager.loadSessionMessages(sessionId);
                    // Safe race check: ensure user didn't switch to another session during async I/O
                    if (sessionSwitchGeneration === currentGen && get().activeSessionId === sessionId) {
                        set((state) => {
                            const target = state.sessions[sessionId];
                            if (!target) return state;
                            return {
                                sessions: {
                                    ...state.sessions,
                                    [sessionId]: {
                                        ...target,
                                        messages
                                    }
                                },
                                isLoadingMessages: false
                            };
                        });
                    }
                } catch (err) {
                    console.warn(`[ChatStore] Failed to load messages for ${sessionId}:`, err);
                    if (sessionSwitchGeneration === currentGen) {
                        set({ isLoadingMessages: false });
                    }
                }
            }
        },

        deleteSession: (sessionId) => {
            // Delete physically from storage
            chatStorageManager.deleteSession(sessionId).catch(err => {
                console.error(`[ChatStore] Failed deleting session folder ${sessionId}:`, err);
            });

            // Trigger FFI physical delete in background
            import('../../core/engine').then(({ cluaizEngine }) => {
                cluaizEngine.deleteSession(sessionId).catch(console.error);
            }).catch(() => {});

            // The engine's saved model memory (KV cache) of this chat goes with it
            import('../../api/engine/chat-memory').then(({ chatMemoryApi }) => {
                chatMemoryApi.deleteChat(sessionId).catch(() => {});
            }).catch(() => {});

            set((state) => {
                const newSessions = { ...state.sessions };
                delete newSessions[sessionId];
                const remainingIds = Object.keys(newSessions);
                const newActive = state.activeSessionId === sessionId
                    ? (remainingIds[0] || null)
                    : state.activeSessionId;

                syncIndexToStorage(newSessions, newActive);

                return {
                    sessions: newSessions,
                    activeSessionId: newActive
                };
            });
        },

        addMessage: (sessionId, message) => {
            const newMessage: ChatMessage = {
                ...message,
                id: generateId(),
            };

            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;

                // Auto-generate topic emoji and smart title from first user message
                let title = session.title;
                let avatar = session.avatar;
                let metaChanged = false;
                if (session.messages.length === 0 && message.sender === 'user' && message.text) {
                    const inference = inferChatTopicAndEmoji(message.text);
                    title = inference.title;
                    avatar = inference.emoji;
                    metaChanged = true;
                }

                // A new message in an archived chat follows the history preference
                let archived = session.archived;
                let archivedAt = session.archivedAt;
                if (session.archived && message.sender === 'user') {
                    const activity = currentChatPrefs().archivedActivity;
                    if (activity === 'unarchive') {
                        archived = false;
                        archivedAt = undefined;
                        metaChanged = true;
                    } else if (activity === 'reset') {
                        archivedAt = Date.now();
                        metaChanged = true;
                    }
                }

                const updatedSession: ChatSession = {
                    ...session,
                    title,
                    avatar,
                    archived,
                    archivedAt,
                    updatedAt: Date.now(),
                    messages: [...session.messages, newMessage]
                };

                const updatedSessions = {
                    ...state.sessions,
                    [sessionId]: updatedSession
                };

                if (metaChanged) {
                    syncSessionMeta(updatedSession);
                }

                return {
                    sessions: updatedSessions
                };
            });

            // Reviewer Option A: Persist user message immediately on dispatch (never for private chats)
            if (!get().sessions[sessionId]?.isIncognito && message.sender === 'user' && (message.text || message.attachments?.length || message.parts?.length)) {
                chatStorageManager.appendMessage(sessionId, newMessage)
                    .then(() => {
                        syncIndexToStorage(get().sessions, get().activeSessionId);
                    })
                    .catch(err => {
                        console.error(`[ChatStore] Failed to append user message in session ${sessionId}:`, err);
                    });
            }
        },

        finalizeAssistantMessage: async (sessionId: string) => {
            const session = get().sessions[sessionId];
            if (!session || session.messages.length === 0) return;

            if (session.isIncognito) return;
            const lastMsg = session.messages[session.messages.length - 1];
            if (!lastMsg || lastMsg.sender !== 'assistant') return;

            // Do not persist empty placeholders
            if (!lastMsg.text && !lastMsg.thinking && (!lastMsg.toolCalls || lastMsg.toolCalls.length === 0)) {
                return;
            }

            try {
                // Atomic append of completed assistant turn
                await chatStorageManager.appendMessage(sessionId, lastMsg);
                syncIndexToStorage(get().sessions, get().activeSessionId);
            } catch (err) {
                console.error(`[ChatStore] Failed finalizing assistant message for ${sessionId}:`, err);
            }
        },

        appendTokenToLastMessage: (sessionId, token) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = [...session.messages];
                const lastIndex = messages.length - 1;
                const lastMessage = messages[lastIndex];

                // Only append to assistant messages
                if (lastMessage.sender !== 'assistant') return state;

                messages[lastIndex] = {
                    ...lastMessage,
                    text: lastMessage.text + token
                };

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        appendThinkingToLastMessage: (sessionId, token) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = [...session.messages];
                const lastIndex = messages.length - 1;
                const lastMessage = messages[lastIndex];

                if (lastMessage.sender !== 'assistant') return state;

                const hasTools = Boolean(lastMessage.toolCalls && lastMessage.toolCalls.length > 0);

                messages[lastIndex] = {
                    ...lastMessage,
                    ...(hasTools ? {
                        postToolThinking: (lastMessage.postToolThinking || '') + token
                    } : {
                        thinking: (lastMessage.thinking || '') + token
                    })
                };

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        appendToolCallToLastMessage: (sessionId, toolCall) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = [...session.messages];
                const lastIndex = messages.length - 1;
                const lastMessage = messages[lastIndex];

                if (lastMessage.sender !== 'assistant') return state;

                const existingTools = lastMessage.toolCalls || [];
                const exists = existingTools.some(t => t.id === toolCall.id);
                const updatedTools = exists
                    ? existingTools.map(t => t.id === toolCall.id ? { ...t, ...toolCall } : t)
                    : [...existingTools, { ...toolCall, status: toolCall.status || 'running' }];

                messages[lastIndex] = {
                    ...lastMessage,
                    toolCalls: updatedTools
                };

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        updateToolResultOnLastMessage: (sessionId, toolResult) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = [...session.messages];
                const lastIndex = messages.length - 1;
                const lastMessage = messages[lastIndex];

                if (lastMessage.sender !== 'assistant') return state;

                const existingTools = lastMessage.toolCalls || [];
                const targetIndex = existingTools.findIndex(t => t.id === toolResult.id || t.id.includes(toolResult.id) || toolResult.id.includes(t.id));

                let updatedTools: typeof existingTools;
                if (targetIndex >= 0) {
                    updatedTools = existingTools.map((t, idx) => {
                        if (idx !== targetIndex) return t;
                        return {
                            ...t,
                            status: (toolResult.status || 'completed') as 'completed' | 'failed',
                            result: toolResult.result,
                            logs: toolResult.logs || t.logs,
                            latencyMs: toolResult.latency_ms !== undefined ? Math.round(toolResult.latency_ms) : t.latencyMs,
                            iconSvg: toolResult.iconSvg || t.iconSvg
                        };
                    });
                } else if (existingTools.length > 0) {
                    const lastToolIdx = existingTools.length - 1;
                    updatedTools = existingTools.map((t, idx) => {
                        if (idx !== lastToolIdx) return t;
                        return {
                            ...t,
                            status: (toolResult.status || 'completed') as 'completed' | 'failed',
                            result: toolResult.result,
                            logs: toolResult.logs || t.logs,
                            latencyMs: toolResult.latency_ms !== undefined ? Math.round(toolResult.latency_ms) : t.latencyMs,
                            iconSvg: toolResult.iconSvg || t.iconSvg
                        };
                    });
                } else {
                    updatedTools = [{
                        id: toolResult.id,
                        name: toolResult.name || 'execute_tool',
                        category: toolResult.category || 'skill',
                        status: (toolResult.status || 'completed') as 'completed' | 'failed',
                        result: toolResult.result,
                        logs: toolResult.logs,
                        latencyMs: toolResult.latency_ms !== undefined ? Math.round(toolResult.latency_ms) : undefined,
                        iconSvg: toolResult.iconSvg
                    }];
                }

                messages[lastIndex] = {
                    ...lastMessage,
                    toolCalls: updatedTools
                };

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        setPermissionRequestOnLastMessage: (sessionId, req) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = [...session.messages];
                const lastIndex = messages.length - 1;
                const lastMessage = messages[lastIndex];
                if (lastMessage.sender !== 'assistant') return state;

                messages[lastIndex] = {
                    ...lastMessage,
                    permissionRequest: req
                };

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        resolvePermissionRequest: (sessionId, requestId, decision, feedback) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = session.messages.map(msg => {
                    if (msg.permissionRequest && msg.permissionRequest.requestId === requestId) {
                        return {
                            ...msg,
                            permissionRequest: {
                                ...msg.permissionRequest,
                                status: decision,
                                feedback
                            }
                        };
                    }
                    return msg;
                });

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        attachTelemetryToLastMessage: (sessionId, telemetry) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;

                const messages = [...session.messages];
                const lastIndex = messages.length - 1;
                const lastMessage = messages[lastIndex];

                if (lastMessage.sender !== 'assistant') return state;

                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

                messages[lastIndex] = {
                    ...lastMessage,
                    time: lastMessage.time || timeStr,
                    telemetry
                };

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            updatedAt: Date.now(),
                            messages
                        }
                    }
                };
            });
        },

        updateMessage: (sessionId, messageIndex, updater) => {
            let updatedMessages: ChatMessage[] | null = null;
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || !session.messages[messageIndex]) return state;
                const messages = [...session.messages];
                messages[messageIndex] = updater(messages[messageIndex]);
                updatedMessages = messages;
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: { ...session, updatedAt: Date.now(), messages }
                    }
                };
            });

            if (updatedMessages) {
                scheduleMessagesSync(sessionId, updatedMessages);
            }
        },

        deleteMessage: (sessionId, messageIndex) => {
            let remainingMessages: ChatMessage[] | null = null;
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                const messages = session.messages.filter((_, i) => i !== messageIndex);
                remainingMessages = messages;
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: { ...session, updatedAt: Date.now(), messages }
                    }
                };
            });

            if (remainingMessages) {
                scheduleMessagesSync(sessionId, remainingMessages);
            }
        },

        updateSession: (sessionId, updater) => {
            let updatedSession: ChatSession | null = null;
            let updatedSessionsMap: Record<string, ChatSession> | null = null;

            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                updatedSession = updater(session);
                // Archive time: set when a chat is archived, cleared when it comes back
                if (updatedSession.archived !== session.archived) {
                    updatedSession = {
                        ...updatedSession,
                        archivedAt: updatedSession.archived ? Date.now() : undefined
                    };
                }
                updatedSessionsMap = {
                    ...state.sessions,
                    [sessionId]: updatedSession
                };
                return {
                    sessions: updatedSessionsMap
                };
            });

            if (updatedSession) {
                syncSessionMeta(updatedSession);
                syncIndexToStorage(updatedSessionsMap || get().sessions, get().activeSessionId);
            }
        },

        setSessionEngineContext: (sessionId, context, boundaryId) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            lastEngineContext: context,
                            droppedBoundaryMessageId: boundaryId !== undefined ? boundaryId : session.droppedBoundaryMessageId
                        }
                    }
                };
            });
        },

        setLastMessageFinishReason: (sessionId, finishReason) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || session.messages.length === 0) return state;
                const lastIdx = session.messages.length - 1;
                const updatedMessages = [...session.messages];
                updatedMessages[lastIdx] = {
                    ...updatedMessages[lastIdx],
                    finishReason
                };
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            messages: updatedMessages
                        }
                    }
                };
            });
        }
    })
);

if (typeof window !== 'undefined') {
    // Proactively hydrate chat sessions catalog on app startup, then apply the history preferences
    setTimeout(() => {
        useChatStore.getState().hydrateFromStorage()
            .then(() => import('../../services/storage/chatRetentionRunner'))
            .then(({ startChatRetention }) => startChatRetention())
            .catch(err => console.warn('[ChatStore] Chat history cleanup could not start:', err));
    }, 0);
}

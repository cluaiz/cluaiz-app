import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' | 'system';
    text: string;
    thinking?: string;
    postToolThinking?: string;
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
    muted: boolean;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
}

interface ChatStore {
    sessions: Record<string, ChatSession>;
    activeSessionId: string | null;
    
    // Actions
    createNewSession: () => string;
    switchSession: (sessionId: string | null) => void;
    deleteSession: (sessionId: string) => void;
    
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
    updateMessage: (sessionId: string, messageIndex: number, updater: (msg: ChatMessage) => ChatMessage) => void;
    deleteMessage: (sessionId: string, messageIndex: number) => void;
    updateSession: (sessionId: string, updater: (session: ChatSession) => ChatSession) => void;
    fetchSessionsFromEngine: () => Promise<void>;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatStore>()(
    (set, get) => ({
        sessions: {},
        activeSessionId: null,

        fetchSessionsFromEngine: async () => {
            const { cluaizEngine } = await import('../../core/engine');
            try {
                const sessionsArray = await cluaizEngine.fetchHistory();
                const sessions: Record<string, ChatSession> = {};
                sessionsArray.forEach(s => sessions[s.id] = s);
                set({ sessions });
            } catch (err) {
                console.error("Failed to fetch history from FFI:", err);
            }
        },

        createNewSession: () => {
            const id = generateId();
            const newSession: ChatSession = {
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
            
            set((state) => ({
                sessions: { ...state.sessions, [id]: newSession },
                activeSessionId: id,
            }));
            return id;
        },

        switchSession: (sessionId: string | null) => {
            set({ activeSessionId: sessionId });
        },

        deleteSession: (sessionId) => {
            // Trigger FFI physical delete in background
            import('../../core/engine').then(({ cluaizEngine }) => {
                cluaizEngine.deleteSession(sessionId).catch(console.error);
            });

            set((state) => {
                const newSessions = { ...state.sessions };
                delete newSessions[sessionId];
                
                return {
                    sessions: newSessions,
                    activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
                };
            });
        },

        addMessage: (sessionId, message) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;

                const newMessage: ChatMessage = {
                    ...message,
                    id: generateId(),
                };

                // Auto-generate title from first user message
                let title = session.title;
                if (session.messages.length === 0 && message.sender === 'user') {
                    title = message.text.slice(0, 30) + (message.text.length > 30 ? '...' : '');
                }

                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: {
                            ...session,
                            title,
                            updatedAt: Date.now(),
                            messages: [...session.messages, newMessage]
                        }
                    }
                };
            });
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
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session || !session.messages[messageIndex]) return state;
                const messages = [...session.messages];
                messages[messageIndex] = updater(messages[messageIndex]);
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: { ...session, updatedAt: Date.now(), messages }
                    }
                };
            });
        },

        deleteMessage: (sessionId, messageIndex) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                const messages = session.messages.filter((_, i) => i !== messageIndex);
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: { ...session, updatedAt: Date.now(), messages }
                    }
                };
            });
        },

        updateSession: (sessionId, updater) => {
            set((state) => {
                const session = state.sessions[sessionId];
                if (!session) return state;
                return {
                    sessions: {
                        ...state.sessions,
                        [sessionId]: updater(session)
                    }
                };
            });
        }
    })
);

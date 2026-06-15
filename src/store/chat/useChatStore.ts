import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' | 'system';
    text: string;
    time: string;
    date: number; // Stored as timestamp
    reactions?: string[];
    pinned?: boolean;
    isStarred?: boolean;
    highlights?: string[];
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
            const { CluaizeEngine } = await import('../../core/engine');
            try {
                const sessionsArray = await CluaizeEngine.fetchHistory();
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
            import('../../core/engine').then(({ CluaizeEngine }) => {
                CluaizeEngine.deleteSession(sessionId).catch(console.error);
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

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useChatStore } from '../chat/useChatStore';
import { useLayoutStore } from '../ui/useLayoutStore';

export type NotebookSourceType = 'file' | 'media' | 'code' | 'snippet' | 'prompt';
export type NotebookItemType = 'book' | 'page';
export type NotebookSortOption = 'updated' | 'created' | 'name' | 'items';

export interface CoverTheme {
    id: string;
    name: string;
    gradient: string;
    border: string;
    accent: string;
    badgeBg: string;
}

export const COVER_THEMES: Record<string, CoverTheme> = {
    aurora: {
        id: 'aurora',
        name: 'Aurora',
        gradient: 'from-emerald-600/35 via-teal-600/20 to-cyan-600/30',
        border: 'border-emerald-500/30',
        accent: '#10b981',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    ocean: {
        id: 'ocean',
        name: 'Ocean',
        gradient: 'from-blue-600/35 via-cyan-600/20 to-indigo-600/30',
        border: 'border-blue-500/30',
        accent: '#3b82f6',
        badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    sunset: {
        id: 'sunset',
        name: 'Sunset',
        gradient: 'from-rose-600/35 via-amber-600/20 to-orange-600/30',
        border: 'border-rose-500/30',
        accent: '#f43f5e',
        badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        gradient: 'from-purple-600/35 via-fuchsia-600/20 to-pink-600/30',
        border: 'border-purple-500/30',
        accent: '#a855f7',
        badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    obsidian: {
        id: 'obsidian',
        name: 'Obsidian',
        gradient: 'from-neutral-700/40 via-neutral-800/30 to-neutral-900/40',
        border: 'border-neutral-700/40',
        accent: '#9ca3af',
        badgeBg: 'bg-neutral-500/10 text-neutral-300 border-neutral-600/30',
    },
    amber: {
        id: 'amber',
        name: 'Amber',
        gradient: 'from-amber-600/35 via-yellow-600/20 to-orange-600/30',
        border: 'border-amber-500/30',
        accent: '#f59e0b',
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
};

export const DEFAULT_ICONS = ['📘', '🧠', '⚡', '🚀', '📂', '🔬', '📑', '💻', '🎯', '🎨', '🔥', '🌐', '🛡️', '📦'];

export interface NotebookSource {
    id: string;
    name: string;
    type: NotebookSourceType;
    size?: number;
    content?: string;
    path?: string;
    previewUrl?: string;
    language?: string;
    addedAt: number;
}

export interface Notebook {
    id: string;
    parentId: string | null; // null = root level shelf item
    itemType: NotebookItemType; // 'book' = container / folder, 'page' = document
    title: string;
    icon: string;
    coverTheme: string;
    description: string;
    aiIntent: string;
    tags: string[];
    content: any; // Tiptap JSON document structure
    htmlContent?: string;
    textContent?: string;
    sources: NotebookSource[];
    chatSessionIds: string[];
    createdAt: number;
    updatedAt: number;
}

interface NotebookStore {
    notebooks: Record<string, Notebook>;

    // Navigation and View state
    currentFolderId: string | null; // null = on root shelf, string = inside that book
    activePageId: string | null; // string = editing that page in BrainEditor, null = viewing shelf or book
    viewMode: 'grid' | 'list';
    sortOption: NotebookSortOption;
    searchQuery: string;

    // Navigation setters
    setCurrentFolderId: (folderId: string | null) => void;
    setActivePageId: (pageId: string | null) => void;
    setViewMode: (mode: 'grid' | 'list') => void;
    setSortOption: (option: NotebookSortOption) => void;
    setSearchQuery: (query: string) => void;

    // CRUD
    createItem: (params: {
        title: string;
        itemType?: NotebookItemType;
        parentId?: string | null;
        description?: string;
        icon?: string;
        coverTheme?: string;
        tags?: string[];
        template?: string;
    }) => string;
    updateItem: (id: string, updates: Partial<Notebook>) => void;
    deleteItem: (id: string) => void;

    // Sources & Chats
    addSourceToItem: (itemId: string, source: Omit<NotebookSource, 'id' | 'addedAt'>) => string;
    removeSourceFromItem: (itemId: string, sourceId: string) => void;
    bindChatSessionToItem: (itemId: string, sessionId: string) => void;
    createItemChat: (itemId: string) => Promise<string>;

    // Hierarchy helpers
    getBreadcrumbs: (itemId: string | null) => Notebook[];
    getChildren: (parentId: string | null) => Notebook[];
    getItem: (id: string | null) => Notebook | null;
    getSubItemCounts: (itemId: string) => { subBooks: number; pages: number };
}

function getTemplateContent(title: string, template?: string) {
    if (template === 'technical-spec') {
        return {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'High-level architectural overview and technical specification.' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Goals & Non-Goals' }] },
                {
                    type: 'bulletList',
                    content: [
                        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goal: Clear modular design and zero redundant memory allocation.' }] }] },
                        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Non-Goal: Third-party runtime dependencies.' }] }] }
                    ]
                },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Architecture & Data Flow' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Detail the component interaction, APIs, and state boundaries.' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Security & Validation' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Ensure all inputs are strictly bounded and verified.' }] }
            ]
        };
    }

    if (template === 'research-notes') {
        return {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Deep research log, benchmarks, and experimental hypotheses.' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Hypotheses' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'What are we testing and what reproducible metrics determine success?' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Evidence & Findings' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Document observations and source references here.' }] }
            ]
        };
    }

    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
            { type: 'paragraph', content: [{ type: 'text', text: '' }] }
        ]
    };
}

const DEFAULT_WELCOME_ROOT_BOOK: Notebook = {
    id: 'nb-root-welcome',
    parentId: null,
    itemType: 'book',
    title: 'Cluaiz Core Knowledge Base',
    icon: '📘',
    coverTheme: 'aurora',
    description: 'Central project knowledge base containing system specs, nested research books, and documentation.',
    aiIntent: 'Focus on clean architecture, systems performance, and verified engineering reality.',
    tags: ['Architecture', 'Core'],
    content: null,
    sources: [
        {
            id: 'src-sample-1',
            name: 'Cluaiz System Overview.md',
            type: 'snippet',
            size: 2048,
            content: 'Cluaiz is a high-performance offline-first local AI workspace.',
            language: 'markdown',
            addedAt: Date.now() - 3600000,
        }
    ],
    chatSessionIds: [],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
};

const DEFAULT_SUB_BOOK: Notebook = {
    id: 'nb-sub-architecture',
    parentId: 'nb-root-welcome',
    itemType: 'book',
    title: 'Inference Engine & Hardware',
    icon: '⚡',
    coverTheme: 'cyberpunk',
    description: 'Hardware prober, compute orchestrator, and zero-overhead memory layouts.',
    aiIntent: 'Low-level PTX and GPU compute optimization.',
    tags: ['Hardware', 'PTX', 'Engine'],
    content: null,
    sources: [],
    chatSessionIds: [],
    createdAt: Date.now() - 72000000,
    updatedAt: Date.now() - 36000000,
};

const DEFAULT_PAGE: Notebook = {
    id: 'nb-page-specs',
    parentId: 'nb-sub-architecture',
    itemType: 'page',
    title: 'Hardware Prober Specification',
    icon: '📑',
    coverTheme: 'ocean',
    description: 'Dynamic VRAM safety buffers and thread-affinity topology probing.',
    aiIntent: 'Cross-platform probe without static hardcoding.',
    tags: ['Prober', 'Topology'],
    content: {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hardware Prober Specification' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'This document defines the zero-assumption hardware probing architecture for Cluaiz.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Principles' }] },
            {
                type: 'bulletList',
                content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Never assume hardware buffers or static GPU limits.' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dynamically sample available VRAM and system memory before allocating tensors.' }] }] },
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Support hot-swapping engines without process restarts.' }] }] }
                ]
            }
        ]
    },
    htmlContent: '<h1>Hardware Prober Specification</h1><p>This document defines the zero-assumption hardware probing architecture for Cluaiz.</p>',
    textContent: 'Hardware Prober Specification\nThis document defines the zero-assumption hardware probing architecture for Cluaiz.',
    sources: [],
    chatSessionIds: [],
    createdAt: Date.now() - 60000000,
    updatedAt: Date.now(),
};

export const useNotebookStore = create<NotebookStore>()(
    persist(
        (set, get) => ({
            notebooks: {
                [DEFAULT_WELCOME_ROOT_BOOK.id]: DEFAULT_WELCOME_ROOT_BOOK,
                [DEFAULT_SUB_BOOK.id]: DEFAULT_SUB_BOOK,
                [DEFAULT_PAGE.id]: DEFAULT_PAGE,
            },

            currentFolderId: null, // Start on the root shelf!
            activePageId: null, // Start on shelf view
            viewMode: 'grid',
            sortOption: 'updated',
            searchQuery: '',

            setCurrentFolderId: (folderId: string | null) => set({ currentFolderId: folderId, activePageId: null }),
            setActivePageId: (pageId: string | null) => set({ activePageId: pageId }),
            setViewMode: (mode: 'grid' | 'list') => set({ viewMode: mode }),
            setSortOption: (option: NotebookSortOption) => set({ sortOption: option }),
            setSearchQuery: (query: string) => set({ searchQuery: query }),

            createItem: (params) => {
                const id = `nb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                const now = Date.now();
                const itemType = params.itemType || 'book';
                const parentId = params.parentId !== undefined ? params.parentId : get().currentFolderId;
                const icon = params.icon || (itemType === 'book' ? '📘' : '📑');
                const coverTheme = params.coverTheme || 'aurora';
                const title = params.title.trim() || (itemType === 'book' ? 'Untitled Notebook' : 'Untitled Document');
                const content = itemType === 'page' ? getTemplateContent(title, params.template) : null;

                const newItem: Notebook = {
                    id,
                    parentId,
                    itemType,
                    title,
                    icon,
                    coverTheme,
                    description: params.description?.trim() || '',
                    aiIntent: '',
                    tags: params.tags || [],
                    content,
                    htmlContent: itemType === 'page' ? `<h1>${title}</h1><p></p>` : undefined,
                    textContent: itemType === 'page' ? title : undefined,
                    sources: [],
                    chatSessionIds: [],
                    createdAt: now,
                    updatedAt: now,
                };

                set((state) => ({
                    notebooks: {
                        ...state.notebooks,
                        [id]: newItem,
                    },
                }));

                // If created a page, immediately open it
                if (itemType === 'page') {
                    set({ activePageId: id });
                }

                return id;
            },

            updateItem: (id: string, updates: Partial<Notebook>) => {
                set((state) => {
                    const current = state.notebooks[id];
                    if (!current) return state;

                    return {
                        notebooks: {
                            ...state.notebooks,
                            [id]: {
                                ...current,
                                ...updates,
                                updatedAt: Date.now(),
                            },
                        },
                    };
                });
            },

            deleteItem: (id: string) => {
                set((state) => {
                    const allNotebooks = { ...state.notebooks };

                    // Find all recursive children of this item
                    const findDescendantIds = (parentId: string): string[] => {
                        const children = Object.values(allNotebooks).filter((n) => n.parentId === parentId);
                        let ids: string[] = [];
                        for (const child of children) {
                            ids.push(child.id);
                            ids = ids.concat(findDescendantIds(child.id));
                        }
                        return ids;
                    };

                    const toDelete = [id, ...findDescendantIds(id)];
                    toDelete.forEach((delId) => {
                        delete allNotebooks[delId];
                    });

                    // Adjust active pointers
                    let nextCurrentFolderId = state.currentFolderId;
                    if (state.currentFolderId && toDelete.includes(state.currentFolderId)) {
                        nextCurrentFolderId = null;
                    }

                    let nextActivePageId = state.activePageId;
                    if (state.activePageId && toDelete.includes(state.activePageId)) {
                        nextActivePageId = null;
                    }

                    return {
                        notebooks: allNotebooks,
                        currentFolderId: nextCurrentFolderId,
                        activePageId: nextActivePageId,
                    };
                });
            },

            addSourceToItem: (itemId: string, source: Omit<NotebookSource, 'id' | 'addedAt'>) => {
                const sourceId = `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                const newSource: NotebookSource = {
                    ...source,
                    id: sourceId,
                    addedAt: Date.now(),
                };

                set((state) => {
                    const item = state.notebooks[itemId];
                    if (!item) return state;

                    return {
                        notebooks: {
                            ...state.notebooks,
                            [itemId]: {
                                ...item,
                                sources: [newSource, ...item.sources],
                                updatedAt: Date.now(),
                            },
                        },
                    };
                });

                return sourceId;
            },

            removeSourceFromItem: (itemId: string, sourceId: string) => {
                set((state) => {
                    const item = state.notebooks[itemId];
                    if (!item) return state;

                    return {
                        notebooks: {
                            ...state.notebooks,
                            [itemId]: {
                                ...item,
                                sources: item.sources.filter((s) => s.id !== sourceId),
                                updatedAt: Date.now(),
                            },
                        },
                    };
                });
            },

            bindChatSessionToItem: (itemId: string, sessionId: string) => {
                set((state) => {
                    const item = state.notebooks[itemId];
                    if (!item) return state;
                    if (item.chatSessionIds.includes(sessionId)) return state;

                    return {
                        notebooks: {
                            ...state.notebooks,
                            [itemId]: {
                                ...item,
                                chatSessionIds: [sessionId, ...item.chatSessionIds],
                                updatedAt: Date.now(),
                            },
                        },
                    };
                });
            },

            createItemChat: async (itemId: string) => {
                const item = get().notebooks[itemId];
                const title = item ? `${item.icon || '📘'} ${item.title}` : 'Notebook Chat';

                // 1. Create new chat session in useChatStore
                const sessionId = useChatStore.getState().createNewSession(title);

                // 2. Bind chat to item
                get().bindChatSessionToItem(itemId, sessionId);

                // 3. Switch chat store to this session
                await useChatStore.getState().switchSession(sessionId, true);

                // 4. Switch layout view to chat
                useLayoutStore.getState().setActiveView('chat');

                return sessionId;
            },

            getBreadcrumbs: (itemId: string | null) => {
                const { notebooks } = get();
                if (!itemId) return [];

                const trail: Notebook[] = [];
                let curr: Notebook | undefined = notebooks[itemId];

                while (curr) {
                    trail.unshift(curr);
                    curr = curr.parentId ? notebooks[curr.parentId] : undefined;
                }

                return trail;
            },

            getChildren: (parentId: string | null) => {
                const { notebooks } = get();
                return Object.values(notebooks).filter((n) => n.parentId === parentId);
            },

            getItem: (id: string | null) => {
                const { notebooks } = get();
                if (!id) return null;
                return notebooks[id] || null;
            },

            getSubItemCounts: (itemId: string) => {
                const { notebooks } = get();
                const children = Object.values(notebooks).filter((n) => n.parentId === itemId);
                const subBooks = children.filter((c) => c.itemType === 'book').length;
                const pages = children.filter((c) => c.itemType === 'page').length;
                return { subBooks, pages };
            },
        }),
        {
            name: 'cluaiz-notebook-v2-store',
            version: 2,
        }
    )
);

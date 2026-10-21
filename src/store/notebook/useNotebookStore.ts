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
    /** CSS inline style for the cover banner background */
    coverStyle: React.CSSProperties;
    /** Tailwind class for badge pill on cards */
    badgeClass: string;
}

/**
 * Cover themes derive all colors from the app's active theme CSS variables.
 * The `coverStyle` uses `var(--accent-color)` mixed with `var(--bg-tertiary)`
 * so that notebooks automatically adapt to Dark, Light, OLED, Cyberpunk,
 * Matrix, and Pixel themes without any hardcoded color.
 *
 * The hue-rotate filter on each variant gives visual variety WITHIN the
 * active theme's accent palette — no arbitrary Tailwind colors needed.
 */
export const COVER_THEMES: Record<string, CoverTheme> = {
    aurora: {
        id: 'aurora',
        name: 'Aurora',
        coverStyle: {
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 30%, var(--bg-tertiary)), var(--bg-tertiary))',
        },
        badgeClass: 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20',
    },
    ocean: {
        id: 'ocean',
        name: 'Ocean',
        coverStyle: {
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 25%, var(--bg-tertiary)), color-mix(in srgb, var(--accent-color) 10%, var(--bg-primary)))',
            filter: 'hue-rotate(30deg)',
        },
        badgeClass: 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20',
    },
    sunset: {
        id: 'sunset',
        name: 'Sunset',
        coverStyle: {
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 30%, var(--bg-tertiary)), color-mix(in srgb, var(--accent-color) 15%, var(--bg-primary)))',
            filter: 'hue-rotate(-40deg)',
        },
        badgeClass: 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20',
    },
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        coverStyle: {
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 35%, var(--bg-tertiary)), color-mix(in srgb, var(--accent-color) 12%, var(--bg-primary)))',
            filter: 'hue-rotate(60deg)',
        },
        badgeClass: 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20',
    },
    obsidian: {
        id: 'obsidian',
        name: 'Obsidian',
        coverStyle: {
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--text-muted) 20%, var(--bg-tertiary)), var(--bg-primary))',
        },
        badgeClass: 'bg-[var(--text-muted)]/10 text-[var(--text-secondary)] border border-[var(--border-color)]',
    },
    amber: {
        id: 'amber',
        name: 'Amber',
        coverStyle: {
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 28%, var(--bg-tertiary)), color-mix(in srgb, var(--accent-color) 8%, var(--bg-primary)))',
            filter: 'hue-rotate(-80deg)',
        },
        badgeClass: 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20',
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
    coverImage?: string; // Optional custom banner image (data URL or web path)
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
        coverImage?: string;
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
                    coverImage: params.coverImage,
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

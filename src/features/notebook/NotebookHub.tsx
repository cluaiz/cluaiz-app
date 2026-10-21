import React, { useState, useRef, useMemo } from 'react';
import {
    ArrowLeft,
    BookOpen,
    FolderKanban,
    Plus,
    Search,
    X,
    LayoutGrid,
    List,
    ArrowUpDown,
    Check,
    Layers,
    FileText,
    Sparkles,
    ChevronRight,
    Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { ActionDropdown } from '../../components/ui/dropdown/ActionDropdown';
import { Tooltip } from '../../components/ui/tooltip';
import {
    useNotebookStore,
    Notebook,
    NotebookSortOption,
    COVER_THEMES
} from '../../store/notebook/useNotebookStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushViewRoute } from '../../core/router';
import { NotebookCard } from './components/NotebookCard';
import { NotebookListRow } from './components/NotebookListRow';
import { BookWorkspace } from './components/BookWorkspace';
import { PageEditorWorkspace } from './components/PageEditorWorkspace';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

export const NotebookHub: React.FC = () => {
    const {
        notebooks,
        currentFolderId,
        activePageId,
        setCurrentFolderId,
        setActivePageId,
        viewMode,
        setViewMode,
        sortOption,
        setSortOption,
        searchQuery,
        setSearchQuery,
        getBreadcrumbs,
        getItem,
        createItem,
    } = useNotebookStore();

    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const [isCreatingInline, setIsCreatingInline] = useState(false);
    const [shelfFilter, setShelfFilter] = useState<'all' | 'books' | 'pages'>('all');
    const sortTriggerRef = useRef<HTMLButtonElement>(null);

    // Active item pointers
    const activePage = getItem(activePageId);
    const currentBook = getItem(currentFolderId);

    // Breadcrumbs list
    const breadcrumbTargetId = activePageId || currentFolderId;
    const breadcrumbs = useMemo(() => {
        return getBreadcrumbs(breadcrumbTargetId);
    }, [breadcrumbTargetId, getBreadcrumbs]);

    // Root items on Shelf (parentId === null)
    const rootItems = useMemo(() => {
        let items = Object.values(notebooks).filter((n) => n.parentId === null);

        // Shelf filter
        if (shelfFilter === 'books') {
            items = items.filter((n) => n.itemType === 'book');
        } else if (shelfFilter === 'pages') {
            items = items.filter((n) => n.itemType === 'page');
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            // In search mode, search across all items or root
            items = Object.values(notebooks).filter(
                (n) =>
                    n.title.toLowerCase().includes(q) ||
                    n.description?.toLowerCase().includes(q) ||
                    n.tags?.some((t) => t.toLowerCase().includes(q))
            );
        }

        // Sorting
        return items.sort((a, b) => {
            if (sortOption === 'updated') return b.updatedAt - a.updatedAt;
            if (sortOption === 'created') return b.createdAt - a.createdAt;
            if (sortOption === 'name') return a.title.localeCompare(b.title);
            if (sortOption === 'items') {
                const countA = (a.sources?.length || 0) + (a.chatSessionIds?.length || 0);
                const countB = (b.sources?.length || 0) + (b.chatSessionIds?.length || 0);
                return countB - countA;
            }
            return 0;
        });
    }, [notebooks, shelfFilter, searchQuery, sortOption]);

    // Navigation back handler
    const handleBack = () => {
        if (activePageId) {
            // If inside a page, return to its parent folder or shelf
            if (activePage?.parentId) {
                setCurrentFolderId(activePage.parentId);
            } else {
                setCurrentFolderId(null);
            }
            setActivePageId(null);
        } else if (currentFolderId) {
            // If inside a book, return to its parent book or root shelf
            if (currentBook?.parentId) {
                setCurrentFolderId(currentBook.parentId);
            } else {
                setCurrentFolderId(null);
            }
        } else {
            // On root shelf, return to chat
            useLayoutStore.getState().setActiveView('chat');
            pushViewRoute('chat');
        }
    };

    const handleOpenItem = (item: Notebook) => {
        if (item.itemType === 'book') {
            setCurrentFolderId(item.id);
            setActivePageId(null);
        } else {
            setActivePageId(item.id);
        }
    };

    const sortLabels: Record<NotebookSortOption, string> = {
        updated: 'Recently Updated',
        created: 'Date Created',
        name: 'Name (A-Z)',
        items: 'Most Content',
    };

    return (
        <div className="flex flex-col h-full w-full bg-[var(--bg-primary)] overflow-hidden font-sans text-[var(--text-primary)] selection:bg-[var(--accent-color)]/30">
            {/* 💎 Reusable Header (Identical structure to LibraryHub) */}
            <header className="flex-none h-14 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-b border-[var(--border-color)] px-4 sm:px-6 flex items-center justify-between z-40 sticky top-0">
                {/* Left: Back button + Title / Breadcrumbs */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                    <Tooltip title="Go Back" position="bottom">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleBack}
                            className="h-8 w-8 rounded-xl transition-all active:scale-95 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Tooltip>

                    <div className="h-4 w-[1px] bg-[var(--border-color)] shrink-0 hidden sm:block" />

                    {/* Breadcrumbs Navigation */}
                    <nav className="flex items-center gap-1.5 min-w-0 text-xs font-semibold overflow-hidden">
                        <button
                            onClick={() => {
                                setCurrentFolderId(null);
                                setActivePageId(null);
                            }}
                            className={cn(
                                'flex items-center gap-1.5 transition-colors cursor-pointer shrink-0',
                                !currentFolderId && !activePageId
                                    ? 'text-[var(--text-primary)] font-bold'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            )}
                        >
                            <BookOpen className="w-4 h-4 text-[var(--accent-color)]" />
                            <span className="hidden sm:inline">Notebooks</span>
                        </button>

                        {/* Count Badge on Root */}
                        {!currentFolderId && !activePageId && (
                            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20">
                                {Object.values(notebooks).length}
                            </span>
                        )}

                        {/* Breadcrumbs trail */}
                        {breadcrumbs.map((crumb, idx) => {
                            const isLast = idx === breadcrumbs.length - 1;
                            return (
                                <React.Fragment key={crumb.id}>
                                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]/60 shrink-0" />
                                    <button
                                        onClick={() => {
                                            if (crumb.itemType === 'book') {
                                                setCurrentFolderId(crumb.id);
                                                setActivePageId(null);
                                            } else {
                                                setActivePageId(crumb.id);
                                            }
                                        }}
                                        className={cn(
                                            'truncate max-w-[120px] sm:max-w-[180px] transition-colors cursor-pointer flex items-center gap-1',
                                            isLast
                                                ? 'text-[var(--text-primary)] font-bold'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        )}
                                    >
                                        <span className="text-xs">{crumb.icon}</span>
                                        <span className="truncate">{crumb.title}</span>
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </nav>
                </div>

                {/* Center / Right: Search Bar + Controls */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Search Bar (Only shown on Shelf or Book Contents) */}
                    {!activePageId && (
                        <div className="relative w-40 sm:w-60 md:w-72">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input
                                type="text"
                                placeholder="Search notebooks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Sort Dropdown (Only shown when not editing a page) */}
                    {!activePageId && (
                        <div className="relative">
                            <button
                                ref={sortTriggerRef}
                                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                            >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                <span>{sortLabels[sortOption]}</span>
                            </button>

                            <ActionDropdown
                                isOpen={isSortDropdownOpen}
                                onClose={() => setIsSortDropdownOpen(false)}
                                triggerRef={sortTriggerRef}
                                align="right"
                                floating={true}
                                className="w-48 p-1.5"
                            >
                                {(Object.keys(sortLabels) as NotebookSortOption[]).map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => {
                                            setSortOption(opt);
                                            setIsSortDropdownOpen(false);
                                        }}
                                        className={cn(
                                            'w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer',
                                            sortOption === opt
                                                ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-semibold'
                                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                        )}
                                    >
                                        <span>{sortLabels[opt]}</span>
                                        {sortOption === opt && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                ))}
                            </ActionDropdown>
                        </div>
                    )}

                    {/* View Switcher (Grid / List) */}
                    {!activePageId && (
                        <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn(
                                    'p-1.5 rounded-lg transition-all cursor-pointer',
                                    viewMode === 'grid'
                                        ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                )}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    'p-1.5 rounded-lg transition-all cursor-pointer',
                                    viewMode === 'list'
                                        ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                )}
                            >
                                <List className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Primary "+ New" Button */}
                    {!activePageId && (
                        <Button
                            onClick={() => setIsCreatingInline(true)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-[var(--accent-color)]/10 active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">
                                {currentFolderId ? 'New Item' : 'New Notebook'}
                            </span>
                        </Button>
                    )}
                </div>
            </header>

            {/* Main Body Switcher */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {activePage ? (
                    // 1. PAGE EDITOR VIEW
                    <PageEditorWorkspace page={activePage} onBack={handleBack} />
                ) : currentBook ? (
                    // 2. INSIDE BOOK WORKSPACE VIEW
                    <BookWorkspace book={currentBook} />
                ) : (
                    // 3. ROOT SHELF VIEW (Notion-Style Shelf Hub)
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full pb-28">
                        {/* Shelf Filter Pills */}
                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-[var(--border-color)]/60">
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setShelfFilter('all')}
                                    className={cn(
                                        'px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                                        shelfFilter === 'all'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    )}
                                >
                                    All Projects
                                </button>
                                <button
                                    onClick={() => setShelfFilter('books')}
                                    className={cn(
                                        'px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                                        shelfFilter === 'books'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    )}
                                >
                                    Notebooks
                                </button>
                                <button
                                    onClick={() => setShelfFilter('pages')}
                                    className={cn(
                                        'px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                                        shelfFilter === 'pages'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    )}
                                >
                                    Standalone Pages
                                </button>
                            </div>

                            <span className="text-xs text-[var(--text-muted)]">
                                {rootItems.length} {rootItems.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>

                        {/* Items Presentation (Grid vs List) */}
                        {rootItems.length === 0 ? (
                            <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
                                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4 text-[var(--text-muted)]">
                                    <BookOpen className="w-7 h-7 text-[var(--accent-color)]" />
                                </div>
                                <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                                    {searchQuery ? 'No matching notebooks found' : 'Your Notebook Shelf is empty'}
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-5 leading-relaxed">
                                    {searchQuery
                                        ? `No notebooks match "${searchQuery}". Try a different keyword.`
                                        : 'Create your first project notebook to organize documents, nested sub-books, and contextual AI chats.'}
                                </p>
                                <Button
                                    onClick={() => setIsCreatingInline(true)}
                                    className="rounded-xl text-xs font-bold px-4 py-2"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    Create Notebook
                                </Button>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {isCreatingInline && (
                                    <NotebookCard
                                        initialEditing={true}
                                        defaultItemType={shelfFilter === 'pages' ? 'page' : 'book'}
                                        parentId={null}
                                        onSaveNew={(data) => {
                                            const newId = createItem({
                                                title: data.title,
                                                itemType: data.itemType,
                                                parentId: null,
                                                description: data.description,
                                                icon: data.icon,
                                                coverTheme: data.coverTheme,
                                                coverImage: data.coverImage,
                                            });
                                            setIsCreatingInline(false);
                                        }}
                                        onCancelNew={() => setIsCreatingInline(false)}
                                    />
                                )}
                                {rootItems.map((item) => (
                                    <NotebookCard key={item.id} item={item} onOpen={handleOpenItem} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rootItems.map((item) => (
                                    <NotebookListRow key={item.id} item={item} onOpen={handleOpenItem} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

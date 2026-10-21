import React, { useState, useRef } from 'react';
import {
    BookOpen,
    FileText,
    Plus,
    FolderKanban,
    MessageSquare,
    Sparkles,
    Code2,
    UploadCloud,
    Eye,
    Copy,
    Check,
    Trash2,
    Layers,
    Bot,
    ExternalLink,
    Tag,
    ChevronRight,
    Edit3
} from 'lucide-react';
import {
    Notebook,
    COVER_THEMES,
    useNotebookStore,
    NotebookSource,
    NotebookSourceType
} from '../../../store/notebook/useNotebookStore';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { NotebookCard } from './NotebookCard';
import { NotebookListRow } from './NotebookListRow';
import { CreateItemModal } from './CreateItemModal';
import { useChatStore } from '../../../store/chat/useChatStore';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface BookWorkspaceProps {
    book: Notebook;
}

export const BookWorkspace: React.FC<BookWorkspaceProps> = ({ book }) => {
    const {
        getChildren,
        setCurrentFolderId,
        setActivePageId,
        viewMode,
        addSourceToItem,
        removeSourceFromItem,
        createItemChat,
        updateItem
    } = useNotebookStore();

    const chatSessions = useChatStore((s) => s.sessions);
    const children = getChildren(book.id);

    const subBooks = children.filter((c) => c.itemType === 'book');
    const pages = children.filter((c) => c.itemType === 'page');

    const theme = COVER_THEMES[book.coverTheme] || COVER_THEMES.aurora;

    // Tabs inside book: 'contents' | 'sources' | 'chats'
    const [activeTab, setActiveTab] = useState<'contents' | 'sources' | 'chats'>('contents');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createModalType, setCreateModalType] = useState<'book' | 'page'>('book');
    const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
    const [inspectSource, setInspectSource] = useState<NotebookSource | null>(null);
    const [copiedSourceId, setCopiedSourceId] = useState<string | null>(null);

    // Source Form
    const [sourceType, setSourceType] = useState<NotebookSourceType>('file');
    const [sourceName, setSourceName] = useState('');
    const [sourceLanguage, setSourceLanguage] = useState('typescript');
    const [sourceContent, setSourceContent] = useState('');
    const [sourceSize, setSourceSize] = useState<number | undefined>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inline edit description
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [descInput, setDescInput] = useState(book.description || '');

    const handleOpenItem = (item: Notebook) => {
        if (item.itemType === 'book') {
            setCurrentFolderId(item.id);
        } else {
            setActivePageId(item.id);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSourceName(file.name);
        setSourceSize(file.size);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                setSourceContent(text);
            }
        };
        reader.readAsText(file);
    };

    const handleAddSourceSubmit = () => {
        if (!sourceName.trim()) return;

        addSourceToItem(book.id, {
            name: sourceName.trim(),
            type: sourceType,
            size: sourceSize || (sourceContent ? new Blob([sourceContent]).size : 0),
            content: sourceContent,
            language: sourceType === 'code' ? sourceLanguage : undefined,
        });

        setSourceName('');
        setSourceContent('');
        setSourceSize(undefined);
        setIsAddSourceModalOpen(false);
    };

    const handleCopySource = (source: NotebookSource) => {
        if (source.content) {
            navigator.clipboard.writeText(source.content);
            setCopiedSourceId(source.id);
            setTimeout(() => setCopiedSourceId(null), 2000);
        }
    };

    const handleSaveDescription = () => {
        updateItem(book.id, { description: descInput.trim() });
        setIsEditingDesc(false);
    };

    const formatBytes = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    return (
        <div className="flex-1 overflow-y-auto pb-24">
            {/* 💎 Hero Cover Banner */}
            <div className={cn('h-44 sm:h-52 w-full bg-gradient-to-r relative border-b border-[var(--border-color)]/60 p-6 flex flex-col justify-end', theme.gradient)}>
                <div className="max-w-6xl w-full mx-auto relative z-10 flex items-end justify-between gap-4">
                    <div className="flex items-end gap-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[var(--bg-primary)] border-2 border-[var(--border-color)] shadow-xl flex items-center justify-center text-3xl sm:text-4xl select-none shrink-0 -mb-8">
                            {book.icon || '📘'}
                        </div>
                        <div className="mb-2">
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm', theme.badgeBg)}>
                                Notebook Container
                            </span>
                            <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md truncate mt-1">
                                {book.title}
                            </h1>
                        </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="hidden sm:flex items-center gap-2 mb-2">
                        <Button
                            size="sm"
                            onClick={() => {
                                setCreateModalType('page');
                                setIsCreateModalOpen(true);
                            }}
                            className="rounded-xl text-xs font-bold bg-white text-neutral-900 hover:bg-neutral-100 shadow-lg active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            New Page
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setCreateModalType('book');
                                setIsCreateModalOpen(true);
                            }}
                            className="rounded-xl text-xs font-bold bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/20 active:scale-95"
                        >
                            <BookOpen className="w-3.5 h-3.5 mr-1" />
                            New Sub-Book
                        </Button>
                    </div>
                </div>
            </div>

            {/* Description & Tab Bar Container */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
                {/* Description Row */}
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex-1">
                        {isEditingDesc ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={descInput}
                                    onChange={(e) => setDescInput(e.target.value)}
                                    placeholder="Add a description for this notebook..."
                                    className="h-8 text-xs rounded-xl bg-[var(--bg-secondary)]"
                                    autoFocus
                                />
                                <Button size="sm" onClick={handleSaveDescription} className="h-8 rounded-xl text-xs font-semibold">
                                    Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setIsEditingDesc(false)} className="h-8 rounded-xl text-xs">
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsEditingDesc(true)}
                                className="group flex items-center gap-2 cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                <p className="leading-relaxed">
                                    {book.description || 'Click to add a description for this notebook project...'}
                                </p>
                                <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent-color)] shrink-0" />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:hidden">
                        <Button
                            size="sm"
                            onClick={() => {
                                setCreateModalType('page');
                                setIsCreateModalOpen(true);
                            }}
                            className="rounded-xl text-xs font-bold"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Page
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setCreateModalType('book');
                                setIsCreateModalOpen(true);
                            }}
                            className="rounded-xl text-xs font-bold"
                        >
                            <BookOpen className="w-3.5 h-3.5 mr-1" />
                            Sub-Book
                        </Button>
                    </div>
                </div>

                {/* Sub-Tabs: Contents, Sources, Chats */}
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3 mb-6">
                    <button
                        onClick={() => setActiveTab('contents')}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                            activeTab === 'contents'
                                ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        )}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Contents</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-bold">
                            {children.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('sources')}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                            activeTab === 'sources'
                                ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        )}
                    >
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span>Sources</span>
                        {book.sources?.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-bold">
                                {book.sources.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('chats')}
                        className={cn(
                            'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                            activeTab === 'chats'
                                ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        )}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chats</span>
                        {book.chatSessionIds?.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-bold">
                                {book.chatSessionIds.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* TAB 1: CONTENTS (SUB-BOOKS & PAGES) */}
                {activeTab === 'contents' && (
                    <div className="space-y-8">
                        {/* Sub-Notebooks Section */}
                        {subBooks.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                        <BookOpen className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                        <span>Sub-Notebooks ({subBooks.length})</span>
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setCreateModalType('book');
                                            setIsCreateModalOpen(true);
                                        }}
                                        className="h-7 text-xs font-semibold text-[var(--accent-color)]"
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Add Sub-Book
                                    </Button>
                                </div>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {subBooks.map((item) => (
                                            <NotebookCard key={item.id} item={item} onOpen={handleOpenItem} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {subBooks.map((item) => (
                                            <NotebookListRow key={item.id} item={item} onOpen={handleOpenItem} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Document Pages Section */}
                        {pages.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Document Pages ({pages.length})</span>
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setCreateModalType('page');
                                            setIsCreateModalOpen(true);
                                        }}
                                        className="h-7 text-xs font-semibold text-[var(--accent-color)]"
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Add Page
                                    </Button>
                                </div>

                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {pages.map((item) => (
                                            <NotebookCard key={item.id} item={item} onOpen={handleOpenItem} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {pages.map((item) => (
                                            <NotebookListRow key={item.id} item={item} onOpen={handleOpenItem} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty State if neither sub-books nor pages */}
                        {children.length === 0 && (
                            <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3 text-[var(--text-muted)]">
                                    <Layers className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                                    This notebook is empty
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-5 leading-relaxed">
                                    Add sub-notebooks to organize deeper topics or create document pages to start writing specifications.
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setCreateModalType('page');
                                            setIsCreateModalOpen(true);
                                        }}
                                        className="rounded-xl text-xs font-semibold"
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        Create First Page
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setCreateModalType('book');
                                            setIsCreateModalOpen(true);
                                        }}
                                        className="rounded-xl text-xs font-semibold"
                                    >
                                        <BookOpen className="w-3.5 h-3.5 mr-1" />
                                        Create Sub-Book
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: SOURCES & INPUTS */}
                {activeTab === 'sources' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                    Notebook Knowledge Sources
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Attach code snippets, architecture specs, or prompts to ground AI conversations for this notebook.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => setIsAddSourceModalOpen(true)}
                                className="rounded-xl text-xs font-bold"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Attach Source
                            </Button>
                        </div>

                        {book.sources?.length === 0 ? (
                            <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
                                <p className="text-xs text-[var(--text-muted)] mb-3">No sources attached to this notebook yet.</p>
                                <Button size="sm" variant="outline" onClick={() => setIsAddSourceModalOpen(true)} className="rounded-xl text-xs">
                                    <Plus className="w-3 h-3 mr-1" /> Attach Source
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {book.sources.map((source) => (
                                    <div
                                        key={source.id}
                                        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)] p-4 transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="w-8 h-8 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
                                                    {source.type === 'code' ? (
                                                        <Code2 className="w-4 h-4 text-emerald-400" />
                                                    ) : source.type === 'prompt' ? (
                                                        <Sparkles className="w-4 h-4 text-amber-400" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-blue-400" />
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                                        {source.name}
                                                    </h4>
                                                    <span className="text-[10px] text-[var(--text-muted)]">
                                                        {source.language || source.type} • {formatBytes(source.size)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {source.content && (
                                                    <button
                                                        onClick={() => setInspectSource(source)}
                                                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {source.content && (
                                                    <button
                                                        onClick={() => handleCopySource(source)}
                                                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                                    >
                                                        {copiedSourceId === source.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removeSourceFromItem(book.id, source.id)}
                                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {source.content && (
                                            <div className="p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]/70 text-[11px] font-mono text-[var(--text-secondary)] line-clamp-2">
                                                {source.content.slice(0, 160)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: CONTEXTUAL CHATS */}
                {activeTab === 'chats' && (
                    <div>
                        <div className="p-5 rounded-3xl bg-gradient-to-r from-[var(--accent-color)]/10 via-[var(--bg-secondary)] to-[var(--bg-secondary)] border border-[var(--accent-color)]/20 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-[var(--accent-color)]" />
                                    <span>Contextual Conversations</span>
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    Chats initiated here ground AI responses in this notebook&apos;s nested books, pages, and attached sources.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => createItemChat(book.id)}
                                className="rounded-xl text-xs font-bold shrink-0"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Start Notebook Chat
                            </Button>
                        </div>

                        {book.chatSessionIds?.length === 0 ? (
                            <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
                                <p className="text-xs text-[var(--text-muted)] mb-3">No chat sessions linked to this notebook yet.</p>
                                <Button size="sm" onClick={() => createItemChat(book.id)} className="rounded-xl text-xs font-semibold">
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Start First Chat
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {book.chatSessionIds.map((sessionId) => {
                                    const session = chatSessions[sessionId];
                                    const title = session?.title || 'Notebook Discussion';
                                    const messageCount = session?.messages?.length || session?.messageCount || 0;
                                    const lastMessage = session?.messages?.[session.messages.length - 1]?.text || 'Active chat session';

                                    return (
                                        <div
                                            key={sessionId}
                                            onClick={async () => {
                                                await useChatStore.getState().switchSession(sessionId, true);
                                                useLayoutStore.getState().setActiveView('chat');
                                            }}
                                            className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)] transition-all hover:border-[var(--accent-color)]/40 cursor-pointer flex items-center justify-between gap-4"
                                        >
                                            <div className="flex items-center gap-3 truncate">
                                                <div className="w-9 h-9 rounded-xl bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center shrink-0">
                                                    <MessageSquare className="w-4 h-4" />
                                                </div>
                                                <div className="truncate">
                                                    <h5 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                                        {title}
                                                    </h5>
                                                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5 max-w-lg">
                                                        {lastMessage}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                                    {messageCount} msgs
                                                </span>
                                                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal to create sub-book or page */}
            <CreateItemModal
                open={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                defaultItemType={createModalType}
                parentId={book.id}
            />

            {/* Modal to Add Source */}
            <Dialog open={isAddSourceModalOpen} onOpenChange={setIsAddSourceModalOpen}>
                <DialogContent className="max-w-lg p-6 bg-[var(--bg-secondary)] border-[var(--border-color)]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Plus className="w-4 h-4 text-[var(--accent-color)]" />
                            <span>Attach Knowledge Source</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 my-2">
                        <div>
                            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                Source Name
                            </label>
                            <Input
                                value={sourceName}
                                onChange={(e) => setSourceName(e.target.value)}
                                placeholder="e.g. system_architecture.rs"
                                className="h-9 text-xs rounded-xl bg-[var(--bg-primary)]"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                Content / Source Code
                            </label>
                            <textarea
                                value={sourceContent}
                                onChange={(e) => setSourceContent(e.target.value)}
                                rows={6}
                                placeholder="Paste or type content here..."
                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setIsAddSourceModalOpen(false)} className="rounded-xl text-xs">
                            Cancel
                        </Button>
                        <Button onClick={handleAddSourceSubmit} disabled={!sourceName.trim()} className="rounded-xl text-xs font-bold">
                            Attach Source
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal to Inspect Source */}
            <Dialog open={!!inspectSource} onOpenChange={() => setInspectSource(null)}>
                <DialogContent className="max-w-2xl p-6 bg-[var(--bg-secondary)] border-[var(--border-color)]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-[var(--text-primary)]">
                            {inspectSource?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="my-4 max-h-96 overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap select-text">
                        {inspectSource?.content}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setInspectSource(null)} className="rounded-xl text-xs font-semibold">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

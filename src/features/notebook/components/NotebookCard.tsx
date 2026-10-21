import React, { useRef, useState } from 'react';
import {
    BookOpen,
    FileText,
    MoreVertical,
    Trash2,
    Copy,
    FolderKanban,
    Calendar,
    ArrowUpRight,
    Tag
} from 'lucide-react';
import {
    Notebook,
    COVER_THEMES,
    useNotebookStore
} from '../../../store/notebook/useNotebookStore';
import { ActionDropdown } from '../../../components/ui/dropdown/ActionDropdown';
import { ConfirmationModal } from '../../../components/ui/modal/ConfirmationModal';
import { Tooltip } from '../../../components/ui/tooltip';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

function formatDate(timestamp: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface NotebookCardProps {
    item: Notebook;
    onOpen: (item: Notebook) => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({ item, onOpen }) => {
    const { getSubItemCounts, deleteItem, createItem } = useNotebookStore();
    const { subBooks, pages } = getSubItemCounts(item.id);

    const theme = COVER_THEMES[item.coverTheme] || COVER_THEMES.aurora;
    const isBook = item.itemType === 'book';

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);

    const handleDuplicate = (e: React.MouseEvent) => {
        e.stopPropagation();
        createItem({
            title: `${item.title} (Copy)`,
            itemType: item.itemType,
            parentId: item.parentId,
            description: item.description,
            icon: item.icon,
            coverTheme: item.coverTheme,
            tags: [...item.tags],
        });
        setIsMenuOpen(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        deleteItem(item.id);
        setIsDeleteModalOpen(false);
    };

    return (
        <div
            onClick={() => onOpen(item)}
            className="group relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-secondary)] transition-all hover:border-[var(--accent-color)]/50 hover:shadow-xl hover:shadow-black/10 cursor-pointer overflow-hidden flex flex-col active:scale-[0.99]"
        >
            {/* Top Cover Banner */}
            <div className={cn('h-24 w-full bg-gradient-to-r relative p-3 border-b border-[var(--border-color)]/60', theme.gradient)}>
                {/* Elevated Action Menu */}
                <div className="absolute top-2.5 right-2.5 z-10">
                    <button
                        ref={menuTriggerRef}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white/80 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
                    >
                        <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    <ActionDropdown
                        isOpen={isMenuOpen}
                        onClose={() => setIsMenuOpen(false)}
                        triggerRef={menuTriggerRef}
                        align="right"
                        floating={true}
                        className="w-44 p-1.5"
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(false);
                                onOpen(item);
                            }}
                            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 cursor-pointer"
                        >
                            <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span>Open</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDuplicate}
                            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span>Duplicate</span>
                        </button>

                        <div className="h-[1px] bg-[var(--border-color)] my-1" />

                        <button
                            type="button"
                            onClick={handleDelete}
                            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                        </button>
                    </ActionDropdown>
                </div>
            </div>

            {/* Elevated Icon Badge */}
            <div className="px-4 -mt-5 flex items-center justify-between relative z-10">
                <div className="w-11 h-11 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-md flex items-center justify-center text-xl select-none group-hover:scale-105 transition-transform">
                    {item.icon || (isBook ? '📘' : '📑')}
                </div>

                <div className="flex items-center gap-1.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', theme.badgeBg)}>
                        {isBook ? 'Notebook' : 'Page'}
                    </span>
                </div>
            </div>

            {/* Card Body */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate mb-1">
                        {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                        {item.description || (isBook ? 'Organized notebook container.' : 'Document notes and technical spec.')}
                    </p>
                </div>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                            >
                                #{tag}
                            </span>
                        ))}
                        {item.tags.length > 3 && (
                            <span className="text-[10px] text-[var(--text-muted)] px-1 self-center">
                                +{item.tags.length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Footer Telemetry */}
                <div className="pt-2 border-t border-[var(--border-color)]/70 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                        {isBook ? (
                            <>
                                <span className="flex items-center gap-1">
                                    <BookOpen className="w-3 h-3 text-[var(--accent-color)]" />
                                    <span>{subBooks} books</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                                    <span>{pages} pages</span>
                                </span>
                            </>
                        ) : (
                            <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3 text-[var(--accent-color)]" />
                                <span>Doc Page</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px]">
                        <Calendar className="w-3 h-3 opacity-60" />
                        <span>{formatDate(item.updatedAt)}</span>
                    </div>
                </div>
            </div>

            {/* Delete Modal */}
            <ConfirmationModal
                open={isDeleteModalOpen}
                title={`Delete ${isBook ? 'Notebook' : 'Page'}`}
                message={`Are you sure you want to delete "${item.title}"? ${
                    isBook ? 'All nested sub-books, document pages, and attached sources will be removed.' : 'This page will be deleted.'
                }`}
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive={true}
                onConfirm={handleConfirmDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
            />
        </div>
    );
};

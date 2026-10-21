import React, { useRef, useState } from 'react';
import {
    BookOpen,
    FileText,
    MoreVertical,
    Trash2,
    Copy,
    ArrowUpRight,
    Calendar
} from 'lucide-react';
import {
    Notebook,
    COVER_THEMES,
    useNotebookStore
} from '../../../store/notebook/useNotebookStore';
import { ActionDropdown } from '../../../components/ui/dropdown/ActionDropdown';
import { ConfirmationModal } from '../../../components/ui/modal/ConfirmationModal';

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

interface NotebookListRowProps {
    item: Notebook;
    onOpen: (item: Notebook) => void;
}

export const NotebookListRow: React.FC<NotebookListRowProps> = ({ item, onOpen }) => {
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
            className="group px-4 py-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] transition-all hover:border-[var(--accent-color)]/40 hover:shadow-md cursor-pointer flex items-center justify-between gap-4 select-none"
        >
            {/* Left: Icon & Title */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-sm flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                    {item.icon || (isBook ? '📘' : '📑')}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate">
                            {item.title}
                        </h4>
                        <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full border shrink-0', theme.badgeBg)}>
                            {isBook ? 'Notebook' : 'Page'}
                        </span>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5 max-w-lg">
                        {item.description || (isBook ? 'Notebook folder' : 'Document specification')}
                    </p>
                </div>
            </div>

            {/* Middle: Tags & Counters */}
            <div className="hidden sm:flex items-center gap-4 text-xs text-[var(--text-muted)] shrink-0">
                {isBook ? (
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            <span>{subBooks} books</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{pages} pages</span>
                        </span>
                    </div>
                ) : (
                    <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                        <FileText className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span>Document</span>
                    </span>
                )}

                <div className="flex items-center gap-1 text-[11px] min-w-[70px] justify-end">
                    <Calendar className="w-3 h-3 opacity-60" />
                    <span>{formatDate(item.updatedAt)}</span>
                </div>
            </div>

            {/* Right: Actions Menu */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    ref={menuTriggerRef}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(!isMenuOpen);
                    }}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                    <MoreVertical className="w-4 h-4" />
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

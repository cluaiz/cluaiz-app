import React, { useRef, useState, useEffect } from 'react';
import {
    BookOpen,
    FileText,
    MoreVertical,
    Trash2,
    Copy,
    Edit3,
    Calendar,
    ArrowUpRight,
    Upload,
    Palette,
    X,
    Check
} from 'lucide-react';
import {
    Notebook,
    COVER_THEMES,
    NotebookItemType,
    useNotebookStore
} from '../../../store/notebook/useNotebookStore';
import { ActionDropdown } from '../../../components/ui/dropdown/ActionDropdown';
import { ConfirmationModal } from '../../../components/ui/modal/ConfirmationModal';
import { EmojiPicker } from '../../../components/ui/context-menu/EmojiPicker';
import { Button } from '../../../components/ui/Button';

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
    item?: Notebook;
    onOpen?: (item: Notebook) => void;
    initialEditing?: boolean;
    defaultItemType?: NotebookItemType;
    parentId?: string | null;
    onSaveNew?: (data: {
        title: string;
        description: string;
        icon: string;
        coverTheme: string;
        coverImage?: string;
        itemType: NotebookItemType;
    }) => void;
    onCancelNew?: () => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
    item,
    onOpen,
    initialEditing = false,
    defaultItemType = 'book',
    parentId = null,
    onSaveNew,
    onCancelNew,
}) => {
    const isNew = !item;
    const { getSubItemCounts, deleteItem, createItem, updateItem } = useNotebookStore();
    const counts = item ? getSubItemCounts(item.id) : { subBooks: 0, pages: 0 };

    const [isEditing, setIsEditing] = useState(initialEditing || isNew);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Pick a default theme on initial mount
    const availableThemes = Object.keys(COVER_THEMES);
    const initialThemeKey = item?.coverTheme || availableThemes[Math.floor(Math.random() * availableThemes.length)] || 'aurora';

    // Editable draft states
    const [editTitle, setEditTitle] = useState(item?.title || '');
    const [editDescription, setEditDescription] = useState(item?.description || '');
    const [editIcon, setEditIcon] = useState(item?.icon || (defaultItemType === 'book' ? '📘' : '📑'));
    const [editThemeKey, setEditThemeKey] = useState(initialThemeKey);
    const [editCoverImage, setEditCoverImage] = useState<string | null>(item?.coverImage || null);
    const [editItemType, setEditItemType] = useState<NotebookItemType>(item?.itemType || defaultItemType);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const iconTriggerRef = useRef<HTMLButtonElement>(null);

    const currentTheme = COVER_THEMES[isEditing ? editThemeKey : (item?.coverTheme || 'aurora')] || COVER_THEMES.aurora;
    const isBook = (isEditing ? editItemType : item?.itemType) === 'book';

    // Cycle through available cover themes
    const handleCycleTheme = () => {
        const currentIndex = availableThemes.indexOf(editThemeKey);
        const nextIndex = (currentIndex + 1) % availableThemes.length;
        setEditThemeKey(availableThemes[nextIndex]);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setEditCoverImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = (e?: React.MouseEvent | React.FormEvent) => {
        if (e) e.stopPropagation();
        if (!editTitle.trim()) return;

        if (isNew) {
            if (onSaveNew) {
                onSaveNew({
                    title: editTitle.trim(),
                    description: editDescription.trim(),
                    icon: editIcon,
                    coverTheme: editThemeKey,
                    coverImage: editCoverImage || undefined,
                    itemType: editItemType,
                });
            }
        } else if (item) {
            updateItem(item.id, {
                title: editTitle.trim(),
                description: editDescription.trim(),
                icon: editIcon,
                coverTheme: editThemeKey,
                coverImage: editCoverImage || undefined,
            });
            setIsEditing(false);
        }
    };

    const handleCancel = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (isNew) {
            if (onCancelNew) onCancelNew();
        } else if (item) {
            // Revert changes
            setEditTitle(item.title);
            setEditDescription(item.description);
            setEditIcon(item.icon);
            setEditThemeKey(item.coverTheme);
            setEditCoverImage(item.coverImage || null);
            setIsEditing(false);
        }
    };

    const handleDuplicate = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!item) return;
        createItem({
            title: `${item.title} (Copy)`,
            itemType: item.itemType,
            parentId: item.parentId,
            description: item.description,
            icon: item.icon,
            coverTheme: item.coverTheme,
            coverImage: item.coverImage,
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
        if (!item) return;
        deleteItem(item.id);
        setIsDeleteModalOpen(false);
    };

    return (
        <div
            onClick={() => {
                if (!isEditing && item && onOpen) {
                    onOpen(item);
                }
            }}
            className="group relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-secondary)] transition-all hover:border-[var(--accent-color)]/50 hover:shadow-xl hover:shadow-black/10 overflow-hidden flex flex-col active:scale-[0.99] cursor-pointer"
        >
            {/* Top Cover Banner */}
            <div
                style={!editCoverImage ? currentTheme.coverStyle : undefined}
                className="h-24 w-full relative p-3 border-b border-[var(--border-color)]/60 overflow-hidden flex items-start justify-end gap-1.5"
            >
                {editCoverImage && (
                    <>
                        <img
                            src={editCoverImage}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30" />
                    </>
                )}

                {/* Edit Controls On Banner */}
                {isEditing ? (
                    <div className="relative z-10 flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-lg">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            className="px-2 py-1 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition-colors text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Upload Banner Image"
                        >
                            <Upload className="w-3 h-3" />
                            <span>Banner</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCycleTheme();
                            }}
                            className="px-2 py-1 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition-colors text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Cycle Theme Pattern"
                        >
                            <Palette className="w-3 h-3" />
                            <span>Theme</span>
                        </button>

                        {editCoverImage && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditCoverImage(null);
                                }}
                                className="p-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-500/30 transition-colors cursor-pointer"
                                title="Remove Image"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ) : (
                    /* Elevated Action Menu in View Mode */
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
                                    if (item && onOpen) onOpen(item);
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 cursor-pointer"
                            >
                                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <span>Open</span>
                            </button>

                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    setIsEditing(true);
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 cursor-pointer"
                            >
                                <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                <span>Edit</span>
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
                )}
            </div>

            {/* Elevated Icon - Pure Big Emoji with Zero Background Box */}
            <div className="px-4 -mt-5 flex items-center justify-between relative z-10">
                {isEditing ? (
                    <button
                        ref={iconTriggerRef}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowEmojiPicker(!showEmojiPicker);
                        }}
                        className="text-3xl select-none hover:scale-110 transition-transform cursor-pointer leading-none p-0 bg-transparent border-none outline-none drop-shadow-md"
                        title="Click to choose emoji"
                    >
                        {editIcon}
                    </button>
                ) : (
                    <div className="text-3xl select-none group-hover:scale-110 transition-transform leading-none drop-shadow-md cursor-pointer">
                        {item?.icon || (isBook ? '📘' : '📑')}
                    </div>
                )}

                <div className="flex items-center gap-1.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', currentTheme.badgeClass)}>
                        {isBook ? 'Notebook' : 'Page'}
                    </span>
                </div>
            </div>

            {/* Card Body - In editing mode, zero input borders, exact same native typography */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                {isEditing ? (
                    <div>
                        <div className="mb-1">
                            <input
                                autoFocus
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(e);
                                    if (e.key === 'Escape') handleCancel(e as any);
                                }}
                                placeholder={isBook ? 'Notebook name...' : 'Page title...'}
                                className="w-full text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-transparent border-none outline-none p-0 focus:ring-0 truncate"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(e);
                                    if (e.key === 'Escape') handleCancel(e as any);
                                }}
                                placeholder={isBook ? 'Organized notebook container.' : 'Document notes and technical spec.'}
                                className="w-full text-xs text-[var(--text-muted)] placeholder:text-[var(--text-muted)]/60 bg-transparent border-none outline-none p-0 focus:ring-0 leading-relaxed"
                            />
                        </div>
                    </div>
                ) : (
                    <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate mb-1">
                            {item?.title}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                            {item?.description || (isBook ? 'Organized notebook container.' : 'Document notes and technical spec.')}
                        </p>
                    </div>
                )}

                {/* Footer Controls: In edit mode shows subtle inline save/cancel, in view mode shows stats */}
                {isEditing ? (
                    <div className="pt-2 border-t border-[var(--border-color)]/70 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span className="text-[10px] text-[var(--text-muted)]">Enter ↵ save</span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!editTitle.trim()}
                                className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                                <Check className="w-3 h-3" />
                                <span>{isNew ? 'Create' : 'Save'}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    item && (
                        <div className="pt-2 border-t border-[var(--border-color)]/70 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                            <div className="flex items-center gap-2">
                                {isBook ? (
                                    <>
                                        <span className="flex items-center gap-1">
                                            <BookOpen className="w-3 h-3 text-[var(--accent-color)]" />
                                            <span>{counts.subBooks} books</span>
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                                            <span>{counts.pages} pages</span>
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
                    )
                )}
            </div>

            {/* Floating Clean Emoji Picker Popover — Direct ActionDropdown Portal, Zero Backdrop / Zero Modal Overlay */}
            <ActionDropdown
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                triggerRef={iconTriggerRef}
                align="left"
                floating={true}
                className="!p-0 !border-none !bg-transparent !shadow-none"
            >
                <EmojiPicker
                    noAnimation={true}
                    onSelect={(emoji) => {
                        setEditIcon(emoji);
                        setShowEmojiPicker(false);
                    }}
                    onClose={() => setShowEmojiPicker(false)}
                />
            </ActionDropdown>

            {/* Delete Modal */}
            {item && (
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
            )}
        </div>
    );
};

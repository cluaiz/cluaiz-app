import React, { useState } from 'react';
import {
    Plus,
    BookOpen,
    FileText,
    Sparkles,
    Check,
    Palette
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/Dialog';
import {
    useNotebookStore,
    NotebookItemType,
    COVER_THEMES,
    DEFAULT_ICONS,
    CoverTheme
} from '../../../store/notebook/useNotebookStore';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface CreateItemModalProps {
    open: boolean;
    onClose: () => void;
    defaultItemType?: NotebookItemType;
    parentId?: string | null;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
    open,
    onClose,
    defaultItemType = 'book',
    parentId = null,
}) => {
    const { createItem, getItem } = useNotebookStore();
    const parentItem = getItem(parentId);

    const [itemType, setItemType] = useState<NotebookItemType>(defaultItemType);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(defaultItemType === 'book' ? '📘' : '📑');
    const [selectedTheme, setSelectedTheme] = useState('aurora');
    const [selectedTemplate, setSelectedTemplate] = useState('blank');

    // Update defaults when modal opens with a different defaultItemType
    React.useEffect(() => {
        if (open) {
            setItemType(defaultItemType);
            setSelectedIcon(defaultItemType === 'book' ? '📘' : '📑');
            setTitle('');
            setDescription('');
        }
    }, [open, defaultItemType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        createItem({
            title: title.trim(),
            itemType,
            parentId,
            description: description.trim(),
            icon: selectedIcon,
            coverTheme: selectedTheme,
            template: selectedTemplate,
        });

        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-lg p-6 bg-[var(--bg-secondary)] border-[var(--border-color)]">
                <DialogHeader>
                    <DialogTitle className="text-sm font-bold text-[var(--text-primary)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-[var(--accent-color)]" />
                            <span>
                                {itemType === 'book'
                                    ? parentItem
                                        ? `New Sub-Notebook inside "${parentItem.title}"`
                                        : 'New Notebook Project'
                                    : parentItem
                                    ? `New Page inside "${parentItem.title}"`
                                    : 'New Standalone Document Page'}
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 my-2">
                    {/* Item Type Toggle */}
                    <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                            Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setItemType('book');
                                    setSelectedIcon('📘');
                                }}
                                className={cn(
                                    'py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 cursor-pointer',
                                    itemType === 'book'
                                        ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--accent-color)] shadow-sm'
                                        : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                )}
                            >
                                <BookOpen className="w-4 h-4" />
                                <span>Notebook (Folder/Book)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setItemType('page');
                                    setSelectedIcon('📑');
                                }}
                                className={cn(
                                    'py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-2 cursor-pointer',
                                    itemType === 'page'
                                        ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--accent-color)] shadow-sm'
                                        : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                )}
                            >
                                <FileText className="w-4 h-4" />
                                <span>Document Page</span>
                            </button>
                        </div>
                    </div>

                    {/* Icon Selection */}
                    <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                            Icon
                        </label>
                        <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                            {DEFAULT_ICONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setSelectedIcon(emoji)}
                                    className={cn(
                                        'w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer',
                                        selectedIcon === emoji
                                            ? 'bg-[var(--accent-color)]/20 scale-110 shadow-sm'
                                            : 'hover:bg-[var(--bg-tertiary)] opacity-80 hover:opacity-100'
                                    )}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cover Theme Gradients */}
                    <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                            Cover Theme
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {Object.values(COVER_THEMES).map((theme: CoverTheme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setSelectedTheme(theme.id)}
                                    className={cn(
                                        'h-11 rounded-xl bg-gradient-to-br border relative transition-all flex flex-col items-center justify-center cursor-pointer',
                                        theme.gradient,
                                        selectedTheme === theme.id
                                            ? 'border-white/80 ring-2 ring-[var(--accent-color)] scale-105 shadow-md'
                                            : 'border-[var(--border-color)] opacity-70 hover:opacity-100'
                                    )}
                                >
                                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                                        {theme.name}
                                    </span>
                                    {selectedTheme === theme.id && (
                                        <Check className="w-3.5 h-3.5 text-white absolute top-1 right-1 drop-shadow" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                            Title
                        </label>
                        <Input
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={itemType === 'book' ? 'e.g. Distributed Compute Engine' : 'e.g. API Architecture Spec'}
                            className="h-9 text-xs rounded-xl bg-[var(--bg-primary)] font-semibold"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                            Description (Optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Brief summary of this notebook or document..."
                            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] resize-none"
                        />
                    </div>

                    {/* Page Template Selection (Only if Page) */}
                    {itemType === 'page' && (
                        <div>
                            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                                Starter Template
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'blank', label: 'Blank Page' },
                                    { id: 'technical-spec', label: 'Technical Spec' },
                                    { id: 'research-notes', label: 'Research Notes' },
                                ].map((tmpl) => (
                                    <button
                                        key={tmpl.id}
                                        type="button"
                                        onClick={() => setSelectedTemplate(tmpl.id)}
                                        className={cn(
                                            'py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer',
                                            selectedTemplate === tmpl.id
                                                ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--accent-color)] font-semibold'
                                                : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        )}
                                    >
                                        {tmpl.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-6 pt-3 border-t border-[var(--border-color)]">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="rounded-xl text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!title.trim()}
                            className="rounded-xl text-xs font-bold"
                        >
                            Create {itemType === 'book' ? 'Notebook' : 'Page'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

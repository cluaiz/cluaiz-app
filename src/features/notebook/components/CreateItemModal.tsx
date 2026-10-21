import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    Check,
    Image as ImageIcon,
    X,
    Upload
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/Dialog';
import { EmojiPicker } from '../../../components/ui/context-menu/EmojiPicker';
import {
    useNotebookStore,
    NotebookItemType,
    COVER_THEMES,
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

    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(defaultItemType === 'book' ? '📘' : '📑');
    const [selectedTheme, setSelectedTheme] = useState('aurora');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('blank');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // On open: Reset name, picker, image, and pick a fresh random cover theme pattern
    useEffect(() => {
        if (open) {
            setName('');
            setSelectedIcon(defaultItemType === 'book' ? '📘' : '📑');
            setShowEmojiPicker(false);
            setCoverImage(null);
            setSelectedTemplate('blank');

            // Default random pattern chosen from available cover themes
            const themeKeys = Object.keys(COVER_THEMES);
            if (themeKeys.length > 0) {
                const randomTheme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
                setSelectedTheme(randomTheme);
            }
        }
    }, [open, defaultItemType]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setCoverImage(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        createItem({
            title: name.trim(),
            itemType: defaultItemType,
            parentId,
            description: '',
            icon: selectedIcon,
            coverTheme: selectedTheme,
            coverImage: coverImage || undefined,
            template: selectedTemplate,
        });

        onClose();
    };

    return (
        <>
            {/* Main Create Modal */}
            <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-md p-6 bg-[var(--bg-secondary)] border-[var(--border-color)]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold text-[var(--text-primary)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4 text-[var(--accent-color)]" />
                                <span>
                                    {defaultItemType === 'book'
                                        ? parentItem
                                            ? `New Sub-Notebook inside "${parentItem.title}"`
                                            : 'New Notebook'
                                        : parentItem
                                        ? `New Page inside "${parentItem.title}"`
                                        : 'New Page'}
                                </span>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 my-2">
                        {/* Icon Picker & Name Row */}
                        <div>
                            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                                Icon & Name
                            </label>
                            <div className="flex items-center gap-3">
                                {/* Emoji Picker Trigger Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(true)}
                                    className="w-12 h-12 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent-color)]/60 flex items-center justify-center text-2xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                                    title="Choose emoji"
                                >
                                    {selectedIcon}
                                </button>

                                {/* Name Input */}
                                <div className="flex-1">
                                    <Input
                                        autoFocus
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={defaultItemType === 'book' ? 'e.g. Distributed Compute Engine' : 'e.g. API Architecture Spec'}
                                        className="h-12 text-xs rounded-xl bg-[var(--bg-primary)] font-semibold border-[var(--border-color)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cover Custom Banner or Gradient Theme */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                    Cover Banner
                                </label>
                                {coverImage && (
                                    <button
                                        type="button"
                                        onClick={() => setCoverImage(null)}
                                        className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                        <span>Remove Image</span>
                                    </button>
                                )}
                            </div>

                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />

                            {/* If coverImage uploaded: Show Banner Preview */}
                            {coverImage ? (
                                <div className="relative h-20 w-full rounded-xl overflow-hidden border border-[var(--border-color)] group mb-3 shadow-sm">
                                    <img
                                        src={coverImage}
                                        alt="Cover preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-100 cursor-pointer shadow"
                                        >
                                            Change Image
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCoverImage(null)}
                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer shadow"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-11 mb-2.5 rounded-xl border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)]/60 bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Upload className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    <span>Upload Custom Banner Image</span>
                                </button>
                            )}

                            {/* Gradient Theme Selector Pills */}
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    {coverImage ? 'Fallback theme if image fails to load:' : 'Or choose a gradient pattern:'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {Object.values(COVER_THEMES).map((theme: CoverTheme) => (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        onClick={() => setSelectedTheme(theme.id)}
                                        style={theme.coverStyle}
                                        className={cn(
                                            'h-10 rounded-xl border relative transition-all flex flex-col items-center justify-center cursor-pointer',
                                            selectedTheme === theme.id
                                                ? 'border-white/90 ring-2 ring-[var(--accent-color)] scale-105 shadow-md'
                                                : 'border-[var(--border-color)] opacity-70 hover:opacity-100'
                                        )}
                                    >
                                        <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                                            {theme.name}
                                        </span>
                                        {selectedTheme === theme.id && (
                                            <Check className="w-3 h-3 text-white absolute top-1 right-1 drop-shadow" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Starter Template Selection (Only if Page) */}
                        {defaultItemType === 'page' && (
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
                                disabled={!name.trim()}
                                className="rounded-xl text-xs font-bold"
                            >
                                Create {defaultItemType === 'book' ? 'Notebook' : 'Page'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Floating Clean Emoji Picker Dialog — Zero Clipping, Zero Hidden Elements */}
            <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <DialogContent className="max-w-fit p-0 bg-transparent border-none shadow-2xl overflow-hidden rounded-2xl z-[9999]">
                    <DialogTitle className="sr-only">Choose an Emoji</DialogTitle>
                    <EmojiPicker
                        onSelect={(emoji) => {
                            setSelectedIcon(emoji);
                            setShowEmojiPicker(false);
                        }}
                        onClose={() => setShowEmojiPicker(false)}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    Save,
    Loader2,
    PanelRightClose,
    PanelRight,
    Download,
    Sparkles,
    Trash2,
    Calendar,
    X,
    FolderGit2,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Tooltip } from '../../../components/ui/tooltip';
import { BrainEditor } from '../editor/NotebookRichEditor';
import {
    Notebook,
    useNotebookStore,
    COVER_THEMES,
    DEFAULT_ICONS
} from '../../../store/notebook/useNotebookStore';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

// Auto-resizing textarea
const AutoResizeTextarea: React.FC<{
    value: string;
    onChange: (val: string) => void;
    maxLength?: number;
    placeholder?: string;
    rows?: number;
    className?: string;
}> = ({ value, onChange, maxLength, placeholder, rows = 2, className }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={rows}
            className={`w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] resize-none transition-all ${className}`}
        />
    );
};

interface PageEditorWorkspaceProps {
    page: Notebook;
    onBack: () => void;
}

export const PageEditorWorkspace: React.FC<PageEditorWorkspaceProps> = ({ page, onBack }) => {
    const { updateItem } = useNotebookStore();

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, []);

    // Handle Editor Content Change with Debounced Auto-save
    const handleEditorChange = useCallback(
        (content: any, html?: string, text?: string) => {
            setIsDirty(true);
            setIsSaving(true);

            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            autoSaveTimerRef.current = setTimeout(() => {
                let detectedTitle = page.title;
                if (html) {
                    const match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
                    if (match) {
                        const h1 = match[1].replace(/<[^>]+>/g, '').trim();
                        if (h1 && h1 !== 'Untitled' && h1 !== 'Untitled Document') {
                            detectedTitle = h1;
                        }
                    }
                }

                updateItem(page.id, {
                    content,
                    htmlContent: html,
                    textContent: text,
                    title: detectedTitle,
                });

                setIsSaving(false);
                setIsDirty(false);
            }, 600);
        },
        [page.id, page.title, updateItem]
    );

    const handleManualSave = () => {
        setIsSaving(true);
        updateItem(page.id, { updatedAt: Date.now() });
        setTimeout(() => {
            setIsSaving(false);
            setIsDirty(false);
        }, 400);
    };

    const handleExportMarkdown = () => {
        const content = page.textContent || `# ${page.title}\n\n${page.description || ''}`;
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleAddTag = () => {
        const val = tagInput.trim();
        if (!val || page.tags.includes(val) || page.tags.length >= 10) return;
        updateItem(page.id, { tags: [...page.tags, val] });
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        updateItem(page.id, { tags: page.tags.filter((t) => t !== tagToRemove) });
    };

    return (
        <div className="flex flex-1 overflow-hidden relative items-stretch h-full">
            {/* Center Rich Text Editor */}
            <main className="flex-1 bg-[var(--bg-primary)] transition-all duration-300 ease-in-out relative overflow-y-auto">
                {/* Editor Secondary Action Bar */}
                <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-md px-6 py-2 border-b border-[var(--border-color)]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Page Icon Picker Trigger */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
                                className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center text-base cursor-pointer transition-all"
                            >
                                {page.icon || '📑'}
                            </button>

                            {isIconPickerOpen && (
                                <div className="absolute top-10 left-0 z-50 p-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-wrap gap-1.5 w-52">
                                    {DEFAULT_ICONS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => {
                                                updateItem(page.id, { icon: emoji });
                                                setIsIconPickerOpen(false);
                                            }}
                                            className="w-7 h-7 rounded-lg text-sm hover:bg-[var(--bg-tertiary)] flex items-center justify-center cursor-pointer"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <span className="text-xs font-semibold text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-md">
                            {page.title}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Sync Status */}
                        <div className="flex items-center h-7 px-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                            <AnimatePresence mode="wait">
                                {isSaving || isDirty ? (
                                    <motion.div
                                        key="saving"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-1.5"
                                    >
                                        <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--accent-color)]" />
                                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Saving</span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="saved"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-1.5"
                                    >
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Saved</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <Tooltip title="Export Markdown" position="bottom">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleExportMarkdown}
                                className="h-7 w-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </Button>
                        </Tooltip>

                        <Tooltip title={sidebarOpen ? 'Hide Tools' : 'Show Tools'} position="bottom">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className={cn(
                                    'h-7 w-7 rounded-lg',
                                    sidebarOpen ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)]' : 'text-[var(--text-muted)]'
                                )}
                            >
                                {sidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* Rich BrainEditor */}
                <div className="mx-auto min-h-full max-w-[1100px] px-6 sm:px-12 pt-6 pb-40">
                    <BrainEditor
                        key={page.id}
                        initialContent={page.content}
                        onChange={handleEditorChange}
                        className="w-full"
                    />
                </div>
            </main>

            {/* Collapsible Page Tools Inspector */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-none bg-[var(--bg-secondary)]/50 backdrop-blur-md border-l border-[var(--border-color)] flex flex-col z-30 overflow-hidden"
                    >
                        <div className="p-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                <span>Page Blueprint</span>
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(false)}
                                className="h-6 w-6 rounded-lg text-[var(--text-muted)]"
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                    Page Title
                                </label>
                                <Input
                                    value={page.title}
                                    onChange={(e) => updateItem(page.id, { title: e.target.value })}
                                    className="h-8 text-xs font-semibold rounded-xl bg-[var(--bg-primary)]"
                                    placeholder="Page title..."
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                    Description
                                </label>
                                <AutoResizeTextarea
                                    value={page.description || ''}
                                    onChange={(val) => updateItem(page.id, { description: val })}
                                    maxLength={300}
                                    placeholder="Brief summary..."
                                    className="bg-[var(--bg-primary)]"
                                />
                            </div>

                            {/* AI Intent Blueprint */}
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-[var(--accent-color)]" />
                                    <span>AI Intent / Prompt Blueprint</span>
                                </label>
                                <AutoResizeTextarea
                                    value={page.aiIntent || ''}
                                    onChange={(val) => updateItem(page.id, { aiIntent: val })}
                                    maxLength={300}
                                    placeholder="Specific system instructions when querying this doc..."
                                    className="bg-[var(--bg-primary)]"
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                                    Tags
                                </label>
                                <div className="flex items-center gap-2 mb-2">
                                    <Input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                        placeholder="Add tag..."
                                        className="h-7 text-xs rounded-lg bg-[var(--bg-primary)]"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleAddTag}
                                        disabled={!tagInput.trim()}
                                        className="h-7 px-2.5 rounded-lg text-xs"
                                    >
                                        Add
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {page.tags?.map((tag) => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]"
                                        >
                                            #{tag}
                                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-rose-400 cursor-pointer">
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Telemetry card */}
                            <div className="p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] space-y-1.5 text-xs">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                                    Telemetry
                                </div>
                                <div className="flex items-center justify-between text-[var(--text-muted)]">
                                    <span>Characters:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{page.textContent?.length || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-[var(--text-muted)]">
                                    <span>Approx Tokens:</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{Math.ceil((page.textContent?.length || 0) / 4)}</span>
                                </div>
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </div>
    );
};

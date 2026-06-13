"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Brain, Activity, Save, Database, Hash, Sparkles, Wand2, Undo2, Redo2, RefreshCcw, Check, Clock, Loader2, PanelRightClose, PanelRight, FileText, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../Button";
import { Input } from "../Input";
import { BrainEditor } from "./editor/NotebookRichEditor";
import { useLayoutStore } from "../../../store/ui/useLayoutStore";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

const ScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={`overflow-auto ${className}`}>{children}</div>
);

// Auto-resizing textarea inline component
const AutoResizeTextarea = ({ value, onChange, maxLength, placeholder, rows = 1, className }: any) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
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
            className={`w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm shadow-sm placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] resize-none overflow-hidden ${className}`}
        />
    );
};

export const NotebookEditor = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    
    // Unified Shared States (Sidebar)
    const [description, setDescription] = useState("");
    const [aiIntent, setAiIntent] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    
    // Notebook specific state
    const [editorContent, setEditorContent] = useState<any>({
        type: "doc",
        content: [
            {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "" }]
            }
        ]
    });
    const [editorHtml, setEditorHtml] = useState<string>("");
    const [editorText, setEditorText] = useState<string>("");

    // UI States
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    let extractedTitle = "";
    if (editorHtml) {
        const match = editorHtml.match(/<h1[^>]*>(.*?)<\/h1>/);
        if (match) {
            extractedTitle = match[1].replace(/<[^>]+>/g, '').trim();
        } else {
            const plainText = editorHtml.replace(/<[^>]+>/g, '').trim();
            extractedTitle = plainText.substring(0, 50);
        }
    } else if (editorContent && editorContent.content) {
        const firstH1Node = editorContent.content.find((node: any) =>
            node.type === 'heading' && node.attrs?.level === 1
        );
        extractedTitle = firstH1Node?.content?.[0]?.text?.trim() || "";
    }

    if (!extractedTitle) {
        extractedTitle = "Untitled Notebook";
    }

    if (extractedTitle.length > 130) {
        extractedTitle = extractedTitle.substring(0, 127) + "...";
    }

    const isOverLimit = ((description?.length || 0) > 500) || ((aiIntent?.length || 0) > 350) || ((tags?.length || 0) > 12);
    const globalCharCount = editorText.length;

    const handleEditorChange = (content: any, html?: string, text?: string) => {
        setEditorContent(content);
        if (html !== undefined) setEditorHtml(html);
        if (text !== undefined) setEditorText(text);
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSyncing(true);
        // Mock save delay
        setTimeout(() => {
            setIsSyncing(false);
            setIsDirty(false);
            setUpdatedAt(new Date());
        }, 1000);
    };

    const addTag = () => {
        const val = tagInput.trim();
        if (tags.length >= 12) return;
        if (val && !tags.includes(val)) {
            setTags([...tags, val]);
            setTagInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden font-sans text-[var(--text-primary)] selection:bg-[var(--accent-color)]/30">
            {/* 💎 Premium Sticky Header */}
            <header className="flex-none h-14 bg-[var(--bg-primary)]/70 backdrop-blur-xl border-b border-[var(--border-color)] px-6 flex items-center justify-between z-50 sticky top-0" style={{ borderStyle: 'var(--border-style)' }}>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => useLayoutStore.setState({ activeView: 'chat' })}
                            className="h-8 w-8 rounded-full transition-all active:scale-95"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="h-4 w-[1px] bg-[var(--border-color)] mr-1" />
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-tight uppercase text-[var(--text-muted)]">
                            <span className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">Notebooks</span>
                            <span>/</span>
                            <span className="text-[var(--text-primary)] uppercase">New Notebook</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-colors"
                            onClick={() => document.dispatchEvent(new CustomEvent('editor-undo'))}
                        >
                            <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-colors"
                            onClick={() => document.dispatchEvent(new CustomEvent('editor-redo'))}
                        >
                            <Redo2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center self-center h-8 px-3 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all">
                        <AnimatePresence mode="wait">
                            {(isSyncing || isDirty) ? (
                                <motion.div
                                    key="syncing"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="flex items-center gap-2"
                                >
                                    <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--accent-color)]" />
                                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">Syncing...</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="synced"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="flex items-center gap-2 pr-1"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 bg-[var(--text-muted)]"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--text-muted)]"></span>
                                        </div>
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">Draft</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-4 w-[1px] bg-[var(--border-color)]" />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={cn(
                            "h-8 px-2.5 text-xs font-semibold rounded-lg border border-transparent transition-all active:scale-95 flex items-center gap-2",
                            sidebarOpen ? "bg-[var(--bg-secondary)]" : "text-[var(--text-muted)]"
                        )}
                    >
                        {sidebarOpen ? <PanelRightClose className="w-3.5 h-3.5 opacity-80" /> : <PanelRight className="w-3.5 h-3.5 opacity-80" />}
                        <span className="text-[10px] uppercase tracking-wider font-bold">
                            {sidebarOpen ? "Hide Tools" : "Show Tools"}
                        </span>
                    </Button>

                    <div className="h-4 w-[1px] bg-[var(--border-color)]" />

                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isOverLimit}
                        className={cn(
                            "h-8 px-4 text-xs font-bold transition-all active:scale-95 rounded-lg",
                            isOverLimit ? "opacity-50 cursor-not-allowed" : ""
                        )}
                    >
                        <Save className="w-3.5 h-3.5 mr-2" />
                        Save Notebook
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative items-stretch">
                <main className="flex-1 bg-[var(--bg-primary)] transition-all duration-300 ease-in-out relative overflow-hidden">
                    <ScrollArea className="h-full w-full">
                        <div className="mx-auto min-h-full max-w-[1200px] px-12 pt-2 pb-40">
                            <BrainEditor
                                initialContent={editorContent}
                                onChange={handleEditorChange}
                                className="w-full"
                            />
                        </div>
                    </ScrollArea>
                </main>

                {/* 🤖 Simplified Right Sidebar */}
                <aside
                    className={cn(
                        "flex-none w-[360px] bg-[var(--bg-tertiary)]/20 border-l border-[var(--border-color)] flex flex-col transition-all duration-300 ease-in-out z-40 overflow-hidden",
                        !sidebarOpen ? "mr-[-360px] opacity-0 pointer-events-none" : "mr-0 opacity-100"
                    )}
                >
                    <ScrollArea className="h-full w-full">
                        <div className="flex-1 p-8 space-y-12">
                            {/* 📝 Automatic Title Section */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                    <Brain className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    Title
                                </h3>
                                <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm flex items-center group transition-all duration-300 p-4 min-h-[50px]">
                                    <p className={cn(
                                        "text-sm font-bold leading-tight",
                                        extractedTitle ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]/60 font-medium"
                                    )}>
                                        {extractedTitle || "Notebook Title..."}
                                    </p>
                                </div>
                            </section>

                            {/* 📖 Description Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                        <Database className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                        Description
                                    </h3>
                                    <span className={cn("text-[9px] font-bold tracking-tight uppercase", description.length >= 480 ? "text-red-500" : "text-[var(--text-muted)]")}>
                                        {description.length}/500 chars
                                    </span>
                                </div>
                                <AutoResizeTextarea
                                    value={description}
                                    onChange={setDescription}
                                    maxLength={500}
                                    placeholder="Add a brief description..."
                                    className="min-h-[60px]"
                                />
                            </section>

                            {/* 🧞 AI Intent Context Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                        <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                                        AI Intent / Context
                                    </h3>
                                    <span className={cn("text-[9px] font-bold tracking-tight uppercase", aiIntent.length >= 325 ? "text-red-500" : "text-[var(--text-muted)]")}>
                                        {aiIntent.length}/350 chars
                                    </span>
                                </div>
                                <AutoResizeTextarea
                                    value={aiIntent}
                                    onChange={setAiIntent}
                                    maxLength={350}
                                    rows={2}
                                    placeholder="Explain how the AI should use this info..."
                                    className="min-h-[60px]"
                                />
                            </section>

                            {/* 🏷️ Interactive Tags Section */}
                            <section className="space-y-4 pb-10">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                        <Hash className="w-3.5 h-3.5" />
                                        Brain Tags
                                        <span className={cn("ml-2 text-[9px]", tags.length >= 10 ? "text-red-500" : "text-[var(--text-muted)]")}>
                                            ({tags.length}/12)
                                        </span>
                                    </h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        <AnimatePresence>
                                            {tags.map((tag) => (
                                                <motion.div key={tag} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                                                    <div className="px-3 py-1 bg-[var(--bg-secondary)] border-[var(--border-color)] border rounded-full text-xs font-medium flex items-center gap-2 group hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-colors cursor-pointer" onClick={() => removeTag(tag)}>
                                                        {tag}
                                                        <span className="opacity-40 group-hover:opacity-100 text-[10px]">✕</span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    {tags.length < 12 ? (
                                        <div className="relative group">
                                            <Input
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                                placeholder="Add a tag..."
                                            />
                                            <div className="absolute right-3 top-5 -translate-y-1/2">
                                                <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[8px] text-[var(--text-muted)]">Enter</kbd>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-lg border border-dashed border-red-500/30 bg-red-500/5 text-center">
                                            <p className="text-[10px] font-bold text-red-500 uppercase">Limit Reached</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                                <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                    Document Insights
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                <FileText className="w-2.5 h-2.5 text-blue-500" />
                                            </div>
                                            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tight">Overall</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <p className="text-xl font-bold">{globalCharCount}</p>
                                            <span className="text-[10px] text-[var(--text-muted)] font-medium">chars</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center">
                                                <Zap className="w-2.5 h-2.5 text-purple-500" />
                                            </div>
                                            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tight">Context</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <p className="text-xl font-bold">{Math.ceil(globalCharCount / 4)}</p>
                                            <span className="text-[10px] text-[var(--text-muted)] font-medium">tokens</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                                <div className="p-5 rounded-3xl bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] space-y-4 backdrop-blur-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider flex items-center gap-2">
                                            <RefreshCcw className="w-3 h-3 opacity-60" /> Last Sync
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                                            (isSyncing || isDirty) ? "text-blue-500 bg-blue-500/5 border-blue-500/10 animate-pulse" : "text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                                        )}>
                                            {(isSyncing || isDirty) ? 'Syncing...' : (updatedAt ? `${updatedAt.toLocaleDateString()} • ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Draft')}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
                </aside>
            </div>
        </div>
    );
};

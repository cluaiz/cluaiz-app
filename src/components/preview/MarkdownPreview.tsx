import React, { useState, useEffect } from 'react';
import { Eye, Code, BookOpen, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { CodeEditor } from '../ui/CodeEditor/CodeEditor';

interface MarkdownPreviewProps {
    filePath?: string;
    fileName: string;
    content: string;
    onChange?: (val: string) => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
    filePath,
    fileName,
    content,
    onChange
}) => {
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
    const [floatingAction, setFloatingAction] = useState<{ x: number; y: number; text: string } | null>(null);

    const handleMouseUp = () => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const text = selection.toString().trim();
            if (text.length > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setFloatingAction({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    text
                });
                return;
            }
        }
        setFloatingAction(null);
    };

    useEffect(() => {
        const handleMouseDownOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.ask-ai-floating-popover')) {
                setFloatingAction(null);
            }
        };
        document.addEventListener('mousedown', handleMouseDownOutside);
        return () => document.removeEventListener('mousedown', handleMouseDownOutside);
    }, []);

    const handleAskAi = () => {
        if (!floatingAction) return;
        document.dispatchEvent(new CustomEvent('insert-chat-context', {
            detail: {
                path: filePath || fileName,
                name: fileName,
                selectedText: floatingAction.text,
                language: 'markdown'
            }
        }));
        setFloatingAction(null);
        window.getSelection()?.removeAllRanges();
    };

    return (
        <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] font-sans overflow-hidden relative">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] px-4 flex items-center justify-between flex-shrink-0 select-none">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[var(--accent-color)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[250px]">{fileName}</span>
                    <span className="text-[10px] font-mono text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded border border-[var(--accent-color)]/20">
                        {viewMode === 'preview' ? 'Preview' : 'Code'}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-color)]">
                        <button
                            type="button"
                            onClick={() => setViewMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                                viewMode === 'preview' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            <span>Preview</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('code')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                                viewMode === 'code' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Code className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Code</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Rendered View or Live Monaco Code Editor */}
            <div className="flex-1 overflow-hidden relative select-text" onMouseUp={handleMouseUp}>
                {viewMode === 'preview' ? (
                    <div className="h-full w-full overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-primary)] select-text">
                        <div className="max-w-7xl mx-auto select-text">
                            <MarkdownRenderer content={content} />
                        </div>
                    </div>
                ) : (
                    <CodeEditor
                        value={content}
                        language="markdown"
                        filePath={filePath}
                        fileName={fileName}
                        onChange={(newVal) => onChange?.(newVal)}
                        height="100%"
                        className="h-full border-0 rounded-none shadow-none"
                        showToolbar={false}
                    />
                )}
            </div>

            {/* Floating Selection "Ask AI" Popover */}
            {floatingAction && (
                <div
                    className="ask-ai-floating-popover fixed z-[100] -translate-x-1/2 -translate-y-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl p-1 flex items-center gap-1 backdrop-blur-md"
                    style={{ left: floatingAction.x, top: floatingAction.y }}
                >
                    <button
                        type="button"
                        onClick={handleAskAi}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-[var(--accent-color)] text-white hover:opacity-90 transition-all cursor-pointer shadow-xs"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ask AI</span>
                    </button>
                </div>
            )}
        </div>
    );
};

import React, { useState } from 'react';
import { Eye, Code, BookOpen } from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { CodeEditor } from '../ui/CodeEditor/CodeEditor';

interface MarkdownPreviewProps {
    fileName: string;
    content: string;
    onChange?: (val: string) => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
    fileName,
    content,
    onChange
}) => {
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

    return (
        <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] select-none font-sans overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] px-4 flex items-center justify-between flex-shrink-0">
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
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'preview' ? (
                    <div className="h-full w-full overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-primary)]">
                        <div className="max-w-7xl mx-auto">
                            <MarkdownRenderer content={content} />
                        </div>
                    </div>
                ) : (
                    <CodeEditor
                        value={content}
                        language="markdown"
                        onChange={(newVal) => onChange?.(newVal)}
                        height="100%"
                        className="h-full border-0 rounded-none shadow-none"
                        showToolbar={false}
                    />
                )}
            </div>
        </div>
    );
};

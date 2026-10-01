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
        <div className="h-full w-full flex flex-col bg-[#0d1117] select-none font-sans overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-white/[0.08] bg-zinc-950/80 px-4 flex items-center justify-between flex-shrink-0 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-zinc-200 truncate max-w-[250px]">{fileName}</span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        {viewMode === 'preview' ? 'Preview' : 'Code'}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/5">
                        <button
                            type="button"
                            onClick={() => setViewMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                                viewMode === 'preview' ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Preview</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setViewMode('code')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                                viewMode === 'code' ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-zinc-400 hover:text-white'
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
                        <div className="max-w-4xl mx-auto">
                            <MarkdownRenderer content={content} />
                        </div>
                    </div>
                ) : (
                    <CodeEditor
                        value={content}
                        language="markdown"
                        onChange={(newVal) => onChange?.(newVal)}
                        height="100%"
                        className="h-full border-0"
                        showToolbar={false}
                    />
                )}
            </div>
        </div>
    );
};

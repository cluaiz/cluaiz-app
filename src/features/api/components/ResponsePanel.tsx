import React, { useState } from 'react';
import { useApiStore } from '../../../store/api/useApiStore';
import { AudioVisualizer } from './AudioVisualizer';
import { ResponsePreview } from './ResponsePreview';
import { 
    Check, 
    Copy, 
    Terminal, 
    Volume2, 
    Clock, 
    HardDrive, 
    Eye,
    Columns2,
    Rows2
} from 'lucide-react';

export const ResponsePanel: React.FC = () => {
    const {
        responseBody,
        responseMetrics,
        audioData,
        activeResTab,
        setActiveResTab,
        layoutOrientation,
        setLayoutOrientation
    } = useApiStore();

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(responseBody);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getStatusStyle = (status: number) => {
        if (status >= 200 && status < 300) {
            return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        }
        if (status >= 400 && status < 500) {
            return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        }
        if (status >= 500) {
            return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        }
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    };

    return (
        <div className="flex flex-col h-full w-full bg-[var(--bg-primary)] overflow-hidden">
            {/* Header / Metrics Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none flex-wrap gap-2">
                {/* Left: Title & Subtabs */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <Terminal className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span>Response Output</span>
                    </div>

                    <div className="flex items-center gap-1 ml-2 bg-[var(--bg-primary)] p-0.5 rounded-md border border-[var(--border-color)]">
                        <button
                            type="button"
                            onClick={() => setActiveResTab('json')}
                            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                                activeResTab === 'json'
                                    ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] font-semibold'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            JSON / Raw
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveResTab('preview')}
                            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                                activeResTab === 'preview'
                                    ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] font-semibold'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Eye className="w-3 h-3 text-[var(--accent-color)]" />
                            <span>Preview</span>
                        </button>

                        {audioData && (
                            <button
                                type="button"
                                onClick={() => setActiveResTab('audio')}
                                className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                                    activeResTab === 'audio'
                                        ? 'bg-purple-500/20 text-purple-400 font-semibold'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }}`}
                            >
                                <Volume2 className="w-3 h-3" />
                                <span>Audio Synth</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Metrics, Layout Controls & Actions */}
                <div className="flex items-center gap-2 text-xs font-mono">
                    {/* Layout Orientation Controls (Bottom vs Right Side-by-Side) */}
                    <div 
                        className="flex items-center gap-0.5 bg-[var(--bg-primary)] p-0.5 rounded border border-[var(--border-color)]"
                        title="Toggle layout orientation (Right vs Bottom split)"
                    >
                        <button
                            type="button"
                            onClick={() => setLayoutOrientation('bottom')}
                            title="Bottom Split (Top Editor / Bottom Response)"
                            className={`p-1 rounded cursor-pointer transition-colors ${
                                layoutOrientation === 'bottom'
                                    ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] font-bold'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Rows2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLayoutOrientation('right')}
                            title="Right Split (Left Editor / Right Response Side-by-side)"
                            className={`p-1 rounded cursor-pointer transition-colors ${
                                layoutOrientation === 'right'
                                    ? 'bg-[var(--accent-color)]/20 text-[var(--accent-color)] font-bold'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            <Columns2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {responseMetrics && (
                        <>
                            {/* Status Code */}
                            <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getStatusStyle(
                                    responseMetrics.status
                                )}`}
                            >
                                {responseMetrics.status ? `${responseMetrics.status} ${responseMetrics.statusText}` : responseMetrics.statusText}
                            </span>

                            {/* Latency / TTFT */}
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-muted)] text-[11px]">
                                <Clock className="w-3 h-3 text-[var(--accent-color)]" />
                                <span>
                                    {responseMetrics.ttft
                                        ? `TTFT: ${responseMetrics.ttft}`
                                        : `${responseMetrics.timeMs} ms`}
                                </span>
                            </div>

                            {/* Size */}
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-muted)] text-[11px]">
                                <HardDrive className="w-3 h-3 text-[var(--accent-color)]" />
                                <span>
                                    {responseMetrics.sizeBytes < 1024
                                        ? `${responseMetrics.sizeBytes} B`
                                        : `${(responseMetrics.sizeBytes / 1024).toFixed(1)} KB`}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Copy Button */}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors cursor-pointer"
                        title="Copy response body"
                    >
                        {copied ? (
                            <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-[10px] text-emerald-400 font-sans">Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px] font-sans">Copy</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Body View */}
            <div className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
                {activeResTab === 'audio' && audioData ? (
                    <div className="h-full p-3 overflow-auto custom-scrollbar">
                        <AudioVisualizer audioBase64={audioData} />
                    </div>
                ) : activeResTab === 'preview' ? (
                    <ResponsePreview content={responseBody} />
                ) : (
                    <div className="h-full p-3 overflow-auto custom-scrollbar">
                        <pre className="h-full m-0 p-3 text-xs font-mono leading-relaxed rounded-lg bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] text-[var(--text-primary)] overflow-auto custom-scrollbar select-text">
                            <code>{responseBody}</code>
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

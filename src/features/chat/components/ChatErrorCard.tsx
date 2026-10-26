import React, { useState } from 'react';
import { AlertCircle, RotateCcw, ChevronDown, ChevronRight, WifiOff } from 'lucide-react';

interface ChatErrorCardProps {
    errorText: string;
    hasPartialContent?: boolean;
    onRetry?: () => void;
    className?: string;
}

export const ChatErrorCard: React.FC<ChatErrorCardProps> = ({
    errorText,
    hasPartialContent = false,
    onRetry,
    className = ''
}) => {
    const [showDetails, setShowDetails] = useState(false);

    // Clean up raw error text: remove "Request failed:" and completely sanitize any exposed URLs
    const rawCleaned = errorText.replace(/^Request failed:\s*/i, '').trim();
    const isConnectionError = rawCleaned.toLowerCase().includes('engine connection failed') ||
        rawCleaned.toLowerCase().includes('failed to fetch') ||
        rawCleaned.toLowerCase().includes('connection refused');

    // Strip internal URLs, hostnames, ports and paths (e.g. "(http://127.0.0.1:8000/health)")
    const sanitizedError = rawCleaned
        .replace(/\s*\(\s*https?:\/\/[^\s)]+\s*\)/gi, '')
        .replace(/https?:\/\/[^\s)]+/gi, '')
        .replace(/\s*:\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const title = isConnectionError
        ? (hasPartialContent ? 'Engine Connection Interrupted' : 'Engine Connection Failed')
        : (hasPartialContent ? 'Generation Interrupted' : 'Request Failed');

    const summary = isConnectionError
        ? 'Could not connect to the local Cluaiz Engine. Please ensure the engine is running and reachable.'
        : 'An error occurred while generating the response.';

    return (
        <div
            className={`w-full max-w-xl my-2 p-0 bg-transparent select-text text-left transition-all duration-200 ${className}`}
        >
            <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 shrink-0 mt-0.5">
                    {isConnectionError ? <WifiOff className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                            {title}
                        </h4>
                    </div>

                    <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                        {summary}
                    </p>

                    {/* Expandable Technical Diagnostics (zero URL exposure) */}
                    {sanitizedError && (
                        <div className="mt-2">
                            <button
                                type="button"
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer select-none font-mono"
                            >
                                {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <span>{showDetails ? 'Hide details' : 'View diagnostics'}</span>
                            </button>

                            {showDetails && (
                                <div className="mt-1.5 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]/50 text-[11px] font-mono text-red-400/90 break-words break-all leading-tight">
                                    {sanitizedError}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Bar with Sidebar Tab Style Button */}
                    {onRetry && (
                        <div className="mt-3 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/25 active:scale-95 text-xs font-semibold transition-all cursor-pointer shadow-[0_0_12px_var(--accent-color)]/10"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{hasPartialContent ? 'Resume Generating' : 'Retry Request'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

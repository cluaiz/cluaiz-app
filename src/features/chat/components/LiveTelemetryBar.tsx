import React, { useState, useRef, useEffect } from 'react';
import { ContextWindowPopover } from './ContextWindowPopover';
import { ContextBreakdown, LivePerformanceStats, formatTokensK } from '../hooks/useChatTelemetry';

interface LiveTelemetryBarProps {
    breakdown: ContextBreakdown | null;
    liveStats: LivePerformanceStats;
}

export const LiveTelemetryBar: React.FC<LiveTelemetryBarProps> = ({
    breakdown,
    liveStats
}) => {
    const [isPinned, setIsPinned] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalLimit = breakdown?.total_context_limit || 32768;
    const totalActive = breakdown?.total_active_tokens || 0;
    const activePct = breakdown?.active_percentage || (totalLimit > 0 ? Math.round((totalActive / totalLimit) * 100) : 0);

    const isOpen = isPinned || isHovered;

    // Handle outside click to unpin / close modal
    useEffect(() => {
        if (!isPinned) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsPinned(false);
                setIsHovered(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isPinned]);

    return (
        <div 
            className="relative z-30 flex items-center justify-between px-2.5 py-0.5 text-xs text-[var(--text-muted)] select-none font-mono"
            style={{ fontSize: '0.72rem' }}
        >
            {/* Left: Real-time generation performance stats (Visible ONLY during active streaming, hidden when idle) */}
            <div className="flex items-center gap-3 min-h-[0.9rem]">
                {liveStats.isStreaming && (
                    <div className="flex items-center gap-2.5 text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                            <b className="text-[var(--text-primary)] font-semibold">{liveStats.tps}</b> TPS
                        </span>
                        <span className="flex items-center gap-1">
                            <b className="text-[var(--text-primary)] font-semibold">{liveStats.elapsed}</b>s
                        </span>
                        <span className="flex items-center gap-1">
                            <b className="text-[var(--text-primary)] font-semibold">{liveStats.ttft}</b>s TTFT
                        </span>
                        <span className="flex items-center gap-1">
                            <b className="text-[var(--text-primary)] font-semibold">{liveStats.tokens}</b> Tokens
                        </span>
                    </div>
                )}
            </div>

            {/* Right: Interactive Context Window Trigger & Popover */}
            <div 
                ref={containerRef}
                className="relative z-50 flex items-center gap-2"
                onMouseEnter={() => { if (!isPinned) setIsHovered(true); }}
                onMouseLeave={() => { if (!isPinned) setIsHovered(false); }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setIsPinned(prev => !prev);
                    }}
                    className={`flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer py-0.5 px-1.5 rounded ${
                        isOpen ? 'bg-white/[0.08] text-[var(--text-primary)]' : 'hover:bg-white/[0.04]'
                    }`}
                    title="Active safe context allocation (hardware-clamped to prevent OOM crash)"
                >
                    <span>Context:</span>{' '}
                    <b className="text-[var(--text-primary)] font-semibold">{formatTokensK(totalActive)}</b> /{' '}
                    <span className="text-[var(--text-muted)]">{formatTokensK(totalLimit)}</span>{' '}
                    <span className="text-[var(--text-muted)] opacity-80">({activePct}%)</span>
                </button>

                {/* Popover */}
                <ContextWindowPopover
                    isOpen={isOpen}
                    onClose={() => {
                        setIsPinned(false);
                        setIsHovered(false);
                    }}
                    breakdown={breakdown}
                    isPinned={isPinned}
                />
            </div>
        </div>
    );
};

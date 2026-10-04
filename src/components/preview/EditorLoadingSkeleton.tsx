import React from 'react';
import { Loader2 } from 'lucide-react';

interface EditorLoadingSkeletonProps {
    fileName?: string;
}

export const EditorLoadingSkeleton: React.FC<EditorLoadingSkeletonProps> = ({ fileName }) => {
    // Generate realistic code skeleton line widths
    const skeletonLines = [
        'w-1/3', 'w-1/2', 'w-2/3', 'w-1/4', 'w-3/4', 'w-1/2', 'w-5/6', 'w-1/3',
        'w-2/5', 'w-3/5', 'w-1/2', 'w-4/5', 'w-1/4', 'w-2/3', 'w-3/4', 'w-1/2'
    ];

    return (
        <div className="h-full w-full bg-[var(--bg-primary)] flex flex-col font-mono text-xs select-none overflow-hidden relative">
            {/* Top Loading Indicator Badge */}
            <div className="h-7 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 flex items-center justify-between text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-[var(--accent-color)] animate-spin" />
                    <span className="text-[11px] text-[var(--text-primary)]">
                        Loading {fileName || 'file'}...
                    </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">Syncing disk</span>
            </div>

            {/* Shimmer Lines */}
            <div className="p-4 space-y-2.5 overflow-hidden animate-pulse">
                {skeletonLines.map((widthClass, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                        <span className="w-6 text-right text-[11px] text-[var(--text-muted)]/50 select-none">
                            {idx + 1}
                        </span>
                        <div className={`h-3.5 rounded bg-[var(--border-color)]/60 ${widthClass}`} />
                    </div>
                ))}
            </div>
        </div>
    );
};

import React from 'react';
import { Tooltip } from './tooltip';

export interface ResizableDividerProps {
    onMouseDown: (e: React.MouseEvent) => void;
    className?: string;
    /** Optional center action button (e.g. swap layout, toggle collapse) */
    centerAction?: {
        icon: React.ReactNode;
        tooltip: string;
        onClick: (e: React.MouseEvent) => void;
    };
    title?: string;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
    onMouseDown,
    className = '',
    centerAction,
    title = 'Drag to resize'
}) => {
    return (
        <div
            className={`w-2 h-full cursor-col-resize relative select-none flex-shrink-0 group z-20 ${className}`}
            onMouseDown={onMouseDown}
            title={centerAction ? undefined : title}
        >
            {/* Visual subtle divider line that glows on hover */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-[var(--border-color)] group-hover:bg-[var(--accent-color)] group-hover:shadow-[0_0_6px_var(--accent-color)] transition-all duration-150 pointer-events-none" />

            {/* Optional center action button (e.g. swap layout), visible strictly on hover */}
            {centerAction && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-150 pointer-events-auto">
                    <Tooltip title={centerAction.tooltip} position="top">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                centerAction.onClick(e);
                            }}
                            className="p-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)] shadow-md transition-all cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95"
                        >
                            {centerAction.icon}
                        </button>
                    </Tooltip>
                </div>
            )}
        </div>
    );
};

ResizableDivider.displayName = 'ResizableDivider';

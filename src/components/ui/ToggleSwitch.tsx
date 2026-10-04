import React from 'react';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

import { Loader2 } from 'lucide-react';

export interface ToggleSwitchProps {
    active: boolean;
    onToggle?: () => void;
    size?: 'sm' | 'md';
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    id?: string;
    'aria-label'?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    active,
    onToggle,
    size = 'md',
    className,
    disabled = false,
    loading = false,
    id,
    'aria-label': ariaLabel,
}) => {
    const isSm = size === 'sm';
    const isBlocked = disabled || loading;
    return (
        <div
            id={id}
            role="switch"
            aria-checked={active}
            aria-label={ariaLabel}
            tabIndex={isBlocked ? -1 : 0}
            onClick={(e) => {
                e.stopPropagation();
                if (!isBlocked) onToggle?.();
            }}
            onKeyDown={(e) => {
                if (!isBlocked && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle?.();
                }
            }}
            className={cn(
                isSm 
                    ? "w-[34px] h-[19px] p-[2px]" 
                    : "w-[44px] h-[24px] p-[3px]",
                "rounded-full flex items-center transition-all duration-200 shrink-0 select-none",
                isBlocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                active
                    ? "bg-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-[0_0_12px_var(--accent-color)]/20"
                    : "bg-white/10 border border-white/10 hover:bg-white/15",
                className
            )}
        >
            <div
                className={cn(
                    isSm ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]",
                    "rounded-full shadow-md transition-transform duration-200 flex items-center justify-center",
                    active 
                        ? (isSm ? "translate-x-[15px] bg-[var(--bg-primary)]" : "translate-x-[20px] bg-[var(--bg-primary)]") 
                        : "translate-x-0 bg-zinc-400"
                )}
            >
                {loading && (
                    <Loader2 className={cn("animate-spin text-zinc-600", isSm ? "w-2.5 h-2.5" : "w-3 h-3")} />
                )}
            </div>
        </div>
    );
};

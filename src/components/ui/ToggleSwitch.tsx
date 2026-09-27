import React from 'react';

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export interface ToggleSwitchProps {
    active: boolean;
    onToggle?: () => void;
    size?: 'sm' | 'md';
    className?: string;
    disabled?: boolean;
    id?: string;
    'aria-label'?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    active,
    onToggle,
    size = 'md',
    className,
    disabled = false,
    id,
    'aria-label': ariaLabel,
}) => {
    const isSm = size === 'sm';
    return (
        <div
            id={id}
            role="switch"
            aria-checked={active}
            aria-label={ariaLabel}
            tabIndex={disabled ? -1 : 0}
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onToggle?.();
            }}
            onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
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
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                active
                    ? "bg-[var(--accent-color)] border border-[var(--accent-color)]/30 shadow-[0_0_12px_var(--accent-color)]/20"
                    : "bg-white/10 border border-white/10 hover:bg-white/15",
                className
            )}
        >
            <div
                className={cn(
                    isSm ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]",
                    "rounded-full shadow-md transition-transform duration-200",
                    active 
                        ? (isSm ? "translate-x-[15px] bg-[var(--bg-primary)]" : "translate-x-[20px] bg-[var(--bg-primary)]") 
                        : "translate-x-0 bg-zinc-400"
                )}
            />
        </div>
    );
};

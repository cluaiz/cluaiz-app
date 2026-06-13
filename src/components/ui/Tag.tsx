import React from 'react';

export interface TagProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    name?: string;
    children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLButtonElement, TagProps>(
    ({ className = '', active = false, name = 'default', children, ...props }, ref) => {
        const baseClass = "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide transition-all duration-200 whitespace-nowrap active:scale-95 border cursor-pointer";

        // Active vs Inactive styles - active tags use the dynamic accent color variables
        const activeClass = active
            ? "text-[var(--accent-color)] bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]";

        return (
            <button
                ref={ref}
                className={`${baseClass} ${activeClass} ${className}`}
                style={{
                    borderStyle: active ? 'solid' : 'var(--border-style)',
                }}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Tag.displayName = 'Tag';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'cyber' | 'pixel';
    children?: React.ReactNode;
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
    const baseClass = "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider select-none";

    const variants = {
        default: "border-transparent bg-[var(--accent-color)] text-[var(--bg-primary)] font-black",
        secondary: "border-transparent bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
        destructive: "border-transparent bg-red-600/20 text-red-500 border border-red-500/25",
        outline: "border-[var(--border-color)] text-[var(--text-primary)]",
        cyber: "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--accent-color)] font-mono",
        pixel: "border-double border-4 border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono"
    };

    const classes = `${baseClass} ${variants[variant]} ${className}`;
    const isPixelOrCyber = variant === 'pixel' || variant === 'cyber';

    return (
        <div
            className={classes}
            style={{
                borderRadius: isPixelOrCyber ? '0px' : undefined,
                borderStyle: variant === 'pixel' ? 'double' : 'var(--border-style)',
                borderColor: 'var(--border-color)'
            }}
            {...props}
        >
            {children}
        </div>
    );
}

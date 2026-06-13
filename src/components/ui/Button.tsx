import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'cyber' | 'pixel';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
        const baseClass = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-bold tracking-wide transition-all outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none border border-transparent cursor-pointer";

        const variants = {
            default: "bg-[var(--accent-color)] text-[var(--bg-primary)] hover:bg-[var(--accent-color)]/90 font-extrabold shadow-[0_0_6px_var(--accent-glow)]",
            destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
            outline: "border-[var(--border-color)] bg-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--text-muted)]",
            secondary: "bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
            ghost: "hover:bg-[var(--bg-tertiary)]/75 text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            link: "text-[var(--accent-color)] underline-offset-4 hover:underline bg-transparent border-none p-0 h-auto",
            cyber: "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--accent-color)] hover:text-white hover:bg-[var(--accent-color)]/25 hover:border-[var(--accent-color)] hover:shadow-[0_0_8px_var(--accent-glow)] font-mono",
            pixel: "border-double border-4 border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-mono uppercase"
        };

        const sizes = {
            default: "h-9 px-4 py-2",
            sm: "h-8 rounded px-3 text-[10px]",
            lg: "h-10 rounded px-6 text-sm",
            icon: "h-9 w-9 p-0"
        };

        const classes = `${baseClass} ${variants[variant]} ${sizes[size]} ${className}`;
        const isPixelOrCyber = variant === 'pixel' || variant === 'cyber';

        return (
            <button
                ref={ref}
                className={classes}
                style={{
                    borderRadius: isPixelOrCyber ? '0px' : 'var(--radius-base)',
                    borderStyle: variant === 'pixel' ? 'double' : 'var(--border-style)'
                }}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

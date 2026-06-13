import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', error, ...props }, ref) => {
        return (
            <div className="w-full relative">
                <input
                    ref={ref}
                    className={`flex h-9 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-color)] disabled:cursor-not-allowed disabled:opacity-50 ${
                        error ? 'border-red-500 focus-visible:ring-red-500' : ''
                    } ${className}`}
                    {...props}
                />
                {error && <span className="absolute -bottom-5 left-0 text-[10px] text-red-500">{error}</span>}
            </div>
        );
    }
);

Input.displayName = "Input";

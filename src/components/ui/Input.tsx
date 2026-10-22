import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    leftIcon?: React.ReactNode;
    rightElement?: React.ReactNode;
    sizeVariant?: 'sm' | 'default' | 'lg';
    wrapperClassName?: string;
}

const sizeClasses: Record<NonNullable<InputProps['sizeVariant']>, string> = {
    sm: 'h-8 text-xs py-1',
    default: 'h-9 text-xs py-1.5',
    lg: 'h-10 text-sm py-2'
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', wrapperClassName = '', error, leftIcon, rightElement, sizeVariant = 'default', ...props }, ref) => {
        return (
            <div className={`w-full relative flex items-center ${wrapperClassName}`}>
                {leftIcon && (
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] flex items-center justify-center shrink-0">
                        {leftIcon}
                    </div>
                )}
                <input
                    ref={ref}
                    className={`ui-input ${sizeClasses[sizeVariant]} ${leftIcon ? 'pl-8' : ''} ${rightElement ? 'pr-8' : ''} ${error ? 'ui-input-error' : ''} ${className}`}
                    {...props}
                />
                {rightElement && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center shrink-0">
                        {rightElement}
                    </div>
                )}
                {error && <span className="absolute -bottom-5 left-0 text-[10px] text-red-500 font-medium">{error}</span>}
            </div>
        );
    }
);

Input.displayName = "Input";


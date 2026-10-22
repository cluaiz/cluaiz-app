import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'cyber' | 'pixel';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    children?: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    default: 'ui-btn-primary',
    destructive: 'ui-btn-destructive',
    outline: 'ui-btn-outline',
    secondary: 'ui-btn-secondary',
    ghost: 'ui-btn-ghost',
    link: 'ui-btn-link',
    cyber: 'ui-btn-cyber',
    pixel: 'ui-btn-pixel'
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
    default: 'ui-btn-md',
    sm: 'ui-btn-sm',
    lg: 'ui-btn-lg',
    icon: 'ui-btn-icon'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
        const classes = `ui-btn ${variantClasses[variant] || 'ui-btn-primary'} ${sizeClasses[size] || 'ui-btn-md'} ${className}`;

        return (
            <button
                ref={ref}
                className={classes}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

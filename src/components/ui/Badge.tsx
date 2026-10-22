import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'cyber' | 'pixel';
    children?: React.ReactNode;
}

const badgeVariantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: 'ui-badge-primary',
    secondary: 'ui-badge-secondary',
    destructive: 'ui-badge-destructive',
    outline: 'ui-badge-outline',
    cyber: 'ui-badge-cyber',
    pixel: 'ui-badge-pixel'
};

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
    const variantClass = badgeVariantClasses[variant] || 'ui-badge-primary';

    return (
        <div
            className={`ui-badge ${variantClass} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

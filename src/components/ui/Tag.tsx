import React from 'react';

export interface TagProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active?: boolean;
    name?: string;
    children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLButtonElement, TagProps>(
    ({ className = '', active = false, name = 'default', children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`ui-tag ${active ? 'ui-tag-active' : ''} ${className}`}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Tag.displayName = 'Tag';


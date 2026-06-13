import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hover?: boolean;
    children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ children, className = '', hover = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`bg-[var(--bg-secondary)]/70 backdrop-blur-sm border-[var(--border-color)] p-6 transition-all duration-300 select-none flex flex-col ${
                    hover ? 'hover:-translate-y-0.5 hover:shadow-[0_0_12px_var(--accent-glow)]' : ''
                } ${className}`}
                style={{
                    borderRadius: 'var(--radius-base)',
                    borderStyle: 'var(--border-style)',
                    boxShadow: 'var(--glow-effect)'
                }}
                {...props}
            >
                {children}
            </div>
        );
    }
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = '', ...props }, ref) => (
        <div
            ref={ref}
            className={`flex flex-col space-y-1.5 p-0 mb-3 ${className}`}
            {...props}
        />
    )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className = '', ...props }, ref) => (
        <h3
            ref={ref}
            className={`text-sm font-extrabold tracking-wide text-[var(--text-primary)] ${className}`}
            {...props}
        />
    )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className = '', ...props }, ref) => (
        <p
            ref={ref}
            className={`text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider ${className}`}
            {...props}
        />
    )
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = '', ...props }, ref) => (
        <div
            ref={ref}
            className={`p-0 flex-1 ${className}`}
            {...props}
        />
    )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = '', ...props }, ref) => (
        <div
            ref={ref}
            className={`flex items-center pt-3 mt-3 border-t border-[var(--border-color)] p-0 ${className}`}
            style={{ borderStyle: 'var(--border-style)' }}
            {...props}
        />
    )
);
CardFooter.displayName = "CardFooter";

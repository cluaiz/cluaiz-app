import React from 'react';

export const Dialog = ({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="ui-modal-overlay" onClick={() => onOpenChange?.(false)} />
            <div className="z-50 relative w-full max-w-lg p-0 animate-in fade-in zoom-in-95">
                {children}
            </div>
        </div>
    );
};

export const DialogContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return (
        <div className={`ui-modal ${className}`}>
            {children}
        </div>
    );
};

export const DialogHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return <div className={`ui-modal-header text-center sm:text-left ${className}`}>{children}</div>;
};

export const DialogTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return <h2 className={`text-lg font-semibold leading-none tracking-tight text-[var(--text-primary)] ${className}`}>{children}</h2>;
};

export const DialogFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return <div className={`ui-modal-footer ${className}`}>{children}</div>;
};

import React, { useEffect } from 'react';

export const Dialog = ({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange?.(false)} />
            <div className="z-50 relative w-full max-w-lg p-0 animate-in fade-in zoom-in-95">
                {children}
            </div>
        </div>
    );
};

export const DialogContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return (
        <div className={`bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden ${className}`}>
            {children}
        </div>
    );
};

export const DialogHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>{children}</div>;
};

export const DialogTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return <h2 className={`text-lg font-semibold leading-none tracking-tight text-[var(--text-primary)] ${className}`}>{children}</h2>;
};

export const DialogFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    return <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>{children}</div>;
};

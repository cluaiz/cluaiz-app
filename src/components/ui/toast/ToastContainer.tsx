import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useToastStore } from './useToastStore';
import { ToastItem } from './ToastItem';

export const ToastContainer: React.FC = () => {
    const toasts = useToastStore((state) => state.toasts);

    return (
        <div
            aria-live="polite"
            className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none"
        >
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} />
                ))}
            </AnimatePresence>
        </div>
    );
};

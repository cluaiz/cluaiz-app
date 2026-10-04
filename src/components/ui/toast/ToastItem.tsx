import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, HelpCircle, X, Loader2 } from 'lucide-react';
import { ToastItemData } from './toastTypes';
import { useToastStore } from './useToastStore';

interface ToastItemProps {
    toast: ToastItemData;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
    const removeToast = useToastStore((state) => state.removeToast);
    const [isHovered, setIsHovered] = useState(false);
    const remainingRef = useRef<number>(toast.duration ?? (toast.type === 'loading' || toast.type === 'prompt' ? 0 : 4000));
    const startTimeRef = useRef<number>(Date.now());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-dismiss with Pause-on-Hover
    useEffect(() => {
        if (toast.type === 'loading' || toast.type === 'prompt' || (toast.duration !== undefined && toast.duration <= 0)) {
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }

        const duration = toast.duration ?? 4000;
        remainingRef.current = duration;
        startTimeRef.current = Date.now();

        if (!isHovered) {
            timerRef.current = setTimeout(() => {
                removeToast(toast.id);
            }, duration);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [toast.id, toast.type, toast.duration]);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            const elapsed = Date.now() - startTimeRef.current;
            remainingRef.current = Math.max(1000, remainingRef.current - elapsed);
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (toast.type !== 'loading' && toast.type !== 'prompt' && remainingRef.current > 0) {
            startTimeRef.current = Date.now();
            timerRef.current = setTimeout(() => {
                removeToast(toast.id);
            }, remainingRef.current);
        }
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'loading':
                return <Loader2 className="w-5 h-5 text-sky-400 shrink-0 animate-spin" />;
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
            case 'prompt':
                return <HelpCircle className="w-5 h-5 text-[var(--accent-color)] shrink-0" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-sky-400 shrink-0" />;
        }
    };

    const getBorderAccent = () => {
        switch (toast.type) {
            case 'loading':
                return 'border-sky-500/30 bg-sky-500/5 shadow-sky-500/10';
            case 'success':
                return 'border-emerald-500/30 bg-emerald-500/5';
            case 'error':
                return 'border-rose-500/30 bg-rose-500/5';
            case 'warning':
                return 'border-amber-500/30 bg-amber-500/5';
            case 'prompt':
                return 'border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5';
            case 'info':
            default:
                return 'border-sky-500/30 bg-sky-500/5';
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-xl bg-[var(--bg-secondary)]/90 ${getBorderAccent()} text-[var(--text-primary)] w-full`}
        >
            <div className="mt-0.5">{getIcon()}</div>

            <div className="flex-1 min-w-0">
                {toast.title && (
                    <h4 className="text-xs font-semibold leading-tight mb-0.5 text-[var(--text-primary)]">
                        {toast.title}
                    </h4>
                )}
                <p className="text-xs leading-relaxed text-[var(--text-secondary)] break-words">
                    {toast.message}
                </p>

                {toast.action && (
                    <div className="mt-2.5 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                toast.action?.onClick();
                                removeToast(toast.id);
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shadow-sm ${
                                toast.action.isDestructive
                                    ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                                    : 'bg-[var(--accent-color)] text-white hover:opacity-90'
                            }`}
                        >
                            {toast.action.label}
                        </button>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5 rounded-md hover:bg-white/5 transition-colors shrink-0"
                aria-label="Close"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </motion.div>
    );
};

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, Loader2, HelpCircle } from 'lucide-react';
import { ToastItemData } from './toastTypes';
import { useToastStore } from './useToastStore';
import SwipeToast from '../../SwipeToast/SwipeToast';

interface ToastItemProps {
    toast: ToastItemData;
}

export const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
    const removeToast = useToastStore((state) => state.removeToast);

    const getTypeConfig = () => {
        switch (toast.type) {
            case 'error':
                return {
                    fuseColor: '#f43f5e',
                    icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                };
            case 'success':
                return {
                    fuseColor: '#10b981',
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                };
            case 'warning':
                return {
                    fuseColor: '#f59e0b',
                    icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                };
            case 'prompt':
                return {
                    fuseColor: 'var(--accent-color, #a855f7)',
                    icon: <HelpCircle className="w-4 h-4 text-[var(--accent-color,#a855f7)] shrink-0" />
                };
            case 'loading':
                return {
                    fuseColor: '#38bdf8',
                    icon: <Loader2 className="w-4 h-4 text-sky-400 shrink-0 animate-spin" />
                };
            case 'info':
            default:
                return {
                    fuseColor: '#38bdf8',
                    icon: <Info className="w-4 h-4 text-sky-400 shrink-0" />
                };
        }
    };

    const { fuseColor, icon } = getTypeConfig();
    const isPersistent = toast.type === 'loading' || toast.type === 'prompt' || (toast.duration !== undefined && toast.duration <= 0);
    const duration = isPersistent ? 0 : (toast.duration ?? 4000);

    return (
        <div className="pointer-events-auto w-full">
            <SwipeToast
                open={true}
                inline={true}
                title={toast.title || toast.message}
                description={toast.title ? toast.message : undefined}
                icon={icon}
                background="var(--bg-secondary, #080808)"
                color="var(--text-primary, #f5f5f5)"
                fuseColor={fuseColor}
                duration={duration}
                fuse={isPersistent ? 'none' : 'bottom'}
                closeButton={true}
                dismissible={toast.type !== 'loading'}
                pauseOnHover={true}
                actionLabel={toast.action?.label}
                onAction={() => {
                    toast.action?.onClick();
                }}
                onClose={() => {
                    toast.onDismiss?.();
                    removeToast(toast.id);
                }}
            />
        </div>
    );
};

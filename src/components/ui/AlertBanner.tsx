import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export type AlertBannerVariant = 'warning' | 'error' | 'info' | 'success';

export interface AlertBannerProps {
    variant?: AlertBannerVariant;
    title?: string;
    message: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
        loading?: boolean;
    };
    icon?: React.ReactNode;
    className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
    variant = 'warning',
    title,
    message,
    action,
    icon,
    className = '',
}) => {
    const getStyles = () => {
        switch (variant) {
            case 'error':
                return {
                    container: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
                    defaultIcon: <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />,
                    btn: 'bg-rose-500 text-white hover:bg-rose-600',
                };
            case 'success':
                return {
                    container: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                    defaultIcon: <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />,
                    btn: 'bg-emerald-500 text-white hover:bg-emerald-600',
                };
            case 'info':
                return {
                    container: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
                    defaultIcon: <Info size={16} className="shrink-0 text-sky-400 mt-0.5" />,
                    btn: 'bg-sky-500 text-white hover:bg-sky-600',
                };
            case 'warning':
            default:
                return {
                    container: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                    defaultIcon: <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />,
                    btn: 'bg-amber-500 text-black font-semibold hover:bg-amber-400',
                };
        }
    };

    const { container, defaultIcon, btn } = getStyles();

    return (
        <div className={`flex items-start justify-between gap-3 p-4 border rounded-xl text-xs backdrop-blur-sm ${container} ${className}`}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
                {icon || defaultIcon}
                <div className="space-y-0.5 min-w-0">
                    {title && <span className="font-semibold block leading-tight">{title}</span>}
                    <div className="opacity-90 leading-relaxed text-[11px]">{message}</div>
                </div>
            </div>

            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    disabled={action.loading}
                    className={`px-3 py-1 rounded-lg text-xs transition-opacity shrink-0 ${btn} ${
                        action.loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                    }`}
                >
                    {action.loading ? 'Loading...' : action.label}
                </button>
            )}
        </div>
    );
};

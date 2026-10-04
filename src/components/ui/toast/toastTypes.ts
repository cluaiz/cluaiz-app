export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'prompt' | 'loading';

export interface ToastAction {
    label: string;
    onClick: () => void;
    isDestructive?: boolean;
    variant?: 'primary' | 'secondary';
}

export interface ToastItemData {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number; // ms, default 4000 (0 for persistent until dismissed)
    action?: ToastAction;
    onDismiss?: () => void;
}

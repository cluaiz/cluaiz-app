import { useToastStore } from './useToastStore';
import { ToastAction } from './toastTypes';

interface ToastOptions {
    title?: string;
    duration?: number;
    action?: ToastAction;
}

export const toast = {
    success: (message: string, options?: ToastOptions): string => {
        return useToastStore.getState().addToast({
            type: 'success',
            message,
            title: options?.title,
            duration: options?.duration,
            action: options?.action,
        });
    },

    error: (message: string, options?: ToastOptions): string => {
        return useToastStore.getState().addToast({
            type: 'error',
            message,
            title: options?.title,
            duration: options?.duration,
            action: options?.action,
        });
    },

    warning: (message: string, options?: ToastOptions): string => {
        return useToastStore.getState().addToast({
            type: 'warning',
            message,
            title: options?.title,
            duration: options?.duration,
            action: options?.action,
        });
    },

    info: (message: string, options?: ToastOptions): string => {
        return useToastStore.getState().addToast({
            type: 'info',
            message,
            title: options?.title,
            duration: options?.duration,
            action: options?.action,
        });
    },

    prompt: (message: string, action: ToastAction, options?: Omit<ToastOptions, 'action'>): string => {
        return useToastStore.getState().addToast({
            type: 'prompt',
            message,
            title: options?.title,
            duration: options?.duration ?? 0, // Prompts do not auto-dismiss by default
            action,
        });
    },

    loading: (message: string, options?: ToastOptions): string => {
        return useToastStore.getState().addToast({
            type: 'loading',
            message,
            title: options?.title,
            duration: 0, // Persists until updated or dismissed
            action: options?.action,
        });
    },

    update: (id: string, updates: Partial<Omit<import('./toastTypes').ToastItemData, 'id'>>): void => {
        useToastStore.getState().updateToast(id, updates);
    },

    promise: async <T>(
        promise: Promise<T> | (() => Promise<T>),
        msgs: {
            loading: string;
            success: string | ((data: T) => string);
            error: string | ((err: any) => string);
        },
        options?: ToastOptions
    ): Promise<T> => {
        const id = toast.loading(msgs.loading, options);
        try {
            const p = typeof promise === 'function' ? promise() : promise;
            const res = await p;
            const successMsg = typeof msgs.success === 'function' ? msgs.success(res) : msgs.success;
            toast.update(id, {
                type: 'success',
                message: successMsg,
                duration: options?.duration ?? 4000,
            });
            return res;
        } catch (err: any) {
            const errorMsg = typeof msgs.error === 'function' ? msgs.error(err) : (err?.message || msgs.error);
            toast.update(id, {
                type: 'error',
                message: errorMsg,
                duration: options?.duration ?? 5000,
            });
            throw err;
        }
    },

    dismiss: (id: string): void => {
        useToastStore.getState().removeToast(id);
    },

    clear: (): void => {
        useToastStore.getState().clearToasts();
    }
};

export { ToastContainer } from './ToastContainer';
export { useToastStore } from './useToastStore';
export * from './toastTypes';

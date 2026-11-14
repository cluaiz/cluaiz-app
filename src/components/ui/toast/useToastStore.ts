import { create } from 'zustand';
import { ToastItemData } from './toastTypes';

interface ToastStore {
    toasts: ToastItemData[];
    addToast: (toast: Omit<ToastItemData, 'id'>) => string;
    updateToast: (id: string, updates: Partial<Omit<ToastItemData, 'id'>>) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

/** The same message twice shows once: the newer toast replaces the older, so its timer starts again */
const same = (a: Omit<ToastItemData, 'id'>, b: Omit<ToastItemData, 'id'>) =>
    a.type !== 'loading' && a.type === b.type && a.message === b.message && a.title === b.title;

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = 'toast_' + Math.random().toString(36).substring(2, 9);
        const newToast: ToastItemData = { ...toast, id };
        
        set((state) => {
            // Keep at most 5 toasts on screen
            const updated = [...state.toasts.filter((t) => !same(t, newToast)), newToast];
            return { toasts: updated.slice(-5) };
        });

        return id;
    },
    updateToast: (id, updates) => {
        set((state) => {
            const current = state.toasts.find((t) => t.id === id);
            if (!current) return state;
            const changed = { ...current, ...updates };
            return {
                toasts: state.toasts
                    .filter((t) => t.id === id || !same(t, changed))
                    .map((t) => (t.id === id ? changed : t))
            };
        });
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    },
    clearToasts: () => set({ toasts: [] }),
}));

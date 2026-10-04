import { create } from 'zustand';
import { ToastItemData } from './toastTypes';

interface ToastStore {
    toasts: ToastItemData[];
    addToast: (toast: Omit<ToastItemData, 'id'>) => string;
    updateToast: (id: string, updates: Partial<Omit<ToastItemData, 'id'>>) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (toast) => {
        const id = 'toast_' + Math.random().toString(36).substring(2, 9);
        const newToast: ToastItemData = { ...toast, id };
        
        set((state) => {
            // Keep at most 5 toasts on screen
            const updated = [...state.toasts, newToast];
            return { toasts: updated.slice(-5) };
        });

        return id;
    },
    updateToast: (id, updates) => {
        set((state) => ({
            toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t))
        }));
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    },
    clearToasts: () => set({ toasts: [] }),
}));

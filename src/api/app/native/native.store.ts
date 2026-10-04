import { create } from 'zustand';

interface NativeState {
  isDesktop: boolean;
  sessionToken: string | null;
  setSessionToken: (token: string | null) => void;
}

export const useNativeStore = create<NativeState>((set) => ({
  isDesktop: typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window),
  sessionToken: null,
  setSessionToken: (token) => set({ sessionToken: token }),
}));

import { create } from 'zustand';
import { http, type Status, errorMessage } from '../../client';
import { permissionApi } from './permission.api';
import { nativeApi } from '../../app/native/native.api';
import type {
  PermissionSchema,
  PendingPermissionRequest,
} from './permission.types';

export interface PermissionState {
  permissions: PermissionSchema | null;
  lanIp: string | null;
  pendingRequests: PendingPermissionRequest[];
  status: Status;
  error: string | null;
  isAuthModalOpen: boolean;

  // Actions
  fetchPermission: () => Promise<void>;
  updatePermission: (patch: Partial<PermissionSchema>) => Promise<void>;
  generateAuthToken: () => Promise<string | null>;
  revokeAuthToken: (token: string) => Promise<void>;
  fetchPendingPermissions: () => Promise<void>;
  approvePermission: (requestId: string, feedback?: string) => Promise<void>;
  rejectPermission: (requestId: string, feedback?: string) => Promise<void>;
  setAuthModalOpen: (open: boolean) => void;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => {
  // Register automatic 401 token sync handler with centralized http client
  http.setAuthTokenSyncHandler(async () => {
    try {
      // 1. In Desktop (Tauri), read the secret session token or permission.json directly from native IPC
      if (nativeApi.isDesktop()) {
        const sessionToken = await nativeApi.getSessionToken();
        if (sessionToken && sessionToken.trim()) {
          http.setToken(sessionToken.trim());
          return sessionToken.trim();
        }
      }
    } catch {
      // Return null on failure to prevent endless retry loops
    }
    // Auto-prompt user with AuthTokenModal if desktop token discovery fails or running in web
    set({ isAuthModalOpen: true });
    return null;
  });

  return {
    permissions: null,
    lanIp: null,
    pendingRequests: [],
    status: 'idle',
    error: null,
    isAuthModalOpen: false,

    setAuthModalOpen: (open: boolean) => set({ isAuthModalOpen: open }),

    fetchPermission: async () => {
      set({ status: 'pending', error: null });
      try {
        // 1. Seed token from native desktop session or permission.json before making the call
        if (nativeApi.isDesktop() && !http.getToken()) {
          const sessionToken = await nativeApi.getSessionToken();
          if (sessionToken && sessionToken.trim()) {
            http.setToken(sessionToken.trim());
          }
        }

        const res = await permissionApi.getPermission();
        if (res && res.permission) {
          set({
            permissions: res.permission,
            lanIp: res.lan_ip || null,
            status: 'success',
            error: null,
            isAuthModalOpen: false,
          });
        } else {
          set({ status: 'success', error: null, isAuthModalOpen: false });
        }
      } catch (err) {
        const msg = errorMessage(err);
        const isUnauthorized = msg.includes('401') || msg.toLowerCase().includes('unauthorized');
        // Prompt the user with AuthTokenModal if authorization failed
        set({
          status: 'error',
          error: msg,
          isAuthModalOpen: isUnauthorized,
        });
      }
    },

    updatePermission: async (patch: Partial<PermissionSchema>) => {
      const previous = get().permissions;
      if (!previous) return;

      // Optimistic update
      const optimistic = { ...previous, ...patch };
      set({ permissions: optimistic });

      try {
        const res = await permissionApi.updatePermission(patch);
        if (res.permission) {
          set({ permissions: res.permission, status: 'success', error: null });
        }
      } catch (err) {
        // Rollback on failure
        set({ permissions: previous, status: 'error', error: errorMessage(err) });
      }
    },

    generateAuthToken: async () => {
      try {
        const res = await permissionApi.generateAuthToken();
        if (res.token) {
          http.setToken(res.token);
          const current = get().permissions;
          if (current) {
            const currentApiAuth = current.api_auth || { required: true, tokens: [] };
            set({
              permissions: {
                ...current,
                api_auth: {
                  ...currentApiAuth,
                  tokens: res.tokens || [...currentApiAuth.tokens, res.token],
                },
              },
            });
          }
          return res.token;
        }
        return null;
      } catch (err) {
        set({ error: errorMessage(err) });
        return null;
      }
    },

    revokeAuthToken: async (token: string) => {
      try {
        const res = await permissionApi.revokeAuthToken(token);
        const current = get().permissions;
        if (current) {
          const currentApiAuth = current.api_auth || { required: false, tokens: [] };
          set({
            permissions: {
              ...current,
              api_auth: {
                ...currentApiAuth,
                tokens: res.tokens || currentApiAuth.tokens.filter((t) => t !== token),
              },
            },
          });
        }
        // If the revoked token was the active client token (or is no longer in valid list), switch immediately
        const currentActive = http.getToken();
        if (currentActive === token || (res.tokens && !res.tokens.includes(currentActive || ''))) {
          const remaining = res.tokens || [];
          http.setToken(remaining.length > 0 ? remaining[0] : null);
        }
      } catch (err) {
        set({ error: errorMessage(err) });
      }
    },

    fetchPendingPermissions: async () => {
      try {
        const res = await permissionApi.getPendingPermissions();
        set({ pendingRequests: res.pending || [] });
      } catch (err) {
        set({ error: errorMessage(err) });
      }
    },

    approvePermission: async (requestId: string, feedback?: string) => {
      // Optimistic removal from pending
      const prevPending = get().pendingRequests;
      set({ pendingRequests: prevPending.filter((r) => r.id !== requestId) });

      try {
        await permissionApi.approvePermission({ request_id: requestId, feedback });
      } catch (err) {
        // Rollback on failure
        set({ pendingRequests: prevPending, error: errorMessage(err) });
      }
    },

    rejectPermission: async (requestId: string, feedback?: string) => {
      // Optimistic removal from pending
      const prevPending = get().pendingRequests;
      set({ pendingRequests: prevPending.filter((r) => r.id !== requestId) });

      try {
        await permissionApi.rejectPermission({ request_id: requestId, feedback });
      } catch (err) {
        // Rollback on failure
        set({ pendingRequests: prevPending, error: errorMessage(err) });
      }
    },

    reset: () => {
      set({
        permissions: null,
        lanIp: null,
        pendingRequests: [],
        status: 'idle',
        error: null,
        isAuthModalOpen: false,
      });
    },
  };
});


import { create } from 'zustand';
import { http, type Status, errorMessage } from '../../client';
import { permissionApi } from './permission.api';
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

  // Actions
  fetchPermission: () => Promise<void>;
  updatePermission: (patch: Partial<PermissionSchema>) => Promise<void>;
  generateAuthToken: () => Promise<string | null>;
  revokeAuthToken: (token: string) => Promise<void>;
  fetchPendingPermissions: () => Promise<void>;
  approvePermission: (requestId: string, feedback?: string) => Promise<void>;
  rejectPermission: (requestId: string, feedback?: string) => Promise<void>;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => {
  // Register automatic 401 token sync handler with centralized http client
  http.setAuthTokenSyncHandler(async () => {
    try {
      // Clear rejected token immediately so recovery fetch does not send invalid auth
      http.setToken(null);

      // Fetch fresh permission state from public endpoint
      const res = await permissionApi.getPermission();
      const tokens = res.permission?.api_auth?.tokens || [];
      if (tokens.length > 0) {
        const nextToken = tokens[0];
        http.setToken(nextToken);
        set({ permissions: res.permission, lanIp: res.lan_ip });
        return nextToken;
      } else {
        set({ permissions: res.permission, lanIp: res.lan_ip });
        return null;
      }
    } catch {
      // Return null on failure to prevent endless retry loops
    }
    return null;
  });

  return {
    permissions: null,
    lanIp: null,
    pendingRequests: [],
    status: 'idle',
    error: null,

    fetchPermission: async () => {
      set({ status: 'pending', error: null });
      try {
        const res = await permissionApi.getPermission();
        if (res.permission) {
          // If active token is missing from client, sync first available token
          if (!http.getToken() && res.permission.api_auth?.tokens?.length) {
            http.setToken(res.permission.api_auth.tokens[0]);
          }
          set({
            permissions: res.permission,
            lanIp: res.lan_ip || null,
            status: 'success',
            error: null,
          });
        } else {
          set({ status: 'success', error: null });
        }
      } catch (err) {
        set({ status: 'error', error: errorMessage(err) });
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
      });
    },
  };
});

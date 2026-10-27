import { create } from 'zustand';
import { http, type Status, errorMessage } from '../../client';
import { permissionApi } from './permission.api';
import { nativeApi } from '../../app/native/native.api';
import { ApiError } from '../../client/errors';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import type {
  PermissionSchema,
  PendingPermissionRequest,
  TokenListResponse,
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
  generateAuthToken: () => Promise<string>;
  revokeAuthToken: (token: string) => Promise<void>;
  fetchPendingPermissions: () => Promise<void>;
  approvePermission: (requestId: string, feedback?: string) => Promise<void>;
  rejectPermission: (requestId: string, feedback?: string) => Promise<void>;
  setAuthModalOpen: (open: boolean) => void;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => {
  let epoch = 0, permissionVersion = 0, pendingVersion = 0, tokenBusy = false;
  const deciding = new Set<string>();
  const assertCurrent = (started: number) => {
    if (started !== epoch) throw new ApiError('Engine connection changed; refresh before continuing', 409, 'STALE_PERMISSION_REQUEST');
  };
  async function tokenAction<T extends TokenListResponse>(request: () => Promise<T>, apply: (saved: T) => void): Promise<T> {
    if (tokenBusy) throw new ApiError('Another API-key action is pending', 409, 'TOKEN_ACTION_PENDING');
    const started = epoch;
    tokenBusy = true;
    ++permissionVersion;
    try {
      const saved = await request();
      assertCurrent(started);
      ++permissionVersion;
      apply(saved);
      const current = get().permissions;
      set({ ...(current && { permissions: { ...current,
        api_auth: { required: saved.api_auth_required, tokens: saved.tokens } } }), status: 'success', error: null });
      return saved;
    } catch (err) {
      if (started === epoch) set({ error: errorMessage(err) });
      throw err;
    } finally {
      if (started === epoch) tokenBusy = false;
    }
  }
  async function decide(requestId: string, approved: boolean, feedback?: string) {
    if (deciding.has(requestId)) throw new ApiError('This approval is already being submitted', 409, 'APPROVAL_ACTION_PENDING');
    const started = epoch;
    deciding.add(requestId);
    ++pendingVersion;
    try {
      await (approved ? permissionApi.approvePermission(requestId, feedback) : permissionApi.rejectPermission(requestId, feedback));
      assertCurrent(started);
      ++pendingVersion;
      set({ pendingRequests: get().pendingRequests.filter(request => request.id !== requestId), error: null });
    } catch (err) {
      if (started === epoch) set({ error: errorMessage(err) });
      throw err;
    } finally {
      if (started === epoch) deciding.delete(requestId);
    }
  }
  useConnectionStore.subscribe((current, previous) => {
    if (current.protocol !== previous.protocol || current.host !== previous.host || current.port !== previous.port) get().reset();
  });
  // Register automatic 401 token sync handler with centralized http client
  http.setAuthTokenSyncHandler(async () => {
    const started = epoch;
    try {
      // 1. In Desktop (Tauri), read the secret session token or permission.json directly from native IPC
      if (nativeApi.isDesktop()) {
        const sessionToken = await nativeApi.getSessionToken();
        if (started !== epoch) return null;
        if (sessionToken && sessionToken.trim()) {
          return sessionToken.trim();
        }
      }
    } catch {
      // Return null on failure to prevent endless retry loops
    }
    // Auto-prompt user with AuthTokenModal strictly if engine explicitly enforces authentication
    if (started === epoch && get().permissions?.api_auth?.required) {
      set({ isAuthModalOpen: true });
    }
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
      const started = epoch, version = ++permissionVersion;
      set({ status: 'pending', error: null });
      try {
        // 1. Seed token from native desktop session or permission.json before making the call
        if (nativeApi.isDesktop() && !http.getToken()) {
          const sessionToken = await nativeApi.getSessionToken();
          assertCurrent(started);
          if (sessionToken && sessionToken.trim()) {
            http.setToken(sessionToken.trim());
          }
        }

        const res = await permissionApi.getPermission();
        if (started !== epoch || version !== permissionVersion) return;
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
        if (started !== epoch || version !== permissionVersion) return;
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
      const started = epoch, version = ++permissionVersion;
      const previous = get().permissions;
      if (!previous) return;

      // Optimistic update
      const optimistic = { ...previous, ...patch };
      set({ permissions: optimistic });

      try {
        const res = await permissionApi.updatePermission(patch);
        if (started !== epoch || version !== permissionVersion) return;
        if (res.permission) {
          set({ permissions: res.permission, status: 'success', error: null });
        }
      } catch (err) {
        if (started !== epoch || version !== permissionVersion) return;
        // Rollback on failure
        set({ permissions: previous, status: 'error', error: errorMessage(err) });
      }
    },

    generateAuthToken: async () => {
      const saved = await tokenAction(permissionApi.generateAuthToken, result => {
        if (!http.getToken()) http.setToken(result.token);
      });
      return saved.token;
    },

    revokeAuthToken: async (token: string) => {
      await tokenAction(() => permissionApi.revokeAuthToken(token), saved => {
        // A desktop session secret is not part of tokens.list; absence there does not revoke it.
        if (http.getToken() === saved.revoked_token) http.setToken(saved.tokens[0] ?? null);
      });
    },

    fetchPendingPermissions: async () => {
      const started = epoch, version = ++pendingVersion;
      try {
        const res = await permissionApi.getPendingPermissions();
        if (started === epoch && version === pendingVersion) set({ pendingRequests: res.pending, error: null });
      } catch (err) {
        if (started === epoch && version === pendingVersion) set({ error: errorMessage(err) });
      }
    },

    approvePermission: (requestId, feedback) => decide(requestId, true, feedback),
    rejectPermission: (requestId, feedback) => decide(requestId, false, feedback),

    reset: () => {
      ++epoch; ++permissionVersion; ++pendingVersion;
      tokenBusy = false;
      deciding.clear();
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


import { client } from '../../client';
import { PERMISSION_ENDPOINTS } from './permission.endpoints';
import type {
  PermissionResponse,
  PermissionSchema,
  TokenGenerateResponse,
  TokenRevokeResponse,
  PendingPermissionsResponse,
  ApprovalActionRequest,
  ApprovalActionResponse,
} from './permission.types';

export const permissionApi = {
  /**
   * Fetches the current permissions, categorized available models, and host LAN IP.
   */
  getPermission: async (): Promise<PermissionResponse> => {
    return client.get<PermissionResponse>(PERMISSION_ENDPOINTS.PERMISSION);
  },

  /**
   * Atomically merges and updates engine permissions (partial patch supported).
   */
  updatePermission: async (payload: Partial<PermissionSchema> | Record<string, any>): Promise<PermissionResponse> => {
    return client.post<PermissionResponse>(PERMISSION_ENDPOINTS.PERMISSION, payload);
  },

  /**
   * Generates a cryptographically secure API authentication token on the engine.
   */
  generateAuthToken: async (): Promise<TokenGenerateResponse> => {
    return client.post<TokenGenerateResponse>(PERMISSION_ENDPOINTS.AUTH_TOKEN_GENERATE, {});
  },

  /**
   * Revokes an existing API token from the engine security registry.
   */
  revokeAuthToken: async (token: string): Promise<TokenRevokeResponse> => {
    return client.post<TokenRevokeResponse>(PERMISSION_ENDPOINTS.AUTH_TOKEN_REVOKE, { token });
  },

  /**
   * Fetches all pending Human-In-The-Loop (HITL) tool execution permission requests.
   */
  getPendingPermissions: async (): Promise<PendingPermissionsResponse> => {
    return client.get<PendingPermissionsResponse>(PERMISSION_ENDPOINTS.PENDING_PERMISSIONS);
  },

  /**
   * Approves a pending HITL permission request, unblocking active LLM inference task.
   */
  approvePermission: async (
    payloadOrId: ApprovalActionRequest | string,
    feedback?: string
  ): Promise<ApprovalActionResponse> => {
    const payload: ApprovalActionRequest =
      typeof payloadOrId === 'string'
        ? { request_id: payloadOrId, feedback }
        : payloadOrId;
    return client.post<ApprovalActionResponse>(PERMISSION_ENDPOINTS.APPROVE_PERMISSION, payload);
  },

  /**
   * Rejects a pending HITL permission request with optional reviewer feedback.
   */
  rejectPermission: async (
    payloadOrId: ApprovalActionRequest | string,
    feedback?: string
  ): Promise<ApprovalActionResponse> => {
    const payload: ApprovalActionRequest =
      typeof payloadOrId === 'string'
        ? { request_id: payloadOrId, feedback }
        : payloadOrId;
    return client.post<ApprovalActionResponse>(PERMISSION_ENDPOINTS.REJECT_PERMISSION, payload);
  },
};


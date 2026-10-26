import { client } from '../../client';
import { getConfig, setConfig } from '../config/config.api';
import { ApiError } from '../../client/errors';
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

/** Keep the existing App container; the wire result is {engine: PermissionSchema}. */
function engineSettings(result: unknown): PermissionResponse {
  const engine = (result as { engine?: PermissionSchema } | null)?.engine;
  if (!engine || typeof engine !== 'object' || Array.isArray(engine)) {
    throw new ApiError('Engine returned invalid engine settings', 200, 'INVALID_CONFIG_RESPONSE', 'config.get/set');
  }
  const chat = engine.active_slots?.chat_slot;
  return { status: 'success', permission: { ...engine,
    ...(chat && { chat_models: { ...engine.chat_models, text: chat.model_id ?? null } }) } };
}

export const permissionApi = {
  /**
   * Reads saved Engine settings; installed inventory remains owned by modelsApi.
   */
  getPermission: async (signal?: AbortSignal): Promise<PermissionResponse> => {
    return engineSettings({ engine: await getConfig('engine', signal) });
  },

  /**
   * Saves the patch through CEP; nested objects follow the Engine's merge rules.
   */
  updatePermission: async (payload: Partial<PermissionSchema> | Record<string, any>, signal?: AbortSignal): Promise<PermissionResponse> => {
    return engineSettings({ engine: await setConfig('engine', payload, signal) });
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


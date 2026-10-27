import { getConfig, setConfig } from '../config/config.api';
import { ApiError } from '../../client/errors';
import { listTokens, createToken, revokeToken } from './tokens';
import { listApprovals, decideApproval } from './approvals';
import type {
  PermissionResponse,
  PermissionSchema,
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

  listAuthTokens: listTokens,
  generateAuthToken: createToken,
  revokeAuthToken: revokeToken,
  getPendingPermissions: listApprovals,

  /**
   * Approves a pending HITL permission request, unblocking active LLM inference task.
   */
  approvePermission: async (
    payloadOrId: ApprovalActionRequest | string,
    feedback?: string
  ): Promise<ApprovalActionResponse> => {
    return decideApproval(true, payloadOrId, feedback);
  },

  /**
   * Rejects a pending HITL permission request with optional reviewer feedback.
   */
  rejectPermission: async (
    payloadOrId: ApprovalActionRequest | string,
    feedback?: string
  ): Promise<ApprovalActionResponse> => {
    return decideApproval(false, payloadOrId, feedback);
  },
};


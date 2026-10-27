import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { PendingPermissionRequest, PendingPermissionsResponse, ApprovalActionRequest, ApprovalActionResponse } from './permission.types';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value: unknown): value is string => text(value) && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
function record(value: unknown, status: PendingPermissionRequest['status']): value is PendingPermissionRequest {
  const item = value as PendingPermissionRequest | null;
  return !!item && text(item.id) && text(item.principal) && text(item.method) && typeof item.target === 'string'
    && timestamp(item.created_at) && timestamp(item.expires_at) && item.status === status;
}
function invalid(method: string): never {
  throw new ApiError('Engine returned an invalid approval acknowledgment', 200, 'INVALID_APPROVAL_RESPONSE', method);
}

export async function listApprovals(signal?: AbortSignal): Promise<PendingPermissionsResponse> {
  const method = 'approvals.list';
  const value = await callCep<PendingPermissionsResponse>(method, {}, { signal });
  if (!value || !Array.isArray(value.pending) || !value.pending.every(item => record(item, 'pending'))
    || new Set(value.pending.map(item => item.id)).size !== value.pending.length) invalid(method);
  return { pending: value.pending };
}

export async function decideApproval(approved: boolean, payloadOrId: ApprovalActionRequest | string,
  feedback?: string): Promise<ApprovalActionResponse> {
  const payload = typeof payloadOrId === 'string' ? { request_id: payloadOrId, feedback } : payloadOrId;
  const method = approved ? 'approvals.approve' : 'approvals.reject';
  if (!payload || !text(payload.request_id) || (payload.feedback !== undefined && typeof payload.feedback !== 'string')) {
    throw new ApiError('An approval id and optional text feedback are required', 400, 'INVALID_APPROVAL_REQUEST', method);
  }
  const value = await callCep<ApprovalActionResponse>(method, { approval_id: payload.request_id,
    ...(payload.feedback !== undefined && { feedback: payload.feedback }) });
  if (!value || !record(value.approval, approved ? 'approved' : 'rejected') || value.approval.id !== payload.request_id) invalid(method);
  return value;
}

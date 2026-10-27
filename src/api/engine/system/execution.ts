import { callCep, CepError } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { CmdPayload, CmdResponse, CommandOptions, CommandApproval } from './system.types';

const COMMAND_TIMEOUT_MS = 600_000;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** A real approval-required result, not a locally manufactured request. */
export function commandApproval(error: unknown): CommandApproval | null {
  if (!(error instanceof CepError) || error.code !== -32003) return null;
  const data = error.data as Record<string, unknown> | undefined;
  if (data?.type !== 'approval_required' || data.action !== 'system.exec' || !text(data.approval_id)
    || typeof data.target !== 'string' || !text(data.expires_at) || !Number.isFinite(Date.parse(data.expires_at))) return null;
  return { id: data.approval_id, target: data.target, expiresAt: data.expires_at };
}

/** One wire owner for program/args and explicitly policy-gated shell lines. */
export async function executeSystem(payload: CmdPayload, options: CommandOptions = {}): Promise<CmdResponse> {
  if (options.signal?.aborted) throw new ApiError('Command observation ended', 409, 'COMMAND_OBSERVATION_ENDED');
  const invalid = () => new ApiError('Send a nonempty command or program with string arguments', 400, 'INVALID_COMMAND', 'system.exec');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).some(key => !['command', 'program', 'args'].includes(key))) throw invalid();
  const shell = 'command' in payload;
  if (shell ? (!text(payload.command) || 'program' in payload || 'args' in payload)
    : (!text(payload.program) || !Array.isArray(payload.args) || !payload.args.every(arg => typeof arg === 'string'))) throw invalid();
  if ((options.approvalId !== undefined && !text(options.approvalId))
    || (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 0))) throw invalid();
  const result = await callCep<unknown>('system.exec', { ...payload,
    ...(options.approvalId !== undefined && { _meta: { approval: options.approvalId } }) },
  { timeoutMs: options.timeoutMs ?? COMMAND_TIMEOUT_MS, signal: options.signal });
  const value = result as { exit_code?: number | null; stdout?: string; stderr?: string } | null;
  if (!value || !(value.exit_code === null || Number.isSafeInteger(value.exit_code))
    || typeof value.stdout !== 'string' || typeof value.stderr !== 'string') {
    throw new ApiError('Engine returned invalid command output', 200, 'INVALID_COMMAND_RESPONSE', 'system.exec');
  }
  return { exit_code: value.exit_code as number | null, stdout: value.stdout, stderr: value.stderr,
    status: value.exit_code === 0 ? 'success' : 'error',
    output: value.stdout + (value.stdout && value.stderr && !value.stdout.endsWith('\n') ? '\n' : '') + value.stderr };
}

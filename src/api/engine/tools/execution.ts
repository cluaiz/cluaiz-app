import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { toolTarget } from './lifecycle';
import type { DynamicExecuteResponse } from './components/components.types';

/** One explicit installed tool/function; Engine owns authorization and execution. */
export async function executeTool(name: string, fn: string, input: Record<string, unknown> | undefined,
  kind: string): Promise<DynamicExecuteResponse> {
  const target = toolTarget(kind, name);
  if (typeof fn !== 'string' || !fn || fn.includes('..') || /[/\\\0]/.test(fn)
    || (input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input)))) {
    throw new ApiError('Choose a tool function and a JSON argument object', 400, 'INVALID_TOOL_CALL', 'tools.call');
  }
  // A result may be any JSON value, including null/false or the tool's own domain failure data.
  // Do not invent a successful-execution status or unwrap a tool-owned `result` field.
  return {result: await callCep<unknown>('tools.call', {...target, fn, input: input ?? {}})};
}

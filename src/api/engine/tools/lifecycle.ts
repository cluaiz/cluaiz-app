import { callCep } from '../../client/cep';
import { callCepTask } from '../../client/cepTask';
import { ApiError } from '../../client/errors';
import type { ToolKind } from './catalog';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function target(kind: ToolKind, name: string) {
  if (!['skill', 'plugin', 'mcp'].includes(kind) || typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name)) {
    throw new ApiError('Use a tool kind and its installed/registry package id', 400, 'INVALID_TOOL_TARGET', 'tools');
  }
  return { kind, name };
}

/** Existing action DTOs are returned only after an acknowledged matching package result. */
export async function installTool(kind: ToolKind, name: string, signal?: AbortSignal) {
  const value = await callCepTask<unknown>('tools.install', target(kind, name), signal);
  if (!object(value) || value.id !== name || value.category !== kind || typeof value.enabled !== 'boolean') {
    throw new ApiError('Engine returned an invalid installed-tool result', 200, 'INVALID_TOOL_RESULT', 'tools.install');
  }
  return { status: 'success', message: `Installed ${kind} ${name}` };
}

export async function removeTool(kind: ToolKind, name: string, signal?: AbortSignal) {
  const value = await callCep<unknown>('tools.remove', target(kind, name), { signal });
  if (!object(value) || value.name !== name || value.kind !== kind) {
    throw new ApiError('Engine returned an invalid removed-tool result', 200, 'INVALID_TOOL_RESULT', 'tools.remove');
  }
  return { status: 'success', message: `Removed ${kind} ${name}` };
}

import { callCep } from '../../client/cep';
import { callCepTask, resumeCepTask, type TaskObserver } from '../../client/cepTask';
import { ApiError } from '../../client/errors';
import { isToolKind, type ToolKind } from './catalog';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function toolTarget(kind: string | undefined, name: string | undefined) {
  if (!isToolKind(kind) || typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name)) {
    throw new ApiError('Use a tool kind and its installed/registry package id', 400, 'INVALID_TOOL_TARGET', 'tools');
  }
  return { kind, name };
}

/** Existing action DTOs are returned only after an acknowledged matching package result. */
export async function installTool(kind: ToolKind, name: string, signal?: AbortSignal, observer?: TaskObserver) {
  return installResult(await callCepTask<unknown>('tools.install', toolTarget(kind, name), signal, observer), kind, name);
}

export async function resumeToolInstall(kind: ToolKind, name: string, id: string, signal?: AbortSignal, observer?: TaskObserver) {
  toolTarget(kind, name);
  return installResult(await resumeCepTask<unknown>('tools.install', id, signal, observer), kind, name);
}

function installResult(value: unknown, kind: ToolKind, name: string) {
  if (!object(value) || value.id !== name || value.category !== kind || typeof value.enabled !== 'boolean') {
    throw new ApiError('Engine returned an invalid installed-tool result', 200, 'INVALID_TOOL_RESULT', 'tools.install');
  }
  return { status: 'success', message: `Installed ${kind} ${name}` };
}

export async function removeTool(kind: ToolKind, name: string, signal?: AbortSignal) {
  const value = await callCep<unknown>('tools.remove', toolTarget(kind, name), { signal });
  if (!object(value) || value.name !== name || value.kind !== kind) {
    throw new ApiError('Engine returned an invalid removed-tool result', 200, 'INVALID_TOOL_RESULT', 'tools.remove');
  }
  return { status: 'success', message: `Removed ${kind} ${name}` };
}

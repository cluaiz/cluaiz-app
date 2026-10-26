import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { toolTarget } from './lifecycle';
import { isToolCacheInfo } from './cache';
import { isPackageRelativePath } from '../../../utils/filePath';
import type { ComponentFileItem, ComponentFilesResponse, UpdateComponentFilePayload } from './components/components.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = (method: string) => new ApiError('Engine returned an invalid tool file result', 200, 'INVALID_TOOL_FILE', method);

/** Relative package files only. Canonicalization/roots and symlink authorization stay in Engine. */
export async function listToolFiles(kind?: string, name?: string, signal?: AbortSignal): Promise<ComponentFilesResponse> {
  const value = await callCep<unknown>('tools.files', toolTarget(kind, name), {signal});
  if (!object(value) || !Array.isArray(value.files) || value.files.some(file => !object(file)
    || typeof file.name !== 'string' || !file.name || !isPackageRelativePath(file.path) || typeof file.is_dir !== 'boolean')
    || typeof value.truncated !== 'boolean' || !Number.isSafeInteger(value.skipped) || Number(value.skipped) < 0
    || !isToolCacheInfo(value.cache)) throw invalid('tools.files');
  return {status: 'success', files: value.files as ComponentFileItem[], cache: value.cache,
    truncated: value.truncated, skipped: value.skipped as number};
}

export async function readToolFile(kind: string, name: string, path: string, signal?: AbortSignal):
Promise<{status: string; content: string; path: string; message?: string}> {
  const target = toolTarget(kind, name);
  if (!isPackageRelativePath(path)) throw new ApiError('Choose a relative path inside this tool package', 400, 'INVALID_TOOL_FILE_PATH', 'tools.read_file');
  const value = await callCep<unknown>('tools.read_file', {...target, path}, {signal});
  if (!object(value) || typeof value.path !== 'string' || !value.path || typeof value.text !== 'string') {
    throw invalid('tools.read_file');
  }
  return {status: 'success', content: value.text, path: value.path};
}

/** Engine chooses the main file (SKILL.md or package.json). Arbitrary file writes are not exposed. */
export async function writeToolFile(payload: UpdateComponentFilePayload) {
  if (!object(payload) || typeof payload.content !== 'string'
    || Object.keys(payload).some(key => !['component_type', 'component_id', 'content'].includes(key))) {
    throw new ApiError('Send the tool main-file content without a file path', 400, 'INVALID_TOOL_FILE_WRITE', 'tools.write_file');
  }
  const value = await callCep<unknown>('tools.write_file', {
    ...toolTarget(payload.component_type, payload.component_id), text: payload.content,
  });
  if (!object(value) || typeof value.path !== 'string' || !value.path
    || value.bytes !== new Blob([payload.content]).size) throw invalid('tools.write_file');
  return {status: 'success', path: value.path, bytes: value.bytes as number};
}

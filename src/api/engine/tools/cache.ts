import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { isToolKind } from './catalog';
import { toolTarget } from './lifecycle';

export interface ToolCacheInfo {
  temp_bytes: number; all_bytes: number;
  entries: Array<{path: string; size: number}>;
  [key: string]: unknown;
}
interface CacheReport extends ToolCacheInfo { kind: string; name: string }
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export function isToolCacheInfo(value: unknown): value is ToolCacheInfo {
  return object(value) && count(value.temp_bytes) && count(value.all_bytes) && value.temp_bytes <= value.all_bytes
    && Array.isArray(value.entries) && value.entries.every(entry => object(entry)
      && typeof entry.path === 'string' && count(entry.size));
}
function cacheTarget(kind: string, name?: string) {
  if (name !== undefined) return toolTarget(kind, name);
  if (!isToolKind(kind)) throw new ApiError('Unknown tool kind', 400, 'INVALID_TOOL_TARGET', 'tools.cache');
  return {kind};
}

export async function listToolCache(kind: string, name?: string) {
  const target = cacheTarget(kind, name);
  const value = await callCep<unknown>('tools.cache', target);
  if (!Array.isArray(value) || value.some(report => !object(report) || report.kind !== kind
    || typeof report.name !== 'string' || !report.name || (name !== undefined && report.name !== name)
    || !isToolCacheInfo(report))
    || (name !== undefined && value.length !== 1)) {
    throw new ApiError('Engine returned an invalid tool cache report', 200, 'INVALID_TOOL_CACHE', 'tools.cache');
  }
  const reports = value as CacheReport[];
  return {status: 'success', message: reports, reports};
}

/** CEP clears all cache files, never the package itself; no temp-only mode is offered. */
export async function clearToolCache(kind: string, name?: string) {
  const value = await callCep<unknown>('tools.clear_cache', cacheTarget(kind, name));
  if (!object(value) || !count(value.removed) || !count(value.freed_bytes)) {
    throw new ApiError('Engine returned an invalid tool cleanup result', 200, 'INVALID_TOOL_CACHE', 'tools.clear_cache');
  }
  return {status: 'success', message: `Removed ${value.removed} cache files`, removed: value.removed, freed_bytes: value.freed_bytes};
}

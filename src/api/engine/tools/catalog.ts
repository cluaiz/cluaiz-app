import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

export type ToolKind = 'skill' | 'plugin' | 'mcp';
export interface ToolCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: ToolKind;
  enabled: boolean;
  version?: string;
  execution_mode?: string;
  icon_svg?: string | null;
  security_mode?: string;
  tokens?: number;
  functions: Array<{ name: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export type ComponentCatalog = Record<ToolKind, string[]> & {
  rich: Record<ToolKind, ToolCatalogEntry[]>;
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const kindOf = (value: unknown): value is ToolKind => value === 'skill' || value === 'plugin' || value === 'mcp';

/** One wire owner for installed skill/plugin/MCP discovery; lifecycle stays separate. */
export async function listTools(kind?: string, signal?: AbortSignal): Promise<ToolCatalogEntry[]> {
  if (kind !== undefined && !kindOf(kind)) {
    throw new ApiError('A tool kind must be skill, plugin or mcp', 400, 'INVALID_TOOL_KIND', 'tools.list');
  }
  const value = await callCep<unknown>('tools.list', kind ? { kind } : {}, { signal });
  if (!Array.isArray(value) || value.some(entry => !object(entry) || typeof entry.id !== 'string' || !entry.id
    || typeof entry.name !== 'string' || typeof entry.description !== 'string' || !kindOf(entry.category) || (kind && entry.category !== kind)
    || typeof entry.enabled !== 'boolean' || !Array.isArray(entry.functions)
    || (entry.icon_svg != null && typeof entry.icon_svg !== 'string')
    || (entry.security_mode !== undefined && typeof entry.security_mode !== 'string')
    || (entry.tokens !== undefined && (!Number.isFinite(entry.tokens) || Number(entry.tokens) < 0))
    || (entry.version !== undefined && typeof entry.version !== 'string')
    || (entry.execution_mode !== undefined && typeof entry.execution_mode !== 'string')
    || entry.functions.some(fn => !object(fn) || typeof fn.name !== 'string' || !fn.name))) {
    throw new ApiError('Engine returned an invalid installed-tool catalog', 200, 'INVALID_TOOLS_RESPONSE', 'tools.list');
  }
  return value as ToolCatalogEntry[];
}

/** Existing components facade, projected from actual registry entries rather than guessed metadata. */
export async function componentCatalog(kind?: string, signal?: AbortSignal): Promise<ComponentCatalog> {
  const entries = await listTools(kind, signal);
  const rich: ComponentCatalog['rich'] = { skill: [], plugin: [], mcp: [] };
  for (const entry of entries) rich[entry.category].push(entry);
  return { rich, skill: rich.skill.map(entry => entry.id), plugin: rich.plugin.map(entry => entry.id),
    mcp: rich.mcp.map(entry => entry.id) };
}

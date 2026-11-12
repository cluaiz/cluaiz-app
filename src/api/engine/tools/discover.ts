import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

export interface ToolMatch { id: string; category: string; score: number; level?: string; summary?: string; matched?: string[]; load_cost_tokens?: number }
export interface ToolDiscovery { query: string; installed: number; actionable: boolean; candidates: ToolMatch[] }

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/** Which installed tools the chat would offer for this message; runs nothing. */
export async function discoverTools(query: string, signal?: AbortSignal): Promise<ToolDiscovery> {
    if (!query.trim()) throw new ApiError('Type a message to test', 400, 'INVALID_TOOL_QUERY', 'tools.discover');
    const result = await callCep<unknown>('tools.discover', { query }, { signal });
    if (!object(result) || !Array.isArray(result.candidates) || typeof result.actionable !== 'boolean'
        || !result.candidates.every(item => object(item) && typeof item.id === 'string' && typeof item.score === 'number')) {
        throw new ApiError('Engine returned an invalid tool match', 200, 'INVALID_TOOL_RESPONSE', 'tools.discover');
    }
    return result as unknown as ToolDiscovery;
}

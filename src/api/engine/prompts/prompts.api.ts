import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { EnginePrompt, PromptVersion } from './prompts.types';

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const invalid = (method: string) => new ApiError('Engine returned an invalid prompts response', 200, 'INVALID_PROMPTS_RESPONSE', method);

function prompt(value: unknown, method: string, id?: string): EnginePrompt {
    if (!object(value) || !text(value.id) || !value.id || (id !== undefined && value.id !== id) || !text(value.text)
        || !text(value.description) || typeof value.overridden !== 'boolean'
        || !Array.isArray(value.variables) || !value.variables.every(text)) throw invalid(method);
    return value as unknown as EnginePrompt;
}

const one = async (method: string, params: { id: string; text?: string }, signal?: AbortSignal) => {
    const result = await callCep<unknown>(method, params, { signal });
    if (!object(result)) throw invalid(method);
    return prompt(result.prompt, method, params.id);
};

/** The Engine's model prompts; a change applies to every later request. */
export const promptsApi = {
    list: async (signal?: AbortSignal): Promise<EnginePrompt[]> => {
        const result = await callCep<unknown>('prompts.list', {}, { signal });
        if (!object(result) || !Array.isArray(result.prompts)) throw invalid('prompts.list');
        return result.prompts.map(value => prompt(value, 'prompts.list'));
    },
    get: (id: string, signal?: AbortSignal) => one('prompts.get', { id }, signal),
    set: async (id: string, value: string, signal?: AbortSignal): Promise<EnginePrompt> => {
        const saved = await one('prompts.set', { id, text: value }, signal);
        if (saved.text !== value || !saved.overridden) throw invalid('prompts.set');
        return saved;
    },
    reset: async (id: string, signal?: AbortSignal): Promise<EnginePrompt> => {
        const saved = await one('prompts.reset', { id }, signal);
        if (saved.overridden) throw invalid('prompts.reset');
        return saved;
    },
    history: async (id: string, signal?: AbortSignal): Promise<PromptVersion[]> => {
        const result = await callCep<unknown>('prompts.history', { id }, { signal });
        if (!object(result) || result.id !== id || !Array.isArray(result.history)
            || !result.history.every(item => object(item) && text(item.text) && text(item.replaced_at))) throw invalid('prompts.history');
        return result.history as PromptVersion[];
    },
};

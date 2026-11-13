import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { ModelProvider, ProviderModel, ProviderSave, ProviderTest } from './providers.types';

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const invalid = (method: string) => new ApiError('Engine returned an invalid provider response', 200, 'INVALID_PROVIDER_RESPONSE', method);
/** Provider names become the first part of model names: letters, digits, - and _ */
export const PROVIDER_NAME = /^[A-Za-z0-9_-]+$/;

function models(value: unknown, method: string): ProviderModel[] {
    if (!Array.isArray(value) || !value.every(item => object(item) && text(item.id) && text(item.model))) throw invalid(method);
    return value as ProviderModel[];
}

function provider(value: unknown, method: string): ModelProvider {
    if (!object(value) || !text(value.name) || !text(value.base_url) || typeof value.key !== 'string') throw invalid(method);
    return { ...(value as unknown as ModelProvider), models: models(value.models ?? [], method) };
}

/** Model providers (OpenAI-compatible or Anthropic APIs) kept by the Engine in providers.json. */
export const providersApi = {
    list: async (signal?: AbortSignal): Promise<ModelProvider[]> => {
        const result = await callCep<unknown>('providers.list', {}, { signal });
        if (!object(result) || !Array.isArray(result.providers)) throw invalid('providers.list');
        return result.providers.map(item => provider(item, 'providers.list'));
    },
    /** The models the provider itself offers (its GET /models). */
    available: async (name: string, signal?: AbortSignal): Promise<ProviderModel[]> => {
        const result = await callCep<unknown>('providers.models', { name }, { signal });
        if (!object(result)) throw invalid('providers.models');
        return models(result.models, 'providers.models');
    },
    save: async (params: ProviderSave, signal?: AbortSignal): Promise<ModelProvider> => {
        if (!PROVIDER_NAME.test(params.name) || !/^https?:\/\//.test(params.base_url.trim())) {
            throw new ApiError('A provider needs a name (letters, digits, - and _) and an http(s) base URL', 400, 'INVALID_PROVIDER_INPUT', 'providers.set');
        }
        const result = await callCep<unknown>('providers.set', { ...params, base_url: params.base_url.trim() }, { signal });
        if (!object(result)) throw invalid('providers.set');
        const saved = provider(result.provider, 'providers.set');
        if (saved.name !== params.name) throw invalid('providers.set');
        return saved;
    },
    remove: async (name: string, signal?: AbortSignal): Promise<void> => {
        const result = await callCep<unknown>('providers.remove', { name }, { signal });
        if (!object(result) || result.removed !== name) throw invalid('providers.remove');
    },
    /** One short real request: the URL, the key and the model work. */
    test: async (name: string, model?: string, signal?: AbortSignal): Promise<ProviderTest> => {
        const result = await callCep<unknown>('providers.test', { name, ...(model && { model }) }, { signal });
        if (!object(result) || typeof result.answer !== 'string' || !text(result.model)) throw invalid('providers.test');
        return result as unknown as ProviderTest;
    },
};

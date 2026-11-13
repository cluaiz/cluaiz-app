import supported from './supportedProviders.json';
import { readPublicCatalogue } from './public';

export type CloudModelKind = 'chat' | 'embedding' | 'tts' | 'stt';
/** US dollars per million tokens */
export interface CloudPrice { input: number; output: number; cacheRead?: number }
export interface CloudModel {
    id: string; name: string; description: string; family: string; kind: CloudModelKind;
    context?: number; output?: number; price?: CloudPrice;
    inputs: string[]; tools: boolean; reasoning: boolean; openWeights: boolean;
    knowledge: string; released: string; updated: string; status: string;
}
export interface CloudProvider {
    id: string; name: string; api: string; env: string[]; doc: string;
    /** The Engine's provider tests cover this provider's stream format */
    tested: boolean;
    models: CloudModel[];
}
interface SupportedProvider { base_url?: string; tested?: boolean }

const SOURCE = 'https://models.dev/api.json';
/**
 * Providers the Engine supports, by models.dev id: the ones with recorded streams in the Engine's
 * provider tests are `tested`, the others are formats the Engine tells from their URL.
 * `base_url` is given where models.dev names none.
 */
const SUPPORTED: Record<string, SupportedProvider> = supported;
const isSupported = (id: string) => Object.prototype.hasOwnProperty.call(SUPPORTED, id);
const KINDS: Record<string, CloudModelKind> = { chat: 'chat', embedding: 'embedding', speech: 'tts', transcription: 'stt' };

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 2048) : '';
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const number = (value: unknown, min: number) => typeof value === 'number' && Number.isFinite(value) && value >= min ? value : undefined;

function baseUrl(id: string, provider: Record<string, unknown>): string {
    try {
        const url = new URL(SUPPORTED[id].base_url || text(provider.api));
        return url.protocol === 'https:' ? url.href.replace(/\/+$/, '') : '';
    } catch { return ''; }
}

function model(id: string, value: unknown): CloudModel | null {
    if (!object(value)) return null;
    const kind = KINDS[text(value.type) || 'chat'];
    if (!kind) return null;
    const limit = object(value.limit) ? value.limit : {}, cost = object(value.cost) ? value.cost : {};
    const input = number(cost.input, 0), output = number(cost.output, 0), cacheRead = number(cost.cache_read, 0);
    return {
        id, name: text(value.name) || id, description: text(value.description), family: text(value.family), kind,
        context: number(limit.context, 1), output: number(limit.output, 1),
        price: input !== undefined && output !== undefined ? { input, output, ...(cacheRead !== undefined && { cacheRead }) } : undefined,
        inputs: strings(object(value.modalities) ? value.modalities.input : []),
        tools: value.tool_call === true, reasoning: value.reasoning === true, openWeights: value.open_weights === true,
        knowledge: text(value.knowledge), released: text(value.release_date), updated: text(value.last_updated), status: text(value.status),
    };
}

/** models.dev reduced to the providers the Engine supports, with the fields the App shows; this is what is saved. */
export function keepProviders(value: unknown): CloudProvider[] {
    if (!object(value)) throw new Error('Invalid provider catalogue');
    return Object.keys(SUPPORTED).flatMap(id => {
        const provider = value[id];
        if (!object(provider) || !object(provider.models)) return [];
        const api = baseUrl(id, provider);
        const models = Object.entries(provider.models).map(([key, item]) => model(key, item)).filter((item): item is CloudModel => !!item);
        return api && models.length ? [{ id, name: text(provider.name) || id, api, env: strings(provider.env), doc: text(provider.doc),
            tested: SUPPORTED[id].tested === true, models }] : [];
    });
}

export function parseProviders(value: unknown): CloudProvider[] {
    if (!Array.isArray(value) || value.length > Object.keys(SUPPORTED).length) throw new Error('Invalid provider catalogue');
    if (!value.every(item => object(item) && isSupported(text(item.id)) && text(item.api) && Array.isArray(item.models))) {
        throw new Error('Invalid provider entry');
    }
    return value as CloudProvider[];
}

/** Only supported providers' logos are asked for, so the names of custom providers never leave this device. */
export const providerLogo = (id: string) => isSupported(id) ? `https://models.dev/logos/${encodeURIComponent(id)}.svg` : '';

/** Read when the Cloud list is first opened, then kept on this device and refreshed once a day. */
export const providerCatalogue = {
    source: SOURCE,
    list: (refresh = false) => readPublicCatalogue(SOURCE, parseProviders, refresh, keepProviders),
};

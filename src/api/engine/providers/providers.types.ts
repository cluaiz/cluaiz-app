/** A model of a provider; `model` is its full name `<provider>/<id>`, used in chat and settings. */
export interface ProviderModel { id: string; model: string; context?: number; kind?: string }

/** A model provider saved in the Engine's providers.json; its key is never returned. */
export interface ModelProvider {
    name: string;
    base_url: string;
    /** Where the key comes from, e.g. `env GROQ_API_KEY`, `in providers.json`, `none` */
    key: string;
    type: string;
    models: ProviderModel[];
}

export interface ProviderSave {
    name: string;
    base_url: string;
    /** The key itself; leave out (with `api_key_env`) to keep the current one */
    api_key?: string;
    api_key_env?: string;
    /** Listed models: id → context size in tokens */
    models?: Record<string, { context?: number }>;
}

export interface ProviderTest { answer: string; model: string; ms: number }

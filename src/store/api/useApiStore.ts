import { create } from 'zustand';
import { ApiEndpoint, ApiGroup, ApiProtocol, ExecutionMetrics, HttpMethod, InstalledModel, VoiceOption } from '../../features/api/types';
import { useConnectionStore } from '../engine/useConnectionStore';

interface ApiStoreState {
    apiData: ApiGroup[];
    isLoadingData: boolean;
    activeEndpoint: ApiEndpoint | null;
    activeCategory: string | null;
    searchQuery: string;
    installedModels: InstalledModel[];
    selectedModel: string;
    availableVoices: VoiceOption[];
    selectedVoice: string;
    reqMethod: HttpMethod;
    reqProtocol: ApiProtocol;
    reqUrl: string;
    reqHeaders: string;
    reqBody: string;
    reqLanguage: string;
    responseBody: string;
    responseMetrics: ExecutionMetrics | null;
    audioData: string | null;
    isExecuting: boolean;
    activeTab: 'params' | 'headers' | 'docs' | 'snippets';
    activeResTab: 'json' | 'preview' | 'audio';
    layoutOrientation: 'bottom' | 'right';

    // Actions
    loadApiData: () => Promise<void>;
    selectEndpoint: (ep: ApiEndpoint, forceDefaultPayload?: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSelectedModel: (modelId: string) => void;
    setSelectedVoice: (voiceId: string) => void;
    setReqMethod: (method: HttpMethod) => void;
    setReqProtocol: (protocol: ApiProtocol) => void;
    setReqUrl: (url: string) => void;
    setReqHeaders: (headers: string) => void;
    setReqBody: (body: string) => void;
    setReqLanguage: (lang: string) => void;
    setActiveTab: (tab: 'params' | 'headers' | 'docs' | 'snippets') => void;
    setActiveResTab: (tab: 'json' | 'preview' | 'audio') => void;
    setLayoutOrientation: (orientation: 'bottom' | 'right') => void;
    setExecuting: (executing: boolean) => void;
    setResponse: (metrics: ExecutionMetrics, body: string, audio?: string | null) => void;
    appendStreamingResponse: (chunk: string, metrics?: Partial<ExecutionMetrics>) => void;
    resetPayload: () => void;
}

const DATA_FILES = [
    'system.json',
    'inference.json',
    'tools.json',
    'execution.json',
    'models.json',
    'plugins.json',
    'skills.json',
    'mcp.json',
    'config.json',
    'tuning.json'
];

export const useApiStore = create<ApiStoreState>()((set, get) => ({
    apiData: [],
    isLoadingData: false,
    activeEndpoint: null,
    activeCategory: null,
    searchQuery: '',
    installedModels: [],
    selectedModel: 'auto',
    availableVoices: [{ value: 'default', label: 'Default Voice' }],
    selectedVoice: 'default',
    reqMethod: 'GET',
    reqProtocol: useConnectionStore.getState().protocol === 'ffi' ? 'c-pointer' : 'http',
    reqUrl: '',
    reqHeaders: JSON.stringify({ 'Content-Type': 'application/json' }, null, 2),
    reqBody: '',
    reqLanguage: 'json',
    responseBody: 'Hit "Send" to execute the request.',
    responseMetrics: null,
    audioData: null,
    isExecuting: false,
    activeTab: 'params',
    activeResTab: 'json',
    layoutOrientation: 'bottom',

    loadApiData: async () => {
        set({ isLoadingData: true });
        try {
            const results = await Promise.all(
                DATA_FILES.map(async (file) => {
                    try {
                        const res = await fetch(`/data/${file}`);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return (await res.json()) as ApiGroup;
                    } catch (err) {
                        console.warn(`[useApiStore] Failed to load /data/${file}:`, err);
                        return null;
                    }
                })
            );

            const validGroups = results.filter((g): g is ApiGroup => g !== null && Array.isArray(g.endpoints));
            set({ apiData: validGroups, isLoadingData: false });

            // Fetch installed models dynamically from configured gateway
            try {
                const baseUrl = useConnectionStore.getState().getBaseUrl();
                const modelRes = await fetch(`${baseUrl}/v1/models/installed`);
                if (modelRes.ok) {
                    const data = await modelRes.json();
                    if (data && Array.isArray(data.models)) {
                        set({ installedModels: data.models });
                    }
                }
            } catch (err) {
                console.warn('[useApiStore] Could not fetch installed models from gateway:', err);
            }

            // If no active endpoint is selected, pick the first one
            if (!get().activeEndpoint && validGroups.length > 0 && validGroups[0].endpoints.length > 0) {
                get().selectEndpoint(validGroups[0].endpoints[0]);
            }
        } catch (e) {
            console.error('[useApiStore] Error in loadApiData:', e);
            set({ isLoadingData: false });
        }
    },

    selectEndpoint: (ep: ApiEndpoint, forceDefaultPayload = false) => {
        const { getBaseUrl } = useConnectionStore.getState();
        const baseUrl = getBaseUrl();
        const currentGroup = get().apiData.find((g) => g.endpoints.some((e) => e.path === ep.path));

        const isRawCode = ep.path.includes('/cel/execute') || ep.path.includes('/execute/');
        const targetProtocol: ApiProtocol = ep.path.includes('/execute/') ? 'c-pointer' : 'http';

        // Check for saved payload in localStorage unless forceDefault is requested
        const storageKey = `cluaiz_payload_${ep.method}_${ep.path}`;
        if (forceDefaultPayload) {
            localStorage.removeItem(storageKey);
        }
        const savedPayload = forceDefaultPayload ? null : localStorage.getItem(storageKey);

        let defaultBody = '';
        if (savedPayload && savedPayload.trim().length > 0) {
            defaultBody = savedPayload;
        } else if (ep.request_payload && ep.request_payload.trim().length > 0) {
            defaultBody = ep.request_payload;
        } else if (ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'DELETE') {
            if (isRawCode) {
                defaultBody = ep.params?.[0]?.default ?? '';
            } else if (ep.params && ep.params.length > 0) {
                const obj: Record<string, any> = {};
                ep.params.forEach((p) => {
                    if (p.default !== undefined) {
                        obj[p.name] = p.default;
                    } else if (p.type === 'string') {
                        obj[p.name] = 'value';
                    } else if (p.type === 'integer' || p.type === 'float') {
                        obj[p.name] = 0;
                    } else if (p.type === 'array') {
                        obj[p.name] = [];
                    } else if (p.type === 'boolean') {
                        obj[p.name] = false;
                    } else {
                        obj[p.name] = null;
                    }
                });
                defaultBody = JSON.stringify(obj, null, 2);
            } else {
                defaultBody = '{}';
            }
        }

        const targetUrl = targetProtocol === 'c-pointer' 
            ? 'cluaiz_engine_invoke(ptr)' 
            : `${baseUrl}${ep.path}`;

        set({
            activeEndpoint: ep,
            activeCategory: currentGroup?.group || null,
            reqMethod: ep.method,
            reqProtocol: targetProtocol,
            reqUrl: targetUrl,
            reqBody: defaultBody,
            reqLanguage: isRawCode ? 'cel' : 'json',
            activeTab: 'params',
            responseBody: 'Hit "Send" to execute the request.',
            responseMetrics: null,
            audioData: null,
            activeResTab: 'json'
        });
    },

    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedModel: (selectedModel) => {
        set({ selectedModel });
        // Dynamically update model field inside JSON payload if valid JSON
        try {
            const current = get().reqBody;
            if (current.trim().startsWith('{')) {
                const obj = JSON.parse(current);
                obj.model = selectedModel;
                set({ reqBody: JSON.stringify(obj, null, 2) });
            }
        } catch {
            // Ignore non-JSON payloads
        }
    },
    setSelectedVoice: (selectedVoice) => {
        set({ selectedVoice });
        try {
            const current = get().reqBody;
            if (current.trim().startsWith('{')) {
                const obj = JSON.parse(current);
                if (!obj.parameters) obj.parameters = {};
                obj.parameters.voice_id = selectedVoice;
                set({ reqBody: JSON.stringify(obj, null, 2) });
            }
        } catch {
            // Ignore non-JSON payloads
        }
    },
    setReqMethod: (reqMethod) => set({ reqMethod }),
    setReqProtocol: (reqProtocol) => {
        const { getBaseUrl } = useConnectionStore.getState();
        const ep = get().activeEndpoint;
        const targetUrl = reqProtocol === 'c-pointer'
            ? 'cluaiz_engine_invoke(ptr)'
            : `${getBaseUrl()}${ep ? ep.path : '/health'}`;
        set({ reqProtocol, reqUrl: targetUrl });
    },
    setReqUrl: (reqUrl) => set({ reqUrl }),
    setReqHeaders: (reqHeaders) => set({ reqHeaders }),
    setReqBody: (reqBody) => {
        set({ reqBody });
        const ep = get().activeEndpoint;
        if (ep) {
            localStorage.setItem(`cluaiz_payload_${ep.method}_${ep.path}`, reqBody);
        }
    },
    setReqLanguage: (reqLanguage) => set({ reqLanguage }),
    setActiveTab: (activeTab) => set({ activeTab }),
    setActiveResTab: (activeResTab) => set({ activeResTab }),
    setLayoutOrientation: (layoutOrientation) => set({ layoutOrientation }),
    setExecuting: (isExecuting) => set({ isExecuting }),
    setResponse: (responseMetrics, responseBody, audioData = null) => {
        set({
            responseMetrics,
            responseBody,
            audioData,
            activeResTab: audioData ? 'audio' : 'json'
        });
    },
    appendStreamingResponse: (chunk, metrics) => {
        set((state) => ({
            responseBody: state.responseBody === 'Sending request...' ? chunk : state.responseBody + chunk,
            responseMetrics: state.responseMetrics ? { ...state.responseMetrics, ...metrics } : null
        }));
    },
    resetPayload: () => {
        const ep = get().activeEndpoint;
        if (ep) {
            get().selectEndpoint(ep, true);
        }
    }
}));

import { create } from 'zustand';
import { ApiEndpoint, ApiGroup, ApiProtocol, ExecutionMetrics, HttpMethod, InstalledModel, VoiceOption } from '../../features/api/types';
import { useConnectionStore } from '../engine/useConnectionStore';
import { http, modelsApi } from '../../api';
import { AUDIO_ENDPOINTS } from '../../api/engine/audio/audio.endpoints';
import { pushApiRoute } from '../../core/router';

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
    /** The streamed speech was already played sentence by sentence (no autoplay of the whole) */
    audioPlayedLive: boolean;
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
    'filesystem.json',
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

export async function fetchActiveBearerToken(): Promise<string | null> {
    const rawToken = http.getToken();
    if (!rawToken) return null;
    return rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;
}

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
    audioPlayedLive: false,
    isExecuting: false,
    activeTab: 'params',
    activeResTab: 'json',
    layoutOrientation: typeof localStorage !== 'undefined' && localStorage.getItem('cluaiz_api_layout_orientation') === 'right' ? 'right' : 'bottom',

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

            // Fetch installed models dynamically via centralized modelsApi
            try {
                const data = await modelsApi.getInstalled();
                if (data && Array.isArray(data.models)) {
                    set({ installedModels: data.models as any });
                }
            } catch (err) {
                console.warn('[useApiStore] Could not fetch installed models from gateway:', err);
            }

            // Resolve target endpoint & tab:
            // 1. URL search params (?endpoint=...&method=...&tab=...)
            // 2. localStorage last visited endpoint
            // 3. Fallback to first endpoint in validGroups
            let targetEp: ApiEndpoint | null = null;
            let targetTab: 'params' | 'headers' | 'docs' | 'snippets' | null = null;

            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const urlPath = params.get('endpoint');
                const urlMethod = params.get('method');
                const urlTab = params.get('tab');

                if (urlTab && ['params', 'headers', 'docs', 'snippets'].includes(urlTab)) {
                    targetTab = urlTab as 'params' | 'headers' | 'docs' | 'snippets';
                }

                if (urlPath) {
                    for (const group of validGroups) {
                        const found = group.endpoints.find(
                            (e) =>
                                e.path === urlPath &&
                                (!urlMethod || e.method.toUpperCase() === urlMethod.toUpperCase())
                        );
                        if (found) {
                            targetEp = found;
                            break;
                        }
                    }
                }
            }

            // Fallback to localStorage if no URL endpoint
            if (!targetEp && typeof localStorage !== 'undefined') {
                try {
                    const saved = localStorage.getItem('cluaiz_api_last_endpoint');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed?.path) {
                            for (const group of validGroups) {
                                const found = group.endpoints.find(
                                    (e) =>
                                        e.path === parsed.path &&
                                        (!parsed.method || e.method.toUpperCase() === parsed.method.toUpperCase())
                                );
                                if (found) {
                                    targetEp = found;
                                    break;
                                }
                            }
                        }
                    }
                } catch (_) { }
            }

            // Fallback to first available endpoint
            if (!targetEp && validGroups.length > 0 && validGroups[0].endpoints.length > 0) {
                targetEp = validGroups[0].endpoints[0];
            }

            if (targetEp) {
                get().selectEndpoint(targetEp);
                if (targetTab) {
                    get().setActiveTab(targetTab);
                }
            }

            // Auto-fetch active token and sync into reqHeaders
            try {
                const bearer = await fetchActiveBearerToken();
                if (bearer) {
                    set({
                        reqHeaders: JSON.stringify({
                            'Content-Type': 'application/json',
                            'Authorization': bearer
                        }, null, 2)
                    });
                }
            } catch (_) { }
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
            audioPlayedLive: false,
            activeResTab: 'json'
        });

        // Persist last selected endpoint for seamless session restoration on refresh
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(
                    'cluaiz_api_last_endpoint',
                    JSON.stringify({ path: ep.path, method: ep.method })
                );
            } catch (_) { }
        }

        // Synchronize browser URL query with selected endpoint and activeTab
        pushApiRoute(ep.path, ep.method, get().activeTab);

        // Ensure Authorization header stays in sync with active token
        const currentHeaders = get().reqHeaders;
        try {
            const parsed = JSON.parse(currentHeaders || '{}');
            fetchActiveBearerToken().then((token) => {
                if (token) {
                    const updated = {
                        'Content-Type': parsed['Content-Type'] || 'application/json',
                        ...parsed,
                        'Authorization': token
                    };
                    set({ reqHeaders: JSON.stringify(updated, null, 2) });
                } else if (parsed['Authorization']) {
                    const { Authorization: _, ...rest } = parsed;
                    set({ reqHeaders: JSON.stringify(rest, null, 2) });
                }
            });
        } catch (_) { }

        // Fetch markdown documentation if docs_url is specified and docs_content not yet cached
        if (ep.docs_url && !ep.docs_content) {
            (async () => {
                try {
                    // Try local frontend static public route first (instant & reliable)
                    let r = await fetch(ep.docs_url!);
                    if (!r.ok && baseUrl) {
                        r = await fetch(`${baseUrl}${ep.docs_url}`);
                    }
                    if (!r.ok) return;
                    const text = await r.text();
                    if (!text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
                        set((state) => {
                            if (state.activeEndpoint && state.activeEndpoint.path === ep.path) {
                                return {
                                    activeEndpoint: {
                                        ...state.activeEndpoint,
                                        docs_content: text
                                    }
                                };
                            }
                            return {};
                        });
                    }
                } catch (_) { }
            })();
        }
    },

    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedModel: (selectedModel) => {
        set({ selectedModel });
        const ep = get().activeEndpoint;
        const isModelEndpoint = ep && (
            ep.path.toLowerCase().includes('/chat') ||
            ep.path.toLowerCase().includes('/completion') ||
            ep.path.toLowerCase().includes('/embedding') ||
            ep.path.toLowerCase().includes('/plan') ||
            ep.path.toLowerCase().includes('/audio') ||
            ep.path.toLowerCase().includes('/ingest')
        );

        // Dynamically update model field inside JSON payload only for model-compatible endpoints
        try {
            const current = get().reqBody;
            if (current.trim().startsWith('{')) {
                const obj = JSON.parse(current);
                if (isModelEndpoint || 'model' in obj) {
                    obj.model = selectedModel;
                    set({ reqBody: JSON.stringify(obj, null, 2) });
                }
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
                if (get().activeEndpoint?.path === AUDIO_ENDPOINTS.SPEECH) {
                    // Speech uses top-level voice; omission selects the package default.
                    if (selectedVoice === 'default') delete obj.voice;
                    else obj.voice = selectedVoice;
                    if (obj.parameters) {
                        delete obj.parameters.voice_id;
                        if (Object.keys(obj.parameters).length === 0) delete obj.parameters;
                    }
                } else {
                    if (!obj.parameters) obj.parameters = {};
                    if (selectedVoice === 'default') delete obj.parameters.voice_id;
                    else obj.parameters.voice_id = selectedVoice;
                    if (Object.keys(obj.parameters).length === 0) delete obj.parameters;
                }
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
    setActiveTab: (activeTab) => {
        set({ activeTab });
        const ep = get().activeEndpoint;
        if (ep) {
            pushApiRoute(ep.path, ep.method, activeTab, true);
        }
    },
    setActiveResTab: (activeResTab) => set({ activeResTab }),
    setLayoutOrientation: (layoutOrientation) => {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('cluaiz_api_layout_orientation', layoutOrientation);
            } catch (_) { }
        }
        set({ layoutOrientation });
    },
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

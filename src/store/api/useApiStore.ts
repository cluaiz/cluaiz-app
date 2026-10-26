import { create } from 'zustand';
import { ApiEndpoint, ApiGroup, ApiProtocol, ExecutionMetrics, HttpMethod, InstalledModel, VoiceOption } from '../../features/api/types';
import { useConnectionStore } from '../engine/useConnectionStore';
import { http } from '../../api';
import { discoverInstalledModels } from '../../features/api/services/catalogDiscovery';
import { requestParams, parsedParams, requestPath, methodPath } from '../../features/api/utils/requestPayload';
import { AUDIO_ENDPOINTS } from '../../api/engine/audio/audio.endpoints';
import { endpointUsesModel, initialModelForPayload, isEmbeddingModel } from '../../features/api/utils/modelFilter';
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
    selectEndpoint: (ep: ApiEndpoint | null, forceDefaultPayload?: boolean) => void;
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
    applyPayloadExample: (id: string) => void;
}

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
            const response = await fetch('/data/api-catalog.json');
            if (!response.ok) throw new Error(`API catalog HTTP ${response.status}`);
            const validGroups: ApiGroup[] = await response.json();
            if (!Array.isArray(validGroups) || validGroups.some(group => !Array.isArray(group.endpoints))) {
                throw new Error('Invalid API catalog');
            }
            set({ apiData: validGroups, isLoadingData: false });

            // Registry metadata comes through CEP using the configured App transport.
            try {
                set({ installedModels: await discoverInstalledModels() });
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

            if (targetEp) {
                get().selectEndpoint(targetEp);
                if (targetTab) {
                    get().setActiveTab(targetTab);
                }
            } else {
                set({ activeEndpoint: null });
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

    selectEndpoint: (ep: ApiEndpoint | null, forceDefaultPayload = false) => {
        if (!ep) {
            set({
                activeEndpoint: null,
                activeCategory: null,
                responseMetrics: null,
                audioData: null,
                audioPlayedLive: false
            });
            if (typeof localStorage !== 'undefined') {
                try {
                    localStorage.removeItem('cluaiz_api_last_endpoint');
                } catch (_) { }
            }
            pushApiRoute('');
            return;
        }

        const { getBaseUrl } = useConnectionStore.getState();
        const baseUrl = getBaseUrl();
        const currentGroup = get().apiData.find((g) => g.endpoints.some((e) => e.path === ep.path));

        const targetProtocol = get().reqProtocol;

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
            if (ep.params && ep.params.length > 0) {
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

        const targetUrl = `${baseUrl}${requestPath(ep)}`;

        set({
            activeEndpoint: ep,
            activeCategory: currentGroup?.group || null,
            reqMethod: ep.method,
            reqProtocol: targetProtocol,
            reqUrl: targetUrl,
            reqBody: defaultBody,
            reqLanguage: 'json',
            activeTab: 'params',
            responseBody: 'Hit "Send" to execute the request.',
            responseMetrics: null,
            audioData: null,
            audioPlayedLive: false,
            activeResTab: 'json'
        });

        // Prefer a valid saved/example model, then the current task-compatible selection.
        if (endpointUsesModel(ep)) {
            const selected = initialModelForPayload(ep, get().installedModels, defaultBody, get().selectedModel);
            if (selected !== undefined && (selected || methodPath(ep.path).includes('/ingest'))) {
                set({ selectedModel: selected }); // Keep the saved/example voice when opening a route.
                get().setSelectedModel(selected);
            }
            else set({ selectedModel: '' });
        }

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

        // Examples are separate static resources so endpoint schemas stay small.
        if (ep.payload_examples_url && !ep.payload_examples) {
            fetch(ep.payload_examples_url).then(async response => {
                if (!response.ok) return;
                const examples = await response.json();
                if (!Array.isArray(examples)) return;
                set(state => state.activeEndpoint?.path === ep.path
                    ? {activeEndpoint: {...state.activeEndpoint, payload_examples: examples}} : {});
            }).catch(() => { /* The default body remains available if examples cannot load. */ });
        }

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
        const changed = get().selectedModel !== selectedModel;
        set({ selectedModel });
        const ep = get().activeEndpoint;
        if (!endpointUsesModel(ep)) return;

        if (ep?.method === 'GET') {
            if (get().reqProtocol === 'http') {
                try {
                    const url = new URL(get().reqUrl);
                    url.searchParams.set('model', selectedModel);
                    set({ reqUrl: url.toString() });
                } catch { /* Keep a manually edited/incomplete URL editable. */ }
            }
            return;
        }

        // Dynamically update model field inside JSON payload only for model-compatible endpoints
        try {
            const current = get().reqBody;
            if (current.trim().startsWith('{')) {
                const payload = JSON.parse(current);
                const obj = requestParams(ep, payload);
                if (ep && methodPath(ep.path).includes('/ingest')) {
                    if (!selectedModel) {
                        delete obj.model;
                        delete obj.vision_settings;
                        if (obj.output_controls) delete obj.output_controls.return_embeddings;
                        if (obj.output_controls && Object.keys(obj.output_controls).length === 0) delete obj.output_controls;
                    } else {
                        obj.model = selectedModel;
                        const model = get().installedModels.find(m => m.id === selectedModel);
                        if (model && isEmbeddingModel(model)) {
                            delete obj.vision_settings;
                            obj.output_controls = {...obj.output_controls, return_embeddings: true};
                        } else if (obj.output_controls) delete obj.output_controls.return_embeddings;
                    }
                } else obj.model = selectedModel;
                if (changed && (ep?.path === AUDIO_ENDPOINTS.SPEECH || ep?.path === 'audio.run')) {
                    delete obj.voice; // Speaker IDs/references belong to the selected package.
                    if (obj.parameters) {
                        delete obj.parameters.voice_id;
                        if (Object.keys(obj.parameters).length === 0) delete obj.parameters;
                    }
                    set({ selectedVoice: 'default' });
                }
                get().setReqBody(JSON.stringify(payload, null, 2));
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
                const payload = JSON.parse(current);
                const obj = requestParams(get().activeEndpoint, payload);
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
                get().setReqBody(JSON.stringify(payload, null, 2));
            }
        } catch {
            // Ignore non-JSON payloads
        }
    },
    setReqMethod: (reqMethod) => set({ reqMethod }),
    setReqProtocol: (reqProtocol) => {
        const { getBaseUrl } = useConnectionStore.getState();
        const ep = get().activeEndpoint;
        const targetUrl = `${getBaseUrl()}${ep ? requestPath(ep) : '/health'}`;
        set({ reqProtocol, reqUrl: targetUrl });
        if (ep?.method === 'GET' && endpointUsesModel(ep) && get().selectedModel) {
            get().setSelectedModel(get().selectedModel);
        }
    },
    setReqUrl: (reqUrl) => set({ reqUrl }),
    setReqHeaders: (reqHeaders) => set({ reqHeaders }),
    setReqBody: (reqBody) => {
        set({ reqBody });
        const ep = get().activeEndpoint;
        if (endpointUsesModel(ep)) {
            try {
                const payload = parsedParams(reqBody);
                if (typeof payload.model === 'string') set({ selectedModel: payload.model });
                if (ep?.path === AUDIO_ENDPOINTS.SPEECH) set({ selectedVoice: payload.voice || 'default' });
            } catch { /* Preserve incomplete JSON while the user types. */ }
        }
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
    },
    applyPayloadExample: (id) => {
        const ep = get().activeEndpoint;
        const example = ep?.payload_examples?.find(item => item.id === id);
        if (!ep || !example) return;
        const selected = initialModelForPayload(ep, get().installedModels, example.payload,
            get().selectedModel, example.model_task);
        get().setReqBody(example.payload);
        if (endpointUsesModel(ep) && selected !== undefined) {
            set({ selectedModel: selected });
            get().setSelectedModel(selected);
        }
    }
}));

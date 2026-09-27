import { create } from 'zustand';
import { sendFFIMessage, listenToEngineStream, isTauri } from '../../core/tauri-api';
import { UnlistenFn } from '@tauri-apps/api/event';
import { useConnectionStore } from './useConnectionStore';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface InstalledModelFile {
    name: string;
    size_bytes: number;
    is_primary: boolean;
}

export interface InstalledModelMetadata {
    architecture?: string;
    parameters?: string;
    context_window?: string;
    quantization?: string | null;
    bit_depth?: string | null;
    backend_type?: string;
    chat_template?: string | null;
}

export interface InstalledModelDetail {
    id: string;
    category: 'chat' | 'embedding' | 'ingest' | 'tts' | 'stt' | string;
    format_type: 'gguf' | 'onnx' | string;
    local_dir: string;
    huggingface_repo?: string;
    files: InstalledModelFile[];
    extra_files?: string[];
    supported_tasks: string[];
    requires_gpu: boolean;
    metadata: InstalledModelMetadata;
}

export interface PermissionSchema {
    wasm_firewall: string;
    vectorize_user_input: boolean;
    vectorize_ai_response: boolean;
    stream_telemetry: boolean;
    lazy_load_model: boolean;
    temporary_chat_ttl_hours: number;
    chat_models: { text?: string | null; vision?: string | null; audio?: string | null };
    vector_models: { text?: string | null; vision?: string | null; audio?: string | null };
    ingest_models?: { vision?: string | null; document?: string | null };
    tts_models?: { audio?: string | null };
    stt_models?: { audio?: string | null };
    active_slots?: Record<string, any>;
    available_models?: string[];        // fallback full list
    available_chat_models?: string[];   // only generative/chat models
    available_vector_models?: string[]; // only embedding/vector models
    available_vision_ingest_models?: string[];
    available_tts_models?: string[];
    available_stt_models?: string[];
    available_devices?: string[];
}

export interface BoosterControl {
    mode_run: string;
    turbo_quant: string;
    flash_attention: string;
    speculative_decoding: string;
    auto_round: string;
    dflash: string;
    kv_cache_quantization: string;
    context_shifting: string;
    force_vram_reclaim: string;
    n_gpu_layers: number;
    think_mode: string;
    force_memory_lock: string;
    moe_vram_routing: string;
    custom_vram_buffer_gb?: number | null;
    custom_ram_buffer_gb?: number | null;
}

export interface HardwareInfo {
    vram_gb: number;
    ram_gb: number;
    gpu_name: string;
    cpu_cores: number;
    has_gpu: boolean;
}

export type SettingHealth = 'green' | 'yellow' | 'red';
export interface SettingAlert {
    level: SettingHealth;
    message: string;
}

interface EngineState {
    status: 'booting' | 'idle' | 'processing' | 'error';
    fetchStatus: 'idle' | 'loading' | 'success' | 'error';
    messages: ChatMessage[];
    activeStreamId: string | null;
    
    // Core Engine Settings from SSOT
    permissions: PermissionSchema | null;
    booster: BoosterControl | null;
    brainMode: boolean; // From system_control.json
    hardware: HardwareInfo | null;
    activeChatModel: any | null; // The loaded Chat ModelManifest
    activeVectorModel: any | null; // The loaded Vector ModelManifest
    installedModelsMap: Record<string, InstalledModelDetail>;
    
    // UI-only setting
    launchOnStartup: boolean;
    
    // Actions
    setStatus: (status: 'booting' | 'idle' | 'processing' | 'error') => void;
    setLaunchOnStartup: (value: boolean) => void;
    
    initEngineSettings: () => Promise<void>;
    updatePermission: (key: keyof PermissionSchema, value: any) => Promise<void>;
    updateBooster: (key: keyof BoosterControl, value: any) => Promise<void>;
    updateBoosterBuffer: (type: 'vram' | 'ram', value: number | null) => Promise<void>;
    updateModelSlot: (slotKey: 'chat' | 'vector' | 'ingest' | 'tts' | 'stt', modelId: string) => Promise<void>;
    setBrainMode: (value: boolean) => Promise<void>;
    resetBooster: () => Promise<void>;
    
    sendMessage: (text: string) => Promise<void>;
    appendStreamToken: (token: string) => void;
    initStreamListener: () => Promise<void>;
    unlistenFn: UnlistenFn | null;
}

export const useEngineStore = create<EngineState>()((set, get) => ({
    status: 'idle',
    fetchStatus: 'idle',
    messages: [],
    activeStreamId: null,
    unlistenFn: null,
    
    permissions: null,
    booster: null,
    brainMode: false,
    hardware: null,
    activeChatModel: null,
    activeVectorModel: null,
    installedModelsMap: {},
    launchOnStartup: true,

    setStatus: (status) => set({ status }),
    setLaunchOnStartup: (value) => set({ launchOnStartup: value }),

    initEngineSettings: async () => {
        set({ fetchStatus: 'loading' });
        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isTauri();

        const fetchViaHttp = async () => {
            try {
                const baseUrl = getBaseUrl();
                const [permRes, optRes, hwRes, modelsRes] = await Promise.allSettled([
                    fetch(`${baseUrl}/v1/system/permission`),
                    fetch(`${baseUrl}/v1/optimization/status`),
                    fetch(`${baseUrl}/hardware`),
                    fetch(`${baseUrl}/v1/models/installed`)
                ]);

                let permData: any = null;
                let optData: any = null;
                let hwData: any = null;
                let modelsData: any = null;

                if (permRes.status === 'fulfilled' && permRes.value.ok) {
                    permData = await permRes.value.json();
                }
                if (optRes.status === 'fulfilled' && optRes.value.ok) {
                    optData = await optRes.value.json();
                }
                if (hwRes.status === 'fulfilled' && hwRes.value.ok) {
                    hwData = await hwRes.value.json();
                }
                if (modelsRes.status === 'fulfilled' && modelsRes.value.ok) {
                    modelsData = await modelsRes.value.json();
                }

                if (!permData && !optData && !hwData) {
                    throw new Error("Unable to reach engine HTTP endpoints");
                }

                const rawPerm = permData?.permission || {};
                const rawOpt = optData?.optimization || {};
                const rawHw = hwData?.hardware || {};

                const installedModelsMap: Record<string, InstalledModelDetail> = {};
                if (modelsData) {
                    if (modelsData.installed_models && typeof modelsData.installed_models === 'object') {
                        Object.assign(installedModelsMap, modelsData.installed_models);
                    }
                    const rawList = Array.isArray(modelsData.models)
                        ? modelsData.models
                        : (Array.isArray(modelsData.installed) ? modelsData.installed : (Array.isArray(modelsData.data) ? modelsData.data : []));
                    for (const m of rawList) {
                        if (m && m.id) {
                            installedModelsMap[m.id] = m;
                        }
                    }
                }

                // Categorize models directly from registry map (Developer Hub Parity)
                const regChatModels = Object.keys(installedModelsMap).filter(id => {
                    const m = installedModelsMap[id];
                    return m.category === 'chat' || (!m.category && !id.includes('embed') && !id.includes('whisper') && !id.includes('tts') && !id.includes('ocr'));
                });
                const regVectorModels = Object.keys(installedModelsMap).filter(id => {
                    const m = installedModelsMap[id];
                    return m.category === 'embedding' || id.includes('embed') || id.includes('bge') || id.includes('nomic') || id.includes('minilm');
                });
                const regIngestModels = Object.keys(installedModelsMap).filter(id => {
                    const m = installedModelsMap[id];
                    return m.category === 'ingest' || m.category === 'vision' || id.includes('ocr') || id.includes('nougat') || id.includes('florence') || id.includes('table');
                });
                const regTtsModels = Object.keys(installedModelsMap).filter(id => {
                    const m = installedModelsMap[id];
                    return m.category === 'tts' || id.includes('kokoro') || id.includes('piper') || id.includes('melotts') || id.includes('tts');
                });
                const regSttModels = Object.keys(installedModelsMap).filter(id => {
                    const m = installedModelsMap[id];
                    return m.category === 'stt' || m.category === 'audio' || id.includes('whisper') || id.includes('moonshine') || id.includes('sensevoice');
                });

                const hasGpu = (rawHw?.active_drivers?.length ?? 0) > 0;
                const vram_gb = rawHw?.memory?.vram_gb || (hasGpu ? 4 : 0);
                const ram_gb = Math.round(rawHw?.memory?.total_capacity_gb || 16);
                const gpu_name = rawHw?.active_drivers?.[0]?.driver_id || (hasGpu ? 'Discrete GPU' : 'None');
                const cpu_cores = rawHw?.cpu?.physical_cores || 8;

                const booster: BoosterControl = {
                    mode_run: rawOpt.mode_run || 'balance',
                    turbo_quant: rawOpt.turbo_quant || 'Auto',
                    flash_attention: rawOpt.flash_attention || (hasGpu ? 'On' : 'Auto'),
                    speculative_decoding: rawOpt.speculative_decoding || 'Off',
                    auto_round: rawOpt.auto_round || 'Auto',
                    dflash: rawOpt.dflash || 'Auto',
                    kv_cache_quantization: rawOpt.kv_cache_quantization || 'Auto',
                    context_shifting: rawOpt.context_shifting || 'Auto',
                    force_vram_reclaim: rawOpt.force_vram_reclaim || 'Off',
                    n_gpu_layers: rawOpt.n_gpu_layers ?? (hasGpu ? -1 : 0),
                    think_mode: rawOpt.think_mode || 'Auto',
                    force_memory_lock: rawOpt.force_memory_lock || 'Auto',
                    moe_vram_routing: rawOpt.extreme_moe_streaming || rawOpt.moe_vram_routing || 'Off',
                    custom_vram_buffer_gb: rawOpt.custom_vram_buffer_gb ?? null,
                    custom_ram_buffer_gb: rawOpt.custom_ram_buffer_gb ?? null,
                };

                const permissions: PermissionSchema = {
                    wasm_firewall: rawPerm.wasm_firewall || 'auto',
                    vectorize_user_input: rawPerm.vectorize_user_input ?? true,
                    vectorize_ai_response: rawPerm.vectorize_ai_response ?? true,
                    stream_telemetry: rawPerm.stream_telemetry ?? false,
                    lazy_load_model: rawPerm.lazy_load_model ?? true,
                    temporary_chat_ttl_hours: rawPerm.temporary_chat_ttl_hours || 24,
                    chat_models: { text: rawPerm.active_slots?.chat_slot?.model_id || rawPerm.chat_models?.text || null },
                    vector_models: { text: rawPerm.active_slots?.embed_slot?.model_id || rawPerm.vector_models?.text || null },
                    ingest_models: { vision: rawPerm.active_slots?.ingest_slot?.model_id || rawPerm.active_slots?.vision_slot?.model_id || rawPerm.ingest_models?.vision || rawPerm.vector_models?.vision || null },
                    tts_models: { audio: rawPerm.active_slots?.tts_slot?.model_id || rawPerm.tts_models?.audio || null },
                    stt_models: { audio: rawPerm.active_slots?.stt_slot?.model_id || rawPerm.active_slots?.audio_slot?.model_id || rawPerm.stt_models?.audio || rawPerm.vector_models?.audio || null },
                    active_slots: rawPerm.active_slots || {},
                    available_models: rawPerm.available_models || Object.keys(installedModelsMap),
                    available_chat_models: Array.from(new Set([...(rawPerm.available_chat_models || []), ...regChatModels])),
                    available_vector_models: Array.from(new Set([...(rawPerm.available_vector_models || []), ...regVectorModels])),
                    available_vision_ingest_models: Array.from(new Set([...(rawPerm.available_vision_ingest_models || []), ...regIngestModels])),
                    available_tts_models: Array.from(new Set([...(rawPerm.available_tts_models || []), ...regTtsModels])),
                    available_stt_models: Array.from(new Set([...(rawPerm.available_stt_models || []), ...regSttModels])),
                    available_devices: rawPerm.available_devices || ['CPU', 'GPU']
                };

                set({
                    permissions,
                    booster,
                    hardware: { vram_gb, ram_gb, gpu_name, cpu_cores, has_gpu: hasGpu },
                    installedModelsMap,
                    fetchStatus: 'success',
                    status: 'idle'
                });
            } catch (error) {
                console.error("[useEngineStore] Failed to fetch engine settings via HTTP:", error);
                set({ fetchStatus: 'error' });
            }
        };

        if (shouldUseFFI) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const { listen } = await import('@tauri-apps/api/event');
                const { cluaizEngine } = await import('../../core/engine');

                // Force boot the engine if it's not already online
                if (get().status === 'idle' || get().status === 'error') {
                    try {
                        await cluaizEngine.boot();
                    } catch (e) {
                        console.error("Failed to boot engine during settings init:", e);
                    }
                }
                
                // Listen for the FFI response on the system response channel
                const unlisten = await listen<string>('engine_sys_response', (event) => {
                    try {
                        const data = JSON.parse(event.payload);
                        if (data.permissions && data.booster) {
                            set({ 
                                permissions: data.permissions,
                                booster: data.booster,
                                hardware: data.hardware || null,
                                activeChatModel: data.active_chat_model || null,
                                activeVectorModel: data.active_vector_model || null,
                                brainMode: data.brainMode === "on",
                                fetchStatus: 'success'
                            });
                            unlisten();
                        }
                    } catch (e) {
                        // Ignore non-JSON responses
                    }
                });

                await invoke('update_engine_settings', {
                    payload: { action: "GET_SETTINGS" }
                });

                // Safety fallback: if FFI event is not received within 1.5s, fetch over HTTP
                setTimeout(() => {
                    if (get().fetchStatus === 'loading') {
                        console.warn("[useEngineStore] FFI event timed out, falling back to HTTP...");
                        fetchViaHttp();
                    }
                }, 1500);
                return;
            } catch (error) {
                console.warn("[useEngineStore] FFI init failed, falling back to HTTP:", error);
            }
        }

        // Web mode or HTTP protocol mode: directly fetch over HTTP
        await fetchViaHttp();
    },

    updatePermission: async (key, value) => {
        // Optimistically update local state
        set((state) => ({
            permissions: state.permissions ? { ...state.permissions, [key]: value } : null
        }));

        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isTauri();

        if (shouldUseFFI) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_engine_settings', {
                    payload: { action: "UPDATE_PERMISSION", payload: { key, value } }
                });
                return;
            } catch (error) {
                console.warn("[useEngineStore] FFI updatePermission failed, falling back to HTTP:", error);
            }
        }

        try {
            const baseUrl = getBaseUrl();
            await fetch(`${baseUrl}/v1/system/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });
        } catch (error) {
            console.error("[useEngineStore] Failed to update permission over HTTP:", error);
        }
    },

    updateBooster: async (key, value) => {
        // Optimistically update local state
        set((state) => ({
            booster: state.booster ? { ...state.booster, [key]: value } : null
        }));

        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isTauri();

        if (shouldUseFFI) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_engine_settings', {
                    payload: { action: "UPDATE_BOOSTER", payload: { key, value } }
                });
                return;
            } catch (error) {
                console.warn("[useEngineStore] FFI updateBooster failed, falling back to HTTP:", error);
            }
        }

        try {
            const baseUrl = getBaseUrl();
            await fetch(`${baseUrl}/v1/optimization/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });
        } catch (error) {
            console.error("[useEngineStore] Failed to update booster over HTTP:", error);
        }
    },

    updateBoosterBuffer: async (type: 'vram' | 'ram', value: number | null) => {
        const booster = get().booster;
        if (!booster) return;
        const key = type === 'vram' ? 'custom_vram_buffer_gb' : 'custom_ram_buffer_gb';
        set({ booster: { ...booster, [key]: value } });

        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isTauri();

        if (shouldUseFFI) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_engine_settings', {
                    payload: { action: "UPDATE_BOOSTER", payload: { [key]: value } }
                });
                return;
            } catch (e) {
                console.warn("[useEngineStore] FFI buffer update failed, falling back to HTTP:", e);
            }
        }

        try {
            const baseUrl = getBaseUrl();
            await fetch(`${baseUrl}/v1/optimization/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });
        } catch (error) {
            console.error("[useEngineStore] Failed to update buffer over HTTP:", error);
        }
    },

    updateModelSlot: async (slotKey: 'chat' | 'vector' | 'ingest' | 'tts' | 'stt', modelId: string) => {
        const perms = get().permissions;
        if (!perms) return;

        const effectiveId = modelId && modelId.trim() !== '' ? modelId.trim() : null;
        const updatedSlots: Record<string, any> = { ...(perms.active_slots || {}) };
        const updatedPerms: PermissionSchema = { ...perms };

        if (slotKey === 'chat') {
            updatedSlots.chat_slot = {
                ...(updatedSlots.chat_slot || {}),
                model_id: effectiveId
            };
            updatedPerms.chat_models = { ...updatedPerms.chat_models, text: effectiveId };
        } else if (slotKey === 'vector') {
            updatedSlots.embed_slot = {
                ...(updatedSlots.embed_slot || {}),
                model_id: effectiveId
            };
            updatedPerms.vector_models = { ...updatedPerms.vector_models, text: effectiveId };
        } else if (slotKey === 'ingest') {
            updatedSlots.ingest_slot = {
                ...(updatedSlots.ingest_slot || {}),
                model_id: effectiveId
            };
            updatedSlots.vision_slot = {
                ...(updatedSlots.vision_slot || {}),
                model_id: effectiveId
            };
            updatedPerms.ingest_models = { ...(updatedPerms.ingest_models || {}), vision: effectiveId };
        } else if (slotKey === 'tts') {
            updatedSlots.tts_slot = {
                ...(updatedSlots.tts_slot || {}),
                model_id: effectiveId
            };
            updatedPerms.tts_models = { ...(updatedPerms.tts_models || {}), audio: effectiveId };
        } else if (slotKey === 'stt') {
            updatedSlots.stt_slot = {
                ...(updatedSlots.stt_slot || {}),
                model_id: effectiveId
            };
            updatedSlots.audio_slot = {
                ...(updatedSlots.audio_slot || {}),
                model_id: effectiveId
            };
            updatedPerms.stt_models = { ...(updatedPerms.stt_models || {}), audio: effectiveId };
        }

        updatedPerms.active_slots = updatedSlots;
        set({ permissions: updatedPerms });

        // Clean payload for backend saving (Developer Hub Parity)
        const postPayload: Record<string, any> = {
            ...updatedPerms,
            active_slots: updatedSlots
        };
        delete postPayload.available_models;
        delete postPayload.available_chat_models;
        delete postPayload.available_vector_models;
        delete postPayload.available_vision_ingest_models;
        delete postPayload.available_tts_models;
        delete postPayload.available_stt_models;
        delete postPayload.available_devices;
        delete postPayload.status;

        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isTauri();

        if (shouldUseFFI) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_engine_settings', {
                    payload: {
                        action: "UPDATE_PERMISSION",
                        payload: postPayload
                    }
                });
                return;
            } catch (e) {
                console.warn("[useEngineStore] FFI updateModelSlot failed, falling back to HTTP:", e);
            }
        }

        try {
            const baseUrl = getBaseUrl();
            await fetch(`${baseUrl}/v1/system/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postPayload)
            });
        } catch (error) {
            console.error("[useEngineStore] Failed to update model slot over HTTP:", error);
        }
    },

    setBrainMode: async (value) => {
        set({ brainMode: value });
        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isTauri();

        if (shouldUseFFI) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_engine_settings', {
                    payload: { action: "SYSTEM_BRAIN", payload: { state: value } }
                });
                return;
            } catch (error) {
                console.warn("[useEngineStore] FFI setBrainMode failed:", error);
            }
        }

        try {
            const baseUrl = getBaseUrl();
            await fetch(`${baseUrl}/v1/system/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brain_mode: value })
            });
        } catch (error) {
            console.error("[useEngineStore] Failed to update brain mode over HTTP:", error);
        }
    },

    resetBooster: async () => {
        const { updateBooster, hardware } = get();
        const hasGpu = hardware?.has_gpu ?? false;

        // Safe universal defaults that adapt to basic hardware presence
        const safeDefaults: Record<string, any> = {
            mode_run: 'balance',
            turbo_quant: 'Auto',
            flash_attention: hasGpu ? 'On' : 'Auto',
            speculative_decoding: 'Off',
            auto_round: 'Auto',
            dflash: 'Auto',
            kv_cache_quantization: 'Auto',
            context_shifting: 'Auto',
            force_vram_reclaim: 'Off',
            n_gpu_layers: hasGpu ? -1 : 0,
            think_mode: 'Auto',
            force_memory_lock: 'Off',
            moe_vram_routing: 'Off',
        };

        for (const [key, value] of Object.entries(safeDefaults)) {
            await updateBooster(key as any, value);
        }
    },

    sendMessage: async (text: string) => {
        // Optimistically add user message
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        
        const assistantId = (Date.now() + 1).toString();
        const assistantMsg: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now() + 1
        };

        set((state) => ({ 
            messages: [...state.messages, userMsg, assistantMsg],
            status: 'processing',
            activeStreamId: assistantId
        }));

        try {
            await sendFFIMessage(text);
        } catch (error) {
            console.error("FFI Send Error:", error);
            set({ status: 'error' });
        }
    },

    appendStreamToken: (token: string) => {
        set((state) => {
            if (!state.activeStreamId) return state;
            const updatedMessages = state.messages.map(msg => {
                if (msg.id === state.activeStreamId) {
                    return { ...msg, content: msg.content + token };
                }
                return msg;
            });
            return { messages: updatedMessages };
        });
    },

    initStreamListener: async () => {
        const { unlistenFn, appendStreamToken } = get();
        if (unlistenFn) return;
        const unlisten = await listenToEngineStream((token) => {
            appendStreamToken(token);
        });
        set({ unlistenFn: unlisten });
    }
}));

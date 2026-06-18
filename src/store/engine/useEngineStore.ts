import { create } from 'zustand';
import { sendFFIMessage, listenToEngineStream, isTauri } from '../../core/tauri-api';
import { UnlistenFn } from '@tauri-apps/api/event';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface PermissionSchema {
    wasm_firewall: string;
    vectorize_user_input: boolean;
    vectorize_ai_response: boolean;
    stream_telemetry: boolean;
    lazy_load_model: boolean;
    temporary_chat_ttl_hours: number;
    chat_models: { text?: string; vision?: string; audio?: string };
    vector_models: { text?: string; vision?: string; audio?: string };
    available_models?: string[];        // fallback full list
    available_chat_models?: string[];   // only generative/chat models
    available_vector_models?: string[]; // only embedding/vector models
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
    
    // UI-only setting
    launchOnStartup: boolean;
    
    // Actions
    setStatus: (status: 'booting' | 'idle' | 'processing' | 'error') => void;
    setLaunchOnStartup: (value: boolean) => void;
    
    initEngineSettings: () => Promise<void>;
    updatePermission: (key: keyof PermissionSchema, value: any) => Promise<void>;
    updateBooster: (key: keyof BoosterControl, value: any) => Promise<void>;
    setBrainMode: (value: boolean) => Promise<void>;
    
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
    launchOnStartup: true,

    setStatus: (status) => set({ status }),
    setLaunchOnStartup: (value) => set({ launchOnStartup: value }),

    initEngineSettings: async () => {
        if (!isTauri()) return;
        set({ fetchStatus: 'loading' });
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const { listen } = await import('@tauri-apps/api/event');
            const { CluaizeEngine } = await import('../../core/engine');

            // Force boot the engine if it's not already online
            if (get().status === 'idle' || get().status === 'error') {
                try {
                    await CluaizeEngine.boot();
                } catch (e) {
                    console.error("Failed to boot engine during settings init:", e);
                }
            }
            
            // Listen for the FFI response which comes over the stream pipe
            const unlisten = await listen<string>('engine_stream_token', (event) => {
                try {
                    if (event.payload.includes('"permissions"')) {
                        const data = JSON.parse(event.payload);
                        set({ 
                            permissions: data.permissions,
                            booster: data.booster || {
                                mode_run: "balance",
                                turbo_quant: "Auto",
                                flash_attention: "Auto",
                                speculative_decoding: "Auto",
                                auto_round: "Auto",
                                dflash: "Auto",
                                kv_cache_quantization: "Auto",
                                context_shifting: "Auto",
                                force_vram_reclaim: "Auto",
                                n_gpu_layers: 0,
                                think_mode: "Auto",
                                force_memory_lock: "Auto",
                                moe_vram_routing: "Auto"
                            },
                            brainMode: data.brainMode === "on",
                            fetchStatus: 'success'
                        });
                        unlisten(); // Stop listening once we get the settings
                    }
                } catch (e) {
                    // Ignore non-JSON stream tokens
                }
            });

            await invoke('update_engine_settings', {
                payload: { action: "GET_SETTINGS" }
            });
            // We don't parse the immediate response because it's just a success string
        } catch (error) {
            console.error("Failed to fetch engine settings:", error);
            set({ fetchStatus: 'error' });
        }
    },

    updatePermission: async (key, value) => {
        if (!isTauri()) return;
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('update_engine_settings', {
                payload: { action: "UPDATE_PERMISSION", payload: { key, value } }
            });
            // Optimistically update
            set((state) => ({
                permissions: state.permissions ? { ...state.permissions, [key]: value } : null
            }));
        } catch (error) {
            console.error("Failed to update permission:", error);
        }
    },

    updateBooster: async (key, value) => {
        if (!isTauri()) return;
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('update_engine_settings', {
                payload: { action: "UPDATE_BOOSTER", payload: { key, value } }
            });
            // Optimistically update
            set((state) => ({
                booster: state.booster ? { ...state.booster, [key]: value } : null
            }));
        } catch (error) {
            console.error("Failed to update booster:", error);
        }
    },

    setBrainMode: async (value) => {
        if (!isTauri()) return;
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('update_engine_settings', {
                payload: { action: "SYSTEM_BRAIN", payload: { state: value } }
            });
            set({ brainMode: value });
        } catch (error) {
            console.error("Failed to update brain mode:", error);
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

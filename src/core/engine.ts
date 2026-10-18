import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useEngineStore } from '../store/engine/useEngineStore';
import { useConnectionStore } from '../store/engine/useConnectionStore';
import { client, nativeApi, chatApi } from '../api';
import type { ProcessingEvent } from '../api/engine/chat/chat.types';

export interface EngineStatus {
    status: 'offline' | 'booting' | 'online' | 'error';
    latencyMs: number;
    modelLoaded: string | null;
}

/**
 * Checks if we are running inside the Tauri native wrapper (Desktop/Mobile)
 */
export const isNative = (): boolean => {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window);
};

/**
 * Unified FFI Engine Client.
 * 100% Reusable across Mobile, Desktop, and Web.
 * 
 * - In Desktop/Mobile (Tauri), it delegates to Rust FFI for Zero-Latency memory access.
 * - In Web, it falls back to a WASM/HTTP bridge.
 */
export interface SendChatOptions {
    model?: string;
    session_id?: string;
    /** 'lite' for a private chat: the engine keeps nothing of it on disk (no chat memory) */
    temporary_chat?: 'lite' | 'strict';
    messages?: Array<{ role: string; content: string | any[] }>;
    think_mode?: 'auto' | 'on' | 'off' | string;
    reasoning_effort?: 'auto' | 'low' | 'medium' | 'high' | 'max' | string | number;
    temperature?: number;
    tools?: any[];
    attachments?: Array<{ name: string; size?: number; type?: string; previewUrl?: string }>;
    parts?: any[];
}

export interface ToolCallPayload {
    id: string;
    name: string;
    category?: string;
    arguments?: string;
    status: 'running' | 'completed' | 'failed';
    latencyMs?: number;
    result?: string;
    logs?: string[];
    iconSvg?: string;
}

export interface EngineContextReport {
    n_ctx: number;
    prompt_tokens: number;
    cache_n: number;
    dropped_messages: number;
    dropped_tokens: number;
    shifted_tokens: number;
    n_tokens: number;
    truncated: boolean;
    stop: 'eos' | 'limit' | 'cancel' | 'error' | string;
}

export interface StreamChunk {
    content?: string;
    reasoning?: string;
    contextTelemetry?: any;
    usage?: any;
    processing?: ProcessingEvent;
    engine?: {
        context?: EngineContextReport;
        timings?: any;
        thinking?: any;
        load?: any;
    };
    finishReason?: string;
    error?: {
        message: string;
        type?: string;
    };
    toolCall?: ToolCallPayload;
    toolResult?: {
        id: string;
        name?: string;
        category?: string;
        status: 'completed' | 'failed';
        latency_ms?: number;
        result?: string;
        logs?: string[];
        input_payload?: any;
        output_result?: any;
        iconSvg?: string;
    };
    permissionRequest?: {
        requestId: string;
        toolName: string;
        category?: string;
        parameters?: any;
        status: 'pending' | 'approved' | 'rejected' | 'timeout';
        timeoutSeconds?: number;
    };
}

export class cluaizEngine {
    private static isBooted = false;
    private static activeAbortController: AbortController | null = null;
    private static activeStreamId: string | null = null;

    /**
     * Initializes the Co-Execution architecture.
     * Tells the native shell to spawn or link the `~/.cluaiz/bin/cluaiz` engine via FFI.
     */
    static async boot(): Promise<void> {
        if (this.isBooted) return;
        this.isBooted = true; // Set synchronously to prevent Strict Mode double-boot

        useEngineStore.getState().setStatus('booting');

        if (isNative()) {
            console.log("[cluaizEngine] Native environment detected. Booting zero-latency FFI engine...");
            try {
                await invoke('boot_cluaiz_engine');
                console.log("[cluaizEngine] Engine FFI Link Established.");

                try {
                    const sessionToken = await nativeApi.getSessionToken();
                    if (sessionToken) {
                        client.setToken(sessionToken);
                    }
                } catch (e) {
                    console.warn('[cluaizEngine] Failed to retrieve session token:', e);
                }

                useEngineStore.getState().setStatus('idle');

                // If Lazy Load is OFF, trigger EAGER_LOAD
                const perms = useEngineStore.getState().permissions;
                if (perms && !perms.lazy_load_model) {
                    await this.sendEagerLoad();
                }
            } catch (err) {
                console.error("[cluaizEngine] Failed to boot engine via FFI:", err);
                this.isBooted = false; // Revert if failed
                useEngineStore.getState().setStatus('error');
                throw err;
            }
        } else {
            console.log("[cluaizEngine] Web environment detected. Falling back to WebAssembly/Gateway...");
            // Simulate web boot
            setTimeout(() => {
                this.isBooted = true;
                useEngineStore.getState().setStatus('idle');
            }, 1000);
        }
    }

    /**
     * Triggers the EAGER_LOAD command via FFI to pre-load the ML model into VRAM immediately.
     */
    static async sendEagerLoad(): Promise<void> {
        if (isNative()) {
            console.log("[cluaizEngine] Sending EAGER_LOAD to IPC Pipe...");
            try {
                await invoke('update_engine_settings', {
                    payload: { action: "EAGER_LOAD" }
                });
            } catch (err) {
                console.error("[cluaizEngine] EAGER_LOAD FFI error:", err);
            }
        }
    }

    /**
     * Executes a CDQL query directly against the compute node database.
     * Automatically routes dynamically based on user's active connection protocol.
     */
    static async executeCDQL(query: string): Promise<any> {
        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isNative();

        if (shouldUseFFI) {
            console.log("[CDQL Transport] Executing via Native C-Pointer (FFI):", query);
            const { executeCDQLFFI } = await import('./tauri-api');
            const responseJson = await executeCDQLFFI(query);
            return JSON.parse(responseJson);
        } else {
            const baseUrl = getBaseUrl();
            console.log(`[CDQL Transport] Executing via HTTP REST (${baseUrl}):`, query);
            const res = await fetch(`${baseUrl}/v1/db/execute`, {
                method: 'POST',
                headers: client.getHeaders(),
                body: JSON.stringify({ query })
            });
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            return await res.json();
        }
    }

    private static subscribers = new Set<(token: string | StreamChunk) => void>();

    private static broadcastToken(token: string | StreamChunk): void {
        this.subscribers.forEach(cb => {
            try {
                cb(token);
            } catch (err) {
                console.error('[Engine Stream Subscriber Error]:', err);
            }
        });
    }

    /**
     * Sends a chat message to the engine.
     * Dynamically uses Native C-Pointer or configured HTTP API port depending on user setting.
     * Optionally accepts a direct per-call stream callback for guaranteed token delivery.
     */
    static async send(
        message: string,
        options?: SendChatOptions,
        onChunk?: (token: string | StreamChunk) => void
    ): Promise<void> {
        const { protocol, getBaseUrl } = useConnectionStore.getState();
        const shouldUseFFI = protocol === 'ffi' && isNative();

        if (shouldUseFFI) {
            console.log("[Engine Transport] Routing message via Native C-Pointer (FFI)...");
            const { sendFFIMessage } = await import('./tauri-api');
            await sendFFIMessage(message);
        } else {
            const baseUrl = getBaseUrl();
            console.log(`[Engine Transport] Routing message via HTTP REST (${baseUrl})...`, message, options);

            const payload: any = {
                messages: (options?.messages && options.messages.length > 0)
                    ? options.messages
                    : [{ role: 'user', content: (options?.parts && options.parts.length > 0) ? options.parts : message }],
                stream: true,
                return_progress: true
            };
            if (options?.model) {
                payload.model = options.model;
            }
            if (options?.session_id) {
                payload.session_id = options.session_id;
            }
            if (options?.temporary_chat) {
                payload.temporary_chat = options.temporary_chat;
            }
            if (options?.think_mode) {
                payload.think_mode = options.think_mode;
            }
            if (options?.reasoning_effort !== undefined && options.reasoning_effort !== '') {
                payload.reasoning_effort = options.reasoning_effort;
            }
            if (options?.temperature !== undefined) {
                payload.temperature = options.temperature;
            }
            if (options?.tools && options.tools.length > 0) {
                payload.tools = options.tools;
            }

            const emitChunk = (chunk: string | StreamChunk) => {
                if (onChunk) {
                    try {
                        onChunk(chunk);
                    } catch (err) {
                        console.error('[Engine Direct onChunk Error]:', err);
                    }
                } else {
                    this.broadcastToken(chunk);
                }
            };

            this.activeAbortController = new AbortController();

            await chatApi.streamCompletion(payload, {
                signal: this.activeAbortController.signal,
                onEvent: (parsed: any) => {
                    if (!parsed) return;
                    if (parsed.id) {
                        cluaizEngine.activeStreamId = parsed.id;
                    } else if (parsed.stream_id) {
                        cluaizEngine.activeStreamId = parsed.stream_id;
                    }
                    if (parsed.processing) {
                        emitChunk({ processing: parsed.processing });
                        return;
                    }
                    // 0. Handle engine context report (always sent at stream end)
                    if (parsed.engine) {
                        emitChunk({ engine: parsed.engine });
                    }

                    // 0b. Handle stream error (e.g. exceed_context_size_error)
                    if (parsed.error) {
                        emitChunk({ error: parsed.error });
                        return;
                    }

                    // 0c. Handle finish_reason
                    const finishReason = parsed.choices?.[0]?.finish_reason;
                    if (finishReason) {
                        emitChunk({ finishReason });
                    }

                    if (parsed.usage?.context_telemetry) {
                        emitChunk({ contextTelemetry: parsed.usage.context_telemetry, usage: parsed.usage });
                    }
                    const delta = parsed.choices?.[0]?.delta;
                    if (!delta) return;

                    // 1. Handle tool_calls
                    if (delta.tool_calls && Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
                        for (const tc of delta.tool_calls) {
                            const toolName = tc.function?.name || tc.name || 'tool';
                            const toolCat = (tc.type && tc.type !== 'function')
                                ? tc.type
                                : (tc.category || undefined);

                            emitChunk({
                                toolCall: {
                                    id: tc.id || `call_${toolName}`,
                                    name: toolName,
                                    category: toolCat,
                                    arguments: tc.function?.arguments || '',
                                    status: 'running',
                                    iconSvg: tc.icon_svg || tc.function?.icon_svg || undefined
                                }
                            });
                        }
                        return;
                    }

                    // 1b. Handle permission_request (HITL Stream Pause)
                    const permReq = delta.permission_request;
                    if (permReq) {
                        emitChunk({
                            permissionRequest: {
                                requestId: permReq.request_id,
                                toolName: permReq.tool_name,
                                category: permReq.category,
                                parameters: permReq.parameters,
                                status: 'pending',
                                timeoutSeconds: permReq.timeout_seconds || 120
                            }
                        });
                        return;
                    }

                    // 2. Handle tool_result
                    const toolResult = delta.tool_result || delta.cluaiz_tool_result;
                    if (toolResult) {
                        const resultStr = toolResult.result
                            || (typeof toolResult.output_result === 'object' ? JSON.stringify(toolResult.output_result, null, 2) : toolResult.output_result)
                            || '';
                        emitChunk({
                            toolResult: {
                                id: toolResult.id,
                                name: toolResult.name,
                                category: toolResult.category,
                                status: 'completed',
                                latency_ms: toolResult.latency_ms,
                                result: resultStr,
                                logs: toolResult.logs,
                                input_payload: toolResult.input_payload,
                                output_result: toolResult.output_result,
                                iconSvg: toolResult.icon_svg || undefined
                            }
                        });
                        return;
                    }

                    const reasoningPiece = delta.reasoning_content || delta.reasoning || delta.thought || '';
                    let contentPiece = delta.content || delta.text || parsed.choices?.[0]?.text || '';

                    // Real-time detection of tool_call in text stream so UI shows Running indicator without delay
                    if (contentPiece.includes('<tool_call>')) {
                        const match = /<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/i.exec(contentPiece);
                        if (match && match[1]) {
                            try {
                                const toolJson = JSON.parse(match[1].trim());
                                const toolName = toolJson.name || toolJson.function || 'execute_tool';
                                emitChunk({
                                    toolCall: {
                                        id: `call_${toolName}`,
                                        name: toolName,
                                        category: 'skill',
                                        arguments: typeof toolJson.arguments === 'object' ? JSON.stringify(toolJson.arguments) : String(toolJson.arguments || ''),
                                        status: 'running'
                                    }
                                });
                            } catch {
                                const nameMatch = /"(?:name|function)"\s*:\s*"([^"]+)"/.exec(match[1]);
                                if (nameMatch && nameMatch[1]) {
                                    emitChunk({
                                        toolCall: {
                                            id: `call_${nameMatch[1]}`,
                                            name: nameMatch[1],
                                            category: 'skill',
                                            arguments: '',
                                            status: 'running'
                                        }
                                    });
                                }
                            }
                        }
                    }

                    if (reasoningPiece) {
                        emitChunk({ reasoning: reasoningPiece });
                    }
                    if (contentPiece) {
                        emitChunk({ content: contentPiece });
                    }
                },
                onDone: () => {
                    cluaizEngine.activeAbortController = null;
                    cluaizEngine.activeStreamId = null;
                    emitChunk('[DONE]');
                },
                onError: (error) => {
                    cluaizEngine.activeAbortController = null;
                    cluaizEngine.activeStreamId = null;
                    emitChunk({ error: { message: error.message, type: error.statusText } });
                }
            });
        }
    }

    /**
     * Immediately interrupts generation and aborts active token stream.
     */
    static async stop(): Promise<void> {
        const streamId = this.activeStreamId;
        const controller = this.activeAbortController;
        this.activeAbortController = null;
        this.activeStreamId = null;

        if (controller) {
            try { controller.abort(); } catch { }
        }

        if (streamId) {
            try {
                await chatApi.cancelStream({ stream_id: streamId });
            } catch (err) {
                console.warn('[cluaizEngine] cancelStream request returned:', err);
            }
        }

        this.broadcastToken('[DONE]');
    }

    /**
     * Immediately bypasses the chain-of-thought thinking phase and jumps to final answer.
     */
    static async skipThinking(): Promise<void> {
        const streamId = this.activeStreamId;
        if (streamId) {
            try {
                await chatApi.skipReasoning({ stream_id: streamId });
            } catch (err) {
                console.warn('[cluaizEngine] skipReasoning request returned:', err);
            }
        }
    }

    /**
     * Listens for incoming tokens from the engine.
     */
    static async onToken(callback: (token: string | StreamChunk) => void): Promise<() => void> {
        this.subscribers.add(callback);
        if (isNative()) {
            const { listenToEngineStream } = await import('./tauri-api');
            const unlisten = await listenToEngineStream((token) => callback(token));
            return () => {
                this.subscribers.delete(callback);
                unlisten();
            };
        } else {
            return () => {
                this.subscribers.delete(callback);
            };
        }
    }

    /**
     * Fetches chat history from the engine.
     */
    static async fetchHistory(): Promise<any[]> {
        return [];
    }

    /**
     * Deletes a chat session from the engine (no-op: UI manages sessions independently in IndexedDB).
     */
    static async deleteSession(_sessionId: string): Promise<void> {
        // UI owns session management; engine remains a stateless inference runtime.
    }
}

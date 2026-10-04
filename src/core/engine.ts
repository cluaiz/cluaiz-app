import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useEngineStore } from '../store/engine/useEngineStore';
import { useConnectionStore } from '../store/engine/useConnectionStore';
import { client, nativeApi } from '../api';

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
    messages?: Array<{ role: string; content: string }>;
    think_mode?: 'auto' | 'on' | 'off' | string;
    reasoning_effort?: 'auto' | 'low' | 'medium' | 'high' | 'max' | string;
    temperature?: number;
    tools?: any[];
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

export interface StreamChunk {
    content?: string;
    reasoning?: string;
    contextTelemetry?: any;
    usage?: any;
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
                    : [{ role: 'user', content: message }],
                stream: true
            };
            if (options?.model) {
                payload.model = options.model;
            }
            if (options?.session_id) {
                payload.session_id = options.session_id;
            }
            if (options?.think_mode) {
                payload.think_mode = options.think_mode;
            }
            if (options?.reasoning_effort && options.reasoning_effort !== 'auto') {
                payload.reasoning_effort = options.reasoning_effort;
            }
            if (options?.temperature !== undefined) {
                payload.temperature = options.temperature;
            }
            if (options?.tools && options.tools.length > 0) {
                payload.tools = options.tools;
            }

            const headers = client.getHeaders();

            let endpoint = `${baseUrl}/v1/chat/completions`;
            let res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            }).catch(() => null);

            if (!res || !res.ok) {
                // Fallback to legacy /chat route if 404 or failed
                endpoint = `${baseUrl}/chat`;
                res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let sseBuffer = '';
            let receivedDone = false;

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

            const readStream = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        sseBuffer += decoder.decode(value, { stream: true });
                        const events = sseBuffer.split('\n');
                        sseBuffer = events.pop() || '';

                        for (const line of events) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data:')) continue;
                            const data = trimmed.slice(5).trim();
                            if (data === '[DONE]') {
                                receivedDone = true;
                                emitChunk('[DONE]');
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);

                                // Catch usage metadata (live context telemetry) even when choices is empty (Developer Hub parity)
                                if (parsed.usage?.context_telemetry) {
                                    emitChunk({ contextTelemetry: parsed.usage.context_telemetry, usage: parsed.usage });
                                }

                                const delta = parsed.choices?.[0]?.delta;
                                if (!delta) continue;

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
                                    continue;
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
                                    continue;
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
                                    continue;
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
                            } catch {
                                // Incomplete chunk or parse error
                            }
                        }
                    }

                    if (!receivedDone) {
                        emitChunk('[DONE]');
                    }
                } catch (err) {
                    console.error('[Engine Stream Error]:', err);
                    throw err;
                }
            };

            await readStream();
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
        if (isNative()) {
            try {
                const { fetchFFIHistory } = await import('./tauri-api');
                const historyStr = await fetchFFIHistory();
                return JSON.parse(historyStr);
            } catch (e) {
                console.error("Failed to parse FFI history:", e);
                return [];
            }
        }
        return [];
    }

    /**
     * Deletes a chat session from the engine.
     */
    static async deleteSession(sessionId: string): Promise<void> {
        await this.executeCDQL(`DELETE FROM sessions WHERE id = '${sessionId}'`);
    }
}

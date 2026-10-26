import { invoke } from '@tauri-apps/api/core';
import { useEngineStore } from '../store/engine/useEngineStore';
import { useConnectionStore } from '../store/engine/useConnectionStore';
import { client, chatApi } from '../api';
import type { ProcessingEvent } from '../api/engine/chat/chat.types';
import { isTauri } from '../api/client/ipc';

export interface EngineStatus {
    status: 'offline' | 'booting' | 'online' | 'error';
    latencyMs: number;
    modelLoaded: string | null;
}

/**
 * Checks if we are running inside the Tauri native wrapper (Desktop/Mobile)
 */
export const isNative = isTauri;

/** Shared chat client; transport selection stays in the API client. */
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
    private static activeAbortController: AbortController | null = null;
    private static activeStreamId: string | null = null;

    /**
     * Initializes the Co-Execution architecture.
     * Boots the owned native Engine or checks the explicitly selected HTTP service.
     */
    static async boot(): Promise<void> {
        useEngineStore.getState().setStatus('booting');
        try {
            if (useConnectionStore.getState().protocol === 'ffi') {
                if (!isNative()) throw new Error('Native Engine connection requires the desktop App.');
                await invoke('boot_cluaiz_engine');
            } else {
                await client.get('/health', { skipAuth: true });
            }
            useEngineStore.getState().setStatus('idle');
        } catch (error) {
            useEngineStore.getState().setStatus('error');
            throw error;
        }
    }

    /** No database/CDQL protocol is implemented by the current Engine. */
    static async executeCDQL(query: string): Promise<never> {
        void query;
        throw new Error('CDQL execution is unsupported. Use the existing storage APIs.');
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
     * Uses the configured native IPC or explicit HTTP API transport.
     * Optionally accepts a direct per-call stream callback for guaranteed token delivery.
     */
    static async send(
        message: string,
        options?: SendChatOptions,
        onChunk?: (token: string | StreamChunk) => void
    ): Promise<void> {
        // Both transports reuse the existing chat payload and SSE parser.

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
        return () => { this.subscribers.delete(callback); };
    }

    /**
     * Fetches chat history from the engine.
     */
    static async fetchHistory(): Promise<any[]> {
        const { ChatStorageManager } = await import('../services/storage/ChatStorageManager');
        return (await new ChatStorageManager().loadSessionsIndex())?.sessions || [];
    }

    /**
     * Deletes a chat session through its existing storage owner.
     */
    static async deleteSession(_sessionId: string): Promise<void> {
        const { ChatStorageManager } = await import('../services/storage/ChatStorageManager');
        await new ChatStorageManager().deleteSession(_sessionId);
    }
}

import { ExecutionMetrics, HttpMethod, ApiProtocol } from '../types';
import { isTauri, sendFFIMessage } from '../../../core/tauri-api';
import { client } from '../../../api/client';

export interface TransportRequestOptions {
    url: string;
    method: HttpMethod;
    protocol: ApiProtocol;
    headers: Record<string, string>;
    body: string;
    onChunk?: (chunk: string, metrics?: Partial<ExecutionMetrics>) => void;
    onAudioDetected?: (audioBase64: string) => void;
}

export interface TransportResult {
    metrics: ExecutionMetrics;
    body: string;
    audioBase64?: string | null;
}

export async function executeApiRequest(opts: TransportRequestOptions): Promise<TransportResult> {
    const { url, method, protocol, headers, body, onChunk, onAudioDetected } = opts;
    const startTime = performance.now();

    // 1. Native C-Pointer (FFI) Execution Path
    if (protocol === 'c-pointer') {
        if (!isTauri()) {
            const timeMs = Math.round(performance.now() - startTime);
            const fallbackMsg = JSON.stringify(
                {
                    protocol: "c-pointer (FFI)",
                    status: "notice",
                    message: "Native C-Pointer (FFI) execution requires the Tauri Desktop Runtime.",
                    target: url,
                    simulated_payload: body
                },
                null,
                2
            );
            return {
                metrics: {
                    status: 200,
                    statusText: "OK (Web Simulation)",
                    timeMs,
                    sizeBytes: new Blob([fallbackMsg]).size
                },
                body: fallbackMsg
            };
        }

        try {
            await sendFFIMessage(body);
            const timeMs = Math.round(performance.now() - startTime);
            const resText = JSON.stringify(
                {
                    protocol: "c-pointer (FFI)",
                    status: "dispatched",
                    target: url,
                    message: "Instruction sent to engine IPC Named Pipe."
                },
                null,
                2
            );
            return {
                metrics: {
                    status: 200,
                    statusText: "IPC Dispatched",
                    timeMs,
                    sizeBytes: new Blob([resText]).size
                },
                body: resText
            };
        } catch (err: any) {
            const timeMs = Math.round(performance.now() - startTime);
            const errStr = JSON.stringify({ error: err?.message || String(err) }, null, 2);
            return {
                metrics: {
                    status: 500,
                    statusText: "FFI IPC Error",
                    timeMs,
                    sizeBytes: new Blob([errStr]).size
                },
                body: errStr
            };
        }
    }

    // 2. HTTP REST API Execution Path
    const fetchOptions: RequestInit = {
        method,
        headers: client.getHeaders(headers)
    };

    if (method !== 'GET' && body.trim().length > 0) {
        fetchOptions.body = body;
    }

    const targetUrl = url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `${client.getBaseUrl().replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;

    try {
        const response = await fetch(targetUrl, fetchOptions);
        const headersTime = (performance.now() - startTime).toFixed(2);
        const contentType = response.headers.get('content-type') || '';
        const isSse = contentType.includes('text/event-stream');

        if (isSse && response.body) {
            const initialTtft = `${(parseFloat(headersTime) / 1000).toFixed(2)}s`;
            let accumulatedText = '';
            let parsedTotalSecs: string | undefined;
            let parsedTtftSecs: string | undefined;
            let capturedAudioBase64: string | null = null;

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkStr = decoder.decode(value, { stream: true });
                accumulatedText += chunkStr;

                if (chunkStr.includes('"metrics"')) {
                    const matchTotal = chunkStr.match(/"total_execution_time_sec"\s*:\s*"([^"]+)"/);
                    if (matchTotal?.[1]) parsedTotalSecs = matchTotal[1];

                    const matchTtft = chunkStr.match(/"ttft_ms"\s*:\s*([0-9.]+)/);
                    if (matchTtft?.[1]) {
                        parsedTtftSecs = `${(parseFloat(matchTtft[1]) / 1000).toFixed(2)}s`;
                    }
                }

                if (chunkStr.includes('"audio_data"')) {
                    const lines = chunkStr.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const parsed = JSON.parse(line.substring(6));
                                if (parsed.output?.audio_data) {
                                    capturedAudioBase64 = parsed.output.audio_data;
                                    if (capturedAudioBase64 && onAudioDetected) {
                                        onAudioDetected(capturedAudioBase64);
                                    }
                                }
                            } catch {
                                // Ignore non-json SSE lines
                            }
                        }
                    }
                }

                if (onChunk) {
                    onChunk(chunkStr, {
                        status: response.status,
                        statusText: response.statusText,
                        ttft: parsedTtftSecs || initialTtft,
                        totalTime: parsedTotalSecs,
                        sizeBytes: new Blob([accumulatedText]).size,
                        isStreaming: true
                    });
                }
            }

            const totalTime = parsedTotalSecs || `${((performance.now() - startTime) / 1000).toFixed(2)}s`;
            const ttft = parsedTtftSecs || initialTtft;
            const sizeBytes = new Blob([accumulatedText]).size;

            return {
                metrics: {
                    status: response.status,
                    statusText: response.statusText,
                    timeMs: Math.round(performance.now() - startTime),
                    sizeBytes,
                    ttft,
                    totalTime,
                    isStreaming: false
                },
                body: accumulatedText,
                audioBase64: capturedAudioBase64
            };
        }

        const responseText = await response.text();
        const timeMs = Math.round(performance.now() - startTime);
        const sizeBytes = new Blob([responseText]).size;

        let formattedBody = responseText;
        try {
            const parsed = JSON.parse(responseText);
            formattedBody = JSON.stringify(parsed, null, 2);
            if (parsed.output?.audio_data) {
                return {
                    metrics: {
                        status: response.status,
                        statusText: response.statusText,
                        timeMs,
                        sizeBytes
                    },
                    body: formattedBody,
                    audioBase64: parsed.output.audio_data
                };
            }
        } catch {
            // Leave raw text if not JSON
        }

        return {
            metrics: {
                status: response.status,
                statusText: response.statusText,
                timeMs,
                sizeBytes
            },
            body: formattedBody
        };
    } catch (err: any) {
        const timeMs = Math.round(performance.now() - startTime);
        const errorBody = JSON.stringify(
            {
                error: true,
                message: err?.message || 'Failed to connect to gateway',
                url: targetUrl
            },
            null,
            2
        );
        return {
            metrics: {
                status: 0,
                statusText: 'Network Error',
                timeMs,
                sizeBytes: new Blob([errorBody]).size
            },
            body: errorBody
        };
    }
}

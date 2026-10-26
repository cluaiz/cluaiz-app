import { ExecutionMetrics, HttpMethod, ApiProtocol } from '../types';
import { WavStreamPlayer } from '../../../services/audio/wavStreamPlayer';
import { ipc, isTauri } from '../../../api/client/ipc';
import { createEngineFetch } from '../../../api/client/transport';
import { client } from '../../../api/client';

export interface TransportRequestOptions {
    url: string;
    method: HttpMethod;
    protocol: ApiProtocol;
    headers: Record<string, string>;
    body: string;
    onChunk?: (chunk: string, metrics?: Partial<ExecutionMetrics>) => void;
    /** playedLive: the speech was already played part by part while it streamed */
    onAudioDetected?: (audioBase64: string, info?: { playedLive: boolean }) => void;
}

/** Speech parts of the current streamed request; a new request stops the previous playback */
const speechStream = new WavStreamPlayer();

export interface TransportResult {
    metrics: ExecutionMetrics;
    body: string;
    audioBase64?: string | null;
}

export async function executeApiRequest(opts: TransportRequestOptions): Promise<TransportResult> {
    const { url, method, protocol, headers, body, onChunk, onAudioDetected } = opts;
    const startTime = performance.now();
    speechStream.stop();

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
        const requestNative = createEngineFetch({
            getProtocol: () => 'ffi', isTauri, getBaseUrl: () => client.getBaseUrl(),
            nativeInvoke: (command, args) => ipc.invoke(command, args),
            httpFetch: (input, init) => fetch(input, init),
        });
        const response = protocol === 'c-pointer'
            ? await requestNative(targetUrl, fetchOptions)
            : await fetch(targetUrl, fetchOptions);
        const headersTime = (performance.now() - startTime).toFixed(2);
        const contentType = response.headers.get('content-type') || '';
        const isSse = contentType.includes('text/event-stream');

        if (isSse && response.body) {
            const initialTtft = `${(parseFloat(headersTime) / 1000).toFixed(2)}s`;
            let accumulatedText = '';
            let parsedTotalSecs: string | undefined;
            let parsedTtftSecs: string | undefined;
            let capturedAudioBase64: string | null = null;
            let playedLive = false;
            // An SSE event can span several network reads (a whole WAV is hundreds of KB):
            // only complete lines are parsed
            let pendingLine = '';

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            try {
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

                const lines = (pendingLine + chunkStr).split('\n');
                pendingLine = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const parsed = JSON.parse(line.substring(6));
                        if (parsed.type === 'speech.audio.delta' && typeof parsed.audio === 'string') {
                            // A finished sentence: play it now, the next ones queue behind it
                            speechStream.push(parsed.audio);
                            playedLive = true;
                            continue;
                        }
                        const audio = parsed.output?.audio_data || parsed.result?.output?.audio_data || parsed.audio_data;
                        if (audio) {
                            capturedAudioBase64 = audio;
                            onAudioDetected?.(audio, { playedLive });
                        }
                    } catch {
                        // Ignore non-json SSE lines
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

            } finally {
                await reader.cancel().catch(() => {});
                reader.releaseLock();
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

import React, { useMemo } from 'react';
import { useApiStore, fetchActiveBearerToken } from '../../../store/api/useApiStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { HttpMethod, ApiProtocol } from '../types';
import { executeApiRequest } from '../services/apiTransport';
import { Play, RotateCcw, Loader2, Sparkles, Volume2 } from 'lucide-react';

export const RequestHeader: React.FC = () => {
    const {
        activeEndpoint,
        apiData,
        reqMethod,
        reqProtocol,
        reqUrl,
        reqHeaders,
        reqBody,
        selectedModel,
        selectedVoice,
        installedModels,
        availableVoices,
        isExecuting,
        setReqMethod,
        setReqProtocol,
        setReqUrl,
        setSelectedModel,
        setSelectedVoice,
        setExecuting,
        setResponse,
        appendStreamingResponse,
        resetPayload,
        selectEndpoint
    } = useApiStore();

    const { host, port } = useConnectionStore();

    // Calculate available methods for this endpoint path
    const availableMethods = useMemo(() => {
        if (!activeEndpoint) return ['GET'];
        const group = apiData.find((g) => g.endpoints.some((e) => e.path === activeEndpoint.path));
        if (!group) return [activeEndpoint.method];
        const methods = group.endpoints
            .filter((e) => e.path === activeEndpoint.path)
            .map((e) => e.method);
        return Array.from(new Set(methods));
    }, [activeEndpoint, apiData]);

    const handleMethodSelect = (newMethod: HttpMethod) => {
        setReqMethod(newMethod);
        if (!activeEndpoint) return;
        const group = apiData.find((g) => g.endpoints.some((e) => e.path === activeEndpoint.path));
        const matched = group?.endpoints.find(
            (e) => e.path === activeEndpoint.path && e.method === newMethod
        );
        if (matched) {
            selectEndpoint(matched);
        }
    };

    const handleSend = async () => {
        if (!activeEndpoint || isExecuting) return;

        setExecuting(true);
        setResponse(
            {
                status: 0,
                statusText: 'Executing...',
                timeMs: 0,
                sizeBytes: 0,
                isStreaming: true
            },
            'Sending request...'
        );

        let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
            if (reqHeaders.trim()) {
                parsedHeaders = JSON.parse(reqHeaders);
            }
        } catch {
            // Keep default
        }

        // Auto-inject Authorization Bearer token if not provided by user
        if (!parsedHeaders['Authorization']) {
            try {
                const token = await fetchActiveBearerToken();
                if (token) {
                    parsedHeaders['Authorization'] = token;
                    useApiStore.getState().setReqHeaders(JSON.stringify(parsedHeaders, null, 2));
                }
            } catch (_) {}
        }

        try {
            const result = await executeApiRequest({
                url: reqUrl,
                method: reqMethod,
                protocol: reqProtocol,
                headers: parsedHeaders,
                body: reqBody,
                onChunk: (chunk, metrics) => {
                    appendStreamingResponse(chunk, metrics);
                },
                onAudioDetected: (audioBase64) => {
                    useApiStore.setState({ audioData: audioBase64, activeResTab: 'audio' });
                }
            });

            setResponse(result.metrics, result.body, result.audioBase64);
        } catch (err: any) {
            setResponse(
                {
                    status: 500,
                    statusText: 'Execution Error',
                    timeMs: 0,
                    sizeBytes: 0
                },
                JSON.stringify({ error: err?.message || String(err) }, null, 2)
            );
        } finally {
            setExecuting(false);
        }
    };

    const isAudioEndpoint = activeEndpoint?.path.includes('/audio');

    return (
        <div className="flex flex-col gap-2.5 p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
            {/* Top Controls Row */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* HTTP Method Dropdown */}
                <select
                    value={reqMethod}
                    onChange={(e) => handleMethodSelect(e.target.value as HttpMethod)}
                    className="h-8 px-2.5 text-xs font-mono font-bold rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] focus:outline-none focus:border-[var(--accent-color)] cursor-pointer"
                >
                    {['GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                        <option key={m} value={m} disabled={!availableMethods.includes(m as HttpMethod)}>
                            {m} {!availableMethods.includes(m as HttpMethod) ? '(N/A)' : ''}
                        </option>
                    ))}
                </select>

                {/* Protocol Toggle */}
                <select
                    value={reqProtocol}
                    onChange={(e) => setReqProtocol(e.target.value as ApiProtocol)}
                    className="h-8 px-2.5 text-xs font-medium rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] cursor-pointer"
                >
                    <option value="http">HTTP REST API ({host}:{port})</option>
                    <option value="c-pointer">Native C-Pointer (FFI)</option>
                </select>

                {/* Model Selector (if applicable) */}
                <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-transparent text-[var(--text-primary)] focus:outline-none cursor-pointer max-w-[140px] truncate"
                    >
                        <option value="auto">Model: Auto</option>
                        {installedModels.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.id}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Voice Selector (for Audio endpoints) */}
                {isAudioEndpoint && (
                    <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs">
                        <Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <select
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            className="bg-transparent text-[var(--text-primary)] focus:outline-none cursor-pointer"
                        >
                            {availableVoices.map((v) => (
                                <option key={v.value} value={v.value}>
                                    {v.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Reset Payload Button */}
                <button
                    type="button"
                    onClick={resetPayload}
                    className="ml-auto h-8 px-2.5 flex items-center gap-1 text-[11px] font-medium rounded-md border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors cursor-pointer"
                    title="Restore default payload schema"
                >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Payload</span>
                </button>
            </div>

            {/* URL Bar & Send Button Row */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={reqUrl}
                    onChange={(e) => setReqUrl(e.target.value)}
                    placeholder="http://localhost:8000/v1/..."
                    className="flex-1 h-9 px-3 text-xs font-mono rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] transition-colors shadow-inner"
                />
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={isExecuting || !activeEndpoint}
                    className="h-9 px-5 flex items-center gap-2 text-xs font-semibold rounded-lg bg-[var(--accent-color)] text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[var(--accent-color)]/20 cursor-pointer"
                >
                    {isExecuting ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending...</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Send</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

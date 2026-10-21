import React, { useMemo, useEffect } from 'react';
import { useApiStore, fetchActiveBearerToken } from '../../../store/api/useApiStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { ApiProtocol } from '../types';
import { executeApiRequest } from '../services/apiTransport';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { endpointUsesModel, getFilteredModelsForEndpoint, isEmbeddingModel } from '../utils/modelFilter';
import { Play, RotateCcw, Loader2 } from 'lucide-react';
import { audioApi } from '../../../api/engine/audio/audio.api';
import { AUDIO_ENDPOINTS } from '../../../api/engine/audio/audio.endpoints';

export const RequestHeader: React.FC = () => {
    const {
        activeEndpoint,
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
        setReqProtocol,
        setReqUrl,
        setSelectedModel,
        setSelectedVoice,
        setExecuting,
        setResponse,
        appendStreamingResponse,
        resetPayload
    } = useApiStore();

    const { host, port } = useConnectionStore();

    const getMethodBadgeStyle = (method: string) => {
        switch (method.toUpperCase()) {
            case 'GET':
                return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            case 'POST':
                return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
            case 'PUT':
                return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'DELETE':
                return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
            default:
                return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const isModelEndpoint = endpointUsesModel(activeEndpoint);

    const protocolOptions = useMemo(
        () => [
            { value: 'http', label: `HTTP REST API (${host}:${port})` },
            { value: 'c-pointer', label: 'Native C-Pointer (FFI)' }
        ],
        [host, port]
    );

    // Filter models specifically for the active endpoint's task
    const modelOptions = useMemo(() => {
        if (!activeEndpoint) return [];
        const filtered = getFilteredModelsForEndpoint(activeEndpoint.path, installedModels, reqBody);
        const p = activeEndpoint.path.toLowerCase();

        const allowsAuto = p.includes('/chat') || p.includes('/plan');
        const opts = filtered.map((m) => ({
            value: m.id,
            label: `${m.id}${m.experimental ? ' (Experimental)' : ''}`,
            description: p.includes('/ingest') ? (isEmbeddingModel(m)
                ? `${m.format_type || ''} embedding vectors`
                : 'Model-generated text from images/documents') : undefined
        }));

        if (p.includes('/ingest')) {
            return [{ value: '', label: 'Native extraction (no model)' }, ...opts];
        }
        if (allowsAuto) {
            return [{ value: 'auto', label: 'Model: Auto' }, ...opts];
        }
        return opts;
    }, [activeEndpoint?.path, installedModels, reqBody]);

    // Discovery reads the selected package; STT routes have languages, not speaker voices.
    useEffect(() => {
        useApiStore.setState({ availableVoices: [{ value: 'default', label: 'Default Voice' }] });
        if (activeEndpoint?.path !== AUDIO_ENDPOINTS.SPEECH || !selectedModel) return;
        const controller = new AbortController();
        audioApi.voiceCatalog(selectedModel, controller.signal).then(catalog => {
            if (!controller.signal.aborted) useApiStore.setState({ availableVoices: catalog.data.map(voice => ({
                value: voice.id, label: `${voice.id}${voice.language ? ` (${voice.language})` : ''}`
            })) });
        }).catch(() => { /* Default stays usable; discovery errors do not replace the payload. */ });
        return () => controller.abort();
    }, [activeEndpoint?.path, selectedModel]);

    const voiceOptions = useMemo(
        () =>
            availableVoices.map((v) => ({
                value: v.value,
                label: v.label
            })),
        [availableVoices]
    );

    const handleSend = async () => {
        if (!activeEndpoint || isExecuting) return;

        // If user triggers Send from Docs or Snippets, switch to Body Payload to reveal Response Output
        const currentTab = useApiStore.getState().activeTab;
        if (currentTab === 'docs' || currentTab === 'snippets') {
            useApiStore.getState().setActiveTab('params');
        }

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
            } catch (_) { }
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
                onAudioDetected: (audioBase64, info) => {
                    useApiStore.setState({
                        audioData: audioBase64,
                        audioPlayedLive: info?.playedLive ?? false,
                        activeResTab: 'audio'
                    });
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

    const isSpeechEndpoint = activeEndpoint?.path === AUDIO_ENDPOINTS.SPEECH;

    return (
        <div className="flex flex-col gap-2 p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
            {/* Top Controls Row */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Fixed HTTP Method Badge (Matches Sidebar Style) */}
                <span
                    className={`h-8 px-3 flex items-center justify-center text-xs font-mono font-bold uppercase rounded-lg border select-none ${getMethodBadgeStyle(
                        reqMethod
                    )}`}
                    title={`Endpoint HTTP Method: ${reqMethod}`}
                >
                    {reqMethod}
                </span>

                {/* Protocol Selector (Custom Dropdown) */}
                <CustomDropdown
                    value={reqProtocol}
                    onChange={(val) => setReqProtocol(val as ApiProtocol)}
                    options={protocolOptions}
                />

                {/* Reuse the same selector for every endpoint that accepts a model. */}
                {isModelEndpoint && (
                    <CustomDropdown
                        value={selectedModel}
                        onChange={(val) => setSelectedModel(val)}
                        options={modelOptions}
                        placeholder="No compatible installed models"
                        disabled={modelOptions.length === 0}
                    />
                )}

                {/* Speaker choices belong only to speech synthesis. */}
                {isSpeechEndpoint && (
                    <CustomDropdown
                        value={selectedVoice}
                        onChange={(val) => setSelectedVoice(val)}
                        options={voiceOptions}
                    />
                )}

                {/* Reset Payload Button */}
                <button
                    type="button"
                    onClick={resetPayload}
                    className="ml-auto h-8 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors cursor-pointer"
                    title="Restore default payload schema"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
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


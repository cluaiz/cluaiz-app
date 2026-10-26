import type { ApiEndpoint, InstalledModel } from '../types';
import { methodPath, parsedParams } from './requestPayload';

/** The header and payload store must agree on whether this route accepts a model. */
export const endpointUsesModel = (endpoint: ApiEndpoint | null): boolean => {
    if (!endpoint) return false;
    const p = methodPath(endpoint.path);
    if (endpoint.transport_path) return !!endpoint.params?.some(param => param.name === 'model');
    if (p.includes('/ingest')) return true;
    if (p.includes('/plan')) return true;
    if (['/chat/cancel', '/chat/skip-reasoning', '/chat/context_telemetry', '/system/',
        '/storage', '/config', '/health', '/info'].some(path => p.includes(path))) return false;
    return ['/completion', '/embedding', '/audio/'].some(path => p.includes(path))
        || !!endpoint.request_payload?.includes('"model"')
        || !!endpoint.params?.some(param => param.name === 'model');
};

const hasTask = (model: InstalledModel, tasks: string[]): boolean =>
    (model.supported_tasks || []).some(task => tasks.includes(task.toLowerCase().replace(/-/g, '_')));

// Registry declarations, rather than model names, determine the endpoint's choices.
export const isTtsModel = (m: InstalledModel): boolean =>
    m.category?.toLowerCase() === 'tts' || !!m.metadata?.tts_family
    || hasTask(m, ['text_to_speech', 'voice_synthesis', 'tts']);

export const isSttModel = (m: InstalledModel): boolean =>
    m.category?.toLowerCase() === 'stt' || !!m.metadata?.stt_family
    || hasTask(m, ['speech_to_text', 'automatic_speech_recognition', 'stt']);

export const isEmbeddingModel = (m: InstalledModel): boolean =>
    m.category?.toLowerCase() === 'embedding'
    || hasTask(m, ['embedding', 'feature_extraction', 'sentence_similarity',
        'vision_embedding', 'image_feature_extraction']);

export const isVisionIngestModel = (m: InstalledModel): boolean =>
    !isEmbeddingModel(m) && m.format_type?.toLowerCase() === 'gguf'
    && (['ingest', 'vision'].includes(m.category?.toLowerCase() || '')
        || hasTask(m, ['vision', 'multimodal_vision', 'spatial_vision', 'document_ocr']));

export const isChatModel = (m: InstalledModel): boolean =>
    !isTtsModel(m) && !isSttModel(m) && !isEmbeddingModel(m)
    && (m.category?.toLowerCase() === 'chat' || isVisionIngestModel(m)
        || hasTask(m, ['chat', 'chat_completion', 'text_generation']));

/** Match visual/audio chat inputs; file_url only requires document text extraction. */
const chatMediaTasks = (body?: string): string[][] => {
    try {
        const payload = parsedParams(body || '{}');
        const parts = payload.messages?.flatMap((message: { content?: unknown }) =>
            Array.isArray(message.content) ? message.content : []) || [];
        const tasks: string[][] = [];
        if (parts.some((part: { type?: string }) => ['image_url', 'video_url'].includes(part?.type || ''))) {
            tasks.push(['vision', 'multimodal_vision', 'spatial_vision', 'document_ocr']);
        }
        if (parts.some((part: { type?: string; video_url?: { include_audio?: boolean } }) =>
            ['input_audio', 'audio_url'].includes(part?.type || '') || part?.video_url?.include_audio === true)) {
            tasks.push(['audio', 'multimodal_audio']);
        }
        return tasks;
    } catch { return []; } // Incomplete editor input must remain editable.
};

export const getFilteredModelsForEndpoint = (
    endpointPath: string | undefined,
    installedModels: InstalledModel[],
    body?: string
): InstalledModel[] => {
    if (!endpointPath) return installedModels;
    const p = methodPath(endpointPath);
    if (p.includes('/plan')) return installedModels;
    if (p.includes('/chat') || p.includes('/completion')) {
        const tasks = chatMediaTasks(body);
        return installedModels.filter(m => isChatModel(m)
            && tasks.every(required => hasTask(m, required)
                || (required.includes('vision') && isVisionIngestModel(m))));
    }
    if (p.includes('/audio/transcription') || p.includes('/audio/languages') || p.includes('/stt')) {
        return installedModels.filter(isSttModel);
    }
    if (p.includes('/audio/speech') || p.includes('/audio/voices') || p.includes('/tts')) {
        return installedModels.filter(isTtsModel);
    }
    if (p.includes('/audio/run')) {
        // Text input synthesizes speech; audio input is transcribed.
        let isText = true;
        try {
            isText = String(parsedParams(body || '{}').input_source?.type ?? 'text').toLowerCase() === 'text';
        } catch { /* Incomplete JSON. */ }
        return installedModels.filter(isText ? isTtsModel : isSttModel);
    }
    if (p.includes('/embedding')) {
        let hasParts = false;
        try {
            const input = parsedParams(body || '{}').input;
            hasParts = Array.isArray(input) && input.some(part => part !== null && typeof part === 'object');
        } catch { /* Incomplete JSON. */ }
        return installedModels.filter(m => isEmbeddingModel(m)
            && (hasParts ? m.format_type?.toLowerCase() === 'onnx'
                && hasTask(m, ['vision_embedding', 'image_feature_extraction'])
                : (!m.format_type || ['onnx', 'gguf'].includes(m.format_type.toLowerCase()))
                && (hasTask(m, ['embedding', 'feature_extraction', 'sentence_similarity'])
                    || (m.category?.toLowerCase() === 'embedding'
                        && !hasTask(m, ['vision_embedding', 'image_feature_extraction'])))));
    }
    if (p.includes('/ingest')) return installedModels.filter(m => isEmbeddingModel(m) || isVisionIngestModel(m));
    return installedModels;
};

/** Resolve shipped example placeholders, preserving explicit IDs and native ingest mode. */
export const initialModelForPayload = (endpoint: ApiEndpoint, models: InstalledModel[], body: string,
    previous: string, task?: 'text_embedding' | 'image_embedding' | 'vision'): string | undefined => {
    let requested = '';
    try {
        const value = parsedParams(body)?.model;
        if (value != null && typeof value !== 'string') return undefined;
        requested = value || '';
    } catch { /* GET/unfinished body. */ }
    const ingest = methodPath(endpoint.path).includes('/ingest');
    if (ingest && (!requested || requested === 'auto')) return '';
    const candidates = task === 'vision' ? models.filter(isVisionIngestModel)
        : task ? getFilteredModelsForEndpoint('/v1/embeddings', models,
            task === 'image_embedding' ? '{"input":[{"type":"image"}]}' : '{}')
        : getFilteredModelsForEndpoint(endpoint.path, models, body);
    const allowsAuto = methodPath(endpoint.path).includes('/chat') || methodPath(endpoint.path).includes('/plan');
    const valid = (id: string) => (allowsAuto && id === 'auto') || candidates.some(m => m.id === id);
    if (requested && !requested.startsWith('<')) return requested;
    if (valid(previous)) return previous;
    return candidates.find(m => !m.experimental)?.id || candidates[0]?.id || (allowsAuto ? 'auto' : requested);
};

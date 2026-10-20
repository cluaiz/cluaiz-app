import type { ApiEndpoint, InstalledModel } from '../types';

/** The header and payload store must agree on whether this route accepts a model. */
export const endpointUsesModel = (endpoint: ApiEndpoint | null): boolean => {
    if (!endpoint) return false;
    const p = endpoint.path.toLowerCase();
    if (p.includes('/ingest')) return false;
    if (p.includes('/plan')) return true;
    if (['/chat/cancel', '/chat/skip-reasoning', '/chat/context_telemetry', '/system/',
        '/storage', '/config', '/health', '/info'].some(path => p.includes(path))) return false;
    return ['/chat', '/completion', '/embedding', '/audio/'].some(path => p.includes(path))
        || !!endpoint.request_payload?.includes('"model"')
        || !!endpoint.params?.some(param => param.name === 'model');
};

/**
 * Categorization checkers matching Developer Hub & EngineStore taxonomy.
 */
export const isTtsModel = (m: InstalledModel): boolean => {
    const tasks = (m.supported_tasks || []).map((t) => t.toLowerCase());
    if (tasks.includes('text_to_speech') || tasks.includes('tts')) return true;

    const cat = m.category?.toLowerCase();
    if (cat === 'tts') return true;

    const id = m.id.toLowerCase();
    // Exclude STT models explicitly
    if (id.includes('whisper') || id.includes('moonshine') || id.includes('sensevoice')) {
        return false;
    }

    return (
        id.includes('piper') ||
        id.includes('kokoro') ||
        id.includes('melotts') ||
        id.includes('audio8') ||
        id.includes('tts')
    );
};

export const isSttModel = (m: InstalledModel): boolean => {
    const tasks = (m.supported_tasks || []).map((t) => t.toLowerCase());
    if (tasks.includes('speech_to_text') || tasks.includes('stt')) return true;

    const cat = m.category?.toLowerCase();
    if (cat === 'stt') return true;

    const id = m.id.toLowerCase();
    // Exclude TTS models explicitly
    if (id.includes('piper') || id.includes('kokoro') || id.includes('melotts') || id.includes('audio8') || id.includes('tts')) {
        return false;
    }

    return (
        id.includes('whisper') ||
        id.includes('moonshine') ||
        id.includes('sensevoice') ||
        id.includes('stt')
    );
};

export const isChatModel = (m: InstalledModel): boolean => {
    if (isTtsModel(m) || isSttModel(m) || isEmbeddingModel(m)) {
        return false;
    }

    const tasks = (m.supported_tasks || []).map((t) => t.toLowerCase());
    if (tasks.includes('chat') || tasks.includes('text_generation')) return true;

    const cat = m.category?.toLowerCase();
    if (cat === 'chat') return true;
    if (cat && cat !== 'chat') return false;

    const id = m.id.toLowerCase();
    return (
        !id.includes('embed') &&
        !id.includes('bge') &&
        !id.includes('nomic') &&
        !id.includes('minilm') &&
        !id.includes('whisper') &&
        !id.includes('moonshine') &&
        !id.includes('sensevoice') &&
        !id.includes('piper') &&
        !id.includes('kokoro') &&
        !id.includes('melotts') &&
        !id.includes('audio8') &&
        !id.includes('tts') &&
        !id.includes('ocr') &&
        !id.includes('nougat') &&
        !id.includes('florence')
    );
};

export const isEmbeddingModel = (m: InstalledModel): boolean => {
    const tasks = (m.supported_tasks || []).map((t) => t.toLowerCase().replace(/-/g, '_'));
    if (['embedding', 'embed', 'feature_extraction', 'sentence_similarity',
        'vision_embedding', 'image_feature_extraction'].some(task => tasks.includes(task))) return true;

    const cat = m.category?.toLowerCase();
    if (cat === 'embedding') return true;

    const id = m.id.toLowerCase();
    return (
        id.includes('embed') ||
        id.includes('bge') ||
        id.includes('nomic') ||
        id.includes('minilm')
    );
};

export const isVisionIngestModel = (m: InstalledModel): boolean => {
    const tasks = (m.supported_tasks || []).map((t) => t.toLowerCase());
    if (tasks.includes('vision') || tasks.includes('ingest') || tasks.includes('ocr')) return true;

    const cat = m.category?.toLowerCase();
    if (cat === 'ingest' || cat === 'vision') return true;

    const id = m.id.toLowerCase();
    return (
        id.includes('ocr') ||
        id.includes('nougat') ||
        id.includes('florence') ||
        id.includes('table')
    );
};

/**
 * Resolves models filtered by the active endpoint's intended task.
 * For `/plan` or `/system/plan`, returns ALL installed models.
 */
export const getFilteredModelsForEndpoint = (
    endpointPath: string | undefined,
    installedModels: InstalledModel[]
): InstalledModel[] => {
    if (!endpointPath || !installedModels.length) return installedModels;
    const p = endpointPath.toLowerCase();

    // 1. Hardware Execution Plan (/v1/system/plan, /plan) — displays ALL installed models
    if (p.includes('/plan')) {
        return installedModels;
    }

    // 2. Chat & Text Generation (/v1/chat/..., /v1/completion...)
    if (p.includes('/chat') || p.includes('/completion')) {
        return installedModels.filter(isChatModel);
    }

    // 3. Audio Speech-to-Text Transcription (/v1/audio/transcriptions, /v1/audio/languages)
    if (p.includes('/audio/transcription') || p.includes('/audio/languages') || p.includes('/stt')) {
        return installedModels.filter(isSttModel);
    }

    // 4. Audio Text-to-Speech / Voice synthesis (/v1/audio/speech, /v1/audio/voices, /v1/tts)
    if (p.includes('/audio/speech') || p.includes('/audio/voices') || p.includes('/tts')) {
        return installedModels.filter(isTtsModel);
    }

    // 5. Embeddings (/v1/embeddings)
    if (p.includes('/embedding')) {
        return installedModels.filter(m => isEmbeddingModel(m)
            && (!m.format_type || m.format_type.toLowerCase() === 'onnx'));
    }

    // Native extraction has no model argument; vision Q&A and vectors use their own routes.
    if (p.includes('/ingest')) {
        return [];
    }

    // Fallback: If endpoint accepts a model, return all installed models
    return installedModels;
};

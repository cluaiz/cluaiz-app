import { InstalledModel } from '../types';

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
    const tasks = (m.supported_tasks || []).map((t) => t.toLowerCase());
    if (tasks.includes('embedding') || tasks.includes('embed')) return true;

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

    // 3. Audio Speech-to-Text Transcription (/v1/audio/transcriptions)
    if (p.includes('/audio/transcription') || p.includes('/stt')) {
        return installedModels.filter(isSttModel);
    }

    // 4. Audio Text-to-Speech / Voice synthesis (/v1/audio/speech, /v1/tts)
    if (p.includes('/audio/speech') || p.includes('/tts')) {
        return installedModels.filter(isTtsModel);
    }

    // 5. Embeddings (/v1/embeddings)
    if (p.includes('/embedding')) {
        return installedModels.filter(isEmbeddingModel);
    }

    // 7. Ingestion / Vision (/v1/ingest)
    if (p.includes('/ingest')) {
        const ingestModels = installedModels.filter((m) => isVisionIngestModel(m) || isEmbeddingModel(m));
        return ingestModels.length > 0 ? ingestModels : installedModels;
    }

    // Fallback: If endpoint accepts a model, return all installed models
    return installedModels;
};

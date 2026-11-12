import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

export interface EmbeddingPlace {
    id: string; installed: boolean; runs_on: string; needs_gb?: number; bytes?: number; recommended?: boolean;
}
export interface EmbeddingRoom {
    candidates: EmbeddingPlace[];
    chat_model: { id: string; loaded: boolean; placement?: string; ram_gb?: number; vram_gb?: number } | null;
    gpu_left_gb?: number; ram_left_gb?: number;
}

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/** Where each embedding model would run beside the chat model on today's free memory. */
export async function readEmbeddingRoom(signal?: AbortSignal): Promise<EmbeddingRoom> {
    const result = await callCep<unknown>('models.embedding_room', {}, { signal });
    if (!object(result) || !Array.isArray(result.candidates) || !result.candidates.every(item => object(item)
        && typeof item.id === 'string' && typeof item.installed === 'boolean' && typeof item.runs_on === 'string')
        || (result.chat_model != null && !(object(result.chat_model) && typeof result.chat_model.id === 'string'))) {
        throw new ApiError('Engine returned an invalid embedding placement', 200, 'INVALID_MODELS_RESPONSE', 'models.embedding_room');
    }
    return { ...result, chat_model: result.chat_model ?? null } as EmbeddingRoom;
}

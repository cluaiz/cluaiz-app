import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';

/** Engine-owned history; saved-KV-only controls remain in chatMemoryApi. */
export const chatHistoryApi = {
  deleteChat: async (chatId: string, signal?: AbortSignal): Promise<void> => {
    if (!chatId.trim()) throw new ApiError('A chat id is required', 400, 'INVALID_CHAT_ID');
    const result = await callCep<Record<string, unknown>>('memory.delete', { chat_id: chatId }, { signal });
    const events = result?.events as { files?: unknown; bytes?: unknown } | undefined;
    if (!result || result.chat_id !== chatId || result.ledger !== true || typeof result.saved_kv !== 'boolean'
      || typeof result.folder_removed !== 'boolean' || !events
      || ![events.files, events.bytes].every(n => Number.isSafeInteger(n) && Number(n) >= 0)) {
      throw new ApiError('Engine returned an invalid chat deletion acknowledgment', 200, 'INVALID_HISTORY_RESPONSE');
    }
    if (!result.folder_removed) throw new ApiError('Engine chat folder remains; cleanup is incomplete', 200, 'PARTIAL_CHAT_DELETE');
  },
};

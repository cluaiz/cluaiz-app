import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { getConfig, setConfig } from '../config/config.api';
import type { ChatMemorySettings, ChatMemoryStatus } from './chatMemory.types';

async function usage(): Promise<Omit<ChatMemoryStatus, 'settings'>> {
  const value = await callCep<Omit<ChatMemoryStatus, 'settings'>>('kv.status');
  if (!value || typeof value.directory !== 'string' || !Number.isFinite(value.bytes)
    || value.bytes < 0 || !Array.isArray(value.chats)) {
    throw new ApiError('Engine returned invalid saved-KV usage', 200, 'INVALID_KV_RESPONSE', 'kv.status');
  }
  return value;
}

/**
 * Chat memory on the engine: the KV cache of each chat (by session_id) saved to disk.
 */
export const chatMemoryApi = {
  /** Settings, disk used and saved chats */
  getStatus: async (): Promise<ChatMemoryStatus> => {
    const [settings, saved] = await Promise.all([getConfig('kv'), usage()]);
    return { ...saved, settings };
  },

  /** Changes the given settings; the disk and age limits apply at once */
  updateSettings: async (patch: Partial<ChatMemorySettings>): Promise<{ settings: ChatMemorySettings; bytes: number }> => {
    const settings = await setConfig('kv', patch);
    return { settings, bytes: (await usage()).bytes };
  },

  /** Forgets one chat's saved memory (e.g. when the chat is deleted) */
  deleteChat: (chatId: string): Promise<{ chat_id: string; deleted: boolean }> =>
    callCep('kv.delete', { chat_id: chatId }),

  /** Forgets every saved chat */
  clear: (): Promise<{ deleted: number }> => callCep('kv.clear'),
};

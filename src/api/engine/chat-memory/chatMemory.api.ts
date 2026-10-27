import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { getConfig, setConfig } from '../config/config.api';
import type { ChatMemoryRecord, ChatMemorySettings, ChatMemoryStatus } from './chatMemory.types';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const disk = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function invalid(method: string): never {
  throw new ApiError('Engine returned invalid saved model memory data', 200, 'INVALID_KV_RESPONSE', method);
}
function settings(value: unknown): ChatMemorySettings {
  if (!object(value) || typeof value.enabled !== 'boolean' || !disk(value.max_disk_gb)
    || !count(value.max_age_days) || value.max_age_days > 2 ** 32 - 1) invalid('config.kv');
  return value as unknown as ChatMemorySettings;
}
function record(value: unknown): value is ChatMemoryRecord {
  return object(value) && text(value.chat_id) && typeof value.model === 'string' && typeof value.key === 'string'
    && count(value.tokens) && count(value.positions) && count(value.bytes) && count(value.saved_at) && count(value.last_used);
}

async function usage(signal?: AbortSignal): Promise<Omit<ChatMemoryStatus, 'settings'>> {
  const value = await callCep<Omit<ChatMemoryStatus, 'settings'>>('kv.status', {}, { signal });
  if (!value || !text(value.directory) || !count(value.bytes) || !Array.isArray(value.chats)
    || !value.chats.every(record) || new Set(value.chats.map(chat => chat.chat_id)).size !== value.chats.length) invalid('kv.status');
  return value;
}

/**
 * Chat memory on the engine: the KV cache of each chat (by session_id) saved to disk.
 */
export const chatMemoryApi = {
  /** Settings, disk used and saved chats */
  getStatus: async (signal?: AbortSignal): Promise<ChatMemoryStatus> => {
    const [config, saved] = await Promise.all([getConfig('kv', signal), usage(signal)]);
    return { ...saved, settings: settings(config) };
  },

  /** Changes the given settings; the disk and age limits apply at once */
  updateSettings: async (patch: Partial<ChatMemorySettings>, signal?: AbortSignal): Promise<{ settings: ChatMemorySettings }> => {
    if (!object(patch) || !Object.keys(patch).length || Object.keys(patch).some(key => !['enabled', 'max_disk_gb', 'max_age_days'].includes(key))
      || (patch.enabled !== undefined && typeof patch.enabled !== 'boolean')
      || (patch.max_disk_gb !== undefined && !disk(patch.max_disk_gb))
      || (patch.max_age_days !== undefined && (!count(patch.max_age_days) || patch.max_age_days > 2 ** 32 - 1))) {
      throw new ApiError('Send supported model memory settings with valid values', 400, 'INVALID_KV_PATCH', 'config.set');
    }
    return { settings: settings(await setConfig('kv', patch, signal)) };
  },

  /** Forgets one chat's saved memory (e.g. when the chat is deleted) */
  deleteChat: async (chatId: string, signal?: AbortSignal): Promise<{ chat_id: string; deleted: boolean }> => {
    if (!text(chatId)) throw new ApiError('A chat id is required', 400, 'INVALID_KV_CHAT', 'kv.delete');
    const result = await callCep<{ chat_id: string; deleted: boolean }>('kv.delete', { chat_id: chatId }, { signal });
    if (!result || result.chat_id !== chatId || typeof result.deleted !== 'boolean') invalid('kv.delete');
    return result;
  },

  /** Forgets every saved chat */
  clear: async (signal?: AbortSignal): Promise<{ deleted: number }> => {
    const result = await callCep<{ deleted: number }>('kv.clear', {}, { signal });
    if (!result || !count(result.deleted)) invalid('kv.clear');
    return result;
  },
};

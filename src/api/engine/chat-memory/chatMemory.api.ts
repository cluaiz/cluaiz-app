import { client } from '../../client';
import { CHAT_MEMORY_ENDPOINTS } from './chatMemory.endpoints';
import type { ChatMemorySettings, ChatMemoryStatus } from './chatMemory.types';

/**
 * Chat memory on the engine: the KV cache of each chat (by session_id) saved to disk.
 */
export const chatMemoryApi = {
  /** Settings, disk used and saved chats */
  getStatus: (): Promise<ChatMemoryStatus> => client.get<ChatMemoryStatus>(CHAT_MEMORY_ENDPOINTS.ROOT),

  /** Changes the given settings; the disk and age limits apply at once */
  updateSettings: (settings: Partial<ChatMemorySettings>): Promise<{ settings: ChatMemorySettings; bytes: number }> =>
    client.post(CHAT_MEMORY_ENDPOINTS.SETTINGS, settings),

  /** Forgets one chat's saved memory (e.g. when the chat is deleted) */
  deleteChat: (chatId: string): Promise<{ chat_id: string; deleted: boolean }> =>
    client.delete(CHAT_MEMORY_ENDPOINTS.CHAT(chatId)),

  /** Forgets every saved chat */
  clear: (): Promise<{ deleted: number }> => client.delete(CHAT_MEMORY_ENDPOINTS.ROOT),
};

/**
 * Cluaiz Engine Chat Memory API Endpoints (saved KV cache per chat)
 * Maps 1:1 to routes in cluaiz/api/src/routes.rs
 */
export const CHAT_MEMORY_ENDPOINTS = {
  ROOT: '/v1/chat/memory',
  SETTINGS: '/v1/chat/memory/settings',
  CHAT: (chatId: string) => `/v1/chat/memory/${encodeURIComponent(chatId)}`,
} as const;

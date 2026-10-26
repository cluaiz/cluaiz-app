/**
 * Direct chat generation stays on its dedicated HTTP/SSE route.
 * Engine controls/context use CEP through chat.api.ts.
 */
export const CHAT_ENDPOINTS = {
  COMPLETIONS: '/v1/chat/completions',
} as const;

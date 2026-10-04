/**
 * Pure Chat Endpoints (Zero Tools Pollution)
 * Matches routes.rs:22-25
 */
export const CHAT_ENDPOINTS = {
  COMPLETIONS: '/v1/chat/completions',
  CONTEXT_TELEMETRY: '/v1/chat/context_telemetry',
  CANCEL: '/v1/chat/cancel',
  SKIP_REASONING: '/v1/chat/skip-reasoning',
} as const;

/**
 * Cluaiz Engine Session Tools Governance Endpoints
 * Matches routes.rs:51-52
 */
export const SESSION_TOOLS_ENDPOINTS = {
  ALL_TOOLS: '/v1/tools',
  SESSION_TOOLS: (sessionId: string) => `/v1/chat/${encodeURIComponent(sessionId)}/tools`,
} as const;

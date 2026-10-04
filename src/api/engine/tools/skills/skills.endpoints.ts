/**
 * Cluaiz Engine WASM Skills & Agents Endpoints
 * Matches routes.rs:55-59
 */
export const SKILLS_ENDPOINTS = {
  LIST: '/v1/skills/list',
  INSTALL: '/v1/skills/install',
  REMOVE: '/v1/skills/remove',
  CACHE: '/v1/skills/cache',
} as const;

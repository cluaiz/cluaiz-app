/**
 * Cluaiz Engine Plugins Endpoints
 * Matches routes.rs:61-66
 */
export const PLUGINS_ENDPOINTS = {
  LIST: '/v1/plugins/list',
  INSTALL: '/v1/plugins/install',
  REMOVE: '/v1/plugins/remove',
  CACHE: '/v1/plugins/cache',
} as const;

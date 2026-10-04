/**
 * Cluaiz Engine Model Context Protocol (MCP) Endpoints
 * Matches routes.rs:69-73
 */
export const MCP_ENDPOINTS = {
  LIST: '/v1/mcp/list',
  INSTALL: '/v1/mcp/install',
  REMOVE: '/v1/mcp/remove',
  CACHE: '/v1/mcp/cache',
} as const;

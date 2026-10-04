import { client } from '../../../client';
import { MCP_ENDPOINTS } from './mcp.endpoints';
import type {
  McpListResponse,
  McpActionResponse,
  McpCacheReportResponse,
  McpClearCacheResponse,
} from './mcp.types';

export const mcpApi = {
  /**
   * Lists all registered MCP servers.
   * GET /v1/mcp/list
   */
  listMcp: async (): Promise<McpListResponse> => {
    return client.get<McpListResponse>(MCP_ENDPOINTS.LIST);
  },

  /**
   * Installs or registers an MCP server natively.
   * POST /v1/mcp/install
   */
  installMcp: async (mcpName: string): Promise<McpActionResponse> => {
    return client.post<McpActionResponse>(MCP_ENDPOINTS.INSTALL, {
      mcp_name: mcpName,
    });
  },

  /**
   * Removes an installed MCP server.
   * DELETE /v1/mcp/remove
   */
  removeMcp: async (mcpName: string): Promise<McpActionResponse> => {
    return client.delete<McpActionResponse>(MCP_ENDPOINTS.REMOVE, {
      body: { mcp_name: mcpName },
    });
  },

  /**
   * Lists MCP cache report.
   * GET /v1/mcp/cache
   */
  listCache: async (): Promise<McpCacheReportResponse> => {
    return client.get<McpCacheReportResponse>(MCP_ENDPOINTS.CACHE);
  },

  /**
   * Clears MCP cache.
   * DELETE /v1/mcp/cache
   */
  clearCache: async (mcpName?: string): Promise<McpClearCacheResponse> => {
    return client.delete<McpClearCacheResponse>(MCP_ENDPOINTS.CACHE, {
      body: { mcp_name: mcpName || 'all' },
    });
  },
};

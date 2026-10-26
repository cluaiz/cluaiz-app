import { client } from '../../../client';
import { MCP_ENDPOINTS } from './mcp.endpoints';
import { listTools } from '../catalog';
import type {
  McpListResponse,
  McpActionResponse,
  McpCacheReportResponse,
  McpClearCacheResponse,
} from './mcp.types';

export const mcpApi = {
  /**
   * Lists all registered MCP servers.
   * CEP tools.list, filtered to the installed MCP packages.
   */
  listMcp: async (): Promise<McpListResponse> => {
    return { status: 'success', mcp_servers: await listTools('mcp') };
  },

  /**
   * Installs or registers an MCP server natively.
   * POST /v1/mcp/install
   */
  installMcp: async (mcpName: string): Promise<McpActionResponse> => {
    return client.post<McpActionResponse>(
      MCP_ENDPOINTS.INSTALL,
      { mcp_name: mcpName },
      // The engine answers after the download finishes, so no fixed timeout.
      { timeoutMs: 0 }
    );
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

import { listToolCache, clearToolCache } from '../cache';
import { listTools } from '../catalog';
import { installTool, removeTool } from '../lifecycle';
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
   * Waits for the CEP tools.install task's real result.
   */
  installMcp: (mcpName: string, signal?: AbortSignal): Promise<McpActionResponse> =>
    installTool('mcp', mcpName, signal),

  /**
   * Removes an installed MCP server.
   * CEP tools.remove, preserving refusal and package identity.
   */
  removeMcp: (mcpName: string, signal?: AbortSignal): Promise<McpActionResponse> =>
    removeTool('mcp', mcpName, signal),

  /**
   * Lists MCP cache report.
   * CEP tools.cache for installed MCP packages.
   */
  listCache: async (): Promise<McpCacheReportResponse> => {
    return listToolCache('mcp');
  },

  /**
   * Clears MCP cache.
   * CEP tools.clear_cache; omitted name means all MCP caches, not a package named "all".
   */
  clearCache: async (mcpName?: string): Promise<McpClearCacheResponse> => {
    return clearToolCache('mcp', mcpName);
  },
};

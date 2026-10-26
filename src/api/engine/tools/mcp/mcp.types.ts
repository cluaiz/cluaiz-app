/**
 * Cluaiz Engine Model Context Protocol (MCP) Types
 * App response projections for CEP tools methods, not wire envelopes.
 */

export interface McpServerItem {
  name: string;
  version?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface McpListResponse {
  status: string;
  mcp_servers: string[] | McpServerItem[];
  [key: string]: unknown;
}

export interface McpActionResponse {
  status: string;
  message: string;
}

export interface McpCacheReportResponse {
  status: string;
  message: unknown;
}

export interface McpClearCacheResponse {
  status: string;
  message: string;
}

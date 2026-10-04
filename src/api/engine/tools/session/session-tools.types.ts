/**
 * Cluaiz Engine Session Tools Governance Types
 * Matches crate::handlers::session_tools
 */

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AllToolsResponse {
  tools: ToolDefinition[];
  [key: string]: unknown;
}

export interface SessionToolsResponse {
  session_id: string;
  tools: ToolDefinition[];
  [key: string]: unknown;
}

export interface SessionToolsUpdateRequest {
  tools: ToolDefinition[] | string[];
  [key: string]: unknown;
}

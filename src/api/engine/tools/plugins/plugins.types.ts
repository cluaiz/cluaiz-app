/**
 * Cluaiz Engine Plugins Types
 * Matches crate::handlers::plugins
 */

export interface PluginItem {
  name: string;
  version?: string;
  description?: string;
  path?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface PluginListResponse {
  status: string;
  plugins: string[] | PluginItem[];
  [key: string]: unknown;
}

export interface PluginActionResponse {
  status: string;
  message: string;
}

export interface PluginCacheReportResponse {
  status: string;
  message: unknown;
}

export interface PluginClearCacheResponse {
  status: string;
  message: string;
}

/**
 * Cluaiz Engine Components Types
 * Matches crate::handlers::components & cel_handler::execute_dynamic
 */

export interface ComponentSettingsResponse {
  status: string;
  schema?: Record<string, unknown>;
  values?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ComponentFileItem {
  name: string;
  path: string;
  is_dir: boolean;
  [key: string]: unknown;
}

export interface ComponentCacheInfo {
  temp_bytes: number;
  all_bytes: number;
  [key: string]: unknown;
}

export interface ComponentFilesResponse {
  status: string;
  files: ComponentFileItem[];
  cache?: ComponentCacheInfo;
  [key: string]: unknown;
}

export interface UpdateComponentSettingsPayload {
  component_id: string;
  component_type?: string;
  settings: Record<string, unknown>;
  [key: string]: unknown;
}



export interface UpdateComponentFilePayload {
  component_type: string;
  component_id: string;
  content: string;
}

export interface DynamicExecuteRequest {
  component_name: string;
  function_name: string;
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DynamicExecuteResponse {
  status: string;
  result?: unknown;
  output?: string;
  error?: string;
  [key: string]: unknown;
}

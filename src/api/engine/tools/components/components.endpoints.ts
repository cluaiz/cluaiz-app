/**
 * Cluaiz Engine Components & Dynamic Execution Endpoints
 * Matches routes.rs:76-83
 */
export const COMPONENTS_ENDPOINTS = {
  LIST: '/api/components/list',
  SETTINGS: '/api/components/settings',
  FILE: '/api/components/file',
  FILES: '/api/components/files',
  CACHE: '/api/components/cache',
  EXECUTE_DYNAMIC: (componentName: string, functionName: string) =>
    `/v1/execute/${encodeURIComponent(componentName)}/${encodeURIComponent(functionName)}`,
} as const;

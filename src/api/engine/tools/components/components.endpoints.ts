/**
 * Cluaiz Engine Components & Dynamic Execution Endpoints
 * Remaining file/execution routes; settings/cache use shared CEP adapters.
 */
export const COMPONENTS_ENDPOINTS = {
  FILE: '/api/components/file',
  FILES: '/api/components/files',
  EXECUTE_DYNAMIC: (componentName: string, functionName: string) =>
    `/v1/execute/${encodeURIComponent(componentName)}/${encodeURIComponent(functionName)}`,
} as const;

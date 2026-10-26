/**
 * Cluaiz Engine Components & Dynamic Execution Endpoints
 * Remaining execution route; package file/settings/cache methods use shared CEP adapters.
 */
export const COMPONENTS_ENDPOINTS = {
  EXECUTE_DYNAMIC: (componentName: string, functionName: string) =>
    `/v1/execute/${encodeURIComponent(componentName)}/${encodeURIComponent(functionName)}`,
} as const;

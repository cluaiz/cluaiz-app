/**
 * Cluaiz Engine Models API Endpoints
 * Remaining direct and not-yet-migrated operations. Installed inventory uses CEP
 * models.list through models.api.ts, rather than a separate installed REST route.
 */
export const MODELS_ENDPOINTS = {
  LIST_V1: '/v1/models',
  AVAILABLE: '/models/available',
  LOAD: '/models/load',
  DOWNLOAD: '/models/download',
  PULL: '/api/pull',
  TAGS: '/api/tags',
  INSPECT_RAW_HEADER: (modelId: string) =>
    `/v1/models/${encodeURIComponent(modelId)}/inspect_raw_header`,
  DELETE_MODEL: (modelId: string) =>
    `/v1/models/${encodeURIComponent(modelId)}`,
} as const;

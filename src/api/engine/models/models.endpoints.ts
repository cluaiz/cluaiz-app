/**
 * Cluaiz Engine Models API Endpoints
 * Maps 1:1 to routes in cluaiz/inference-engine/api/src/routes.rs
 */
export const MODELS_ENDPOINTS = {
  LIST_V1: '/v1/models',
  INSTALLED: '/v1/models/installed',
  AVAILABLE: '/models/available',
  HARDWARE: '/hardware',
  LOAD: '/models/load',
  DOWNLOAD: '/models/download',
  PULL: '/api/pull',
  TAGS: '/api/tags',
  INSPECT_RAW_HEADER: (modelId: string) =>
    `/v1/models/${encodeURIComponent(modelId)}/inspect_raw_header`,
  DELETE_MODEL: (modelId: string) =>
    `/v1/models/${encodeURIComponent(modelId)}`,
} as const;

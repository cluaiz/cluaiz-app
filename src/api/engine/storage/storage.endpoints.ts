/**
 * Cluaiz Engine Storage API Endpoints
 * Maps 1:1 to routes in cluaiz/inference-engine/api/src/routes.rs
 */
export const STORAGE_ENDPOINTS = {
  TEMP_MEDIA: '/v1/system/storage/temp_media',
  CLEAN_TEMP_MEDIA: '/v1/system/storage/temp_media/clean',
  SETTINGS: '/v1/system/storage/settings',
} as const;

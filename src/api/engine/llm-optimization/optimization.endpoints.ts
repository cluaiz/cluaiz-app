/**
 * Cluaiz Engine LLM Optimization API Endpoints
 * Maps 1:1 to routes in cluaiz/inference-engine/api/src/routes.rs
 */
export const OPTIMIZATION_ENDPOINTS = {
  STATUS: '/v1/optimization/status',
  UPDATE: '/v1/optimization/update',
} as const;

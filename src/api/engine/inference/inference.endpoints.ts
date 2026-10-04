/**
 * Cluaiz Engine Inference API Endpoints
 * Maps 1:1 to routes in cluaiz/inference-engine/api/src/routes.rs
 */
export const INFERENCE_ENDPOINTS = {
  GGUF_CONFIG: '/v1/system/gguf_config',
  ONNX_CONFIG: '/v1/system/onnx_config',
  CALIBRATE: '/v1/hardware/calibrate',
} as const;

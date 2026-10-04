import { client } from '../../client';
import { INFERENCE_ENDPOINTS } from './inference.endpoints';
import type {
  GgufConfig,
  OnnxConfig,
  HardwareCalibrationResult,
} from './inference.types';

/**
 * Pure Stateless Inference API Service
 */
export const inferenceApi = {
  /**
   * Fetches the authoritative GGUF engine configuration
   */
  getGguf: (): Promise<GgufConfig> => {
    return client.get<GgufConfig>(INFERENCE_ENDPOINTS.GGUF_CONFIG);
  },

  /**
   * Persists updated GGUF engine configuration to disk
   */
  saveGguf: (config: Partial<GgufConfig> | Record<string, any>): Promise<{ status: string }> => {
    return client.post<{ status: string }>(INFERENCE_ENDPOINTS.GGUF_CONFIG, config);
  },

  /**
   * Fetches the authoritative ONNX engine configuration
   */
  getOnnx: (): Promise<OnnxConfig> => {
    return client.get<OnnxConfig>(INFERENCE_ENDPOINTS.ONNX_CONFIG);
  },

  /**
   * Persists updated ONNX engine configuration to disk
   */
  saveOnnx: (config: Partial<OnnxConfig> | Record<string, any>): Promise<{ status: string }> => {
    return client.post<{ status: string }>(INFERENCE_ENDPOINTS.ONNX_CONFIG, config);
  },

  /**
   * Triggers hardware auto-calibration in engine core
   */
  calibrateHardware: (): Promise<HardwareCalibrationResult> => {
    return client.post<HardwareCalibrationResult>(INFERENCE_ENDPOINTS.CALIBRATE, {});
  },

  // Aliases for backwards compatibility
  getGgufConfig: (): Promise<GgufConfig> => inferenceApi.getGguf(),
  updateGgufConfig: (config: Partial<GgufConfig> | Record<string, any>): Promise<{ status: string }> =>
    inferenceApi.saveGguf(config),
  getOnnxConfig: (): Promise<OnnxConfig> => inferenceApi.getOnnx(),
  updateOnnxConfig: (config: Partial<OnnxConfig> | Record<string, any>): Promise<{ status: string }> =>
    inferenceApi.saveOnnx(config),
};

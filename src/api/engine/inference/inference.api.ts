import { getConfig, setConfig } from '../config/config.api';
import { ApiError } from '../../client/errors';
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
    return getConfig('gguf');
  },

  /**
   * Persists updated GGUF engine configuration to disk
   */
  saveGguf: async (config: Partial<GgufConfig> | Record<string, any>): Promise<{ status: string; gguf: GgufConfig }> => {
    // The Engine replaces a provided sampler object; preserve omitted saved sampler fields.
    const patch = config.samplers ? { ...config,
      samplers: { ...(await getConfig('gguf')).samplers, ...config.samplers } } : config;
    return { status: 'success', gguf: await setConfig('gguf', patch) };
  },

  /**
   * Fetches the authoritative ONNX engine configuration
   */
  getOnnx: (): Promise<OnnxConfig> => {
    return getConfig('onnx');
  },

  /**
   * Persists updated ONNX engine configuration to disk
   */
  saveOnnx: async (config: Partial<OnnxConfig> | Record<string, any>): Promise<{ status: string; onnx: OnnxConfig }> => {
    return { status: 'success', onnx: await setConfig('onnx', config) };
  },

  /**
   * The current Engine exposes hardware discovery, not a calibration operation.
   */
  calibrateHardware: async (): Promise<HardwareCalibrationResult> => {
    throw new ApiError('Hardware calibration is not exposed by the current Engine API; use the CLI calibrate command.',
      501, 'UNSUPPORTED_OPERATION', 'hardware.calibrate');
  },

  // Aliases for backwards compatibility
  getGgufConfig: (): Promise<GgufConfig> => inferenceApi.getGguf(),
  updateGgufConfig: (config: Partial<GgufConfig> | Record<string, any>): Promise<{ status: string }> =>
    inferenceApi.saveGguf(config),
  getOnnxConfig: (): Promise<OnnxConfig> => inferenceApi.getOnnx(),
  updateOnnxConfig: (config: Partial<OnnxConfig> | Record<string, any>): Promise<{ status: string }> =>
    inferenceApi.saveOnnx(config),
};

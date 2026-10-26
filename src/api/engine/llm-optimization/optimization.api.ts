import { getConfig, setConfig } from '../config/config.api';
import type {
  OptimizationControl,
  OptimizationStatusResponse,
} from './optimization.types';

/**
 * Pure Stateless LLM Optimization API Service
 */
export const optimizationApi = {
  /**
   * Fetches current hardware optimization state from the engine
   */
  getStatus: async (): Promise<OptimizationStatusResponse> => {
    return { status: 'success', optimization: await getConfig('optimization') };
  },

  /**
   * Updates optimization control settings on the engine
   */
  update: async (
    patch: Partial<OptimizationControl>
  ): Promise<OptimizationStatusResponse> => {
    return { status: 'success', optimization: await setConfig('optimization', patch) };
  },

  // Aliases for backwards compatibility
  getBoosterStatus: (): Promise<OptimizationStatusResponse> => optimizationApi.getStatus(),
  updateBooster: (patch: Partial<OptimizationControl>): Promise<{ status: string; message?: string }> =>
    optimizationApi.update(patch),
};

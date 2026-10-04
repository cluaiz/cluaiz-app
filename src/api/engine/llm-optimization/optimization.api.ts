import { client } from '../../client';
import { OPTIMIZATION_ENDPOINTS } from './optimization.endpoints';
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
  getStatus: (): Promise<OptimizationStatusResponse> => {
    return client.get<OptimizationStatusResponse>(OPTIMIZATION_ENDPOINTS.STATUS);
  },

  /**
   * Updates optimization control settings on the engine
   */
  update: (
    patch: Partial<OptimizationControl>
  ): Promise<{ status: string; message?: string }> => {
    return client.post<{ status: string; message?: string }>(
      OPTIMIZATION_ENDPOINTS.UPDATE,
      patch
    );
  },

  // Aliases for backwards compatibility
  getBoosterStatus: (): Promise<OptimizationStatusResponse> => optimizationApi.getStatus(),
  updateBooster: (patch: Partial<OptimizationControl>): Promise<{ status: string; message?: string }> =>
    optimizationApi.update(patch),
};

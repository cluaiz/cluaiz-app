import { client } from '../../client';
import { CONTROL_ENDPOINTS } from './control.endpoints';
import type {
  CelExecuteRequest,
  CelExecuteResponse,
  BenchmarkRunResponse,
} from './control.types';

export const controlApi = {
  /**
   * Executes a Common Expression Language (CEL) script in the native engine sandbox.
   */
  executeCel: async (payload: CelExecuteRequest): Promise<CelExecuteResponse> => {
    return client.post<CelExecuteResponse>(CONTROL_ENDPOINTS.CEL_EXECUTE, payload);
  },

  /**
   * Hardware stress test and benchmark is executed locally via CLI (`cluaiz bench`).
   */
  runBenchmark: async (): Promise<BenchmarkRunResponse> => {
    return {
      status: 'unsupported',
      message: 'Benchmark is executed locally via CLI (cluaiz bench). HTTP remote execution is not exposed.',
    };
  },
};

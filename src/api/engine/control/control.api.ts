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
   * Triggers an isolated hardware stress test and benchmark run.
   */
  runBenchmark: async (): Promise<BenchmarkRunResponse> => {
    return client.post<BenchmarkRunResponse>(CONTROL_ENDPOINTS.BENCHMARK_RUN, {});
  },
};

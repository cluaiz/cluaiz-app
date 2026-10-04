import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { controlApi } from './control.api';
import type { CelExecuteResponse, BenchmarkRunResponse } from './control.types';

export interface ControlState {
  lastCelResult: CelExecuteResponse | null;
  lastBenchmarkResult: BenchmarkRunResponse | null;
  isRunningBenchmark: boolean;
  status: Status;
  error: string | null;

  // Actions
  executeCel: (script: string) => Promise<CelExecuteResponse>;
  runBenchmark: () => Promise<BenchmarkRunResponse | null>;
  reset: () => void;
}

export const useControlStore = create<ControlState>((set) => ({
  lastCelResult: null,
  lastBenchmarkResult: null,
  isRunningBenchmark: false,
  status: 'idle',
  error: null,

  executeCel: async (script: string) => {
    set({ status: 'pending', error: null });
    try {
      const res = await controlApi.executeCel({ script });
      set({ lastCelResult: res, status: 'success', error: null });
      return res;
    } catch (err) {
      const msg = errorMessage(err);
      set({ status: 'error', error: msg });
      return { success: false, error: msg };
    }
  },

  runBenchmark: async () => {
    set({ isRunningBenchmark: true, status: 'pending', error: null });
    try {
      const res = await controlApi.runBenchmark();
      set({
        isRunningBenchmark: false,
        lastBenchmarkResult: res,
        status: 'success',
        error: null,
      });
      return res;
    } catch (err) {
      const msg = errorMessage(err);
      set({ isRunningBenchmark: false, status: 'error', error: msg });
      return null;
    }
  },

  reset: () => {
    set({
      lastCelResult: null,
      lastBenchmarkResult: null,
      isRunningBenchmark: false,
      status: 'idle',
      error: null,
    });
  },
}));

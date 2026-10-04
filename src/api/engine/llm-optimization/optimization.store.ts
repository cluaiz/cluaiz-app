import { create } from 'zustand';
import { optimizationApi } from './optimization.api';
import { errorMessage } from '../../client/errors';
import type { Status } from '../../client/status';
import type { OptimizationControl } from './optimization.types';

interface OptimizationState {
  optimization: OptimizationControl | null;
  status: Status;
  isSaving: boolean;
  error: string | null;

  load: () => Promise<void>;
  updateField: <K extends keyof OptimizationControl>(
    key: K,
    value: OptimizationControl[K]
  ) => Promise<void>;
  updateBuffer: (type: 'vram' | 'ram', value: number | null) => Promise<void>;
}

export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  optimization: null,
  status: 'idle',
  isSaving: false,
  error: null,

  load: async () => {
    set({ status: 'pending', error: null });
    try {
      const res = await optimizationApi.getStatus();
      if (res && res.optimization) {
        set({ optimization: res.optimization, status: 'success' });
      } else {
        set({ status: 'error', error: res?.message || 'Invalid optimization response' });
      }
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  updateField: async (key, value) => {
    const prev = get().optimization;
    if (!prev) return;

    // Optimistic update
    const next: OptimizationControl = {
      ...prev,
      [key]: value,
    };
    set({ optimization: next, isSaving: true, error: null });

    try {
      await optimizationApi.update({ [key]: value });
      set({ isSaving: false, status: 'success' });
    } catch (err) {
      // Rollback on failure
      set({
        optimization: prev,
        isSaving: false,
        status: 'error',
        error: errorMessage(err),
      });
    }
  },

  updateBuffer: async (type, value) => {
    const prev = get().optimization;
    if (!prev) return;

    const key = type === 'vram' ? 'custom_vram_buffer_gb' : 'custom_ram_buffer_gb';
    const next: OptimizationControl = {
      ...prev,
      [key]: value,
    };
    set({ optimization: next, isSaving: true, error: null });

    try {
      await optimizationApi.update({ [key]: value });
      set({ isSaving: false, status: 'success' });
    } catch (err) {
      set({
        optimization: prev,
        isSaving: false,
        status: 'error',
        error: errorMessage(err),
      });
    }
  },
}));

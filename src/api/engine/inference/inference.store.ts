import { create } from 'zustand';
import { inferenceApi } from './inference.api';
import { errorMessage } from '../../client/errors';
import type { Status } from '../../client/status';
import { toast } from '../../../components/ui/toast';
import type {
  GgufConfig,
  OnnxConfig,
  GgufSamplers,
  GgufHardwareExecution,
  GgufTemplatingFlags,
  UserMovedFlags,
} from './inference.types';

interface InferenceState {
  gguf: GgufConfig | null;
  onnx: OnnxConfig | null;
  status: Status;
  isSaving: boolean;
  error: string | null;

  // Lifecycle actions
  load: () => Promise<void>;
  saveGguf: (next: GgufConfig) => Promise<void>;
  saveOnnx: (next: OnnxConfig) => Promise<void>;

  // Granular update actions with debounce
  updateGgufSampler: <K extends keyof GgufSamplers>(key: K, value: GgufSamplers[K]) => void;
  updateGgufHardware: <K extends keyof GgufHardwareExecution>(key: K, value: GgufHardwareExecution[K]) => void;
  updateGgufTemplate: <K extends keyof GgufTemplatingFlags>(key: K, value: GgufTemplatingFlags[K]) => void;
  updateGgufUserMoved: <K extends keyof UserMovedFlags>(key: K, value: UserMovedFlags[K]) => void;

  updateOnnxField: <K extends keyof OnnxConfig>(key: K, value: OnnxConfig[K]) => void;
  updateOnnxUserMoved: <K extends keyof UserMovedFlags>(key: K, value: UserMovedFlags[K]) => void;
}

let ggufSaveTimer: ReturnType<typeof setTimeout> | null = null;
let onnxSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useInferenceStore = create<InferenceState>((set, get) => ({
  gguf: null,
  onnx: null,
  status: 'idle',
  isSaving: false,
  error: null,

  load: async () => {
    set({ status: 'pending', error: null });
    try {
      const [gguf, onnx] = await Promise.all([
        inferenceApi.getGguf(),
        inferenceApi.getOnnx(),
      ]);
      set({ gguf, onnx, status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  saveGguf: async (next: GgufConfig) => {
    const prev = get().gguf;
    set({ gguf: next, isSaving: true, error: null });
    try {
      await toast.promise(
        inferenceApi.saveGguf(next),
        {
          loading: 'Saving inference configuration...',
          success: 'Inference configuration saved',
          error: 'Failed to save inference configuration'
        }
      );
      set({ isSaving: false, status: 'success' });
    } catch (err) {
      // Rollback to previous state on failure
      set({ gguf: prev, isSaving: false, status: 'error', error: errorMessage(err) });
    }
  },

  saveOnnx: async (next: OnnxConfig) => {
    const prev = get().onnx;
    set({ onnx: next, isSaving: true, error: null });
    try {
      await toast.promise(
        inferenceApi.saveOnnx(next),
        {
          loading: 'Saving ONNX configuration...',
          success: 'ONNX configuration saved',
          error: 'Failed to save ONNX configuration'
        }
      );
      set({ isSaving: false, status: 'success' });
    } catch (err) {
      // Rollback to previous state on failure
      set({ onnx: prev, isSaving: false, status: 'error', error: errorMessage(err) });
    }
  },

  updateGgufSampler: (key, value) => {
    const current = get().gguf;
    if (!current) return;

    const next: GgufConfig = {
      ...current,
      samplers: {
        ...current.samplers,
        [key]: value,
      },
    };

    set({ gguf: next });

    if (ggufSaveTimer) clearTimeout(ggufSaveTimer);
    ggufSaveTimer = setTimeout(() => {
      get().saveGguf(next);
    }, 300);
  },

  updateGgufHardware: (key, value) => {
    const current = get().gguf;
    if (!current) return;

    const next: GgufConfig = {
      ...current,
      hardware_and_execution: {
        ...current.hardware_and_execution,
        [key]: value,
      },
    };

    set({ gguf: next });

    if (ggufSaveTimer) clearTimeout(ggufSaveTimer);
    ggufSaveTimer = setTimeout(() => {
      get().saveGguf(next);
    }, 300);
  },

  updateGgufTemplate: (key, value) => {
    const current = get().gguf;
    if (!current) return;

    const next: GgufConfig = {
      ...current,
      templating_flags: {
        ...current.templating_flags,
        [key]: value,
      },
    };

    set({ gguf: next });

    if (ggufSaveTimer) clearTimeout(ggufSaveTimer);
    ggufSaveTimer = setTimeout(() => {
      get().saveGguf(next);
    }, 300);
  },

  updateGgufUserMoved: (key, value) => {
    const current = get().gguf;
    if (!current) return;

    const next: GgufConfig = {
      ...current,
      user_moved_flags: {
        ...current.user_moved_flags,
        [key]: value,
      },
    };

    set({ gguf: next });

    if (ggufSaveTimer) clearTimeout(ggufSaveTimer);
    ggufSaveTimer = setTimeout(() => {
      get().saveGguf(next);
    }, 300);
  },

  updateOnnxField: (key, value) => {
    const current = get().onnx;
    if (!current) return;

    const next: OnnxConfig = {
      ...current,
      [key]: value,
    };

    set({ onnx: next });

    if (onnxSaveTimer) clearTimeout(onnxSaveTimer);
    onnxSaveTimer = setTimeout(() => {
      get().saveOnnx(next);
    }, 300);
  },

  updateOnnxUserMoved: (key, value) => {
    const current = get().onnx;
    if (!current) return;

    const next: OnnxConfig = {
      ...current,
      user_moved_flags: {
        ...current.user_moved_flags,
        [key]: value,
      },
    };

    set({ onnx: next });

    if (onnxSaveTimer) clearTimeout(onnxSaveTimer);
    onnxSaveTimer = setTimeout(() => {
      get().saveOnnx(next);
    }, 300);
  },
}));

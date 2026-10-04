import { create } from 'zustand';
import { modelsApi } from './models.api';
import { errorMessage } from '../../client/errors';
import type { Status } from '../../client/status';
import { toast } from '../../../components/ui/toast';
import type {
  ModelRegistryEntry,
  HardwareDetectorStats,
  InspectHeaderResponse,
  DownloadModelPayload,
} from './models.types';

interface ModelsState {
  installed: ModelRegistryEntry[];
  hardware: HardwareDetectorStats | null;
  inspectedHeader: InspectHeaderResponse | null;
  status: Status;
  isInspecting: boolean;
  error: string | null;

  load: () => Promise<void>;
  inspect: (modelId: string, filename?: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  loadModel: (modelId: string) => Promise<void>;
  pullModel: (modelId: string) => Promise<void>;
  downloadModel: (payload?: DownloadModelPayload) => Promise<boolean>;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  installed: [],
  hardware: null,
  inspectedHeader: null,
  status: 'idle',
  isInspecting: false,
  error: null,

  load: async () => {
    set({ status: 'pending', error: null });
    try {
      const [installedRes, hwRes] = await Promise.all([
        modelsApi.getInstalled().catch(() => null),
        modelsApi.getHardware().catch(() => null),
      ]);

      const list: ModelRegistryEntry[] =
        installedRes?.installed || installedRes?.models || [];

      set({
        installed: list,
        hardware: hwRes?.hardware || null,
        status: 'success',
      });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  inspect: async (modelId: string, filename?: string) => {
    set({ isInspecting: true, error: null });
    try {
      const res = await modelsApi.inspectHeader(modelId, filename);
      set({ inspectedHeader: res, isInspecting: false });
    } catch (err) {
      set({ isInspecting: false, error: errorMessage(err) });
    }
  },

  deleteModel: async (modelId: string) => {
    try {
      await toast.promise(
        modelsApi.deleteModel(modelId),
        {
          loading: `Deleting model ${modelId}...`,
          success: `Model ${modelId} deleted`,
          error: (err: any) => `Failed to delete model: ${errorMessage(err)}`
        }
      );
      // Only delete from store after successful response from engine
      set(state => ({
        installed: state.installed.filter((m) => m.id !== modelId)
      }));
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  loadModel: async (modelId: string) => {
    try {
      await modelsApi.loadModel(modelId);
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  pullModel: async (modelId: string) => {
    try {
      await modelsApi.pullModel(modelId);
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  downloadModel: async (payload?: DownloadModelPayload) => {
    try {
      await modelsApi.downloadModel(payload);
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },
}));

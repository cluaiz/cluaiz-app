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
  deleteModel: (modelId: string) => Promise<boolean>;
  loadModel: (modelId: string) => Promise<boolean>;
  pullModel: (modelId: string) => Promise<boolean>;
  downloadModel: (payload?: DownloadModelPayload) => Promise<boolean>;
}

export const useModelsStore = create<ModelsState>((set, get) => {
  let loadVersion = 0, inspectVersion = 0;
  let inspectingModel: string | null = null;
  return {
  installed: [],
  hardware: null,
  inspectedHeader: null,
  status: 'idle',
  isInspecting: false,
  error: null,

  load: async () => {
    const version = ++loadVersion;
    set({ status: 'pending', error: null });
    try {
      const [installedRes, hwRes] = await Promise.all([
        modelsApi.getInstalled(),
        modelsApi.getHardware().catch(() => null),
      ]);

      if (version !== loadVersion) return;

      set({
        installed: installedRes.installed,
        hardware: hwRes?.hardware || null,
        status: 'success',
      });
    } catch (err) {
      if (version === loadVersion) set({ status: 'error', error: errorMessage(err) });
    }
  },

  inspect: async (modelId: string, filename?: string) => {
    const version = ++inspectVersion;
    inspectingModel = modelId;
    set({ isInspecting: true, inspectedHeader: null, error: null });
    try {
      const res = await modelsApi.inspectHeader(modelId, filename);
      if (version === inspectVersion) { inspectingModel = null; set({ inspectedHeader: res, isInspecting: false }); }
    } catch (err) {
      if (version === inspectVersion) { inspectingModel = null; set({ isInspecting: false, error: errorMessage(err) }); }
    }
  },

  deleteModel: async (modelId: string) => {
    set({error: null});
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
      loadVersion++;
      const deletedInspection = inspectingModel === modelId;
      if (deletedInspection) { inspectVersion++; inspectingModel = null; }
      set(state => ({
        installed: state.installed.filter((m) => m.id !== modelId),
        inspectedHeader: state.inspectedHeader?.model === modelId ? null : state.inspectedHeader,
        isInspecting: deletedInspection ? false : state.isInspecting,
        status: 'success',
      }));
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  loadModel: async (modelId: string) => {
    set({error: null});
    try {
      await modelsApi.loadModel(modelId);
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  pullModel: (modelId: string) => get().downloadModel({model_id: modelId}),

  downloadModel: async (payload?: DownloadModelPayload) => {
    set({error: null});
    try {
      await modelsApi.downloadModel(payload);
      await get().load();
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },
  };
});

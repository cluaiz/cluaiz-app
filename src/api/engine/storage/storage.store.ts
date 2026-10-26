import { create } from 'zustand';
import { storageApi } from './storage.api';
import { errorMessage } from '../../client/errors';
import type { Status } from '../../client/status';
import type { StorageStatus, StorageSettings } from './storage.types';

interface StorageState {
  mediaStatus: StorageStatus | null;
  settings: StorageSettings | null;
  status: Status;
  isCleaning: boolean;
  isSaving: boolean;
  error: string | null;

  load: () => Promise<void>;
  cleanMedia: () => Promise<void>;
  updateSettings: (patch: Partial<StorageSettings>) => Promise<void>;
}

export const useStorageStore = create<StorageState>((set, get) => ({
  mediaStatus: null,
  settings: null,
  status: 'idle',
  isCleaning: false,
  isSaving: false,
  error: null,

  load: async () => {
    set({ status: 'pending', error: null });
    try {
      const [mediaStatus, settings] = await Promise.all([
        storageApi.getTempMediaStatus(),
        storageApi.getStorageSettings(),
      ]);
      set({ mediaStatus, settings, status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  cleanMedia: async () => {
    set({ isCleaning: true, error: null });
    try {
      await storageApi.cleanTempMedia();
      const usage = await storageApi.getTempMediaStatus();
      set({
        mediaStatus: usage,
        isCleaning: false,
      });
    } catch (err) {
      set({ isCleaning: false, error: errorMessage(err) });
    }
  },

  updateSettings: async (patch) => {
    const prev = get().settings;
    const next: StorageSettings = {
      ...(prev || { cleanup_policy: 'Immediate' }),
      ...patch,
    };
    set({ settings: next, isSaving: true, error: null });

    try {
      const saved = await storageApi.updateStorageSettings(patch);
      if (get().settings === next) set({ settings: saved.storage, isSaving: false, status: 'success' });
    } catch (err) {
      if (get().settings === next) set({ settings: prev, isSaving: false, status: 'error', error: errorMessage(err) });
    }
  },
}));

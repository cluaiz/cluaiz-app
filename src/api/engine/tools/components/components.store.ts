import { create } from 'zustand';
import { componentsApi } from './components.api';
import { type Status, errorMessage } from '../../../client';
import type { UpdateComponentFilePayload } from './components.types';

export interface ComponentsState {
  components: Record<string, unknown> | null;
  status: Status;
  error: string | null;

  fetchComponents: (componentType?: string) => Promise<void>;
  updateSettings: (componentId: string, settings: Record<string, unknown>) => Promise<boolean>;
  updateFile: (payload: UpdateComponentFilePayload) => Promise<boolean>;
  executeDynamic: (component: string, fn: string, args?: Record<string, unknown>) => Promise<unknown>;
  reset: () => void;
}

export const useComponentsStore = create<ComponentsState>((set) => ({
  components: null,
  status: 'idle',
  error: null,

  fetchComponents: async (componentType?: string) => {
    set({ status: 'pending', error: null });
    try {
      const res = await componentsApi.listComponents(componentType);
      set({ components: res, status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  updateSettings: async (componentId: string, settings: Record<string, unknown>) => {
    try {
      await componentsApi.updateSettings({ component_id: componentId, settings });
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  updateFile: async (payload: UpdateComponentFilePayload) => {
    try {
      await componentsApi.updateFile(payload);
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  executeDynamic: async (component: string, fn: string, args?: Record<string, unknown>) => {
    try {
      const res = await componentsApi.executeDynamic(component, fn, args);
      return res.result ?? res;
    } catch (err) {
      const msg = errorMessage(err);
      set({ error: msg });
      throw err;
    }
  },

  reset: () => {
    set({
      components: null,
      status: 'idle',
      error: null,
    });
  },
}));

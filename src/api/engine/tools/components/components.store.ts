import { create } from 'zustand';
import { componentsApi } from './components.api';
import { type Status, errorMessage } from '../../../client';
import type { UpdateComponentFilePayload } from './components.types';

export interface ComponentsState {
  components: Record<string, unknown> | null;
  status: Status;
  error: string | null;

  fetchComponents: (componentType?: string) => Promise<void>;
  updateSettings: (componentId: string, settings: Record<string, unknown>, componentType: string) => Promise<boolean>;
  updateFile: (payload: UpdateComponentFilePayload) => Promise<boolean>;
  executeDynamic: (component: string, fn: string, args: Record<string, unknown> | undefined, kind: string) => Promise<unknown>;
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

  updateSettings: async (componentId: string, settings: Record<string, unknown>, componentType: string) => {
    try {
      await componentsApi.updateSettings({ component_id: componentId, component_type: componentType, settings });
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

  executeDynamic: async (component: string, fn: string, args: Record<string, unknown> | undefined, kind: string) => {
    try {
      const res = await componentsApi.executeDynamic(component, fn, args, kind);
      return res.result;
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

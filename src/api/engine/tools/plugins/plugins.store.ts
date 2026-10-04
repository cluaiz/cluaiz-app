import { create } from 'zustand';
import { pluginsApi } from './plugins.api';
import { type Status, errorMessage } from '../../../client';
import type { PluginItem } from './plugins.types';

export interface PluginsState {
  plugins: (string | PluginItem)[];
  status: Status;
  error: string | null;

  fetchPlugins: () => Promise<void>;
  installPlugin: (name: string) => Promise<boolean>;
  removePlugin: (name: string) => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  reset: () => void;
}

export const usePluginsStore = create<PluginsState>((set, get) => ({
  plugins: [],
  status: 'idle',
  error: null,

  fetchPlugins: async () => {
    set({ status: 'pending', error: null });
    try {
      const res = await pluginsApi.listPlugins();
      set({ plugins: res.plugins || [], status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  installPlugin: async (name: string) => {
    try {
      await pluginsApi.installPlugin(name);
      await get().fetchPlugins();
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  removePlugin: async (name: string) => {
    try {
      await pluginsApi.removePlugin(name);
      set((state) => ({
        plugins: state.plugins.filter((p) => (typeof p === 'string' ? p !== name : p.name !== name)),
      }));
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  clearCache: async () => {
    try {
      await pluginsApi.clearCache();
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  reset: () => {
    set({
      plugins: [],
      status: 'idle',
      error: null,
    });
  },
}));

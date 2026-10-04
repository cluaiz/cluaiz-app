import { create } from 'zustand';
import { mcpApi } from './mcp.api';
import { type Status, errorMessage } from '../../../client';
import type { McpServerItem } from './mcp.types';

export interface McpState {
  mcpServers: (string | McpServerItem)[];
  status: Status;
  error: string | null;

  fetchMcp: () => Promise<void>;
  installMcp: (name: string) => Promise<boolean>;
  removeMcp: (name: string) => Promise<boolean>;
  clearCache: (name?: string) => Promise<boolean>;
  reset: () => void;
}

export const useMcpStore = create<McpState>((set, get) => ({
  mcpServers: [],
  status: 'idle',
  error: null,

  fetchMcp: async () => {
    set({ status: 'pending', error: null });
    try {
      const res = await mcpApi.listMcp();
      set({ mcpServers: res.mcp || [], status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  installMcp: async (name: string) => {
    try {
      await mcpApi.installMcp(name);
      await get().fetchMcp();
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  removeMcp: async (name: string) => {
    try {
      await mcpApi.removeMcp(name);
      set((state) => ({
        mcpServers: state.mcpServers.filter((m) =>
          typeof m === 'string' ? m !== name : m.name !== name
        ),
      }));
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  clearCache: async (name?: string) => {
    try {
      await mcpApi.clearCache(name);
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  reset: () => {
    set({
      mcpServers: [],
      status: 'idle',
      error: null,
    });
  },
}));

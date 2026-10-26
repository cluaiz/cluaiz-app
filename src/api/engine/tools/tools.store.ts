import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { listTools } from './catalog';

export interface UnifiedToolsState {
  skillsCount: number;
  pluginsCount: number;
  mcpCount: number;
  toolsCount: number;
  status: Status;
  error: string | null;

  refreshAll: () => Promise<void>;
  reset: () => void;
}

export const useToolsStore = create<UnifiedToolsState>((set) => ({
  skillsCount: 0,
  pluginsCount: 0,
  mcpCount: 0,
  toolsCount: 0,
  status: 'idle',
  error: null,

  refreshAll: async () => {
    set({ status: 'pending', error: null });
    try {
      const entries = await listTools();

      set({
        skillsCount: entries.filter(entry => entry.category === 'skill').length,
        pluginsCount: entries.filter(entry => entry.category === 'plugin').length,
        mcpCount: entries.filter(entry => entry.category === 'mcp').length,
        toolsCount: entries.length,
        status: 'success',
      });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  reset: () => {
    set({
      skillsCount: 0,
      pluginsCount: 0,
      mcpCount: 0,
      toolsCount: 0,
      status: 'idle',
      error: null,
    });
  },
}));

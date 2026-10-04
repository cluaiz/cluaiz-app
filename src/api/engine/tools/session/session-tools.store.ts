import { create } from 'zustand';
import { sessionToolsApi } from './session-tools.api';
import { type Status, errorMessage } from '../../../client';
import type { ToolDefinition } from './session-tools.types';

export interface SessionToolsState {
  allTools: ToolDefinition[];
  sessionTools: Record<string, ToolDefinition[]>; // sessionId -> tools
  status: Status;
  error: string | null;

  fetchAllTools: () => Promise<void>;
  fetchSessionTools: (sessionId: string) => Promise<void>;
  updateSessionTools: (sessionId: string, tools: ToolDefinition[] | string[]) => Promise<boolean>;
  reset: () => void;
}

export const useSessionToolsStore = create<SessionToolsState>((set, get) => ({
  allTools: [],
  sessionTools: {},
  status: 'idle',
  error: null,

  fetchAllTools: async () => {
    set({ status: 'pending', error: null });
    try {
      const res = await sessionToolsApi.getAllTools();
      set({ allTools: res.tools || [], status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  fetchSessionTools: async (sessionId: string) => {
    try {
      const res = await sessionToolsApi.getSessionTools(sessionId);
      set((state) => ({
        sessionTools: {
          ...state.sessionTools,
          [sessionId]: res.tools || [],
        },
      }));
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  updateSessionTools: async (sessionId: string, tools: ToolDefinition[] | string[]) => {
    try {
      const res = await sessionToolsApi.updateSessionTools(sessionId, { tools });
      set((state) => ({
        sessionTools: {
          ...state.sessionTools,
          [sessionId]: res.tools || [],
        },
      }));
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  reset: () => {
    set({
      allTools: [],
      sessionTools: {},
      status: 'idle',
      error: null,
    });
  },
}));

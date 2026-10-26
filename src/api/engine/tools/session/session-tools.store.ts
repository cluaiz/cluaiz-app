import { create } from 'zustand';
import { sessionToolsApi } from './session-tools.api';
import { type Status, errorMessage } from '../../../client';
import type { ToolBinding, ToolBindingInput } from './session-tools.types';
import type { ToolCatalogEntry } from '../catalog';

export interface SessionToolsState {
  allTools: ToolCatalogEntry[];
  sessionTools: Record<string, ToolBinding[]>;
  status: Status;
  error: string | null;

  fetchAllTools: () => Promise<void>;
  fetchSessionTools: (sessionId: string) => Promise<void>;
  updateSessionTools: (sessionId: string, tools: ToolBindingInput[], detach?: string[]) => Promise<boolean>;
  reset: () => void;
}

export const useSessionToolsStore = create<SessionToolsState>((set) => {
  let epoch = 0, catalogVersion = 0;
  const versions = new Map<string, number>();
  const begin = (chat: string) => {
    const version = (versions.get(chat) ?? 0) + 1, started = epoch;
    versions.set(chat, version);
    return () => started === epoch && versions.get(chat) === version;
  };
  return {
  allTools: [],
  sessionTools: {},
  status: 'idle',
  error: null,

  fetchAllTools: async () => {
    const version = ++catalogVersion;
    set({ status: 'pending', error: null });
    try {
      const res = await sessionToolsApi.getAllTools();
      if (version === catalogVersion) set({ allTools: res.tools, status: 'success' });
    } catch (err) {
      if (version === catalogVersion) set({ status: 'error', error: errorMessage(err) });
    }
  },

  fetchSessionTools: async (sessionId: string) => {
    const current = begin(sessionId);
    set({status: 'pending', error: null});
    try {
      const res = await sessionToolsApi.getSessionTools(sessionId);
      if (current()) set((state) => ({status: 'success', error: null,
        sessionTools: {
          ...state.sessionTools,
          [sessionId]: res.tools,
        },
      }));
    } catch (err) {
      if (current()) set({status: 'error', error: errorMessage(err)});
    }
  },

  updateSessionTools: async (sessionId: string, tools: ToolBindingInput[], detach?: string[]) => {
    const current = begin(sessionId);
    set({status: 'pending', error: null});
    try {
      const res = await sessionToolsApi.updateSessionTools(sessionId, { tools, detach });
      if (current()) set((state) => ({status: 'success', error: null,
        sessionTools: {
          ...state.sessionTools,
          [sessionId]: res.tools,
        },
      }));
      return true;
    } catch (err) {
      if (current()) set({status: 'error', error: errorMessage(err)});
      return false;
    }
  },

  reset: () => {
    epoch++;
    catalogVersion++;
    versions.clear();
    set({
      allTools: [],
      sessionTools: {},
      status: 'idle',
      error: null,
    });
  },
  };
});

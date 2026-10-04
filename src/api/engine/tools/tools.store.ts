import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { skillsApi } from './skills/skills.api';
import { pluginsApi } from './plugins/plugins.api';
import { mcpApi } from './mcp/mcp.api';
import { sessionToolsApi } from './session/session-tools.api';

export interface UnifiedToolsState {
  skillsCount: number;
  pluginsCount: number;
  mcpCount: number;
  sessionToolsCount: number;
  status: Status;
  error: string | null;

  refreshAll: () => Promise<void>;
  reset: () => void;
}

export const useToolsStore = create<UnifiedToolsState>((set) => ({
  skillsCount: 0,
  pluginsCount: 0,
  mcpCount: 0,
  sessionToolsCount: 0,
  status: 'idle',
  error: null,

  refreshAll: async () => {
    set({ status: 'pending', error: null });
    try {
      const [skillsRes, pluginsRes, mcpRes, toolsRes] = await Promise.all([
        skillsApi.listSkills().catch(() => ({ skills: [] })),
        pluginsApi.listPlugins().catch(() => ({ plugins: [] })),
        mcpApi.listMcp().catch(() => ({ mcp: [] })),
        sessionToolsApi.getAllTools().catch(() => ({ tools: [] })),
      ]);

      set({
        skillsCount: (skillsRes.skills || []).length,
        pluginsCount: (pluginsRes.plugins || []).length,
        mcpCount: (mcpRes.mcp || []).length,
        sessionToolsCount: (toolsRes.tools || []).length,
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
      sessionToolsCount: 0,
      status: 'idle',
      error: null,
    });
  },
}));

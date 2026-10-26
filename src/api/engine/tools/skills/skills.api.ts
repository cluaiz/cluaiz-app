import { listToolCache, clearToolCache } from '../cache';
import { listTools } from '../catalog';
import { installTool, removeTool } from '../lifecycle';
import type {
  SkillListResponse,
  SkillActionResponse,
  SkillCacheReportResponse,
  SkillClearCacheResponse,
} from './skills.types';

export const skillsApi = {
  /**
   * Lists all installed WASM skills and agents.
   * CEP tools.list, filtered to the installed skill packages.
   */
  listSkills: async (): Promise<SkillListResponse> => {
    return { status: 'success', skills: await listTools('skill') };
  },

  /**
   * Installs a WASM skill natively into the engine.
   * Waits for the CEP tools.install task's real result.
   */
  installSkill: (skillName: string, signal?: AbortSignal): Promise<SkillActionResponse> =>
    installTool('skill', skillName, signal),

  /**
   * Removes an installed WASM skill.
   * CEP tools.remove, preserving refusal and package identity.
   */
  removeSkill: (skillName: string, signal?: AbortSignal): Promise<SkillActionResponse> =>
    removeTool('skill', skillName, signal),

  /**
   * Lists the WASM skills cache report.
   * CEP tools.cache for installed skills.
   */
  listCache: async (): Promise<SkillCacheReportResponse> => {
    return listToolCache('skill');
  },

  /**
   * Clears the WASM skills cache.
   * CEP tools.clear_cache for installed skills.
   */
  clearCache: async (): Promise<SkillClearCacheResponse> => {
    return clearToolCache('skill');
  },
};

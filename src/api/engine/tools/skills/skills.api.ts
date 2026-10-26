import { client } from '../../../client';
import { SKILLS_ENDPOINTS } from './skills.endpoints';
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
   * GET /v1/skills/cache
   */
  listCache: async (): Promise<SkillCacheReportResponse> => {
    return client.get<SkillCacheReportResponse>(SKILLS_ENDPOINTS.CACHE);
  },

  /**
   * Clears the WASM skills cache.
   * DELETE /v1/skills/cache
   */
  clearCache: async (): Promise<SkillClearCacheResponse> => {
    return client.delete<SkillClearCacheResponse>(SKILLS_ENDPOINTS.CACHE);
  },
};

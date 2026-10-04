import { client } from '../../../client';
import { SKILLS_ENDPOINTS } from './skills.endpoints';
import type {
  SkillListResponse,
  SkillActionResponse,
  SkillCacheReportResponse,
  SkillClearCacheResponse,
} from './skills.types';

export const skillsApi = {
  /**
   * Lists all installed WASM skills and agents.
   * GET /v1/skills/list
   */
  listSkills: async (): Promise<SkillListResponse> => {
    return client.get<SkillListResponse>(SKILLS_ENDPOINTS.LIST);
  },

  /**
   * Installs a WASM skill natively into the engine.
   * POST /v1/skills/install
   */
  installSkill: async (skillName: string): Promise<SkillActionResponse> => {
    return client.post<SkillActionResponse>(SKILLS_ENDPOINTS.INSTALL, {
      skill_name: skillName,
    });
  },

  /**
   * Removes an installed WASM skill.
   * DELETE /v1/skills/remove
   */
  removeSkill: async (skillName: string): Promise<SkillActionResponse> => {
    return client.delete<SkillActionResponse>(SKILLS_ENDPOINTS.REMOVE, {
      body: { skill_name: skillName },
    });
  },

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

/**
 * Cluaiz Engine WASM Skills Types
 * Matches crate::handlers::skills
 */

export interface SkillItem {
  name: string;
  version?: string;
  description?: string;
  path?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface SkillListResponse {
  status: string;
  skills: string[] | SkillItem[];
  [key: string]: unknown;
}

export interface SkillActionResponse {
  status: string;
  message: string;
}

export interface SkillCacheReportResponse {
  status: string;
  message: unknown;
}

export interface SkillClearCacheResponse {
  status: string;
  message: string;
}

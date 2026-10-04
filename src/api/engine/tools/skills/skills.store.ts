import { create } from 'zustand';
import { skillsApi } from './skills.api';
import { type Status, errorMessage } from '../../../client';
import type { SkillItem } from './skills.types';

export interface SkillsState {
  skills: (string | SkillItem)[];
  status: Status;
  error: string | null;

  fetchSkills: () => Promise<void>;
  installSkill: (name: string) => Promise<boolean>;
  removeSkill: (name: string) => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  reset: () => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  status: 'idle',
  error: null,

  fetchSkills: async () => {
    set({ status: 'pending', error: null });
    try {
      const res = await skillsApi.listSkills();
      set({ skills: res.skills || [], status: 'success' });
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
    }
  },

  installSkill: async (name: string) => {
    try {
      await skillsApi.installSkill(name);
      await get().fetchSkills();
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  removeSkill: async (name: string) => {
    try {
      await skillsApi.removeSkill(name);
      set((state) => ({
        skills: state.skills.filter((s) => (typeof s === 'string' ? s !== name : s.name !== name)),
      }));
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  clearCache: async () => {
    try {
      await skillsApi.clearCache();
      return true;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  reset: () => {
    set({
      skills: [],
      status: 'idle',
      error: null,
    });
  },
}));

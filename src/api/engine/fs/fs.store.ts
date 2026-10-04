import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { fsApi } from './fs.api';
import type { DiskItemDto } from './fs.types';

export interface ActiveFileState {
  path: string;
  content: string;
  isBinary: boolean;
}

export interface FsState {
  workspace: string | null;
  items: DiskItemDto[];
  activeFile: ActiveFileState | null;
  status: Status;
  error: string | null;

  // Actions
  fetchWorkspace: () => Promise<string | null>;
  setWorkspace: (workspace: string) => Promise<boolean>;
  listDirectory: (dirPath?: string, recursive?: boolean) => Promise<DiskItemDto[]>;
  readFile: (path: string, isBinary?: boolean) => Promise<ActiveFileState | null>;
  writeFile: (path: string, content: string, isBinary?: boolean) => Promise<boolean>;
  deletePath: (path: string) => Promise<boolean>;
  renamePath: (oldPath: string, newPath: string) => Promise<boolean>;
  copyPath: (srcPath: string, destPath: string) => Promise<boolean>;
  createDir: (path: string) => Promise<boolean>;
  clearActiveFile: () => void;
  reset: () => void;
}

export const useFsStore = create<FsState>((set, get) => ({
  workspace: null,
  items: [],
  activeFile: null,
  status: 'idle',
  error: null,

  fetchWorkspace: async () => {
    try {
      const res = await fsApi.getWorkspace();
      if (res.workspace) {
        set({ workspace: res.workspace, error: null });
        return res.workspace;
      }
      return null;
    } catch (err) {
      set({ error: errorMessage(err) });
      return null;
    }
  },

  setWorkspace: async (workspace: string) => {
    try {
      const res = await fsApi.setWorkspace({ workspace });
      if (res.status === 'success' && res.workspace) {
        set({ workspace: res.workspace, error: null });
        // Automatically refresh directory items for the new workspace root
        await get().listDirectory('.', false);
        return true;
      }
      return false;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  listDirectory: async (dirPath = '.', recursive = false) => {
    set({ status: 'pending', error: null });
    try {
      const res = await fsApi.listDir({ dir_path: dirPath, recursive });
      const items = res.items || [];
      set({ items, status: 'success', error: null });
      return items;
    } catch (err) {
      const msg = errorMessage(err);
      set({ status: 'error', error: msg });
      return [];
    }
  },

  readFile: async (path: string, isBinary = false) => {
    set({ status: 'pending', error: null });
    try {
      const res = await fsApi.readFile({ path, is_binary: isBinary });
      if (res.status === 'success') {
        const fileData: ActiveFileState = {
          path,
          content: res.content,
          isBinary: res.is_binary,
        };
        set({ activeFile: fileData, status: 'success', error: null });
        return fileData;
      }
      set({ status: 'error', error: res.message || 'Failed to read file' });
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      set({ status: 'error', error: msg });
      return null;
    }
  },

  writeFile: async (path: string, content: string, isBinary = false) => {
    set({ status: 'pending', error: null });
    try {
      const res = await fsApi.writeFile({ path, content, is_binary: isBinary });
      if (res.status === 'success') {
        // If the active file was updated, sync active file content
        const current = get().activeFile;
        if (current && current.path === path) {
          set({ activeFile: { ...current, content, isBinary } });
        }
        set({ status: 'success', error: null });
        return true;
      }
      set({ status: 'error', error: res.message || 'Write failed' });
      return false;
    } catch (err) {
      const msg = errorMessage(err);
      set({ status: 'error', error: msg });
      return false;
    }
  },

  deletePath: async (path: string) => {
    try {
      const res = await fsApi.deletePath({ path });
      if (res.status === 'success') {
        // Optimistically remove from items list
        set((state) => ({
          items: state.items.filter((item) => item.path !== path),
          activeFile: state.activeFile?.path === path ? null : state.activeFile,
        }));
        return true;
      }
      return false;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  renamePath: async (oldPath: string, newPath: string) => {
    try {
      const res = await fsApi.renamePath({ old_path: oldPath, new_path: newPath });
      if (res.status === 'success') {
        // Update items list
        await get().listDirectory('.', false);
        return true;
      }
      return false;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  copyPath: async (srcPath: string, destPath: string) => {
    try {
      const res = await fsApi.copyPath({ src_path: srcPath, dest_path: destPath });
      if (res.status === 'success') {
        await get().listDirectory('.', false);
        return true;
      }
      return false;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  createDir: async (path: string) => {
    try {
      const res = await fsApi.createDir({ path });
      if (res.status === 'success') {
        await get().listDirectory('.', false);
        return true;
      }
      return false;
    } catch (err) {
      set({ error: errorMessage(err) });
      return false;
    }
  },

  clearActiveFile: () => {
    set({ activeFile: null });
  },

  reset: () => {
    set({
      workspace: null,
      items: [],
      activeFile: null,
      status: 'idle',
      error: null,
    });
  },
}));

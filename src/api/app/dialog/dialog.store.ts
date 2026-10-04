import { create } from 'zustand';

interface DialogState {
  lastSelectedFolder: string | null;
  isPickingFolder: boolean;
  setLastSelectedFolder: (path: string | null) => void;
  setIsPickingFolder: (picking: boolean) => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  lastSelectedFolder: null,
  isPickingFolder: false,
  setLastSelectedFolder: (path) => set({ lastSelectedFolder: path }),
  setIsPickingFolder: (picking) => set({ isPickingFolder: picking }),
}));

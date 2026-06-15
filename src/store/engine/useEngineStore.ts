import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EngineState {
  launchOnStartup: boolean;
  loadModelOnSend: boolean;
  status: 'offline' | 'booting' | 'online' | 'error';
  setLaunchOnStartup: (value: boolean) => void;
  setLoadModelOnSend: (value: boolean) => void;
  setStatus: (status: 'offline' | 'booting' | 'online' | 'error') => void;
}

export const useEngineStore = create<EngineState>()(
  persist(
    (set) => ({
      launchOnStartup: true,
      loadModelOnSend: true,
      status: 'offline',
      setLaunchOnStartup: (value) => set({ launchOnStartup: value }),
      setLoadModelOnSend: (value) => set({ loadModelOnSend: value }),
      setStatus: (status) => set({ status }),
    }),
    {
      name: 'engine-storage',
    }
  )
);

import { create } from 'zustand';
import { type Status, errorMessage } from '../../client';
import { systemApi } from './system.api';
import type {
  HealthResponse,
  SystemInfoResponse,
  ActiveProcess,
  CmdResponse,
  CommandExecutionEntry,
  HardwareProfileResponse,
  SystemLiveResponse,
  LatencyComparePayload,
  LatencyCompareResponse,
} from './system.types';

export interface SystemState {
  health: HealthResponse | null;
  info: SystemInfoResponse | null;
  hardwareInfo: HardwareProfileResponse | null;
  liveTelemetry: SystemLiveResponse | null;
  processes: ActiveProcess[];
  hardwareSnapshot: Record<string, any> | null;
  systemControl: any | null;
  commandHistory: CommandExecutionEntry[];
  isExecutingCmd: boolean;
  status: Status;
  error: string | null;

  // Actions
  checkHealth: () => Promise<boolean>;
  fetchInfo: () => Promise<void>;
  fetchHardwareInfo: () => Promise<void>;
  fetchLiveTelemetry: () => Promise<void>;
  compareLatency: (payload: LatencyComparePayload) => Promise<LatencyCompareResponse>;
  planExecution: (payload: LatencyComparePayload) => Promise<LatencyCompareResponse>;
  fetchProcesses: () => Promise<void>;
  fetchSystemControl: () => Promise<void>;
  executeCommand: (command: string) => Promise<CmdResponse>;
  clearCommandHistory: () => void;
  reset: () => void;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  health: null,
  info: null,
  hardwareInfo: null,
  liveTelemetry: null,
  processes: [],
  hardwareSnapshot: null,
  systemControl: null,
  commandHistory: [],
  isExecutingCmd: false,
  status: 'idle',
  error: null,

  checkHealth: async () => {
    try {
      const res = await systemApi.getHealth();
      set({ health: res, status: 'success', error: null });
      return res.status === 'alive';
    } catch (err) {
      set({ status: 'error', error: errorMessage(err) });
      return false;
    }
  },

  fetchInfo: async () => {
    try {
      const res = await systemApi.getSystemInfo();
      set({ info: res, error: null });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  fetchHardwareInfo: async () => {
    try {
      const res = await systemApi.getHardwareInfo();
      set({ hardwareInfo: res, error: null });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  fetchLiveTelemetry: async () => {
    try {
      const res = await systemApi.getLiveTelemetry();
      set({ liveTelemetry: res, error: null });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  compareLatency: async (payload: LatencyComparePayload) => {
    return systemApi.compareLatency(payload);
  },

  planExecution: async (payload: LatencyComparePayload) => {
    return systemApi.planExecution(payload);
  },

  fetchProcesses: async () => {
    try {
      const res = await systemApi.getProcesses();
      set({
        processes: res.active_processes || [],
        hardwareSnapshot: res.hardware_snapshot || null,
        error: null,
      });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  fetchSystemControl: async () => {
    try {
      const res = await systemApi.getSystemControl();
      set({ systemControl: res.control ?? null, error: null });
    } catch (err) {
      set({ error: errorMessage(err) });
    }
  },

  executeCommand: async (command: string) => {
    set({ isExecutingCmd: true, error: null });
    try {
      const res = await systemApi.executeCommand(command);
      const isOk = res.status === 'success';
      const entry: CommandExecutionEntry = {
        command,
        output: res.output,
        status: isOk ? 'success' : 'error',
        timestamp: Date.now(),
      };

      set((state) => ({
        isExecutingCmd: false,
        commandHistory: [...state.commandHistory, entry],
      }));

      return res;
    } catch (err) {
      const msg = errorMessage(err);
      const entry: CommandExecutionEntry = {
        command,
        output: msg,
        status: 'error',
        timestamp: Date.now(),
      };

      set((state) => ({
        isExecutingCmd: false,
        commandHistory: [...state.commandHistory, entry],
        error: msg,
      }));

      return { status: 'error', output: msg };
    }
  },

  clearCommandHistory: () => {
    set({ commandHistory: [] });
  },

  reset: () => {
    set({
      health: null,
      info: null,
      hardwareInfo: null,
      liveTelemetry: null,
      processes: [],
      hardwareSnapshot: null,
      systemControl: null,
      commandHistory: [],
      isExecutingCmd: false,
      status: 'idle',
      error: null,
    });
  },
}));

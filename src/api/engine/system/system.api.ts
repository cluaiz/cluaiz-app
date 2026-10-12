import { client } from '../../client';
import { SYSTEM_ENDPOINTS } from './system.endpoints';
import { permissionApi } from '../permission/permission.api';
import type {
  HealthResponse,
  SystemInfoResponse,
  CmdPayload,
  CmdResponse,
  ProcessTelemetryResponse,
  SystemControlResponse,
  HardwareProfileResponse,
  SystemLiveResponse,
  LatencyComparePayload,
  LatencyCompareResponse,
} from './system.types';

export const systemApi = {
  /**
   * Pings the Cluaiz engine heartbeat endpoint to verify operational status.
   */
  getHealth: async (): Promise<HealthResponse> => {
    return client.get<HealthResponse>(SYSTEM_ENDPOINTS.HEALTH, { skipAuth: true });
  },

  /**
   * Fetches high-level engine metadata, version, and architecture pillars.
   */
  getSystemInfo: async (): Promise<SystemInfoResponse> => {
    return client.get<SystemInfoResponse>(SYSTEM_ENDPOINTS.INFO, { skipAuth: true });
  },

  /**
   * Fetches calibrated host hardware profile and silicon truth: CPU GFLOPS, RAM bandwidth, GPU VRAM, PCIe Gen/width.
   */
  getHardwareInfo: async (): Promise<HardwareProfileResponse> => {
    return client.get<HardwareProfileResponse>(SYSTEM_ENDPOINTS.INFO_HARDWARE);
  },

  /**
   * Fetches live real-time system metrics: host RAM/VRAM, per-core CPU %, engine process RSS memory and CPU usage.
   */
  getLiveTelemetry: async (): Promise<SystemLiveResponse> => {
    return client.get<SystemLiveResponse>(SYSTEM_ENDPOINTS.LIVE);
  },

  /**
   * Autonomously plans model hardware placement and evaluates the 5 execution candidates.
   */
  planExecution: async (payload: LatencyComparePayload): Promise<LatencyCompareResponse> => {
    return client.post<LatencyCompareResponse>(SYSTEM_ENDPOINTS.PLAN, payload);
  },

  /**
   * Evaluates execution plan and latency between direct host RAM -> CPU vs RAM -> PCIe -> GPU streaming.
   */
  compareLatency: async (payload: LatencyComparePayload): Promise<LatencyCompareResponse> => {
    return client.post<LatencyCompareResponse>(SYSTEM_ENDPOINTS.PLAN, payload);
  },

  /**
   * Executes a terminal shell command on the host machine via the local engine daemon.
   * Requires loopback authentication.
   */
  executeCommand: async (command: string): Promise<CmdResponse> => {
    const payload: CmdPayload = { command };
    return client.post<CmdResponse>(SYSTEM_ENDPOINTS.EXECUTE_CMD, payload);
  },

  /**
   * Fetches real-time running model processes, allocations, and hardware telemetry snapshot.
   */
  getProcesses: async (): Promise<ProcessTelemetryResponse> => {
    return client.get<ProcessTelemetryResponse>(SYSTEM_ENDPOINTS.PS);
  },

  /**
   * Fetches active hardware governor control state.
   */
  getSystemControl: async (): Promise<SystemControlResponse> => {
    return client.get<SystemControlResponse>(SYSTEM_ENDPOINTS.CONTROL);
  },

  /**
   * Updates system control state (e.g., brain_mode).
   */
  updateSystemControl: async (payload: Record<string, unknown>): Promise<any> => {
    return client.post(SYSTEM_ENDPOINTS.CONTROL, payload);
  },

  // Permission & Auth delegates for unified system domain consumption
  getPermission: permissionApi.getPermission,
  updatePermission: permissionApi.updatePermission,
  generateAuthToken: permissionApi.generateAuthToken,
  revokeAuthToken: permissionApi.revokeAuthToken,
  getPendingPermissions: permissionApi.getPendingPermissions,
  approvePermission: permissionApi.approvePermission,
  rejectPermission: permissionApi.rejectPermission,
};


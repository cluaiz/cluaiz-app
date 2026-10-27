import { client } from '../../client';
import { SYSTEM_ENDPOINTS } from './system.endpoints';
import { permissionApi } from '../permission/permission.api';
import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { readSystemInfo, readSystemLive } from './systemData';
import { executeSystem } from './execution';
import type {
  HealthResponse,
  SystemInfoResponse,
  CmdResponse,
  CommandOptions,
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
    return readSystemInfo();
  },

  /**
   * Fetches calibrated host hardware profile and silicon truth: CPU GFLOPS, RAM bandwidth, GPU VRAM, PCIe Gen/width.
   */
  getHardwareInfo: async (): Promise<HardwareProfileResponse> => {
    return { status: 'success', hardware: (await readSystemInfo()).hardware };
  },

  /**
   * Fetches live real-time system metrics: host RAM/VRAM, per-core CPU %, engine process RSS memory and CPU usage.
   */
  getLiveTelemetry: async (): Promise<SystemLiveResponse> => {
    return readSystemLive();
  },

  /**
   * Autonomously plans model hardware placement and evaluates the 5 execution candidates.
   */
  planExecution: async (payload: LatencyComparePayload): Promise<LatencyCompareResponse> => {
    return callCep<LatencyCompareResponse>('system.plan', payload);
  },

  /**
   * Evaluates execution plan and latency between direct host RAM -> CPU vs RAM -> PCIe -> GPU streaming.
   */
  compareLatency: async (payload: LatencyComparePayload): Promise<LatencyCompareResponse> => {
    return systemApi.planExecution(payload);
  },

  /**
   * Runs a shell line under the Engine's exec policy. Approval errors stay CEP errors.
   * Transport timeout stops observation, not the Engine process.
   */
  executeCommand: (command: string, timeoutMs?: number, options?: CommandOptions): Promise<CmdResponse> =>
    executeSystem({ command }, { ...options, ...(timeoutMs !== undefined && { timeoutMs }) }),

  executeProgram: (program: string, args: string[] = [], options?: CommandOptions): Promise<CmdResponse> =>
    executeSystem({ program, args }, options),

  /**
   * Fetches real-time running model processes, allocations, and hardware telemetry snapshot.
   */
  getProcesses: async (): Promise<ProcessTelemetryResponse> => {
    return callCep<ProcessTelemetryResponse>('system.ps');
  },

  /**
   * Fetches active hardware governor control state.
   */
  getSystemControl: async (): Promise<SystemControlResponse> => {
    throw new ApiError('Brain Mode control is not supported by the current Engine.',
      501, 'UNSUPPORTED_OPERATION', 'system.control');
  },

  /**
   * Updates system control state (e.g., brain_mode).
   */
  updateSystemControl: async (payload: Record<string, unknown>): Promise<any> => {
    void payload;
    throw new ApiError('Brain Mode control is not supported by the current Engine.',
      501, 'UNSUPPORTED_OPERATION', 'system.control');
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


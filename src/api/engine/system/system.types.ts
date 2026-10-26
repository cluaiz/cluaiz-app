/** Engine wire DTOs. Measurements absent from CEP are not fabricated here. */
export interface HealthResponse { status: string; engine?: string; version?: string; message?: string; }
export interface SystemCpu {
  brand: string; physical_cores: number; logical_threads: number; frequency_mhz: number;
  gflops_fp32?: number; [key: string]: unknown;
}
export interface SystemGpu {
  index: number; name: string; vendor: string; vram_total_bytes: number; vram_free_bytes: number;
  vram_total_gb?: number; vram_available_gb?: number; compute_capability?: string | null;
  pcie_gen?: number | null; pcie_width?: number | null; [key: string]: unknown;
}
export interface HardwareSnapshot {
  hostname?: string; architecture: string; os_name: string; os_version: string;
  cpu: SystemCpu;
  memory: { total_gb: number; available_gb: number; [key: string]: unknown };
  gpus: SystemGpu[];
  storage?: Record<string, unknown>[];
}
export interface SystemInfoResponse {
  engine: string; version: string; cep_version: number;
  hardware: HardwareSnapshot; network: { lan_ip: string | null };
}
export interface HardwareProfileResponse { status: string; hardware: HardwareSnapshot; }
export interface HardwareDetectorStats {
  vram_gb: number; ram_gb: number; gpu_name: string; cpu_cores: number; has_gpu: boolean;
  [key: string]: unknown;
}
export interface HardwareStatusResponse { success: boolean; hardware: HardwareDetectorStats; }
export interface SystemLiveResponse {
  process_id: number;
  memory: { total_gb: number; available_gb: number; used_gb: number };
  cpu: Pick<SystemCpu, 'brand' | 'physical_cores' | 'logical_threads' | 'frequency_mhz'>;
  gpus: SystemGpu[];
}
export interface ActiveProcess {
  pid: string; model_id: string; vram_gb: number; context_size: number;
  engine: string; tier?: string; n_gpu_layers?: number;
}
export interface ProcessTelemetryResponse {
  active_processes: ActiveProcess[]; hardware_snapshot: HardwareSnapshot;
}
export interface LatencyComparePayload {
  model: string; model_path?: string; batch_tokens?: number; n_ctx?: number;
  vram_buffer_gb?: number; ram_buffer_gb?: number;
}
export interface LatencyCompareResponse {
  model_info: Record<string, unknown> & { inputs?: { type: string; available: boolean }[] };
  execution_plan: Record<string, unknown>;
  active_user_settings: Record<string, unknown>;
  hardware_info: Record<string, unknown>;
  candidates?: Record<string, unknown>[];
  request_overrides?: Record<string, number>;
}
export interface SystemControlResponse { status: string; control?: unknown; message?: string; }
export interface CmdPayload { command: string; }
export interface CmdResponse { status: 'success' | 'error' | string; output: string; }
export interface CommandExecutionEntry {
  command: string; output: string; status: 'success' | 'error'; timestamp: number;
}


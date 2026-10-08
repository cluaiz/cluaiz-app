export interface HealthResponse {
  status: string;
  engine: string;
  version: string;
  message: string;
}

export interface SystemInfoResponse {
  engine: string;
  full_name: string;
  version: string;
  pillars: {
    api?: string;
    kernel?: string;
    storage?: string;
    engines?: string;
    [key: string]: string | undefined;
  };
  philosophy: string;
  banned: string[];
}

export interface CmdPayload {
  command: string;
}

export interface CmdResponse {
  status: 'success' | 'error' | string;
  output: string;
}

export interface ActiveProcess {
  pid: string;
  model_id: string;
  vram_gb: number;
  context_size: number;
  original_context: string;
  engine: string;
}

export interface ProcessTelemetryResponse {
  status: string;
  active_processes: ActiveProcess[];
  hardware_snapshot: Record<string, any>;
}

export interface SystemControlResponse {
  status: string;
  control?: any;
  message?: string;
}

export interface CommandExecutionEntry {
  command: string;
  output: string;
  status: 'success' | 'error';
  timestamp: number;
}

export interface HardwareProfileResponse {
  status: string;
  info?: {
    identity: {
      machine_name: string;
      os_target: string;
      architecture: string;
      kernel_version: string;
    };
    silicon_truth: {
      cpu: {
        brand: string;
        physical_cores: number;
        logical_threads: number;
        frequency_mhz: number;
        gflops_fp32: number;
      };
      memory: {
        total_capacity_gb: number;
        bandwidth_gbps: number;
        measured_read_bandwidth_gbps: number;
        latency_ns: number;
      };
      accelerators: {
        gpus: Array<{
          vendor: string;
          model: string;
          vram_total_gb: number;
          bandwidth_gbps: number;
          tflops_fp32: number;
          pcie_gen: number;
          pcie_width: number;
          pcie_h2d_bandwidth_gbps: number;
          pcie_roundtrip_latency_us: number;
          is_unified_with_system: boolean;
        }>;
      };
      storage?: {
        disks: Array<{
          name: string;
          read_mbps: number;
          write_mbps: number;
          is_ssd: boolean;
        }>;
      };
    };
  };
  message?: string;
}

export interface SystemLiveResponse {
  status: string;
  timestamp: number;
  ram: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    utilization_pct: number;
    engine_rss_mb: number;
  };
  cpu: {
    utilization_pct: number;
    clock_ghz?: number;
    temperature_c?: number;
    engine_cpu_pct: number;
    per_core_pct: number[];
  };
  vram: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    pressure_pct: number;
  };
  gpus?: Array<Record<string, any>>;
  storage?: {
    throughput_mbps?: number;
  };
  network?: {
    throughput_mbps?: number;
  };
  engine_process: {
    pid: number;
    memory_rss_mb: number;
    cpu_usage_pct: number;
  };
}

export interface LatencyComparePayload {
  model?: string;
  weights_gb?: number;
  model_path?: string;
  batch_tokens?: number;
  total_layers?: number;
  n_ctx?: number;
  vram_buffer_gb?: number;
  ram_buffer_gb?: number;
}

export interface ExecutionCandidate {
  id: string;
  name: string;
  feasible: boolean;
  ineligibility_reason?: string | null;
  gpu_layers: number;
  cpu_layers: number;
  total_layers: number;
  vram_required_gb: number;
  ram_required_gb: number;
  kv_location: string;
  kv_cache_gb: number;
  prompt_ms_per_token: number;
  generation_ms_per_token: number;
  generation_tps: number;
  ttft_ms: number;
  is_winner: boolean;
  notes: string;
}

export interface LatencyCompareDecision {
  model_name?: string | null;
  architecture?: string | null;
  weights_gb: number;
  batch_tokens: number;
  total_layers: number;
  n_ctx: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  supported_inputs?: string[];
  supported_outputs?: string[];
  supported_attachments?: string[];
  supported_modalities?: string[];
  kv_cache_gb: number;
  compute_buffer_gb: number;
  model_path?: string | null;
  vram_safety_buffer_gb: number;
  ram_safety_buffer_gb: number;
  vram_free_needed_gb: number;
  ram_free_needed_gb: number;
  gpu_layers: number;
  cpu_layers: number;
  model_fits_in_vram: boolean;
  faster_target: string;
  speedup_ratio: number;
  cpu_latency_ms: number;
  gpu_pcie_latency_ms: number;
  gpu_vram_latency_ms?: number | null;
  decision_reason: string;
  breakdown: string;
  timing_breakdown: {
    vram_execution?: {
      vram_read_ms: number;
      cuda_compute_ms: number;
      total_ms: number;
    } | null;
    pcie_streaming?: {
      pcie_transfer_ms: number;
      vram_read_ms: number;
      cuda_compute_ms: number;
      bus_hop_penalty_ms: number;
      total_ms: number;
    } | null;
    cpu_direct: {
      ram_read_ms: number;
      simd_compute_ms: number;
      total_ms: number;
    };
  };
  bus_ping_pong_latency: {
    ram_to_cpu_latency_ns: number;
    ram_to_gpu_pcie_roundtrip_us: number;
  };
  hardware_state: {
    cpu_brand: string;
    cpu_cores: number;
    cpu_threads: number;
    cpu_utilization_pct: number;
    cpu_clock_ghz: number;
    cpu_peak_gflops: number;
    ram_total_gb: number;
    ram_used_gb: number;
    ram_free_gb: number;
    ram_usable_after_buffer_gb: number;
    ram_read_bandwidth_gbps: number;
    ram_latency_ns: number;
    gpu_model: string;
    gpu_total_vram_gb: number;
    gpu_used_vram_gb: number;
    gpu_free_vram_gb: number;
    gpu_usable_after_buffer_gb: number;
    gpu_vram_bandwidth_gbps: number;
    gpu_pcie_bandwidth_gbps: number;
    gpu_pcie_roundtrip_us: number;
    gpu_peak_tflops: number;
  };
  candidates: ExecutionCandidate[];
  winner_candidate_id: string;
  winner_generation_tps: number;
  winner_ttft_ms: number;
}

export interface LatencyCompareResponse {
  status: 'success' | 'error' | string;
  decision?: LatencyCompareDecision;
  message?: string;
}


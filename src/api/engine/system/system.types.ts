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

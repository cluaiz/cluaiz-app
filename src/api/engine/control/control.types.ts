export interface CelExecuteRequest {
  script: string;
}

export interface CelExecuteResponse {
  success: boolean;
  result?: string | null;
  error?: string | null;
}

export interface BenchmarkRunResponse {
  status: string;
  message: string;
}

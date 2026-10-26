import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { SystemInfoResponse, HardwareStatusResponse, SystemLiveResponse } from './system.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const invalid = (method: string) => new ApiError('Engine returned invalid hardware data', 200,
  'INVALID_SYSTEM_RESPONSE', method);

function hardware(value: unknown): boolean {
  return object(value) && object(value.cpu) && number(value.cpu.physical_cores)
    && object(value.memory) && number(value.memory.total_gb) && number(value.memory.available_gb)
    && Array.isArray(value.gpus) && value.gpus.every(gpu => object(gpu)
      && typeof gpu.name === 'string' && number(gpu.vram_total_bytes) && number(gpu.vram_free_bytes));
}

export async function readSystemInfo(): Promise<SystemInfoResponse> {
  const value = await callCep<unknown>('system.info');
  if (!object(value) || typeof value.engine !== 'string' || typeof value.version !== 'string'
    || !hardware(value.hardware) || !object(value.network)) throw invalid('system.info');
  return value as unknown as SystemInfoResponse;
}

/** Inventory totals, not the memory allocation of the active model. */
export async function readHardwareSummary(): Promise<HardwareStatusResponse> {
  const { hardware: profile } = await readSystemInfo();
  return { success: true, hardware: {
    has_gpu: profile.gpus.length > 0,
    vram_gb: profile.gpus.reduce((total, gpu) => total + gpu.vram_total_bytes, 0) / 1024 ** 3,
    ram_gb: profile.memory.total_gb,
    gpu_name: profile.gpus.map(gpu => gpu.name).join(', ') || 'None',
    cpu_cores: profile.cpu.physical_cores,
  } };
}

export async function readSystemLive(): Promise<SystemLiveResponse> {
  const value = await callCep<unknown>('system.live');
  if (!object(value) || !number(value.process_id) || !hardware(value)
    || !object(value.memory) || !number(value.memory.used_gb)) throw invalid('system.live');
  return value as unknown as SystemLiveResponse;
}

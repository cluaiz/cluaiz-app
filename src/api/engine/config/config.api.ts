import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { GgufConfig, OnnxConfig } from '../inference/inference.types';
import type { OptimizationControl } from '../llm-optimization/optimization.types';
import type { PermissionSchema } from '../permission/permission.types';
import type { StorageSettings } from '../storage/storage.types';
import type { ChatMemorySettings } from '../chat-memory/chatMemory.types';

export interface ConfigSections {
  gguf: GgufConfig;
  onnx: OnnxConfig;
  optimization: OptimizationControl;
  engine: PermissionSchema;
  storage: StorageSettings;
  kv: ChatMemorySettings;
  context: Record<string, unknown>;
}

function sectionValue<S extends keyof ConfigSections>(reply: unknown, section: S): ConfigSections[S] {
  const value = (reply as Record<string, unknown> | null)?.[section];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(`Engine returned an invalid ${section} settings section`, 200,
      'INVALID_CONFIG_RESPONSE', 'config.get/set');
  }
  return value as ConfigSections[S];
}

export async function getConfig<S extends keyof ConfigSections>(section: S, signal?: AbortSignal): Promise<ConfigSections[S]> {
  return sectionValue(await callCep('config.get', { section }, { signal }), section);
}

export async function setConfig<S extends keyof ConfigSections>(section: S, patch: object, signal?: AbortSignal): Promise<ConfigSections[S]> {
  return sectionValue(await callCep('config.set', { section, patch }, { signal }), section);
}

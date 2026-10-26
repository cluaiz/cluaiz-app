import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { TtsVoiceCatalog } from './audio.types';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0);
const invalid = (method: string) => new ApiError('Engine returned an invalid speech catalogue',
  200, 'INVALID_AUDIO_CATALOG', method);

function catalog(value: unknown, method: string, selected?: string): Record<string, unknown> {
  if (!record(value) || value.object !== 'list' || typeof value.model !== 'string'
    || !value.model || (selected && value.model !== selected) || !Array.isArray(value.data)) {
    throw invalid(method);
  }
  return value;
}

/** Package metadata only: do not infer language/voice controls from a model name. */
export async function getVoiceCatalog(model?: string, signal?: AbortSignal): Promise<TtsVoiceCatalog> {
  const method = 'audio.voices';
  const value = catalog(await callCep(method, model ? { model } : {}, { signal }), method, model);
  const voices = value.data as unknown[];
  const caps = value.capabilities;
  if (voices.some(voice => !record(voice) || typeof voice.id !== 'string' || !voice.id.trim()
      || (voice.language !== null && typeof voice.language !== 'string') || typeof voice.default !== 'boolean')
    || !record(caps) || !strings(caps.languages)
    || !['explicit', 'auto'].includes(String(caps.language_control))
    || !['preset', 'embedded', 'reference_source', 'reference_profile'].includes(String(caps.voice_mode))
    || typeof caps.coherent_input !== 'boolean') {
    throw invalid(method);
  }
  return value as unknown as TtsVoiceCatalog;
}

export async function getSttLanguages(model?: string, signal?: AbortSignal): Promise<string[]> {
  const method = 'audio.languages';
  const value = catalog(await callCep(method, model ? { model } : {}, { signal }), method, model);
  if (!strings(value.data)) throw invalid(method);
  return value.data;
}

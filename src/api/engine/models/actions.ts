import { callCep } from '../../client/cep';
import { callCepTask, resumeCepTask, type TaskObserver } from '../../client/cepTask';
import { ApiError } from '../../client/errors';
import { isPackageRelativePath } from '../../../utils/filePath';
import type { DownloadModelPayload, DownloadModelResponse, InspectHeaderResponse } from './models.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const invalid = (method: string) => new ApiError('Engine returned an invalid model action result', 200, 'INVALID_MODEL_ACTION', method);

export function modelTarget(model: string) {
  if (!text(model) || model.includes('..') || /[/\\\0]/.test(model)) {
    throw new ApiError('Use an installed model id, not a path or repo URL', 400, 'INVALID_INSTALLED_MODEL', 'models');
  }
  return {model};
}

export async function loadInstalledModel(model: string, signal?: AbortSignal) {
  const value = await callCep<unknown>('models.load', modelTarget(model), {signal, timeoutMs: 0});
  if (!object(value) || value.model !== model || !count(value.loaded_ms)) throw invalid('models.load');
  return {status: 'success', model, loaded_ms: value.loaded_ms};
}

export async function removeInstalledModel(model: string, signal?: AbortSignal) {
  const value = await callCep<unknown>('models.remove', modelTarget(model), {signal, timeoutMs: 0});
  if (!object(value) || value.model !== model || !text(value.dir)) throw invalid('models.remove');
  return {status: 'success', model, dir: value.dir};
}

/** Current Engine probes GGUF headers. ONNX errors remain explicit, never a fabricated header. */
export async function inspectInstalledModel(model: string, file?: string, signal?: AbortSignal): Promise<InspectHeaderResponse> {
  const target = modelTarget(model);
  if (file !== undefined && !isPackageRelativePath(file)) {
    throw new ApiError('Choose a relative file inside the installed model', 400, 'INVALID_MODEL_FILE', 'models.inspect');
  }
  const value = await callCep<unknown>('models.inspect', {...target, ...(file !== undefined && {file})}, {signal});
  if (!object(value) || value.model !== model || !text(value.file) || !object(value.metadata) || !object(value.int_arrays)
    || Object.values(value.int_arrays).some(items => !Array.isArray(items) || items.some(item => !Number.isInteger(item)))
    || !Array.isArray(value.speech_languages) || value.speech_languages.some(language => typeof language !== 'string')
    || !Array.isArray(value.tensors) || value.tensors.some(tensor => !object(tensor) || !text(tensor.name)
      || !Array.isArray(tensor.dims) || tensor.dims.some(dim => !count(dim))
      || !count(tensor.ggml_type) || !count(tensor.offset) || !count(tensor.size_bytes))) throw invalid('models.inspect');
  return value as unknown as InspectHeaderResponse;
}

/** Download and pull share one task start; only a validated final result resolves successfully. */
export async function downloadInstalledModel(payload: DownloadModelPayload = {}, signal?: AbortSignal, observer?: TaskObserver): Promise<DownloadModelResponse> {
  if (!object(payload) || Object.keys(payload).some(key => key !== 'model_id') || !text(payload.model_id)) {
    throw new ApiError('Provide model_id as a catalog id or Hugging Face repo/URL', 400, 'INVALID_MODEL_DOWNLOAD', 'models.download');
  }
  const model = payload.model_id.trim();
  if (new Blob([model]).size > 512 || /[\x00-\x1f\x7f-\x9f]/.test(model)) {
    throw new ApiError('The model reference is too long or contains control characters', 400, 'INVALID_MODEL_DOWNLOAD', 'models.download');
  }
  return downloadResult(await callCepTask<unknown>('models.download', {model}, signal, observer));
}

export async function resumeModelDownload(id: string, signal?: AbortSignal, observer?: TaskObserver): Promise<DownloadModelResponse> {
  return downloadResult(await resumeCepTask<unknown>('models.download', id, signal, observer));
}

function downloadResult(value: unknown): DownloadModelResponse {
  if (!object(value) || value.status !== 'success' || !text(value.model) || typeof value.downloaded !== 'boolean'
    || (value.path !== null && !text(value.path)) || (value.downloaded && !text(value.path))) throw invalid('models.download');
  return value as unknown as DownloadModelResponse;
}

import { client } from '../../client';
import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import { permissionApi } from '../permission/permission.api';
import { readHardwareSummary } from '../system/systemData';
import { MODELS_ENDPOINTS } from './models.endpoints';
import { downloadInstalledModel, inspectInstalledModel, loadInstalledModel, removeInstalledModel } from './actions';
import type {
  InstalledModelsResponse,
  OpenAiModelsResponse,
  AvailableModelsResponse,
  HardwareStatusResponse,
  TagsResponse,
  ModelRegistryEntry,
} from './models.types';

/**
 * Pure Stateless Models Vault API Service
 */
export const modelsApi = {
  /**
   * Fetches installed models from the Engine model registry
   */
  getInstalled: async (signal?: AbortSignal): Promise<InstalledModelsResponse> => {
    const result = await callCep<unknown>('models.list', {}, { signal });
    if (!Array.isArray(result) || result.some(entry => !entry || typeof entry !== 'object'
      || typeof entry.id !== 'string' || !entry.id.trim()
      || (entry.format !== undefined && typeof entry.format !== 'string')
      || (entry.supported_tasks !== undefined && (!Array.isArray(entry.supported_tasks)
        || entry.supported_tasks.some((task: unknown) => typeof task !== 'string'))))) {
      throw new ApiError('Engine returned an invalid installed-model list', 200,
        'INVALID_MODELS_RESPONSE', 'models.list');
    }
    const installed: ModelRegistryEntry[] = result.map(entry => ({ ...entry,
      ...(entry.format !== undefined && { format_type: entry.format }) }));
    return { count: installed.length, installed, models: installed };
  },

  /** Preserve other slots; publish the selected model only after the saved reply agrees. */
  selectChatModel: async (model: ModelRegistryEntry, signal?: AbortSignal) => {
    const current = (await permissionApi.getPermission(signal)).permission;
    signal?.throwIfAborted();
    const slots = current.active_slots || {};
    const saved = (await permissionApi.updatePermission({ active_slots: { ...slots,
      chat_slot: { ...slots.chat_slot, model_id: model.id,
        format_type: model.format_type ?? model.format ?? null,
        supported_tasks: model.supported_tasks ?? [] } } }, signal)).permission;
    if (saved.active_slots?.chat_slot?.model_id !== model.id) {
      throw new ApiError('The selected model was not retained by the Engine', 200,
        'MODEL_SELECTION_NOT_SAVED', 'config.set');
    }
    return saved;
  },

  /**
   * Fetches OpenAI-compatible /v1/models list
   */
  getListV1: (): Promise<OpenAiModelsResponse> => {
    return client.get<OpenAiModelsResponse>(MODELS_ENDPOINTS.LIST_V1);
  },

  /**
   * Fetches hardware capabilities and recommendations
   */
  getAvailable: (): Promise<AvailableModelsResponse> => {
    return Promise.reject(new ApiError('Model recommendations are unavailable in the current Engine API',
      501, 'MODEL_RECOMMENDATIONS_UNAVAILABLE', 'models'));
  },

  /**
   * Probes physical GPU, VRAM, and RAM hardware stats
   */
  getHardware: (): Promise<HardwareStatusResponse> => {
    return readHardwareSummary();
  },

  /**
   * Inspects the installed GGUF header through CEP models.inspect.
   */
  inspectHeader: inspectInstalledModel,

  /**
   * Loads a model into memory
   */
  loadModel: loadInstalledModel,

  /**
   * Waits for the same validated CEP download task as downloadModel.
   */
  pullModel: (modelId: string, signal?: AbortSignal) => downloadInstalledModel({model_id: modelId}, signal),

  /**
   * Fetches downloaded models list (/api/tags)
   */
  getTags: (): Promise<TagsResponse> => {
    return client.get<TagsResponse>(MODELS_ENDPOINTS.TAGS);
  },

  /**
   * Completes only after the Engine download task's final result.
   */
  downloadModel: downloadInstalledModel,

  /**
   * Physically deletes a model file from the disk vault
   */
  deleteModel: removeInstalledModel,

  // Aliases for seamless backwards compatibility
  getInstalledModels: (): Promise<InstalledModelsResponse> => modelsApi.getInstalled(),
  getHardwareStatus: (): Promise<HardwareStatusResponse> => modelsApi.getHardware(),
  inspectModelHeader: (modelId: string, filename?: string) =>
    modelsApi.inspectHeader(modelId, filename),
};

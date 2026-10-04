import { client } from '../../client';
import { MODELS_ENDPOINTS } from './models.endpoints';
import type {
  InstalledModelsResponse,
  OpenAiModelsResponse,
  AvailableModelsResponse,
  HardwareStatusResponse,
  InspectHeaderResponse,
  TagsResponse,
  DownloadModelPayload,
  DownloadModelResponse,
} from './models.types';

/**
 * Pure Stateless Models Vault API Service
 */
export const modelsApi = {
  /**
   * Fetches installed models from the Engine model registry
   */
  getInstalled: (): Promise<InstalledModelsResponse> => {
    return client.get<InstalledModelsResponse>(MODELS_ENDPOINTS.INSTALLED);
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
    return client.get<AvailableModelsResponse>(MODELS_ENDPOINTS.AVAILABLE);
  },

  /**
   * Probes physical GPU, VRAM, and RAM hardware stats
   */
  getHardware: (): Promise<HardwareStatusResponse> => {
    return client.get<HardwareStatusResponse>(MODELS_ENDPOINTS.HARDWARE);
  },

  /**
   * Inspects raw GGUF or ONNX tensor headers for an installed model
   */
  inspectHeader: (modelId: string, filename?: string): Promise<InspectHeaderResponse> => {
    return client.get<InspectHeaderResponse>(MODELS_ENDPOINTS.INSPECT_RAW_HEADER(modelId), {
      params: filename ? { filename } : undefined,
    });
  },

  /**
   * Loads a model into memory
   */
  loadModel: (modelId: string): Promise<{ status: string; message?: string }> => {
    return client.post<{ status: string; message?: string }>(MODELS_ENDPOINTS.LOAD, {
      model_id: modelId,
    });
  },

  /**
   * Triggers a model pull in the background
   */
  pullModel: (modelId: string): Promise<{ status: string; message?: string }> => {
    return client.post<{ status: string; message?: string }>(MODELS_ENDPOINTS.PULL, {
      model_id: modelId,
    });
  },

  /**
   * Fetches downloaded models list (/api/tags)
   */
  getTags: (): Promise<TagsResponse> => {
    return client.get<TagsResponse>(MODELS_ENDPOINTS.TAGS);
  },

  /**
   * Triggers or queues model download (/models/download)
   */
  downloadModel: (payload: DownloadModelPayload = {}): Promise<DownloadModelResponse> => {
    return client.post<DownloadModelResponse>(MODELS_ENDPOINTS.DOWNLOAD, payload);
  },

  /**
   * Physically deletes a model file from the disk vault
   */
  deleteModel: (modelId: string): Promise<{ status: string; message?: string }> => {
    return client.del<{ status: string; message?: string }>(
      MODELS_ENDPOINTS.DELETE_MODEL(modelId)
    );
  },

  // Aliases for seamless backwards compatibility
  getInstalledModels: (): Promise<InstalledModelsResponse> => modelsApi.getInstalled(),
  getHardwareStatus: (): Promise<HardwareStatusResponse> => modelsApi.getHardware(),
  inspectModelHeader: (modelId: string, filename?: string): Promise<InspectHeaderResponse> =>
    modelsApi.inspectHeader(modelId, filename),
};

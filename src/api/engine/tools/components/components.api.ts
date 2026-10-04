import { client } from '../../../client';
import { COMPONENTS_ENDPOINTS } from './components.endpoints';
import type {
  ComponentSettingsResponse,
  ComponentFilesResponse,
  UpdateComponentFilePayload,
  DynamicExecuteResponse,
} from './components.types';

export const componentsApi = {
  /**
   * Lists components filtered by type.
   * GET /api/components/list
   */
  listComponents: async (componentType?: string): Promise<Record<string, unknown>> => {
    return client.get<Record<string, unknown>>(COMPONENTS_ENDPOINTS.LIST, {
      params: componentType ? { component_type: componentType } : undefined,
    });
  },

  /**
   * Fetches settings for a specific component.
   * GET /api/components/settings
   */
  getSettings: async (componentType?: string, componentId?: string): Promise<ComponentSettingsResponse> => {
    return client.get<ComponentSettingsResponse>(COMPONENTS_ENDPOINTS.SETTINGS, {
      params: {
        ...(componentType ? { component_type: componentType } : {}),
        ...(componentId ? { component_id: componentId } : {}),
      },
    });
  },

  /**
   * Updates component settings in tools registry.
   * POST /api/components/settings
   */
  updateSettings: async (payload: {
    component_id: string;
    component_type?: string;
    settings: Record<string, unknown>;
    [key: string]: unknown;
  }): Promise<{ status: string; message?: string }> => {
    const res = await client.post<{ status: string; message?: string }>(COMPONENTS_ENDPOINTS.SETTINGS, payload);
    if (res && res.status === 'error') {
      throw new Error(res.message || 'Failed to update component settings');
    }
    return res;
  },

  /**
   * Lists file paths inside a component directory.
   * GET /api/components/files
   */
  getFiles: async (componentType?: string, componentId?: string): Promise<ComponentFilesResponse> => {
    return client.get<ComponentFilesResponse>(COMPONENTS_ENDPOINTS.FILES, {
      params: {
        ...(componentType ? { component_type: componentType } : {}),
        ...(componentId ? { component_id: componentId } : {}),
      },
    });
  },

  /**
   * Reads a specific file inside a component.
   * GET /api/components/file
   */
  getFile: async (
    componentType: string,
    componentId: string,
    filePath: string
  ): Promise<{ status: string; content?: string; message?: string; [key: string]: any }> => {
    return client.get(COMPONENTS_ENDPOINTS.FILE, {
      params: {
        component_type: componentType,
        component_id: componentId,
        file_path: filePath,
      },
    });
  },

  /**
   * Updates/writes a component file.
   * POST /api/components/file
   */
  updateFile: async (payload: UpdateComponentFilePayload): Promise<{ status: string; message?: string }> => {
    return client.post<{ status: string; message?: string }>(COMPONENTS_ENDPOINTS.FILE, payload);
  },

  /**
   * Clears components cache.
   * POST /api/components/cache
   */
  clearCache: async (payload: {
    component_type: string;
    component_name?: string;
    component_id?: string;
    all?: boolean;
  }): Promise<{ status: string; message?: string; [key: string]: any }> => {
    return client.post(COMPONENTS_ENDPOINTS.CACHE, {
      component_type: payload.component_type,
      component_id: payload.component_id || payload.component_name || '',
      all: payload.all ?? false,
    });
  },

  /**
   * Executes a dynamic component function via CEL sandbox.
   * POST /v1/execute/{component_name}/{function_name}
   */
  executeDynamic: async (
    componentName: string,
    functionName: string,
    args?: Record<string, unknown>
  ): Promise<DynamicExecuteResponse> => {
    const url = COMPONENTS_ENDPOINTS.EXECUTE_DYNAMIC(componentName, functionName);
    return client.post<DynamicExecuteResponse>(url, args || {});
  },
};

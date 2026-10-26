import { client } from '../../../client';
import { COMPONENTS_ENDPOINTS } from './components.endpoints';
import { componentCatalog } from '../catalog';
import { getToolSettings, setToolSettings } from '../settings';
import { listToolCache, clearToolCache } from '../cache';
import { ApiError } from '../../../client/errors';
import { listToolFiles, readToolFile, writeToolFile } from '../files';
import type {
  DynamicExecuteResponse,
} from './components.types';

export const componentsApi = {
  /**
   * Lists components filtered by type.
   * Uses the shared installed-tool CEP catalog and retains this App facade.
   */
  listComponents: componentCatalog,

  /**
   * Fetches settings for a specific component.
   * CEP tools.get_settings for an explicit tool kind and package id.
   */
  getSettings: getToolSettings,

  /**
   * Updates component settings in tools registry.
   * CEP tools.set_settings; the saved values remain available to callers.
   */
  updateSettings: setToolSettings,

  /**
   * Lists file paths inside a component directory.
   * CEP tools.files, retaining partial listing and cache metadata.
   */
  getFiles: listToolFiles,

  /**
   * Reads a specific file inside a component.
   * CEP tools.read_file; UTF-8 content, not a binary asset loader.
   */
  getFile: readToolFile,

  /**
   * Updates/writes a component file.
   * CEP tools.write_file; Engine chooses the package's main file.
   */
  updateFile: writeToolFile,

  /**
   * Clears components cache.
   * CEP tools.clear_cache. Only explicit all-cache requests are supported.
   */
  clearCache: async (payload: {
    component_type: string;
    component_name?: string;
    component_id?: string;
    all?: boolean;
  }): Promise<{ status: string; message?: string; [key: string]: any }> => {
    if (payload.all !== true || (payload.component_id && payload.component_name && payload.component_id !== payload.component_name)) {
      throw new ApiError('Choose one tool and all-cache cleanup; temp-only cleanup is unavailable', 400, 'INVALID_TOOL_CACHE_REQUEST', 'tools.clear_cache');
    }
    const name = payload.component_id ?? payload.component_name;
    if (!name) throw new ApiError('A tool package id is required', 400, 'INVALID_TOOL_TARGET', 'tools.clear_cache');
    return clearToolCache(payload.component_type, name);
  },

  getCache: async (componentType: string, componentId: string) =>
    (await listToolCache(componentType, componentId)).reports[0],

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

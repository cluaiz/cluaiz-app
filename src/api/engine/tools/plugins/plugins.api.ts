import { client } from '../../../client';
import { PLUGINS_ENDPOINTS } from './plugins.endpoints';
import { listTools } from '../catalog';
import { installTool, removeTool } from '../lifecycle';
import type {
  PluginListResponse,
  PluginActionResponse,
  PluginCacheReportResponse,
  PluginClearCacheResponse,
} from './plugins.types';

export const pluginsApi = {
  /**
   * Lists all installed plugins.
   * CEP tools.list, filtered to the installed plugin packages.
   */
  listPlugins: async (): Promise<PluginListResponse> => {
    return { status: 'success', plugins: await listTools('plugin') };
  },

  /**
   * Installs a plugin natively into the engine.
   * Waits for the CEP tools.install task's real result.
   */
  installPlugin: (pluginName: string, signal?: AbortSignal): Promise<PluginActionResponse> =>
    installTool('plugin', pluginName, signal),

  /**
   * Removes an installed plugin.
   * CEP tools.remove, preserving refusal and package identity.
   */
  removePlugin: (pluginName: string, signal?: AbortSignal): Promise<PluginActionResponse> =>
    removeTool('plugin', pluginName, signal),

  /**
   * Lists plugin cache report.
   * GET /v1/plugins/cache
   */
  listCache: async (): Promise<PluginCacheReportResponse> => {
    return client.get<PluginCacheReportResponse>(PLUGINS_ENDPOINTS.CACHE);
  },

  /**
   * Clears plugin cache.
   * DELETE /v1/plugins/cache
   */
  clearCache: async (): Promise<PluginClearCacheResponse> => {
    return client.delete<PluginClearCacheResponse>(PLUGINS_ENDPOINTS.CACHE);
  },
};

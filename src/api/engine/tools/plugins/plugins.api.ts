import { client } from '../../../client';
import { PLUGINS_ENDPOINTS } from './plugins.endpoints';
import type {
  PluginListResponse,
  PluginActionResponse,
  PluginCacheReportResponse,
  PluginClearCacheResponse,
} from './plugins.types';

export const pluginsApi = {
  /**
   * Lists all installed plugins.
   * GET /v1/plugins/list
   */
  listPlugins: async (): Promise<PluginListResponse> => {
    return client.get<PluginListResponse>(PLUGINS_ENDPOINTS.LIST);
  },

  /**
   * Installs a plugin natively into the engine.
   * POST /v1/plugins/install
   */
  installPlugin: async (pluginName: string): Promise<PluginActionResponse> => {
    return client.post<PluginActionResponse>(PLUGINS_ENDPOINTS.INSTALL, {
      plugin_name: pluginName,
    });
  },

  /**
   * Removes an installed plugin.
   * DELETE /v1/plugins/remove
   */
  removePlugin: async (pluginName: string): Promise<PluginActionResponse> => {
    return client.delete<PluginActionResponse>(PLUGINS_ENDPOINTS.REMOVE, {
      body: { plugin_name: pluginName },
    });
  },

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

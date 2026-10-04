import { client } from '../../../client';
import { SESSION_TOOLS_ENDPOINTS } from './session-tools.endpoints';
import type {
  AllToolsResponse,
  SessionToolsResponse,
  SessionToolsUpdateRequest,
} from './session-tools.types';

export const sessionToolsApi = {
  /**
   * Discovers all available Skills, Plugins, and MCP tool definitions across the engine.
   * GET /v1/tools
   */
  getAllTools: async (): Promise<AllToolsResponse> => {
    return client.get<AllToolsResponse>(SESSION_TOOLS_ENDPOINTS.ALL_TOOLS);
  },

  /**
   * Fetches the currently bound active tools for a specific chat session.
   * GET /v1/chat/{session_id}/tools
   */
  getSessionTools: async (sessionId: string): Promise<SessionToolsResponse> => {
    return client.get<SessionToolsResponse>(SESSION_TOOLS_ENDPOINTS.SESSION_TOOLS(sessionId));
  },

  /**
   * Attaches, detaches, or updates turn budgets for tools bound to a session.
   * POST /v1/chat/{session_id}/tools
   */
  updateSessionTools: async (
    sessionId: string,
    payload: SessionToolsUpdateRequest
  ): Promise<SessionToolsResponse> => {
    return client.post<SessionToolsResponse>(
      SESSION_TOOLS_ENDPOINTS.SESSION_TOOLS(sessionId),
      payload
    );
  },
};

import { callCep } from '../../../client/cep';
import { ApiError } from '../../../client/errors';
import { listTools } from '../catalog';
import type {
  AllToolsResponse,
  SessionToolsResponse,
  SessionToolsUpdateRequest,
  ToolBinding,
} from './session-tools.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
// Engine stores turns as i32 and idle as u32; -1 means persistent, 0 means this answer.
const turns = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= -1 && Number(value) <= 2 ** 31 - 1;
const binding = (value: unknown): value is ToolBinding => object(value) && id(value.id) && turns(value.turns)
  && (value.inline === undefined || typeof value.inline === 'boolean')
  && (value.pinned === undefined || typeof value.pinned === 'boolean')
  && (value.idle === undefined || (Number.isInteger(value.idle) && Number(value.idle) >= 0 && Number(value.idle) <= 2 ** 32 - 1));
function chatTarget(sessionId: string) {
  if (!id(sessionId)) throw new ApiError('A chat id is required', 400, 'INVALID_CHAT_TOOLS_REQUEST', 'chat.tools');
  return {chat_id: sessionId};
}
function sessionResult(value: unknown, sessionId: string): SessionToolsResponse {
  if (!object(value) || value.chat_id !== sessionId || !Array.isArray(value.active_tools)
    || !value.active_tools.every(binding) || new Set(value.active_tools.map(tool => tool.id)).size !== value.active_tools.length) {
    throw new ApiError('Engine returned invalid chat tool bindings', 200, 'INVALID_CHAT_TOOLS_RESPONSE', 'chat.tools');
  }
  return {session_id: sessionId, tools: value.active_tools};
}

export const sessionToolsApi = {
  /**
   * Installed packages with function metadata, from the shared tools.list catalog.
   */
  getAllTools: async (): Promise<AllToolsResponse> => {
    return {tools: await listTools()};
  },

  /**
   * Fetches the currently bound active tools for a specific chat session.
   * CEP chat.tools; retain actual turns and Engine-owned lifecycle metadata.
   */
  getSessionTools: async (sessionId: string): Promise<SessionToolsResponse> => {
    return sessionResult(await callCep('chat.tools', chatTarget(sessionId)), sessionId);
  },

  /**
   * Attaches, detaches, or updates turn budgets for tools bound to a session.
   * CEP chat.set_tools merges attachments/turn budgets and explicitly detaches ids.
   */
  updateSessionTools: async (
    sessionId: string,
    payload: SessionToolsUpdateRequest
  ): Promise<SessionToolsResponse> => {
    const target = chatTarget(sessionId);
    const invalid = () => new ApiError('Use tool ids or {id, turns, pinned?}, and explicit detach ids', 400,
      'INVALID_CHAT_TOOLS_REQUEST', 'chat.set_tools');
    if (!object(payload) || Object.keys(payload).some(key => key !== 'tools' && key !== 'detach')
      || (payload.tools !== undefined && !Array.isArray(payload.tools))
      || (payload.detach !== undefined && (!Array.isArray(payload.detach) || !payload.detach.every(id)))) throw invalid();
    const tools = payload.tools ?? [];
    const detach = payload.detach ?? [];
    if (tools.some(tool => !id(tool) && (!object(tool) || !id(tool.id) || !turns(tool.turns)
      || (tool.pinned !== undefined && typeof tool.pinned !== 'boolean')
      || Object.keys(tool).some(key => !['id', 'turns', 'pinned'].includes(key))))) throw invalid();
    const ids = tools.map(tool => typeof tool === 'string' ? tool : tool.id);
    if (new Set(ids).size !== ids.length || new Set(detach).size !== detach.length || detach.some(name => ids.includes(name))) throw invalid();
    const saved = sessionResult(await callCep('chat.set_tools', {...target, tools, detach}), sessionId);
    if (detach.some(name => saved.tools.some(tool => tool.id === name)) || tools.some(requested => {
      const actual = saved.tools.find(tool => tool.id === (typeof requested === 'string' ? requested : requested.id));
      return !actual || (typeof requested !== 'string' && (actual.turns !== requested.turns
        || (requested.pinned !== undefined && (actual.pinned ?? false) !== requested.pinned)));
    })) throw new ApiError('Engine did not acknowledge the requested chat tool bindings', 200, 'CHAT_TOOLS_NOT_SAVED', 'chat.set_tools');
    return saved;
  },
};

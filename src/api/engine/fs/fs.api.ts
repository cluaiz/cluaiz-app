import { callCep } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type {
  ReadFileRequest, ReadFileResponse, WriteFileRequest, ListDirRequest, ListDirResponse,
  PathRequest, RenameRequest, CopyRequest, WorkspaceResponse, SetWorkspaceRequest,
  FsActionResponse, PickFolderResponse,
} from './fs.types';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const path = (value: unknown): value is string => text(value) && value.length > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const invalid = (method: string) => new ApiError('Engine returned an invalid filesystem result',
  200, 'INVALID_FS_RESPONSE', method);

/** Keep authority in the authenticated CEP caller, never in legacy request flags. */
async function operation(method: string, input: object, params: object = input, timeoutMs?: number, signal?: AbortSignal) {
  if ('caller' in input || 'approval_id' in input) {
    throw new ApiError('Caller identity and approvals are managed by CEP, not filesystem payload flags',
      400, 'INVALID_FS_REQUEST', method);
  }
  const options = timeoutMs === undefined && signal === undefined ? undefined :
    {...(timeoutMs !== undefined && {timeoutMs}), ...(signal !== undefined && {signal})};
  const result = await callCep<unknown>(method, params, options);
  if (!object(result)) throw invalid(method);
  return result;
}

function acknowledged(method: string, result: Record<string, unknown>): FsActionResponse {
  if (!path(result.path)) throw invalid(method);
  return { status: 'success', path: result.path };
}

async function transfer(method: string, input: object, from: string, to: string): Promise<FsActionResponse> {
  const result = await operation(method, input, { from, to });
  if (!path(result.from) || !path(result.to)) throw invalid(method);
  return { status: 'success', from: result.from, to: result.to };
}

function workspace(method: string, result: Record<string, unknown>): WorkspaceResponse {
  if (!path(result.path)) throw invalid(method);
  return { status: 'success', workspace: result.path };
}

/** Existing App DTOs; all wire parameters/results belong to the CEP contract. */
export const fsApi = {
  readFile: async (payload: ReadFileRequest, signal?: AbortSignal): Promise<ReadFileResponse> => {
    const result = await operation('fs.read', payload, { path: payload.path, binary: payload.is_binary ?? false }, undefined, signal);
    if (!path(result.path) || !count(result.size) || typeof result.binary !== 'boolean'
      || (payload.is_binary && !result.binary)) throw invalid('fs.read');
    const content = result.binary ? result.data_base64 : result.text;
    if (!text(content)) throw invalid('fs.read');
    return { status: 'success', path: result.path, size: result.size, content, is_binary: result.binary };
  },

  writeFile: async (payload: WriteFileRequest): Promise<FsActionResponse> => {
    const result = await operation('fs.write', payload, {
      path: payload.path, ...(payload.is_binary ? { data_base64: payload.content } : { text: payload.content }),
    });
    if (!count(result.bytes)) throw invalid('fs.write');
    return { ...acknowledged('fs.write', result), bytes: result.bytes };
  },

  listDir: async (payload: ListDirRequest): Promise<ListDirResponse> => {
    const result = await operation('fs.list', payload, {
      ...(payload.dir_path !== undefined && { path: payload.dir_path }),
      ...(payload.root_path !== undefined && { root: payload.root_path }),
      recursive: payload.recursive ?? false,
    });
    if (!Array.isArray(result.items) || typeof result.truncated !== 'boolean' || !count(result.skipped)) {
      throw invalid('fs.list');
    }
    const items = result.items.map(item => {
      if (!object(item) || !text(item.path) || !path(item.name) || typeof item.is_folder !== 'boolean'
        || !count(item.size) || !text(item.modified)) throw invalid('fs.list');
      return { path: item.path, name: item.name, isFolder: item.is_folder, is_folder: item.is_folder,
        length: item.size, modified: item.modified };
    });
    return { status: 'success', items, truncated: result.truncated, skipped: result.skipped };
  },

  deletePath: async (payload: PathRequest): Promise<FsActionResponse> =>
    acknowledged('fs.delete', await operation('fs.delete', payload, { path: payload.path })),

  renamePath: (payload: RenameRequest): Promise<FsActionResponse> =>
    transfer('fs.rename', payload, payload.old_path, payload.new_path),

  copyPath: (payload: CopyRequest): Promise<FsActionResponse> =>
    transfer('fs.copy', payload, payload.src_path, payload.dest_path),

  createDir: async (payload: PathRequest): Promise<FsActionResponse> =>
    acknowledged('fs.mkdir', await operation('fs.mkdir', payload, { path: payload.path })),

  getWorkspace: async (): Promise<WorkspaceResponse> =>
    workspace('workspace.get', await operation('workspace.get', {})),

  setWorkspace: async (payload: SetWorkspaceRequest): Promise<WorkspaceResponse> =>
    workspace('workspace.set', await operation('workspace.set', payload, { path: payload.workspace })),

  /** The Engine picker already selects the workspace. Null means the user cancelled. */
  pickFolder: async (): Promise<PickFolderResponse> => {
    const result = await operation('fs.pick_folder', {}, {}, 0);
    if (result.path !== null && !path(result.path)) throw invalid('fs.pick_folder');
    return { status: 'success', path: result.path };
  },
};

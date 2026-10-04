import { client } from '../../client';
import { FS_ENDPOINTS } from './fs.endpoints';
import type {
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  ListDirRequest,
  ListDirResponse,
  PathRequest,
  RenameRequest,
  CopyRequest,
  WorkspaceResponse,
  SetWorkspaceRequest,
  FsActionResponse,
} from './fs.types';

export const fsApi = {
  /**
   * Fast disk file reading directly via Cluaiz Engine API.
   * Supports plain UTF-8 text or Base64 encoded binary files.
   */
  readFile: async (payload: ReadFileRequest): Promise<ReadFileResponse> => {
    return client.post<ReadFileResponse>(FS_ENDPOINTS.READ, { caller: 'user', ...payload });
  },

  /**
   * High-speed atomic disk write with automatic parent directory creation.
   */
  writeFile: async (payload: WriteFileRequest): Promise<FsActionResponse> => {
    return client.post<FsActionResponse>(FS_ENDPOINTS.WRITE, { caller: 'user', ...payload });
  },

  /**
   * Lists directory contents with metadata (folders, size, modified time).
   */
  listDir: async (payload: ListDirRequest): Promise<ListDirResponse> => {
    return client.post<ListDirResponse>(FS_ENDPOINTS.LIST, { caller: 'user', ...payload });
  },

  /**
   * Deletes a file or directory tree from the host disk.
   */
  deletePath: async (payload: PathRequest): Promise<FsActionResponse> => {
    return client.post<FsActionResponse>(FS_ENDPOINTS.DELETE, { caller: 'user', ...payload });
  },

  /**
   * Renames or moves a file / folder within the workspace.
   */
  renamePath: async (payload: RenameRequest): Promise<FsActionResponse> => {
    return client.post<FsActionResponse>(FS_ENDPOINTS.RENAME, { caller: 'user', ...payload });
  },

  /**
   * Copies a file or folder tree to a destination path.
   */
  copyPath: async (payload: CopyRequest): Promise<FsActionResponse> => {
    return client.post<FsActionResponse>(FS_ENDPOINTS.COPY, { caller: 'user', ...payload });
  },

  /**
   * Creates a directory (including parent directories recursively).
   */
  createDir: async (payload: PathRequest): Promise<FsActionResponse> => {
    return client.post<FsActionResponse>(FS_ENDPOINTS.MKDIR, { caller: 'user', ...payload });
  },

  /**
   * Fetches the currently active workspace root directory path.
   */
  getWorkspace: async (): Promise<WorkspaceResponse> => {
    return client.get<WorkspaceResponse>(FS_ENDPOINTS.WORKSPACE);
  },

  /**
   * Sets or updates the active workspace root directory path on the engine.
   */
  setWorkspace: async (payload: SetWorkspaceRequest): Promise<WorkspaceResponse> => {
    return client.post<WorkspaceResponse>(FS_ENDPOINTS.WORKSPACE, payload);
  },
};

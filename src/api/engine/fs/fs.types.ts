export interface DiskItemDto {
  path: string;
  name: string;
  isFolder: boolean;
  length: number;
  modified: string;
  is_folder?: boolean;
}

export interface ReadFileRequest {
  path: string;
  is_binary?: boolean;
}

export interface ReadFileResponse {
  status: string;
  content: string;
  is_binary: boolean;
  path: string;
  size: number;
  message?: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  is_binary?: boolean;
}

export interface ListDirRequest {
  dir_path?: string;
  root_path?: string;
  recursive?: boolean;
}

export interface ListDirResponse {
  status: string;
  items: DiskItemDto[];
  truncated: boolean;
  skipped: number;
  message?: string;
}

export interface PathRequest {
  path: string;
}

export interface RenameRequest {
  old_path: string;
  new_path: string;
}

export interface CopyRequest {
  src_path: string;
  dest_path: string;
}

export interface WorkspaceResponse {
  status: string;
  workspace: string;
  message?: string;
}

export interface SetWorkspaceRequest {
  workspace: string;
}

export interface FsActionResponse {
  status: string;
  message?: string;
  path?: string;
  bytes?: number;
  from?: string;
  to?: string;
}

export interface PickFolderResponse {
  status: string;
  path?: string | null;
  message?: string;
}

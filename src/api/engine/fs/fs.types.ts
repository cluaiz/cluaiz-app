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
  caller?: string;
  approval_id?: string;
}

export interface ReadFileResponse {
  status: string;
  content: string;
  is_binary: boolean;
  message?: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  is_binary?: boolean;
  caller?: string;
  approval_id?: string;
}

export interface ListDirRequest {
  dir_path?: string;
  root_path?: string;
  recursive?: boolean;
  caller?: string;
}

export interface ListDirResponse {
  status: string;
  items: DiskItemDto[];
  message?: string;
}

export interface PathRequest {
  path: string;
  caller?: string;
  approval_id?: string;
}

export interface RenameRequest {
  old_path: string;
  new_path: string;
  caller?: string;
  approval_id?: string;
}

export interface CopyRequest {
  src_path: string;
  dest_path: string;
  caller?: string;
  approval_id?: string;
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
}

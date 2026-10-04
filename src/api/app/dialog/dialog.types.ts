export interface PickFolderOptions {
  title?: string;
  defaultPath?: string;
}

export interface PickFolderResponse {
  path: string | null;
  status: 'success' | 'cancelled' | 'error';
  message?: string;
}

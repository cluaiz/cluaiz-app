export const DEFAULT_BRIDGE_PORT = 1421;

export const NATIVE_COMMANDS = {
  BOOT_ENGINE: 'boot_cluaiz_engine',
  UPDATE_SETTINGS: 'update_engine_settings',
  GET_SESSION_TOKEN: 'get_session_token',
  FFI_SEND_MESSAGE: 'ffi_send_message',
  FFI_FETCH_HISTORY: 'ffi_fetch_history',
  FFI_DELETE_SESSION: 'ffi_delete_session',
  START_FS_WATCHER: 'start_fs_watcher',
  STOP_FS_WATCHER: 'stop_fs_watcher',
  PICK_FOLDER: 'pick_folder',
} as const;

export const TAURI_COMMANDS = NATIVE_COMMANDS;

/**
 * Dynamically resolves bridge URL based on active domain/hostname and configurable port.
 * Seamlessly adapts to localhost, LAN IP addresses (e.g. 192.168.x.x), and custom domains.
 */
export const getNativeBridgeUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    const port = (import.meta as any).env?.VITE_BRIDGE_PORT || DEFAULT_BRIDGE_PORT;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${host}:${port}`;
  }
  return `http://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;
};

/** Local HTTP bridge base URL — dynamic getter for backwards compatibility */
export const NATIVE_BRIDGE_URL = getNativeBridgeUrl();




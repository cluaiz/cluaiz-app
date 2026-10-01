import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from './tauri-api';
export { isTauri };
import { useConnectionStore } from '../store/engine/useConnectionStore';

export interface EngineCmdResponse {
    status: 'success' | 'error';
    output: string;
}

/**
 * Universal Engine Bridge
 * Direct memory / IPC speed in desktop Tauri mode;
 * Fast HTTP fallback in web mode.
 */
export async function executeEngineCommand(command: string): Promise<EngineCmdResponse> {
    // If running in Tauri desktop environment, check if direct invoke is available
    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const res = await invoke<string>('execute_system_cmd', { command });
            if (typeof res === 'string') {
                return { status: 'success', output: res };
            }
        } catch {
            // Fallback to HTTP endpoint if specific command handler is not bound
        }
    }

    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/system/cmd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
        if (!res.ok) {
            return { status: 'error', output: `HTTP ${res.status}: ${res.statusText}` };
        }
        const data = await res.json();
        return {
            status: data.status || 'success',
            output: data.output || ''
        };
    } catch (err: any) {
        return {
            status: 'error',
            output: err?.message || String(err)
        };
    }
}

/**
 * High-Performance Native File Reader
 * Direct kernel-level Rust fs::read via Tauri IPC in Desktop (< 0.1ms).
 * In Web mode, calls Engine native /v1/fs/read REST API (< 0.2ms, zero cmd/powershell).
 */
export async function readDiskFileFast(path: string, isBinary: boolean = false): Promise<string> {
    if (!path) return '';

    const isWin = typeof navigator !== 'undefined' && (
        navigator.userAgent.includes('Windows') || 
        navigator.platform?.startsWith('Win')
    );
    const normalizedPath = isWin ? path.replace(/\//g, '\\') : path;

    // 1. Instant Native Tauri IPC Dispatch (< 0.1ms direct kernel read)
    if (isTauri()) {
        try {
            const res = await invoke<string>('fs_read_file', { path: normalizedPath });
            if (typeof res === 'string') {
                return res;
            }
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_read_file IPC error:', err);
        }
    }

    // 2. High-speed Engine Native REST Fallback (Direct SSD Syscall, Zero Process Overhead)
    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({
                path: normalizedPath,
                is_binary: isBinary,
            }),
        });

        if (res.ok) {
            const data = await res.json();
            return data.content || '';
        }
    } catch (err) {
        console.warn('[engineBridge] Native FS read error:', err);
    }

    return '';
}

/**
 * High-Performance Native File Writer
 * Direct Rust fs::write via Tauri IPC in Desktop (< 0.1ms).
 * In Web mode, calls Engine native /v1/fs/write REST API (< 0.2ms, zero cmd/powershell).
 */
export async function writeDiskFileFast(path: string, content: string): Promise<boolean> {
    if (!path) return false;

    const isWin = typeof navigator !== 'undefined' && (
        navigator.userAgent.includes('Windows') || 
        navigator.platform?.startsWith('Win')
    );
    const normalizedPath = isWin ? path.replace(/\//g, '\\') : path;

    if (isTauri()) {
        try {
            await invoke('fs_write_file', { path: normalizedPath, content });
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_write_file IPC error:', err);
        }
    }

    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/write`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({
                path: normalizedPath,
                content,
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export interface DiskItemNative {
    path: string;
    name: string;
    isFolder: boolean;
    length: number;
    modified: string;
}

export async function listDiskDirFast(dirPath: string, rootPath?: string, recursive: boolean = false): Promise<DiskItemNative[]> {
    if (!dirPath) return [];

    if (isTauri()) {
        try {
            const res = await invoke<DiskItemNative[]>('fs_list_dir', { 
                dirPath, 
                rootPath: rootPath || dirPath, 
                recursive 
            });
            if (Array.isArray(res)) return res;
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_list_dir error:', err);
        }
    }

    // Engine Native REST for Web Mode
    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({
                dir_path: dirPath,
                root_path: rootPath || dirPath,
                recursive,
            }),
        });

        if (res.ok) {
            const data = await res.json();
            return data.items || [];
        }
    } catch (err) {
        console.warn('[engineBridge] Native FS list error:', err);
    }

    return [];
}

export async function deleteDiskPathFast(path: string): Promise<boolean> {
    if (!path) return false;

    if (isTauri()) {
        try {
            await invoke('fs_delete_path', { path });
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_delete_path error:', err);
        }
    }

    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({ path }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function renameDiskPathFast(oldPath: string, newPath: string): Promise<boolean> {
    if (!oldPath || !newPath) return false;

    if (isTauri()) {
        try {
            await invoke('fs_rename_path', { oldPath, newPath });
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_rename_path error:', err);
        }
    }

    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/rename`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function copyDiskPathFast(srcPath: string, destPath: string): Promise<boolean> {
    if (!srcPath || !destPath) return false;

    if (isTauri()) {
        try {
            await invoke('fs_copy_path', { srcPath, destPath });
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_copy_path error:', err);
        }
    }

    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/copy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({ src_path: srcPath, dest_path: destPath }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function createDirFast(path: string): Promise<boolean> {
    if (!path) return false;

    if (isTauri()) {
        try {
            await invoke('fs_create_dir', { path });
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri fs_create_dir error:', err);
        }
    }

    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        const res = await fetch(`${baseUrl}/v1/fs/mkdir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-caller': 'user',
            },
            body: JSON.stringify({ path }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export interface FsChangeEvent {
    kind: 'create' | 'modify' | 'remove';
    path: string;
    isFolder: boolean;
}

export async function startFsWatcher(rootPath: string): Promise<boolean> {
    if (!rootPath) return false;
    if (isTauri()) {
        try {
            await invoke('start_fs_watcher', { rootPath });
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri start_fs_watcher error:', err);
        }
    }
    return false;
}

export async function stopFsWatcher(): Promise<boolean> {
    if (isTauri()) {
        try {
            await invoke('stop_fs_watcher');
            return true;
        } catch (err) {
            console.warn('[engineBridge] Tauri stop_fs_watcher error:', err);
        }
    }
    return false;
}

export async function onFsChangeEvent(callback: (event: FsChangeEvent) => void): Promise<UnlistenFn> {
    if (isTauri()) {
        try {
            return await listen<FsChangeEvent>('fs:change', (event) => {
                callback(event.payload);
            });
        } catch (err) {
            console.warn('[engineBridge] Tauri onFsChangeEvent error:', err);
        }
    }
    return () => {};
}


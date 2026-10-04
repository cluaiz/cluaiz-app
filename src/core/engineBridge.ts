import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from './tauri-api';
export { isTauri };
import { fsApi, systemApi, type DiskItemDto } from '../api';

export interface EngineCmdResponse {
    status: 'success' | 'error';
    output: string;
}

export type DiskItemNative = DiskItemDto;

 
export async function executeEngineCommand(command: string): Promise<EngineCmdResponse> {
    try {
        const res = await systemApi.executeCommand(command);
        return {
            status: res.status === 'success' ? 'success' : 'error',
            output: res.output || '',
        };
    } catch (err: any) {
        return {
            status: 'error',
            output: err?.message || String(err),
        };
    }
}

/**
 * Native File Reader
 * Delegates to fsApi.readFile (handles FFI or HTTP dynamically).
 */
export async function readDiskFileFast(path: string, isBinary: boolean = false): Promise<string> {
    if (!path) return '';
    try {
        const res = await fsApi.readFile({ path, is_binary: isBinary });
        return res?.content ?? '';
    } catch (err: any) {
        console.error('[engineBridge] readDiskFileFast error:', err);
        throw err;
    }
}

/**
 * Native File Writer
 * Delegates to fsApi.writeFile (handles FFI or HTTP dynamically).
 */
export async function writeDiskFileFast(path: string, content: string): Promise<boolean> {
    if (!path) return false;
    try {
        const res = await fsApi.writeFile({ path, content });
        return res?.status === 'success';
    } catch (err) {
        console.error('[engineBridge] writeDiskFileFast error:', err);
        return false;
    }
}

/**
 * Native Directory Lister
 * Delegates to fsApi.listDir (handles FFI or HTTP dynamically).
 */
export async function listDiskDirFast(dirPath: string, rootPath?: string, recursive: boolean = false): Promise<DiskItemNative[]> {
    if (!dirPath) return [];
    try {
        const res = await fsApi.listDir({
            dir_path: dirPath,
            root_path: rootPath || dirPath,
            recursive,
        });
        return res?.items || [];
    } catch (err: any) {
        console.error('[engineBridge] listDiskDirFast error:', err);
        throw err;
    }
}

/**
 * Native Path Deleter
 * Delegates to fsApi.deletePath (handles FFI or HTTP dynamically).
 */
export async function deleteDiskPathFast(path: string): Promise<boolean> {
    if (!path) return false;
    try {
        const res = await fsApi.deletePath({ path });
        return res?.status === 'success';
    } catch (err) {
        console.warn('[engineBridge] deleteDiskPathFast error:', err);
        return false;
    }
}

/**
 * Native Path Renamer
 * Delegates to fsApi.renamePath (handles FFI or HTTP dynamically).
 */
export async function renameDiskPathFast(oldPath: string, newPath: string): Promise<boolean> {
    if (!oldPath || !newPath) return false;
    try {
        const res = await fsApi.renamePath({ old_path: oldPath, new_path: newPath });
        return res?.status === 'success';
    } catch (err) {
        console.warn('[engineBridge] renameDiskPathFast error:', err);
        return false;
    }
}

/**
 * Native Path Copier
 * Delegates to fsApi.copyPath (handles FFI or HTTP dynamically).
 */
export async function copyDiskPathFast(srcPath: string, destPath: string): Promise<boolean> {
    if (!srcPath || !destPath) return false;
    try {
        const res = await fsApi.copyPath({ src_path: srcPath, dest_path: destPath });
        return res?.status === 'success';
    } catch (err) {
        console.warn('[engineBridge] copyDiskPathFast error:', err);
        return false;
    }
}

/**
 * Native Directory Creator
 * Delegates to fsApi.createDir (handles FFI or HTTP dynamically).
 */
export async function createDirFast(path: string): Promise<boolean> {
    if (!path) return false;
    try {
        const res = await fsApi.createDir({ path });
        return res?.status === 'success';
    } catch (err) {
        console.warn('[engineBridge] createDirFast error:', err);
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
    return () => { };
}

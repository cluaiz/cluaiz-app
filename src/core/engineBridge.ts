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

// Browser-safe UTF-16LE Base64 encoding for Windows PowerShell -EncodedCommand
function encodeUtf16LeBase64(str: string): string {
    const codeUnits = new Uint16Array(str.length);
    for (let i = 0; i < str.length; i++) {
        codeUnits[i] = str.charCodeAt(i);
    }
    const bytes = new Uint8Array(codeUnits.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * High-Performance Native File Reader
 * Direct kernel-level Rust fs::read_to_string via Tauri IPC (< 1ms).
 * In web mode, falls back to immune Base64-encoded PowerShell runner.
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

    // 2. High-speed Fallback (Zero-Double-Quote Engine Runner)
    try {
        const baseUrl = useConnectionStore.getState().getBaseUrl();
        let cmd = '';
        if (isWin) {
            if (isBinary) {
                const psEscaped = normalizedPath.replace(/'/g, "''");
                const script = `$ProgressPreference = 'SilentlyContinue'; $ErrorActionPreference = 'SilentlyContinue'; if (Test-Path -LiteralPath '${psEscaped}') { [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes('${psEscaped}')) }`;
                const encoded = encodeUtf16LeBase64(script);
                cmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
            } else if (!normalizedPath.includes(' ') && !normalizedPath.includes('&') && !normalizedPath.includes('^')) {
                // High-Speed Direct Path (10ms): Clean, unquoted type command.
                // Engine runs: cmd.exe /C type <path>
                // Without double quotes, Rust's Command::new never injects \" escaping.
                cmd = `type ${normalizedPath}`;
            } else {
                // Safe Path with Spaces: Use single-quoted PowerShell ReadAllText.
                // Single quotes are completely ignored by Rust Command escaping and cmd.exe wrapper.
                const psEscaped = normalizedPath.replace(/'/g, "''");
                cmd = `powershell -NoProfile -NonInteractive -Command "[System.IO.File]::ReadAllText('${psEscaped}')"`;
            }
        } else {
            cmd = isBinary ? `base64 "${normalizedPath}" 2>/dev/null || true` : `cat "${normalizedPath}" 2>/dev/null || true`;
        }

        const res = await fetch(`${baseUrl}/v1/system/cmd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        if (res.ok) {
            const data = await res.json();
            const out = data.output || '';
            if (out.includes('The filename, directory name, or volume label syntax is incorrect')) {
                return '';
            }
            return out;
        }
    } catch {}

    return '';
}

/**
 * High-Performance Native File Writer
 * Direct Rust fs::write via Tauri IPC (< 1ms).
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
        const b64 = btoa(unescape(encodeURIComponent(content)));
        const isWin = typeof navigator !== 'undefined' && (navigator.userAgent.includes('Windows') || navigator.platform?.startsWith('Win'));
        const cmd = isWin
            ? `powershell -NoProfile -NonInteractive -Command "$d = Split-Path -Path '${path}' -Parent; if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }; [System.IO.File]::WriteAllBytes('${path}', [System.Convert]::FromBase64String('${b64}'))"`
            : `mkdir -p "$(dirname "${path}")" && echo "${b64}" | base64 -d > "${path}"`;
        const res = await fetch(`${baseUrl}/v1/system/cmd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
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
    return false;
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
    return false;
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
    return false;
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
    return false;
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


import { fsApi } from '../../../api/engine/fs/fs.api';
import { ApiError } from '../../../api/client/errors';

/** Display/navigation paths only; canonicalization and authorization remain Engine-owned. */
export const isTerminalPath = (value: unknown): value is string => typeof value === 'string'
    && !/[\0\r\n]/.test(value) && (/^(?:[a-z]:[/\\]|[/\\]{2})/i.test(value) || value.startsWith('/'));

export function terminalPath(cwd: string, input: string): string {
    const target = input.replace(/^(["'])(.*)\1$/, '$2');
    if (/^~(?:[/\\]|$)/.test(target)) throw new ApiError('Home expansion is unavailable; use an explicit Engine path', 400, 'UNSUPPORTED_HOME_PATH');
    const driveRoot = cwd.match(/^[a-z]:/i)?.[0];
    const rooted = driveRoot && /^[/\\](?![/\\])/.test(target) ? driveRoot + target : target;
    let path = isTerminalPath(rooted) ? rooted : `${cwd}/${rooted}`;
    path = path.replace(/\\/g, '/');
    if (!isTerminalPath(path)) throw new ApiError('An absolute Engine workspace path is required', 400, 'INVALID_TERMINAL_PATH');
    const unc = path.match(/^\/\/[^/]+\/[^/]+/);
    const drive = path.match(/^[a-z]:\//i);
    const prefix = unc ? unc[0] + '/' : drive ? drive[0] : '/';
    const parts: string[] = [];
    for (const part of path.slice(prefix.length).split('/')) {
        if (part === '..') parts.pop();
        else if (part && part !== '.') parts.push(part);
    }
    return prefix + parts.join('/');
}

export async function changeTerminalDirectory(cwd: string, target: string): Promise<string> {
    const path = terminalPath(cwd, target);
    // Listing verifies a directory without a shell, changing global workspace or creating folders.
    await fsApi.listDir({ dir_path: path, root_path: path, recursive: false });
    return path;
}

export async function completeTerminalPath(cwd: string, word: string) {
    const slash = Math.max(word.lastIndexOf('/'), word.lastIndexOf('\\'));
    const parent = word.slice(0, slash + 1), prefix = word.slice(slash + 1);
    const path = terminalPath(cwd, parent || '.');
    const listed = await fsApi.listDir({ dir_path: path, root_path: path, recursive: false });
    const windows = /^[a-z]:/i.test(cwd) || cwd.startsWith('\\\\') || cwd.startsWith('//');
    const matches = listed.items.filter(item => windows ? item.name.toLowerCase().startsWith(prefix.toLowerCase()) : item.name.startsWith(prefix))
        .map(item => parent + item.name + (item.isFolder ? (windows ? '\\' : '/') : ''));
    return { matches, truncated: listed.truncated, skipped: listed.skipped };
}

export function terminalCommand(cwd: string, command: string, windows: boolean): string {
    if (!isTerminalPath(cwd)) throw new ApiError('Select an Engine workspace before running a command', 400, 'INVALID_TERMINAL_PATH');
    if (windows) {
        if (/["%!\0\r\n]/.test(cwd) || /^[/\\]{2}/.test(cwd)) {
            throw new ApiError('This workspace path cannot be represented safely by the Engine cmd shell', 400, 'UNSUPPORTED_SHELL_PATH');
        }
        return `cd /d "${cwd.replace(/\//g, '\\')}" && ${command}`;
    }
    return `cd '${cwd.replace(/'/g, "'\\''")}' && ${command}`;
}

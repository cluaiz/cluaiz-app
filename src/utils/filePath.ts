/**
 * Shared utility functions for file path extraction and extension normalization.
 */

export function extractBaseName(pathStr: string): string {
    if (!pathStr) return '';
    const clean = pathStr.replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = clean.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : pathStr;
}

export function getFileExtension(name?: string): string | undefined {
    if (!name || !name.includes('.')) return undefined;
    const parts = name.split('.');
    return parts.pop()?.toLowerCase();
}

/**
 * Normalizes backslashes to forward slashes and trims redundant slashes.
 */
export function normalizePath(pathStr: string): string {
    if (!pathStr) return '';
    return pathStr.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

/**
 * Safely parses line ranges such as "L14-L35", "L20", "14-35", or ":24".
 */
export function parseLineRange(lineRange?: string): { startLine: number; endLine: number } | null {
    if (!lineRange) return null;
    const clean = lineRange.trim().replace(/^[:#]/, '');
    const match = clean.match(/^L?(\d+)(?:-L?(\d+))?$/i);
    if (!match) return null;

    const startLine = parseInt(match[1], 10);
    const endLine = match[2] ? parseInt(match[2], 10) : startLine;

    if (isNaN(startLine) || startLine <= 0) return null;
    return {
        startLine,
        endLine: isNaN(endLine) || endLine < startLine ? startLine : endLine
    };
}

/**
 * Extracts the relative workspace path if rawPath starts with rootPath.
 */
export function getRelativeWorkspacePath(rawPath: string, rootPath?: string): string {
    if (!rawPath) return '';
    const normRaw = normalizePath(rawPath);
    if (!rootPath) return normRaw;

    const normRoot = normalizePath(rootPath);
    if (normRaw.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
        return normRaw.slice(normRoot.length + 1);
    }
    if (normRaw.toLowerCase() === normRoot.toLowerCase()) {
        return '';
    }
    return normRaw;
}


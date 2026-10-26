import { packageEntry } from '../validation';

export const PACKAGE_COMPRESSED_LIMIT = 20 * 1024 * 1024;
export const PACKAGE_EXPANDED_LIMIT = 32 * 1024 * 1024;
export const PACKAGE_FILE_LIMIT = 128;
const BLOCK = 512;
const decoder = new TextDecoder('utf-8', { fatal: true });
function field(bytes: Uint8Array): string {
    const end = bytes.indexOf(0);
    if (end >= 0 && bytes.subarray(end).some(value => value !== 0)) throw new Error('Archive header contains hidden bytes.');
    return decoder.decode(end < 0 ? bytes : bytes.subarray(0, end));
}
function octal(bytes: Uint8Array): number {
    const text = decoder.decode(bytes).replace(/\0/g, ' ').trim();
    if (!/^[0-7]+$/.test(text)) throw new Error('Unsupported archive number.');
    const number = Number.parseInt(text, 8);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid archive size.');
    return number;
}
/** Restricted npm/USTAR reader. Returns bytes only; never extracts filesystem paths. */
export function readPackageTar(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
    if (!bytes.length || bytes.length > PACKAGE_EXPANDED_LIMIT || bytes.length % BLOCK) throw new Error('Invalid or oversized package archive.');
    const files = new Map<string, Uint8Array>();
    const names = new Set<string>();
    let offset = 0;
    while (offset + BLOCK <= bytes.length) {
        const header = bytes.subarray(offset, offset + BLOCK);
        if (header.every(value => value === 0)) {
            if (bytes.length - offset < 2 * BLOCK || bytes.subarray(offset).some(value => value !== 0)) throw new Error('Invalid archive terminator.');
            if (!files.size) throw new Error('Package archive is empty.');
            return files;
        }
        if (decoder.decode(header.subarray(257, 262)) !== 'ustar') throw new Error('Rebuild this package with the current extension devkit (USTAR required).');
        const checksum = header.reduce((sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value), 0);
        if (checksum !== octal(header.subarray(148, 156))) throw new Error('Archive checksum mismatch.');
        const prefix = field(header.subarray(345, 500));
        const name = (prefix ? prefix + '/' : '') + field(header.subarray(0, 100));
        const type = header[156];
        if (![0, 48, 53].includes(type) || field(header.subarray(157, 257))) throw new Error('Links and special archive entries are not allowed.');
        if (!name.startsWith('package/')) throw new Error('Package entries must use the npm package/ prefix.');
        const relative = type === 53 ? name.slice(8).replace(/\/$/, '') : name.slice(8);
        if (relative) packageEntry(relative);
        else if (type !== 53) throw new Error('Invalid package root entry.');
        if (names.has(name) || names.size >= PACKAGE_FILE_LIMIT + 16) throw new Error('Duplicate or excessive archive entries.');
        names.add(name);
        const size = octal(header.subarray(124, 136));
        const start = offset + BLOCK;
        const end = start + size;
        if (end > bytes.length || (type === 53 && size !== 0)) throw new Error('Truncated or invalid archive entry.');
        if (type !== 53) {
            if (files.has(relative) || files.size >= PACKAGE_FILE_LIMIT) throw new Error('Duplicate or excessive package files.');
            files.set(relative, bytes.subarray(start, end));
        }
        offset = start + Math.ceil(size / BLOCK) * BLOCK;
    }
    throw new Error('Archive terminator is missing.');
}

export async function readPackageArchive(blob: Blob): Promise<ReadonlyMap<string, Uint8Array>> {
    if (!blob.size || blob.size > PACKAGE_COMPRESSED_LIMIT) throw new Error('Package must be within the 20 MiB compressed limit.');
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress extension packages.');
    const reader = blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.byteLength;
            if (size > PACKAGE_EXPANDED_LIMIT) throw new Error('Expanded package exceeds the 32 MiB limit.');
            chunks.push(next.value);
        }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return readPackageTar(bytes);
}

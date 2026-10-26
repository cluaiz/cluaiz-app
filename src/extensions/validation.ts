/** Shared data validation for private bundled manifests and package metadata. */
export const MAX_EXTENSION_VIEWS = 16;
export const MAX_DECLARED_CAPABILITIES = 64;
const segment = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const releaseNumber = '(?:0|[1-9]\\d*)';
const prereleasePart = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const releasePattern = new RegExp(`^${releaseNumber}\\.${releaseNumber}\\.${releaseNumber}(?:-${prereleasePart}(?:\\.${prereleasePart})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);

export function contractRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an extension manifest object.');
    return value as Record<string, unknown>;
}
export function contractText(value: unknown, field: string, max = 120): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid extension ${field}.`);
    return value;
}
export function validLegacyId(value: unknown): value is string {
    return typeof value === 'string' && value === value.trim() && value.length <= 120 && segment.test(value);
}
export function validExtensionId(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const parts = value.split('.');
    return value === value.trim() && value.length <= 120 && parts.length === 2 && parts.every(part => segment.test(part));
}
export function validViewId(value: unknown): value is string {
    return typeof value === 'string' && value === value.trim() && value.length <= 80 && segment.test(value);
}
export function validReleaseVersion(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 60 && value === value.trim() && releasePattern.test(value);
}
export function packageEntry(value: unknown): string {
    const entry = contractText(value, 'package entry', 1024);
    if (/[\\:%?#\u0000-\u001f\u007f]/.test(entry)
        || entry.split('/').some(part => !part || part === '.' || part === '..' || part !== part.trim())) {
        throw new Error('Extension entry must be an unambiguous package-relative path.');
    }
    return entry;
}

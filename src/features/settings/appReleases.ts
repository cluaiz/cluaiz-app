const releaseBase = 'https://github.com/cluaiz/cluaiz-app/releases/tag/';
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export interface AppRelease {
    version: string;
    notes: string;
    url: string;
}

function compareVersions(left: string, right: string): number {
    const other = right.split('.').map(Number);
    return left.split('.').map(Number).reduce((order, value, index) => order || value - other[index], 0);
}

export function selectAppRelease(current: string, rows: unknown): AppRelease | undefined {
    if (!versionPattern.test(current) || !Array.isArray(rows)) return;
    let latest: AppRelease | undefined;
    for (const row of rows) {
        if (row?.draft !== false || typeof row.tag_name !== 'string' || !row.tag_name.startsWith('app-v')) continue;
        const version = row.tag_name.slice(5);
        if (!versionPattern.test(version) || compareVersions(version, latest?.version ?? current) <= 0) continue;
        latest = {
            version,
            notes: typeof row.body === 'string' ? row.body.slice(0, 20_000) : '',
            url: releaseBase + row.tag_name,
        };
    }
    return latest;
}

export async function checkAppRelease(current: string, signal: AbortSignal) {
    const result = await fetch('https://api.github.com/repos/cluaiz/cluaiz-app/releases?per_page=30', { signal });
    if (!result.ok) throw new Error(`Release check failed (${result.status}).`);
    return selectAppRelease(current, await result.json());
}

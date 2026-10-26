/** Owned test archives; never imported by production or included in an SDK build. */
import { sha256 } from '../../../src/extensions/packages/admission';
export function tarFixture(entries: readonly { name: string; bytes: Uint8Array; type?: number }[]) {
    const blocks: Uint8Array[] = [];
    for (const entry of entries) {
        const header = new Uint8Array(512);
        const put = (offset: number, text: string) => header.set(new TextEncoder().encode(text), offset);
        put(0, entry.name); put(100, '0000644'); put(108, '0000000'); put(116, '0000000');
        put(124, entry.bytes.length.toString(8).padStart(11, '0')); put(136, '00000000000');
        header.fill(32, 148, 156); header[156] = entry.type ?? 48; put(257, 'ustar'); put(263, '00');
        const checksum = header.reduce((sum, byte) => sum + byte, 0);
        put(148, checksum.toString(8).padStart(6, '0') + '\0 ');
        const body = new Uint8Array(Math.ceil(entry.bytes.length / 512) * 512); body.set(entry.bytes);
        blocks.push(header, body);
    }
    const output = new Uint8Array(blocks.reduce((size, block) => size + block.length, 1024));
    let offset = 0; for (const block of blocks) { output.set(block, offset); offset += block.length; }
    return output;
}
export async function gzipFixture(bytes: Uint8Array) {
    return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
export async function packageFixture(files: ReadonlyMap<string, Uint8Array>, version: string, tamper = false, id?: string) {
    const copy = new Map(files);
    const decode = (name: string) => new TextDecoder().decode(copy.get(name)!);
    const encode = (text: string) => new TextEncoder().encode(text);
    const pkg = JSON.parse(decode('package.json'));
    pkg.version = version; pkg.app.version = version;
    if (id) pkg.app.id = id;
    const parsed = new DOMParser().parseFromString(decode(pkg.app.runtime.entry), 'text/html');
    parsed.querySelector('#cluaiz-extension-manifest')!.textContent = JSON.stringify({ app: pkg.app });
    copy.set(pkg.app.runtime.entry, encode('<!doctype html>' + parsed.documentElement.outerHTML));
    copy.set('package.json', encode(JSON.stringify(pkg)));
    const inventory = { schema_version: 1, algorithm: 'sha256', id: pkg.app.id, version,
        files: await Promise.all([...copy].filter(([name]) => name !== 'inventory.json').map(async ([path, bytes]) => ({ path, bytes: bytes.length, sha256: await sha256(bytes) }))) };
    copy.set('inventory.json', encode(JSON.stringify(inventory)));
    if (tamper) copy.set(pkg.app.runtime.entry, encode(decode(pkg.app.runtime.entry) + '<!-- changed after inventory -->'));
    return gzipFixture(tarFixture([...copy].map(([name, bytes]) => ({ name: 'package/' + name, bytes }))));
}

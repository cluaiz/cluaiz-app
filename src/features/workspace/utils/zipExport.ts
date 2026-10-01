// Lightweight, dependency-free ZIP archive builder (RFC 1951 STORE mode)
// Generates standard .zip files readable by Windows, macOS, and Linux natively.

function makeCrcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
}

const CRC_TABLE = makeCrcTable();

function computeCrc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export function downloadFile(name: string, content: string, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function exportProjectAsZip(projectName: string, files: Record<string, { path: string; content: string }>) {
    const encoder = new TextEncoder();
    const localHeaders: Uint8Array[] = [];
    const centralHeaders: Uint8Array[] = [];

    let offset = 0;

    for (const [filePath, file] of Object.entries(files)) {
        if (filePath.endsWith('.gitkeep')) continue;

        const pathBytes = encoder.encode(filePath);
        const dataBytes = encoder.encode(file.content);
        const crc = computeCrc32(dataBytes);
        const size = dataBytes.length;

        // Local file header (30 bytes + filename + data)
        const local = new Uint8Array(30 + pathBytes.length + size);
        const lView = new DataView(local.buffer);

        lView.setUint32(0, 0x04034b50, true); // signature
        lView.setUint16(4, 20, true);         // version needed (2.0)
        lView.setUint16(6, 0, true);          // flags
        lView.setUint16(8, 0, true);          // compression (0 = store)
        lView.setUint16(10, 0, true);         // mod time
        lView.setUint16(12, 0, true);         // mod date
        lView.setUint32(14, crc, true);        // crc32
        lView.setUint32(18, size, true);       // compressed size
        lView.setUint32(22, size, true);       // uncompressed size
        lView.setUint16(26, pathBytes.length, true); // filename length
        lView.setUint16(28, 0, true);         // extra field length

        local.set(pathBytes, 30);
        local.set(dataBytes, 30 + pathBytes.length);
        localHeaders.push(local);

        // Central directory entry (46 bytes + filename)
        const central = new Uint8Array(46 + pathBytes.length);
        const cView = new DataView(central.buffer);

        cView.setUint32(0, 0x02014b50, true); // signature
        cView.setUint16(4, 20, true);         // version made by
        cView.setUint16(6, 20, true);         // version needed
        cView.setUint16(8, 0, true);          // flags
        cView.setUint16(10, 0, true);         // compression (0 = store)
        cView.setUint16(12, 0, true);         // mod time
        cView.setUint16(14, 0, true);         // mod date
        cView.setUint32(16, crc, true);        // crc32
        cView.setUint32(20, size, true);       // compressed size
        cView.setUint32(24, size, true);       // uncompressed size
        cView.setUint16(28, pathBytes.length, true); // filename length
        cView.setUint16(30, 0, true);         // extra field length
        cView.setUint16(32, 0, true);         // comment length
        cView.setUint16(34, 0, true);         // disk start
        cView.setUint16(36, 0, true);         // internal attrs
        cView.setUint32(38, 0, true);         // external attrs
        cView.setUint32(42, offset, true);     // relative offset of local header

        central.set(pathBytes, 46);
        centralHeaders.push(central);

        offset += local.length;
    }

    const centralSize = centralHeaders.reduce((acc, h) => acc + h.length, 0);

    // End of central directory record (22 bytes)
    const eocd = new Uint8Array(22);
    const eView = new DataView(eocd.buffer);
    eView.setUint32(0, 0x06054b50, true);  // signature
    eView.setUint16(4, 0, true);           // disk number
    eView.setUint16(6, 0, true);           // disk with central dir
    eView.setUint16(8, centralHeaders.length, true);  // entries on disk
    eView.setUint16(10, centralHeaders.length, true); // total entries
    eView.setUint32(12, centralSize, true); // central dir size
    eView.setUint32(16, offset, true);      // offset of central dir
    eView.setUint16(20, 0, true);           // comment length

    const parts: BlobPart[] = [...localHeaders, ...centralHeaders, eocd] as unknown as BlobPart[];
    const blob = new Blob(parts, { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'project'}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

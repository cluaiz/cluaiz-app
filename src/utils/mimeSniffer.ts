/**
 * High-Precision Binary Magic-Byte MIME Sniffer
 * Accurately determines image and document MIME types from Base64 or binary signatures.
 * Completely immune to file extension mismatches (e.g. PNG files named .webp).
 */

const EXT_MIME_MAP: Record<string, string> = {
    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    avif: 'image/avif',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    // Documents
    pdf: 'application/pdf',
};

export const getMimeFromExt = (ext: string = ''): string => {
    const cleanExt = ext.toLowerCase().replace(/^\.+/, '');
    if (EXT_MIME_MAP[cleanExt]) return EXT_MIME_MAP[cleanExt];
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(cleanExt)) return `audio/${cleanExt}`;
    if (['mp4', 'webm', 'mkv', 'mov'].includes(cleanExt)) return `video/${cleanExt}`;
    return `image/${cleanExt || 'png'}`;
};

/**
 * Strips wrappers, whitespace, newlines, and data URI prefixes to isolate raw Base64.
 */
export const cleanBase64 = (raw: string): string => {
    if (!raw) return '';
    let cleaned = raw;
    if (cleaned.startsWith('__BASE64__:')) {
        cleaned = cleaned.substring('__BASE64__:'.length);
    } else if (cleaned.includes(';base64,')) {
        cleaned = cleaned.split(';base64,').pop() || '';
    }
    return cleaned.replace(/\s+/g, '');
};

/**
 * Sniffs the authoritative MIME type from Base64 header signatures.
 */
export const sniffMimeType = (payload: string, fallbackExt: string = ''): string => {
    const b64 = cleanBase64(payload);
    if (!b64 || b64.length < 4) {
        return getMimeFromExt(fallbackExt);
    }

    // 1. PNG: 89 50 4E 47 -> Base64 starts with iVBOR
    if (b64.startsWith('iVBOR')) {
        return 'image/png';
    }

    // 2. WebP: 52 49 46 46 (RIFF) -> Base64 starts with UklGR
    if (b64.startsWith('UklGR')) {
        return 'image/webp';
    }

    // 3. JPEG: FF D8 FF -> Base64 starts with /9j/
    if (b64.startsWith('/9j/')) {
        return 'image/jpeg';
    }

    // 4. GIF: GIF87a / GIF89a -> Base64 starts with R0lGOD
    if (b64.startsWith('R0lGOD')) {
        return 'image/gif';
    }

    // 5. PDF: %PDF (25 50 44 46) -> Base64 starts with JVBERi
    if (b64.startsWith('JVBERi')) {
        return 'application/pdf';
    }

    // 6. ICO: 00 00 01 00 -> Base64 starts with AAABAA
    if (b64.startsWith('AAABAA')) {
        return 'image/x-icon';
    }

    // 7. BMP: 42 4D (BM) -> Base64 starts with Qk
    if (b64.startsWith('Qk')) {
        return 'image/bmp';
    }

    // 8. SVG: <svg or <?xml (PHN2Zw or PD94b)
    if (b64.startsWith('PHN2Zw') || b64.startsWith('PD94b')) {
        return 'image/svg+xml';
    }

    // 9. MP3: ID3 tag header -> Base64 starts with SUQz
    if (b64.startsWith('SUQz')) {
        return 'audio/mpeg';
    }

    // 10. OGG: OggS header -> Base64 starts with T2dnUw
    if (b64.startsWith('T2dnUw')) {
        return 'audio/ogg';
    }

    // 11. MP4 / MOV: ftyp box -> Base64 contains ftyp
    if (b64.startsWith('AAAA') && b64.includes('ZnR5c')) {
        return 'video/mp4';
    }

    return getMimeFromExt(fallbackExt);
};

/**
 * Ensures a robust, valid data URI by sniffing true MIME type and removing whitespace.
 */
export const toSniffedDataUri = (payload: string, fallbackExt: string = ''): string => {
    const b64 = cleanBase64(payload);
    if (!b64) return '';
    const mime = sniffMimeType(b64, fallbackExt);
    return `data:${mime};base64,${b64}`;
};

/**
 * Converts a Base64 string into a high-performance native browser Blob.
 */
export const base64ToBlob = (raw: string, mimeType: string): Blob => {
    const b64 = cleanBase64(raw);
    const byteChars = atob(b64);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mimeType });
};

/**
 * Creates an instantaneous 0ms in-memory Blob URL from a Base64 payload.
 * Immune to CORS, localhost network binding, and Tauri asset protocol 403 errors.
 */
export const base64ToBlobUrl = (raw: string, fallbackExt: string = ''): string => {
    try {
        const mime = sniffMimeType(raw, fallbackExt);
        const blob = base64ToBlob(raw, mime);
        return URL.createObjectURL(blob);
    } catch (err) {
        console.warn('[mimeSniffer] base64ToBlobUrl error:', err);
        return toSniffedDataUri(raw, fallbackExt);
    }
};

/**
 * Normalizes existing data URIs that might have an incorrect declared MIME type.
 */
export const fixDataUriMime = (dataUri: string, fallbackExt: string = ''): string => {
    if (!dataUri || !dataUri.startsWith('data:')) {
        return toSniffedDataUri(dataUri, fallbackExt);
    }

    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) return dataUri;

    const rawB64 = dataUri.substring(commaIdx + 1).replace(/\s+/g, '');
    const sniffedMime = sniffMimeType(rawB64, fallbackExt);
    return `data:${sniffedMime};base64,${rawB64}`;
};

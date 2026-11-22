/** Files read as bytes, not text: never fetched for the package file reader */
export const BINARY_FILE = /\.(wasm|png|jpe?g|gif|webp|ico|zip|gz|tar|exe|dll|so|dylib|onnx|gguf|bin|pdf|woff2?|ttf)$/i;

/** What a binary file in a tool package is, in plain words, by its extension */
const KINDS: [RegExp, string][] = [
    [/\.wasm$/i, 'WebAssembly module: the compiled plugin. The Engine runs it in its sandbox.'],
    [/\.(exe|dll|so|dylib)$/i, 'Compiled program or library for this computer.'],
    [/\.(gguf|onnx|bin)$/i, 'Model weights or other data the tool loads.'],
    [/\.(zip|gz|tar)$/i, 'Compressed archive.'],
    [/\.(woff2?|ttf)$/i, 'Font file.'],
    [/\.pdf$/i, 'PDF document.'],
];

/** The plain-words kind of a binary file; a file that is not text but has no known extension gets a general line */
export function binaryFileKind(name: string): string {
    return KINDS.find(([pattern]) => pattern.test(name))?.[1] ?? 'A file of bytes, not text.';
}

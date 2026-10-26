import { ipc, isTauri } from './ipc';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { createNativeFetch, type EngineFetch, type NativeInvoke } from './nativeFetch';

interface TransportSelection {
    getProtocol(): 'ffi' | 'http';
    isTauri(): boolean;
    getBaseUrl(): string;
    nativeInvoke: NativeInvoke;
    httpFetch: EngineFetch;
}

/** The stored "ffi" label selects native IPC; failure never downgrades to HTTP. */
export function createEngineFetch(selection: TransportSelection): EngineFetch {
    const native = createNativeFetch(selection.nativeInvoke, selection.getBaseUrl);
    return (input, init) => {
        if (selection.getProtocol() === 'ffi') {
            if (!selection.isTauri()) return Promise.reject(new Error('Native Engine transport requires the desktop App.'));
            return native(input, init);
        }
        return selection.httpFetch(input, init);
    };
}

export const engineFetch = createEngineFetch({
    getProtocol: () => useConnectionStore.getState().protocol,
    isTauri,
    getBaseUrl: () => useConnectionStore.getState().getBaseUrl(),
    nativeInvoke: (command, args) => ipc.invoke(command, args),
    httpFetch: (input, init) => fetch(input, init),
});

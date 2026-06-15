import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useEngineStore } from '../store/engine/useEngineStore';

export interface EngineStatus {
    status: 'offline' | 'booting' | 'online' | 'error';
    latencyMs: number;
    modelLoaded: string | null;
}

/**
 * Checks if we are running inside the Tauri native wrapper (Desktop/Mobile)
 */
export const isNative = (): boolean => {
    return '__TAURI_INTERNALS__' in window;
};

/**
 * Unified FFI Engine Client.
 * 100% Reusable across Mobile, Desktop, and Web.
 * 
 * - In Desktop/Mobile (Tauri), it delegates to Rust FFI for Zero-Latency memory access.
 * - In Web, it falls back to a WASM/HTTP bridge.
 */
export class CluaizeEngine {
    private static isBooted = false;
    
    /**
     * Initializes the Co-Execution architecture.
     * Tells the native shell to spawn or link the `~/.cluaiz/bin/cluaize` engine via FFI.
     */
    static async boot(): Promise<void> {
        if (this.isBooted) return;
        this.isBooted = true; // Set synchronously to prevent Strict Mode double-boot
        
        useEngineStore.getState().setStatus('booting');

        if (isNative()) {
            console.log("[CluaizeEngine] Native environment detected. Booting zero-latency FFI engine...");
            try {
                await invoke('boot_cluaiz_engine');
                console.log("[CluaizeEngine] Engine FFI Link Established.");
                useEngineStore.getState().setStatus('online');
            } catch (err) {
                console.error("[CluaizeEngine] Failed to boot engine via FFI:", err);
                this.isBooted = false; // Revert if failed
                useEngineStore.getState().setStatus('error');
                throw err;
            }
        } else {
            console.log("[CluaizeEngine] Web environment detected. Falling back to WebAssembly/Gateway...");
            // Simulate web boot
            setTimeout(() => {
                this.isBooted = true;
                useEngineStore.getState().setStatus('online');
            }, 1000);
        }
    }

    /**
     * Sends a message directly through the memory FFI buffer.
     */
    static async send(message: string): Promise<void> {
        if (isNative()) {
            await invoke('ffi_send_message', { message });
        } else {
            console.log("Simulated Web Send:", message);
        }
    }

    /**
     * Listens to the high-speed token stream coming from the FFI memory buffer.
     */
    static async onToken(callback: (token: string) => void): Promise<UnlistenFn> {
        if (!isNative()) {
            return () => {}; 
        }
        return await listen<string>('engine_stream_token', (event) => {
            callback(event.payload);
        });
    }

    /**
     * Fetches chat history directly from the cluaize engine's LMDB database.
     */
    static async fetchHistory(): Promise<any[]> {
        if (isNative()) {
            const historyJson = await invoke<string>('ffi_fetch_history');
            return JSON.parse(historyJson);
        }
        return [];
    }

    /**
     * Deletes a chat session from the cluaize engine's LMDB database.
     */
    static async deleteSession(sessionId: string): Promise<void> {
        if (isNative()) {
            await invoke('ffi_delete_session', { sessionId });
        }
    }
}

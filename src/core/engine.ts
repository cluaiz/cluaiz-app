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
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window);
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
                useEngineStore.getState().setStatus('idle');
                
                // If Lazy Load is OFF, trigger EAGER_LOAD
                const perms = useEngineStore.getState().permissions;
                if (perms && !perms.lazy_load_model) {
                    await this.sendEagerLoad();
                }
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
                useEngineStore.getState().setStatus('idle');
            }, 1000);
        }
    }

    /**
     * Triggers the EAGER_LOAD command via FFI to pre-load the ML model into VRAM immediately.
     */
    static async sendEagerLoad(): Promise<void> {
        if (isNative()) {
            console.log("[CluaizeEngine] Sending EAGER_LOAD to IPC Pipe...");
            try {
                await invoke('update_engine_settings', {
                    payload: { action: "EAGER_LOAD" }
                });
            } catch (err) {
                console.error("[CluaizeEngine] EAGER_LOAD FFI error:", err);
            }
        }
    }

    /**
     * Executes a CDQL query directly against the compute node database.
     * Automatically routes between Native FFI and Web HTTP Gateway.
     */
    static async executeCDQL(query: string): Promise<any> {
        if (isNative()) {
            console.log("[CDQL Native] Executing via FFI:", query);
            const { executeCDQLFFI } = await import('./tauri-api');
            const responseJson = await executeCDQLFFI(query);
            return JSON.parse(responseJson);
        } else {
            console.log("[CDQL Web] Executing via HTTP Gateway:", query);
            const res = await fetch('http://localhost:8000/v1/db/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            return await res.json();
        }
    }

    /**
     * Sends a chat message to the engine.
     */
    static async send(message: string): Promise<void> {
        if (isNative()) {
            const { sendFFIMessage } = await import('./tauri-api');
            await sendFFIMessage(message);
        } else {
            console.log("[Web] Sending message via HTTP:", message);
            const res = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: message }],
                    stream: true
                })
            });
            
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');

            const readChunk = async () => {
                const { done, value } = await reader.read();
                if (done) return;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            if (this.tokenCallback) this.tokenCallback('[DONE]');
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                                const content = parsed.choices[0].delta.content;
                                if (content && this.tokenCallback) {
                                    this.tokenCallback(content);
                                }
                            }
                        } catch (e) {
                            // Ignored JSON parse errors
                        }
                    }
                }
                
                await readChunk();
            };
            
            readChunk().catch(console.error);
        }
    }

    private static tokenCallback: ((token: string) => void) | null = null;
    
    /**
     * Listens for incoming tokens from the engine.
     */
    static async onToken(callback: (token: string) => void): Promise<() => void> {
        this.tokenCallback = callback;
        if (isNative()) {
            const { listenToEngineStream } = await import('./tauri-api');
            const unlisten = await listenToEngineStream(callback);
            return unlisten;
        } else {
            return () => { this.tokenCallback = null; };
        }
    }

    /**
     * Fetches chat history from the engine.
     */
    static async fetchHistory(): Promise<any[]> {
        if (isNative()) {
            try {
                const { fetchFFIHistory } = await import('./tauri-api');
                const historyStr = await fetchFFIHistory();
                return JSON.parse(historyStr);
            } catch (e) {
                console.error("Failed to parse FFI history:", e);
                return [];
            }
        }
        return [];
    }

    /**
     * Deletes a chat session from the engine.
     */
    static async deleteSession(sessionId: string): Promise<void> {
        await this.executeCDQL(`DELETE FROM sessions WHERE id = '${sessionId}'`);
    }
}

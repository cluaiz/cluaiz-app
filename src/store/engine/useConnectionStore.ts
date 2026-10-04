import { create } from 'zustand';

export type ConnectionProtocol = 'ffi' | 'http';

interface ConnectionState {
    protocol: ConnectionProtocol;
    host: string;
    port: number;
    setProtocol: (protocol: ConnectionProtocol) => void;
    setPort: (port: number) => void;
    setHost: (host: string) => void;
    getBaseUrl: () => string;
}

// Helper to read last known working connection strictly as a secondary fallback cache
const getFallbackConnection = () => {
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem('cluaiz_connection_fallback');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.port === 'number') {
                    // Discard frontend dev server ports (1420, 5173) and local bridge port (1421)
                    if (parsed.port !== 1420 && parsed.port !== 1421 && parsed.port !== 5173 && parsed.port >= 1024 && parsed.port <= 65535) {
                        return parsed;
                    }
                }
            }
        } catch {
            // Ignore storage parse errors
        }
    }
    return { protocol: 'http', host: '0.0.0.0', port: 8080 };
};

export const saveFallbackConnection = (conn: { protocol?: string; host?: string; port?: number }) => {
    if (typeof window !== 'undefined' && conn.port) {
        try {
            localStorage.setItem('cluaiz_connection_fallback', JSON.stringify({
                protocol: conn.protocol || 'http',
                host: conn.host || '0.0.0.0',
                port: conn.port
            }));
        } catch {
            // Ignore storage save errors
        }
    }
};

const initialFallback = getFallbackConnection();

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
    protocol: (initialFallback.protocol as ConnectionProtocol) || 'http',
    host: initialFallback.host || '0.0.0.0',
    port: initialFallback.port,
    setProtocol: (protocol: ConnectionProtocol) => {
        set({ protocol });
        saveFallbackConnection({ ...get(), protocol });
    },
    setPort: (port: number) => {
        set({ port });
        saveFallbackConnection({ ...get(), port });
    },
    setHost: (host: string) => {
        set({ host });
        saveFallbackConnection({ ...get(), host });
    },
    getBaseUrl: () => {
        const rawHost = get().host;
        // Numerical IP routing: 0.0.0.0 server bind address routes to 127.0.0.1 loopback
        const connectHost = (!rawHost || rawHost === '0.0.0.0') ? '127.0.0.1' : rawHost;
        return `http://${connectHost}:${get().port}`;
    },
}));

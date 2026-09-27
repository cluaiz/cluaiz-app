import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export const useConnectionStore = create<ConnectionState>()(
    persist(
        (set, get) => ({
            protocol: 'http', // Default connection protocol
            host: 'localhost',
            port: 8000,
            setProtocol: (protocol: ConnectionProtocol) => set({ protocol }),
            setPort: (port: number) => set({ port }),
            setHost: (host: string) => set({ host }),
            getBaseUrl: () => `http://${get().host}:${get().port}`,
        }),
        {
            name: 'cluaiz-connection-settings',
            partialize: (state) => ({
                protocol: state.protocol,
                host: state.host,
                port: state.port,
            }),
        }
    )
);

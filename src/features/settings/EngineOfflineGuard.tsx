import React, { useState, useEffect } from 'react';
import { ServerOff, RefreshCw, Play, Loader2, Key, Network } from 'lucide-react';
import { useEngineStore } from '../../store/engine/useEngineStore';
import { usePermissionStore } from '../../api';
import { cluaizEngine } from '../../core/engine';
import { toast } from '../../components/ui/toast';
import { ConfigurePortModal } from './components/ConfigurePortModal';

interface EngineOfflineGuardProps {
    children: React.ReactNode;
}

export const EngineOfflineGuard: React.FC<EngineOfflineGuardProps> = ({ children }) => {
    const permissions = useEngineStore((state) => state.permissions);
    const fetchStatus = useEngineStore((state) => state.fetchStatus);
    const initEngineSettings = useEngineStore((state) => state.initEngineSettings);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isPortModalOpen, setIsPortModalOpen] = useState(false);

    // Auto-probe on initial mount if state is idle
    useEffect(() => {
        if (fetchStatus === 'idle') {
            initEngineSettings();
        }
    }, [fetchStatus, initEngineSettings]);

    const isOnline = Boolean(permissions);

    const handleStartEngine = async () => {
        setIsActionLoading(true);
        try {
            await toast.promise(
                async () => {
                    await cluaizEngine.boot();
                    // Wait briefly for server socket/port to bind
                    await new Promise((r) => setTimeout(r, 1200));
                    await initEngineSettings();
                    const latestPermissions = useEngineStore.getState().permissions;
                    if (!latestPermissions) {
                        throw new Error('Engine process spawned, but communication could not be established. Please check system permissions or port availability.');
                    }
                },
                {
                    loading: 'Starting Cluaiz Engine daemon...',
                    success: 'Cluaiz Engine started successfully',
                    error: (err: any) => err?.message || 'Could not start engine daemon. Please verify system permissions or restart the application.'
                }
            );
        } catch (err: any) {
            console.error('Failed to start engine:', err);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRetry = async () => {
        setIsActionLoading(true);
        try {
            await toast.promise(
                async () => {
                    await initEngineSettings();
                    const latestPermissions = useEngineStore.getState().permissions;
                    if (!latestPermissions) {
                        throw new Error('Engine daemon is unreachable. Please verify the background service is running or click Start Engine.');
                    }
                },
                {
                    loading: 'Connecting to Cluaiz Engine...',
                    success: 'Connected to Cluaiz Engine',
                    error: (err: any) => err?.message || 'Failed to connect to Cluaiz Engine'
                }
            );
        } catch {
            // Handled by toast.promise
        } finally {
            setIsActionLoading(false);
        }
    };

    if (fetchStatus === 'loading' && !permissions) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center">
                <Loader2 className="w-8 h-8 text-[var(--accent-color)] animate-spin mb-4" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Connecting to Cluaiz Engine...</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Establishing secure RPC & synchronizing configuration.</p>
            </div>
        );
    }

    if (!isOnline) {
        const isAuthRequired = fetchStatus === 'auth_required';

        if (isAuthRequired) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center max-w-lg mx-auto select-none">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/5">
                        <Key className="w-8 h-8" />
                    </div>

                    <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">
                        Authentication Required
                    </h2>

                    <p className="text-xs leading-relaxed text-[var(--text-secondary)] mb-6">
                        Cluaiz Engine is active and reachable, but requests require an authorized API Bearer token. Enter your token to unlock settings and configure the engine.
                    </p>

                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => usePermissionStore.getState().setAuthModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ui-btn-primary shadow-md cursor-pointer"
                        >
                            <Key className="w-4 h-4" />
                            Enter Token
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsPortModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ui-btn-secondary cursor-pointer"
                        >
                            <Network className="w-4 h-4" />
                            Change Port
                        </button>

                        <button
                            type="button"
                            onClick={handleRetry}
                            disabled={isActionLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ui-btn-secondary cursor-pointer"
                        >
                            <RefreshCw className={`w-4 h-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                            Retry Connection
                        </button>
                    </div>

                    <ConfigurePortModal
                        isOpen={isPortModalOpen}
                        onClose={() => setIsPortModalOpen(false)}
                    />
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center max-w-lg mx-auto select-none">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/5">
                    <ServerOff className="w-8 h-8" />
                </div>

                <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">
                    Cluaiz Engine is Offline
                </h2>

                <p className="text-xs leading-relaxed text-[var(--text-secondary)] mb-6">
                    Settings cannot be loaded or configured because the local Cluaiz Engine is not running. All configuration is strictly synchronized directly with the Engine backend.
                </p>

                <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
                    <button
                        type="button"
                        onClick={handleStartEngine}
                        disabled={isActionLoading}
                        className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold ui-btn-primary shadow-md cursor-pointer"
                    >
                        {isActionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 fill-current" />
                        )}
                        Start Engine
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsPortModalOpen(true)}
                        disabled={isActionLoading}
                        className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold ui-btn-secondary cursor-pointer"
                    >
                        <Network className="w-4 h-4" />
                        Change Port
                    </button>

                    <button
                        type="button"
                        onClick={handleRetry}
                        disabled={isActionLoading}
                        className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold ui-btn-secondary cursor-pointer"
                    >
                        <RefreshCw className={`w-4 h-4 ${isActionLoading ? 'animate-spin' : ''}`} />
                        Retry Connection
                    </button>

                    <button
                        type="button"
                        onClick={() => usePermissionStore.getState().setAuthModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold ui-btn-secondary cursor-pointer"
                        title="Enter API Bearer Token"
                    >
                        <Key className="w-4 h-4" />
                        Enter Token
                    </button>
                </div>

                <ConfigurePortModal
                    isOpen={isPortModalOpen}
                    onClose={() => setIsPortModalOpen(false)}
                />
            </div>
        );
    }

    return <>{children}</>;
};

import { useState, useEffect } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';
import { useConnectionStore, ConnectionProtocol } from '../../store/engine/useConnectionStore';
import { useEngineStore } from '../../store/engine/useEngineStore';
import { systemApi, storageApi } from '../../api';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { PortConfirmModal } from '../../components/ui/modal/PortConfirmModal';
import { toast } from '../../components/ui/toast';

export function GeneralSettings() {
    // Startup & Background State (Persisted)
    const [launchStartup, setLaunchStartup] = useState(() => {
        try { return localStorage.getItem('cluaiz_launch_startup') === 'true'; } catch { return false; }
    });
    const [runBackground, setRunBackground] = useState(() => {
        try { return localStorage.getItem('cluaiz_run_background') !== 'false'; } catch { return true; }
    });

    // Dynamic Connection State from Store (Zero Hardcoding)
    const { protocol, host, port, getBaseUrl } = useConnectionStore();
    const permissions = useEngineStore((state) => state.permissions);
    const initEngineSettings = useEngineStore((state) => state.initEngineSettings);

    // Live Engine Values strictly prioritize permission.json (zero hardcoded fallback)
    const currentProtocol = (permissions?.connection_protocol as ConnectionProtocol) || protocol || 'http';
    const currentPort = (permissions?.api_port ?? port)?.toString() ?? '';
    const currentHost = permissions?.api_host || host || '0.0.0.0';

    // Per-setting pending sync states
    const [pendingProtocol, setPendingProtocol] = useState<ConnectionProtocol | null>(null);
    const [pendingHost, setPendingHost] = useState<string | null>(null);
    const [isSyncingProtocol, setIsSyncingProtocol] = useState(false);
    const [isSyncingHost, setIsSyncingHost] = useState(false);
    const [isSyncingPort, setIsSyncingPort] = useState(false);
    const [pendingPort, setPendingPort] = useState<number | null>(null);
    const [showPortModal, setShowPortModal] = useState(false);
    const [isUpdatingPort, setIsUpdatingPort] = useState(false);

    // Storage State
    const [cleanupPolicy, setCleanupPolicy] = useState('Immediate');
    const [isSyncingStoragePolicy, setIsSyncingStoragePolicy] = useState(false);
    const [storageUsage, setStorageUsage] = useState('0.00 MB');
    const [fileCount, setFileCount] = useState(0);
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanSuccess, setCleanSuccess] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    // Save startup preferences
    const handleToggleStartup = (val: boolean) => {
        setLaunchStartup(val);
        try { localStorage.setItem('cluaiz_launch_startup', String(val)); } catch {}
    };

    const handleToggleBackground = (val: boolean) => {
        setRunBackground(val);
        try { localStorage.setItem('cluaiz_run_background', String(val)); } catch {}
    };

    // Fetch initial settings & storage telemetry dynamically from active endpoint
    useEffect(() => {
        let isMounted = true;

        const loadSettings = async () => {
            try {
                await initEngineSettings();
                if (isMounted) setIsOffline(false);
            } catch {
                if (isMounted) setIsOffline(true);
            }

            try {
                // 2. Fetch storage telemetry
                const storageData = await storageApi.getTempMediaStatus();
                if (isMounted && storageData) {
                    setStorageUsage(storageData.human_size || (storageData.total_size_bytes ? `${(storageData.total_size_bytes / (1024 * 1024)).toFixed(2)} MB` : '0.00 MB'));
                    setFileCount(storageData.file_count || 0);
                }
            } catch {
                if (isMounted) {
                    setStorageUsage('0.00 MB');
                    setFileCount(0);
                }
            }

            try {
                // 3. Fetch storage policy settings directly from engine backend
                const policyData = await storageApi.getStorageSettings();
                if (isMounted && (policyData as any)?.cleanup_policy) {
                    setCleanupPolicy((policyData as any).cleanup_policy);
                }
            } catch {
                // Default to Immediate
            }
        };

        loadSettings();

        return () => { isMounted = false; };
    }, []);

    const handleProtocolChange = async (val: string) => {
        const proto = val as ConnectionProtocol;
        if (proto === currentProtocol) return;
        setIsSyncingProtocol(true);
        setPendingProtocol(proto);
        try {
            await toast.promise(
                async () => {
                    await systemApi.updatePermission({ connection_protocol: proto });
                    useConnectionStore.getState().setProtocol(proto);
                    await initEngineSettings();
                    setIsOffline(false);
                },
                {
                    loading: `Updating connection protocol to ${proto.toUpperCase()}...`,
                    success: `Protocol updated to ${proto.toUpperCase()}`,
                    error: (err) => err?.message || 'Failed to sync protocol to engine'
                }
            );
        } catch (err: any) {
            console.error('[GeneralSettings] Failed to sync protocol to engine:', err);
        } finally {
            setIsSyncingProtocol(false);
            setPendingProtocol(null);
        }
    };

    const handlePortChange = (val: string) => {
        const portNum = parseInt(val, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            toast.error('Invalid port number (1 - 65535)');
            return;
        }
        if (portNum === parseInt(currentPort, 10)) return;
        setPendingPort(portNum);
        setShowPortModal(true);
    };

    const confirmPortChange = async () => {
        if (!pendingPort) return;
        const targetPort = pendingPort;
        setIsUpdatingPort(true);
        setIsSyncingPort(true);
        try {
            await toast.promise(
                async () => {
                    await systemApi.updatePermission({ api_port: targetPort });
                    await initEngineSettings();
                    setIsOffline(false);
                    setShowPortModal(false);
                    setPendingPort(null);
                },
                {
                    loading: `Setting gateway port to ${targetPort} in permission.json...`,
                    success: `Gateway port set to ${targetPort}. Please restart engine daemon to apply.`,
                    error: (err) => err?.message || 'Failed to sync port to engine'
                }
            );
        } catch (err: any) {
            console.error('[GeneralSettings] Failed to sync port to engine:', err);
        } finally {
            setIsUpdatingPort(false);
            setIsSyncingPort(false);
        }
    };

    const cancelPortChange = () => {
        setShowPortModal(false);
        setPendingPort(null);
    };

    const handleHostChange = async (val: string) => {
        const cleanHost = val.trim();
        if (!cleanHost || cleanHost === currentHost) return;
        setIsSyncingHost(true);
        setPendingHost(cleanHost);
        try {
            await toast.promise(
                async () => {
                    await systemApi.updatePermission({ api_host: cleanHost });
                    await initEngineSettings();
                    setIsOffline(false);
                },
                {
                    loading: `Updating engine API host to ${cleanHost}...`,
                    success: `API host updated to ${cleanHost} in permission.json`,
                    error: (err) => err?.message || 'Failed to sync host to engine'
                }
            );
        } catch (err: any) {
            console.error('[GeneralSettings] Failed to sync host to engine:', err);
        } finally {
            setIsSyncingHost(false);
            setPendingHost(null);
        }
    };

    const handleStoragePolicyChange = async (val: string) => {
        setIsSyncingStoragePolicy(true);
        try {
            await toast.promise(
                async () => {
                    await storageApi.updateStorageSettings({ cleanup_policy: val } as any);
                },
                {
                    loading: `Updating storage cleanup policy to ${val}...`,
                    success: `Storage cleanup policy set to ${val}`,
                    error: 'Failed to update storage cleanup policy'
                }
            );
            // Only update local state after backend returns success
            setCleanupPolicy(val);
        } catch (err) {
            console.error('[GeneralSettings] Failed to update storage cleanup policy:', err);
        } finally {
            setIsSyncingStoragePolicy(false);
        }
    };

    const handleCleanStorage = async () => {
        setIsCleaning(true);
        try {
            await toast.promise(
                async () => {
                    const res = await storageApi.cleanTempMedia();
                    setStorageUsage('0.00 MB');
                    setFileCount(0);
                    setCleanSuccess(true);
                    setTimeout(() => setCleanSuccess(false), 2500);
                    return res;
                },
                {
                    loading: 'Cleaning temporary media cache...',
                    success: (res: any) => `Cleaned ${res?.cleaned_human || 'cache'} (${res?.cleaned_files || 0} files deleted)`,
                    error: (err) => 'Failed to clean storage: ' + (err?.message || 'Unknown error')
                }
            );
        } catch {
            // Handled by toast.promise
        } finally {
            setIsCleaning(false);
        }
    };

    // Dynamic description maps matching Developer Hub
    const protocolDescriptions: Record<string, { desc: string; dynamic: string }> = {
        ffi: {
            desc: 'Direct in-memory zero-copy Rust FFI pipe. Bypasses TCP network stack for maximum local throughput.',
            dynamic: 'Active Mode: Native C-Pointer (FFI) Pipe — Direct In-Memory Kernel'
        },
        http: {
            desc: 'Standard HTTP REST API gateway. Communicates via TCP loopback on local port for external integrations.',
            dynamic: `Active Mode: HTTP REST API Gateway (${getBaseUrl()})`
        }
    };

    const portDescriptions: Record<string, { desc: string; dynamic: string }> = {
        '8080': {
            desc: 'Default port allocated for Cluaiz Engine HTTP daemon.',
            dynamic: `Target Gateway: ${getBaseUrl()} (Default Engine Port)`
        },
        '8000': {
            desc: 'Alternative port allocated for Cluaiz Engine HTTP daemon.',
            dynamic: `Target Gateway: ${getBaseUrl()} (Standard Engine Port)`
        },
        '9000': {
            desc: 'High-range port commonly used for isolated local engine clusters.',
            dynamic: `Target Gateway: ${getBaseUrl()} (High-Range Service Port)`
        }
    };

    const cleanupDescriptions: Record<string, { desc: string; dynamic: string }> = {
        Immediate: {
            desc: 'Deletes downloaded media, charts, and temp files immediately after inference parses.',
            dynamic: 'Policy: Aggressive disk cleanup (Purge immediate)'
        },
        '1_Day': {
            desc: 'Retains temporary media files for 24 hours to allow prompt re-evaluation before removal.',
            dynamic: 'Policy: Retain temp media for 24 hours'
        },
        '7_Days': {
            desc: 'Preserves generated media files for 7 days before automated garbage collection.',
            dynamic: 'Policy: Retain temp media for 7 days'
        },
        '30_Days': {
            desc: 'Preserves all session media assets for 30 days before storage purging.',
            dynamic: 'Policy: Retain temp media for 30 days'
        },
        Manual: {
            desc: "Files are never automatically deleted. Requires clicking 'Clean Now' to free disk space.",
            dynamic: 'Policy: Manual cleanup only (No automatic purging)'
        }
    };

    return (
        <div className="space-y-8 select-none">
            {isOffline && (
                <AlertBanner
                    variant="warning"
                    title="Engine Offline"
                    message="Engine is currently offline. Some settings will apply when the engine boots."
                />
            )}

            {/* Login & Startup */}
            <SettingSection title="Login & Startup">
                <SettingItem
                    label="Launch on startup"
                    description="Automatically open Cluaiz when your computer starts."
                    toggle
                    active={launchStartup}
                    onToggle={() => handleToggleStartup(!launchStartup)}
                />
                <SettingItem
                    label="Run in background"
                    description="Keep Cluaiz running in the tray when window is closed."
                    toggle
                    active={runBackground}
                    onToggle={() => handleToggleBackground(!runBackground)}
                />
            </SettingSection>

            {/* Network & Connection (Dynamic - Engine Source of Truth) */}
            <SettingSection title="Network & Connection">
                <SettingItem
                    label="Connection Protocol"
                    loading={isSyncingProtocol}
                    description={
                        protocolDescriptions[currentProtocol]?.desc ||
                        'Choose how the UI communicates with the Engine.'
                    }
                    dynamicDescription={
                        protocolDescriptions[currentProtocol]?.dynamic ||
                        `Active Mode: ${currentProtocol.toUpperCase()}`
                    }
                    select={[
                        { value: 'http', label: 'HTTP REST API (Default)' },
                        { value: 'ffi', label: 'Native C-Pointer (FFI)' }
                    ]}
                    value={pendingProtocol || currentProtocol}
                    onChange={handleProtocolChange}
                />
                <SettingItem
                    label="API Port"
                    loading={isSyncingPort}
                    description={
                        currentProtocol === 'ffi'
                            ? 'Network port is bypassed because Native C-Pointer uses direct memory IPC instead of TCP sockets.'
                            : portDescriptions[currentPort]?.desc ||
                              'Port for engine HTTP REST API communication.'
                    }
                    dynamicDescription={
                        currentProtocol === 'ffi'
                            ? 'Status: Inactive (Bypassed by Native C-Pointer)'
                            : portDescriptions[currentPort]?.dynamic ||
                              `Target Gateway: ${getBaseUrl()}`
                    }
                    select={[
                        { value: '8080', label: 'Port 8080' },
                        { value: '8000', label: 'Port 8000' },
                        { value: '9000', label: 'Port 9000' }
                    ]}
                    value={pendingPort ? pendingPort.toString() : currentPort}
                    onChange={handlePortChange}
                    allowCustomInput
                    customInputPlaceholder="Type custom port..."
                />
                <SettingItem
                    label="API Host"
                    loading={isSyncingHost}
                    description={
                        currentProtocol === 'ffi'
                            ? 'Host network configuration is bypassed when Native C-Pointer FFI is active.'
                            : 'Host IP address for the engine HTTP gateway.'
                    }
                    dynamicDescription={
                        currentProtocol === 'ffi'
                            ? 'Status: Inactive (Bypassed by Native C-Pointer)'
                            : `Target Gateway: ${getBaseUrl()}`
                    }
                    select={[
                        { value: '0.0.0.0', label: '0.0.0.0 (All Interfaces - Default)' },
                        { value: '127.0.0.1', label: '127.0.0.1 (Local Loopback)' }
                    ]}
                    value={pendingHost || currentHost}
                    onChange={handleHostChange}
                    allowCustomInput
                    customInputPlaceholder="Type custom host..."
                />
            </SettingSection>

            {/* Temp Media & Storage */}
            <SettingSection title="Temp Media & Storage">
                <SettingItem
                    label="Cleanup Policy"
                    loading={isSyncingStoragePolicy}
                    disabled={isSyncingStoragePolicy}
                    description={
                        cleanupDescriptions[cleanupPolicy]?.desc ||
                        'Automatically delete downloaded media/files to save disk space.'
                    }
                    dynamicDescription={
                        cleanupDescriptions[cleanupPolicy]?.dynamic ||
                        `Policy: ${cleanupPolicy}`
                    }
                    select={[
                        { value: 'Immediate', label: 'Immediate (After Parse)' },
                        { value: '1_Day', label: 'Older than 1 Day' },
                        { value: '7_Days', label: 'Older than 7 Days' },
                        { value: '30_Days', label: 'Older than 30 Days' },
                        { value: 'Manual', label: 'Manual' }
                    ]}
                    value={cleanupPolicy}
                    onChange={handleStoragePolicyChange}
                />
                <div className="flex items-center justify-between p-6 hover:bg-[var(--text-primary)]/5 transition-all border-b border-[var(--border-color)] last:border-none">
                    <div className="flex flex-col max-w-sm">
                        <span className="text-sm font-bold text-[var(--text-primary)]">Current Usage</span>
                        <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                            Temporary cache files, generated charts, and media assets.
                        </span>
                        <span className="text-[10px] text-[var(--accent-color)] mt-1.5 font-medium italic opacity-90">
                            ↳ {storageUsage} used ({fileCount} files)
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleCleanStorage}
                        disabled={isCleaning}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            cleanSuccess
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 hover:border-red-500/40'
                        } disabled:opacity-50 cursor-pointer`}
                    >
                        {isCleaning ? 'Cleaning...' : cleanSuccess ? 'Cleaned!' : 'Clean Now'}
                    </button>
                </div>
            </SettingSection>

            {/* Reusable Port Change Confirmation Modal */}
            <PortConfirmModal
                open={showPortModal}
                pendingPort={pendingPort}
                currentPort={currentPort}
                isUpdating={isUpdatingPort}
                onConfirm={confirmPortChange}
                onCancel={cancelPortChange}
            />
        </div>
    );
}

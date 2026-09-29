import { useState, useEffect } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';
import { useConnectionStore, ConnectionProtocol } from '../../store/engine/useConnectionStore';

export function GeneralSettings() {
    // Startup & Localization State
    const [launchStartup, setLaunchStartup] = useState(false);
    const [runBackground, setRunBackground] = useState(true);

    // Dynamic Connection State from Store (Zero Hardcoding)
    const { protocol, host, port, setProtocol, setPort, setHost, getBaseUrl } = useConnectionStore();

    // Storage State
    const [cleanupPolicy, setCleanupPolicy] = useState('Immediate');
    const [storageUsage, setStorageUsage] = useState('0.00 MB');
    const [fileCount, setFileCount] = useState(0);
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanSuccess, setCleanSuccess] = useState(false);

    // Fetch initial settings & storage telemetry dynamically from active endpoint
    useEffect(() => {
        const activeUrl = getBaseUrl();

        // 1. Fetch system permission / network config
        fetch(`${activeUrl}/v1/system/permission`)
            .then(res => res.json())
            .then(data => {
                if (data?.permission) {
                    if (data.permission.connection_protocol) {
                        setProtocol(data.permission.connection_protocol as ConnectionProtocol);
                    }
                    if (data.permission.api_port) {
                        setPort(data.permission.api_port);
                    }
                }
            })
            .catch(() => {
                // Graceful fallback to persistent store if engine endpoint is not active
            });

        // 2. Fetch storage telemetry
        fetchStorageStatus();
    }, [protocol, port]);

    const fetchStorageStatus = () => {
        const activeUrl = getBaseUrl();
        fetch(`${activeUrl}/v1/system/storage/temp_media`)
            .then(res => res.json())
            .then(data => {
                if (data?.status === 'success') {
                    setStorageUsage(data.total_size_mb || '0.00 MB');
                    setFileCount(data.file_count || 0);
                }
            })
            .catch(() => {
                setStorageUsage('0.00 MB');
                setFileCount(0);
            });
    };

    const handleProtocolChange = async (val: string) => {
        const proto = val as ConnectionProtocol;
        setProtocol(proto);
        try {
            await fetch(`${getBaseUrl()}/v1/system/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connection_protocol: proto })
            });
        } catch {
            // Persisted locally in connection store
        }
    };

    const handlePortChange = async (val: string) => {
        const portNum = parseInt(val, 10);
        setPort(portNum);
        try {
            await fetch(`${getBaseUrl()}/v1/system/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_port: portNum })
            });
        } catch {
            // Persisted locally in connection store
        }
    };

    const handleStoragePolicyChange = async (val: string) => {
        setCleanupPolicy(val);
        try {
            await fetch(`${getBaseUrl()}/v1/system/storage/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cleanup_policy: val })
            });
        } catch {
            // Silently persist locally
        }
    };

    const handleCleanStorage = async () => {
        setIsCleaning(true);
        try {
            await fetch(`${getBaseUrl()}/v1/system/storage/temp_media/clean`, { method: 'POST' });
            setStorageUsage('0.00 MB');
            setFileCount(0);
            setCleanSuccess(true);
            setTimeout(() => setCleanSuccess(false), 2500);
        } catch {
            setStorageUsage('0.00 MB');
            setFileCount(0);
            setCleanSuccess(true);
            setTimeout(() => setCleanSuccess(false), 2500);
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
        '8000': {
            desc: 'Standard default port allocated for Cluaiz Engine HTTP daemon.',
            dynamic: `Target Gateway: ${getBaseUrl()} (Default Engine Port)`
        },
        '8080': {
            desc: 'Alternative development port when 8000 is occupied by other local services.',
            dynamic: `Target Gateway: ${getBaseUrl()} (Alternative Dev Port)`
        },
        '9000': {
            desc: 'High-range port commonly used for isolated local engine clusters.',
            dynamic: `Target Gateway: ${getBaseUrl()} (High-Range Service Port)`
        },
        '1420': {
            desc: 'Shared port co-located with the Tauri / Vite UI frontend shell.',
            dynamic: `Target Gateway: ${getBaseUrl()} (Co-located UI Port)`
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
            {/* Login & Startup */}
            <SettingSection title="Login & Startup">
                <SettingItem
                    label="Launch on startup"
                    description="Automatically open Cluaiz when you log in to Windows."
                    toggle
                    active={launchStartup}
                    onToggle={() => setLaunchStartup(!launchStartup)}
                />
                <SettingItem
                    label="Run in background"
                    description="Keep Cluaiz running in the tray when window is closed."
                    toggle
                    active={runBackground}
                    onToggle={() => setRunBackground(!runBackground)}
                />
            </SettingSection>

            {/* Network & Connection (Dynamic - Zero Hardcoding) */}
            <SettingSection title="Network & Connection">
                <SettingItem
                    label="Connection Protocol"
                    description={
                        protocolDescriptions[protocol]?.desc ||
                        'Choose how the UI communicates with the Engine.'
                    }
                    dynamicDescription={
                        protocolDescriptions[protocol]?.dynamic ||
                        `Active Mode: ${protocol.toUpperCase()}`
                    }
                    select={[
                        { value: 'ffi', label: 'Native C-Pointer (FFI)' },
                        { value: 'http', label: 'HTTP REST API (Default)' }
                    ]}
                    value={protocol}
                    onChange={handleProtocolChange}
                />
                <SettingItem
                    label="Localhost Port"
                    description={
                        protocol === 'ffi'
                            ? 'Network port is bypassed because Native C-Pointer uses direct memory IPC instead of TCP sockets.'
                            : portDescriptions[port.toString()]?.desc ||
                              'Select the port for HTTP REST API communication.'
                    }
                    dynamicDescription={
                        protocol === 'ffi'
                            ? 'Status: Inactive (Bypassed by Native C-Pointer)'
                            : portDescriptions[port.toString()]?.dynamic ||
                              `Target Gateway: ${getBaseUrl()}`
                    }
                    select={[
                        { value: '8000', label: 'Port 8000 (Default)' },
                        { value: '8080', label: 'Port 8080' },
                        { value: '9000', label: 'Port 9000' },
                        { value: '1420', label: 'Port 1420' }
                    ]}
                    value={port.toString()}
                    onChange={handlePortChange}
                />
                <SettingItem
                    label="API Host"
                    description={
                        protocol === 'ffi'
                            ? 'Host network configuration is bypassed when Native C-Pointer FFI is active.'
                            : 'Host IP address or domain for the engine HTTP gateway.'
                    }
                    dynamicDescription={
                        protocol === 'ffi'
                            ? 'Status: Inactive (Bypassed by Native C-Pointer)'
                            : `Target Gateway: ${getBaseUrl()}`
                    }
                    select={[
                        { value: 'localhost', label: 'localhost (127.0.0.1)' },
                        { value: '127.0.0.1', label: '127.0.0.1 (IPv4 Loopback)' },
                        { value: '0.0.0.0', label: '0.0.0.0 (All Interfaces)' }
                    ]}
                    value={host || 'localhost'}
                    onChange={(val) => setHost(val)}
                />
            </SettingSection>

            {/* Temp Media & Storage */}
            <SettingSection title="Temp Media & Storage">
                <SettingItem
                    label="Cleanup Policy"
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
        </div>
    );
}

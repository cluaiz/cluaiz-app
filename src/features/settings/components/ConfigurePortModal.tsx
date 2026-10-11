import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Server, Check, X, Loader2, RefreshCw } from 'lucide-react';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { systemApi } from '../../../api';
import { toast } from '../../../components/ui/toast';

interface ConfigurePortModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const ConfigurePortModal: React.FC<ConfigurePortModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const currentPort = useConnectionStore((s) => s.port);
    const host = useConnectionStore((s) => s.host);
    const setPort = useConnectionStore((s) => s.setPort);
    const initEngineSettings = useEngineStore((s) => s.initEngineSettings);

    const [selectedPort, setSelectedPort] = useState<number>(currentPort || 8000);
    const [customPortInput, setCustomPortInput] = useState<string>(String(currentPort || 8000));
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const presets = [
        { port: 8000, label: 'Port 8000', desc: 'Cluaiz CLI & Engine Default' },
        { port: 8080, label: 'Port 8080', desc: 'Standard API Gateway' },
    ];

    const handleSelectPreset = (p: number) => {
        setSelectedPort(p);
        setCustomPortInput(String(p));
        setTestStatus('idle');
        setStatusMessage(null);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        setCustomPortInput(val);
        const parsed = Number(val);
        if (parsed >= 1024 && parsed <= 65535) {
            setSelectedPort(parsed);
        }
        setTestStatus('idle');
        setStatusMessage(null);
    };

    const handleTestAndConnect = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const targetPort = Number(customPortInput);
        if (!targetPort || targetPort < 1024 || targetPort > 65535) {
            setTestStatus('failed');
            setStatusMessage('Please enter a valid port between 1024 and 65535.');
            return;
        }

        setIsTesting(true);
        setTestStatus('idle');
        setStatusMessage(`Probing Cluaiz Engine on port ${targetPort}...`);

        const previousPort = currentPort;
        try {
            // Dynamically set port on connection store for the centralized client
            setPort(targetPort);

            // Zero-hardcoding: centralized systemApi.getHealth() probe
            const health = await systemApi.getHealth();

            setTestStatus('success');
            setStatusMessage(`Connected! Engine: ${health?.engine || 'Cluaiz Engine'} (${health?.status || 'alive'})`);

            toast.success(`Port updated to ${targetPort}. Reconnecting...`);

            // Trigger engine settings re-sync
            await initEngineSettings();

            setTimeout(() => {
                if (onSuccess) onSuccess();
                onClose();
            }, 600);
        } catch {
            // Revert back to previous port if probe fails
            setPort(previousPort);
            setTestStatus('failed');
            setStatusMessage(`No active engine found listening on port ${targetPort}.`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveAnyway = async () => {
        const targetPort = Number(customPortInput);
        if (targetPort >= 1024 && targetPort <= 65535) {
            setPort(targetPort);
            toast.info(`Port set to ${targetPort}. Attempting connection...`);
            await initEngineSettings();
            if (onSuccess) onSuccess();
            onClose();
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="relative w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden p-6 text-left"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-[var(--accent-color)] flex items-center justify-center">
                                <Network className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                    Configure Engine Port
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Set the local port for Cluaiz Engine communication
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Presets */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                            Quick Presets
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {presets.map((preset) => {
                                const isSelected = selectedPort === preset.port;
                                return (
                                    <button
                                        key={preset.port}
                                        type="button"
                                        onClick={() => handleSelectPreset(preset.port)}
                                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--text-primary)] shadow-sm'
                                                : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full mb-1">
                                            <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                                                {preset.label}
                                            </span>
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-[var(--text-secondary)] leading-tight">
                                            {preset.desc}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Port Input */}
                    <form onSubmit={handleTestAndConnect} className="mb-5">
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                            Target Port (1024 - 65535)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={customPortInput}
                                onChange={handleCustomChange}
                                placeholder="8000"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-color)] transition-all"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                                <Server className="w-3.5 h-3.5" />
                                <span>{`http://${host === '0.0.0.0' || !host ? '127.0.0.1' : host}:${customPortInput || '...'}`}</span>
                            </div>
                        </div>

                        {/* Status message */}
                        {statusMessage && (
                            <div
                                className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                                    testStatus === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : testStatus === 'failed'
                                        ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                }`}
                            >
                                {isTesting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                                ) : testStatus === 'success' ? (
                                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                                ) : (
                                    <X className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                                <span className="leading-tight">{statusMessage}</span>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex items-center justify-end gap-2.5 mt-5">
                            {testStatus === 'failed' && (
                                <button
                                    type="button"
                                    onClick={handleSaveAnyway}
                                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-all cursor-pointer"
                                >
                                    Save Anyway
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3.5 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={isTesting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-color)] text-white hover:opacity-90 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                            >
                                {isTesting ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Check className="w-3.5 h-3.5" />
                                )}
                                Connect & Save
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

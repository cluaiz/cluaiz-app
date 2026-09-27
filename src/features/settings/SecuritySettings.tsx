import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingSection, SettingItem } from './SharedComponents';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Key, Copy, Check, Trash2, AlertTriangle, X } from 'lucide-react';

interface ApiAuth {
    required: boolean;
    tokens: string[];
}

interface PermissionData {
    require_login_on_boot?: boolean;
    api_key_storage?: string;
    api_auth?: ApiAuth;
    auto_execute_shell?: boolean;
    workspace_read_access?: boolean;
    wasm_firewall?: string;
    stream_telemetry?: boolean;
    model_header_info?: boolean;
    vectorize_user_input?: boolean;
    vectorize_ai_response?: boolean;
    enable_kvcache?: boolean;
    [key: string]: any;
}

interface ModalConfig {
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
}

const DESCRIPTIONS = {
    wasmFirewall: {
        'auto': 'Blocks dangerous plugins automatically based on heuristics.',
        'strict': 'Maximum security. All WASM plugins are heavily restricted.',
        'off': 'No restrictions. Use only with trusted plugins.'
    } as Record<string, string>,
    telemetry: {
        true: 'Enabled: Sending anonymous performance data.',
        false: 'Disabled: No data leaves your machine.'
    } as Record<string, string>,
    modelHeader: {
        true: 'Enabled: Injects model name and type tags (e.g. <cluaiz_model_name>) directly into the chat SSE stream for client apps to parse.',
        false: 'Disabled: The chat stream will only contain raw generated text without any model metadata headers.'
    } as Record<string, string>,
    vecUser: {
        true: 'Enabled: Your inputs are vectorized and stored in semantic memory.',
        false: 'Disabled: Your inputs are not saved to semantic memory.'
    } as Record<string, string>,
    vecAi: {
        true: 'Enabled: AI responses are vectorized and stored in semantic memory.',
        false: 'Disabled: AI responses are not saved to semantic memory.'
    } as Record<string, string>,
    kvCache: {
        true: 'Enabled: Allows models to cache conversation state in memory for faster responses.',
        false: 'Disabled: Models process the entire conversation history from scratch every time.'
    } as Record<string, string>
};

const KEYSTORE_OPTIONS = [
    { value: 'system', label: 'System Keychain (Secure)' },
    { value: 'env', label: '.env File (Legacy)' },
    { value: 'memory', label: 'In-Memory (Erased on exit)' }
];

const WASM_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: 'strict', label: 'Strict' },
    { value: 'off', label: 'Off' }
];

export function SecuritySettings() {
    const getBaseUrl = useConnectionStore((s) => s.getBaseUrl);

    const [permData, setPermData] = useState<PermissionData>({
        require_login_on_boot: false,
        api_key_storage: 'system',
        api_auth: { required: false, tokens: [] },
        auto_execute_shell: false,
        workspace_read_access: true,
        wasm_firewall: 'auto',
        stream_telemetry: false,
        model_header_info: false,
        vectorize_user_input: true,
        vectorize_ai_response: true,
        enable_kvcache: true
    });

    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

    // Load permissions from Engine on mount
    const fetchPermissions = useCallback(async () => {
        try {
            const res = await fetch(`${getBaseUrl()}/v1/system/permission`);
            if (res.ok) {
                const data = await res.json();
                if (data.permission) {
                    setPermData((prev) => ({
                        ...prev,
                        ...data.permission,
                        api_auth: {
                            required: data.permission.api_auth?.required ?? false,
                            tokens: Array.isArray(data.permission.api_auth?.tokens) ? data.permission.api_auth.tokens : []
                        }
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to load permission settings:', e);
        }
    }, [getBaseUrl]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    // Update permission and sync with Engine
    const updatePermission = async (key: string, value: any) => {
        const nextState = {
            ...permData,
            [key]: value
        };
        setPermData(nextState);

        try {
            await fetch(`${getBaseUrl()}/v1/system/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextState)
            });
        } catch (e) {
            console.error('Failed to update permission setting:', e);
        }
    };

    // Copy token to clipboard with temporary feedback
    const handleCopyToken = (token: string) => {
        navigator.clipboard.writeText(token);
        setCopiedToken(token);
        setTimeout(() => {
            setCopiedToken(null);
        }, 2000);
    };

    // Toggle API Auth with safety confirmation
    const handleToggleApiAuth = () => {
        const isCurrentlyActive = permData.api_auth?.required === true;
        const action = isCurrentlyActive ? 'Disable' : 'Enable';
        const message = isCurrentlyActive
            ? 'Are you sure you want to disable API Authentication? The engine will accept requests without a Bearer token.'
            : 'Are you sure you want to enable API Authentication? All HTTP REST requests will require a valid Bearer token.';

        setModalConfig({
            title: `${action} API Authentication`,
            message,
            confirmText: action,
            isDestructive: isCurrentlyActive,
            onConfirm: async () => {
                const updatedAuth: ApiAuth = {
                    required: !isCurrentlyActive,
                    tokens: permData.api_auth?.tokens || []
                };
                await updatePermission('api_auth', updatedAuth);
                setModalConfig(null);
            }
        });
    };

    // Generate or Regenerate API Key
    const handleGenerateKey = () => {
        const currentTokens = permData.api_auth?.tokens || [];
        if (currentTokens.length > 0) {
            setModalConfig({
                title: 'Regenerate Key',
                message: 'Are you sure you want to regenerate the API key? The old key will immediately stop working and applications using it will lose access.',
                confirmText: 'Regenerate',
                isDestructive: true,
                onConfirm: async () => {
                    const newToken = 'sk-cluaiz-' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
                        .map(b => b.toString(16).padStart(2, '0')).join('');
                    const updatedAuth: ApiAuth = {
                        required: permData.api_auth?.required ?? false,
                        tokens: [newToken]
                    };
                    await updatePermission('api_auth', updatedAuth);
                    setModalConfig(null);
                }
            });
            return;
        }

        const newToken = 'sk-cluaiz-' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        const updatedAuth: ApiAuth = {
            required: permData.api_auth?.required ?? false,
            tokens: [newToken]
        };
        updatePermission('api_auth', updatedAuth);
    };

    // Revoke key confirmation
    const handleRevokeKey = (token: string) => {
        setModalConfig({
            title: 'Revoke Key',
            message: `Are you sure you want to revoke key ...${token.slice(-6)}? This will break any integration using it.`,
            confirmText: 'Revoke',
            isDestructive: true,
            onConfirm: async () => {
                const currentTokens = permData.api_auth?.tokens || [];
                const updatedAuth: ApiAuth = {
                    required: permData.api_auth?.required ?? false,
                    tokens: currentTokens.filter(t => t !== token)
                };
                await updatePermission('api_auth', updatedAuth);
                setModalConfig(null);
            }
        });
    };

    const tokens = permData.api_auth?.tokens || [];
    const hasTokens = tokens.length > 0;

    return (
        <div className="space-y-8 select-none">
            {/* 1. Security & SSO */}
            <SettingSection title="Security & SSO">
                <SettingItem
                    label="Require Login on Boot"
                    description="Ask for biometric or master password when opening the developer hub."
                    toggle
                    active={permData.require_login_on_boot === true}
                    onToggle={() => updatePermission('require_login_on_boot', !permData.require_login_on_boot)}
                />
                <SettingItem
                    label="API Key Storage"
                    description="Where third-party API keys are stored locally."
                    select={KEYSTORE_OPTIONS}
                    value={permData.api_key_storage || 'system'}
                    onChange={(val) => updatePermission('api_key_storage', val)}
                />
            </SettingSection>

            {/* 2. API Keys (Bearer Tokens) */}
            <SettingSection title="API Keys (Bearer Tokens)">
                <SettingItem
                    label="Require API Authentication"
                    description="Enforce Bearer Token authorization for all HTTP REST requests to the engine."
                    toggle
                    active={permData.api_auth?.required === true}
                    onToggle={handleToggleApiAuth}
                />

                <SettingItem
                    label="Manage Engine API Keys"
                    description="Generate a Bearer Token to securely access the engine via HTTP REST."
                >
                    <button
                        onClick={handleGenerateKey}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--text-primary)]/10 text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <Key size={14} className="text-[var(--accent-color)]" />
                        <span>{hasTokens ? 'Regenerate Key' : 'Generate Key'}</span>
                    </button>
                </SettingItem>

                {/* Token List / Empty State */}
                <div className="border-t border-[var(--border-color)]">
                    {tokens.length === 0 ? (
                        <div className="px-6 py-4 text-xs text-[var(--text-muted)] italic">
                            No API keys generated yet.
                        </div>
                    ) : (
                        <div className="p-4 space-y-2">
                            {tokens.map((token) => (
                                <div
                                    key={token}
                                    className="flex items-center justify-between px-4 py-3 bg-[var(--bg-primary)]/70 border border-[var(--border-color)] rounded-xl transition-all hover:border-[var(--accent-color)]/30 group"
                                >
                                    <span className="font-mono text-xs text-[var(--text-primary)] tracking-wide select-all">
                                        {token}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleCopyToken(token)}
                                            className="p-1.5 rounded-lg hover:bg-[var(--text-primary)]/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                            title="Copy Token"
                                        >
                                            {copiedToken === token ? (
                                                <Check size={14} className="text-emerald-400" />
                                            ) : (
                                                <Copy size={14} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleRevokeKey(token)}
                                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer"
                                            title="Revoke Token"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SettingSection>

            {/* 3. Agent Permissions */}
            <SettingSection title="Agent Permissions">
                <SettingItem
                    label="Auto-execute Shell Commands"
                    description="Allow autonomous agents to run commands without prompting. (DANGEROUS)"
                    toggle
                    active={permData.auto_execute_shell === true}
                    onToggle={() => updatePermission('auto_execute_shell', !permData.auto_execute_shell)}
                />
                <SettingItem
                    label="Workspace Read Access"
                    description="Allow agents to read files in the entire active workspace."
                    toggle
                    active={permData.workspace_read_access === true}
                    onToggle={() => updatePermission('workspace_read_access', !permData.workspace_read_access)}
                />
            </SettingSection>

            {/* 4. Engine Security & Privacy */}
            <SettingSection title="Engine Security & Privacy">
                <SettingItem
                    label="WASM Firewall Mode"
                    description="Configure security isolation for dynamic WebAssembly extensions."
                    dynamicDescription={DESCRIPTIONS.wasmFirewall[permData.wasm_firewall || 'auto']}
                    select={WASM_OPTIONS}
                    value={permData.wasm_firewall || 'auto'}
                    onChange={(val) => updatePermission('wasm_firewall', val)}
                />
                <SettingItem
                    label="Stream Telemetry"
                    description="Control performance and diagnostic metrics streaming."
                    dynamicDescription={DESCRIPTIONS.telemetry[String(permData.stream_telemetry === true)]}
                    toggle
                    active={permData.stream_telemetry === true}
                    onToggle={() => updatePermission('stream_telemetry', !permData.stream_telemetry)}
                />
                <SettingItem
                    label="Model Header"
                    description="Inject model identity metadata headers into chat SSE streams."
                    dynamicDescription={DESCRIPTIONS.modelHeader[String(permData.model_header_info === true)]}
                    toggle
                    active={permData.model_header_info === true}
                    onToggle={() => updatePermission('model_header_info', !permData.model_header_info)}
                />
            </SettingSection>

            {/* 5. Context & Memory Permissions */}
            <SettingSection title="Context & Memory Permissions">
                <SettingItem
                    label="Vectorize User Input"
                    description="Control semantic vectorization of incoming user prompts."
                    dynamicDescription={DESCRIPTIONS.vecUser[String(permData.vectorize_user_input === true)]}
                    toggle
                    active={permData.vectorize_user_input === true}
                    onToggle={() => updatePermission('vectorize_user_input', !permData.vectorize_user_input)}
                />
                <SettingItem
                    label="Vectorize AI Response"
                    description="Control semantic vectorization of generated model outputs."
                    dynamicDescription={DESCRIPTIONS.vecAi[String(permData.vectorize_ai_response === true)]}
                    toggle
                    active={permData.vectorize_ai_response === true}
                    onToggle={() => updatePermission('vectorize_ai_response', !permData.vectorize_ai_response)}
                />
                <SettingItem
                    label="Enable KV Cache"
                    description="Enable KV cache retention across conversational turns for lower latency."
                    dynamicDescription={DESCRIPTIONS.kvCache[String(permData.enable_kvcache === true)]}
                    toggle
                    active={permData.enable_kvcache === true}
                    onToggle={() => updatePermission('enable_kvcache', !permData.enable_kvcache)}
                />
            </SettingSection>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {modalConfig && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-2 rounded-xl ${modalConfig.isDestructive ? 'bg-rose-500/10 text-rose-400' : 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'}`}>
                                        <AlertTriangle size={18} />
                                    </div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                        {modalConfig.title}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setModalConfig(null)}
                                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                {modalConfig.message}
                            </p>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalConfig(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={modalConfig.onConfirm}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                                        modalConfig.isDestructive
                                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                                            : 'bg-[var(--accent-color)] hover:brightness-110 text-white shadow-[var(--accent-color)]/20'
                                    }`}
                                >
                                    {modalConfig.confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

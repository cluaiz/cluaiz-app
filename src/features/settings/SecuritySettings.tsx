import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingSection, SettingItem } from './SharedComponents';
import { useEngineStore } from '../../store/engine/useEngineStore';
import { Key, Copy, Check, Trash2, Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { toast } from '../../components/ui/toast';

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
        true: 'Enabled: Injects model name and type tags directly into the chat stream for client apps to parse.',
        false: 'Disabled: The chat stream will only contain raw generated text without metadata headers.'
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
    const permissions = useEngineStore((s) => s.permissions);
    const fetchStatus = useEngineStore((s) => s.fetchStatus);
    const toggleApiAuth = useEngineStore((s) => s.toggleApiAuth);
    const generateApiKey = useEngineStore((s) => s.generateApiKey);
    const revokeApiKey = useEngineStore((s) => s.revokeApiKey);
    const updateAgentSecurityMode = useEngineStore((s) => s.updateAgentSecurityMode);
    const updateFirewall = useEngineStore((s) => s.updateFirewall);
    const updateTelemetry = useEngineStore((s) => s.updateTelemetry);
    const updateVectorizeUserInput = useEngineStore((s) => s.updateVectorizeUserInput);
    const updateVectorizeAiResponse = useEngineStore((s) => s.updateVectorizeAiResponse);
    const updateKvCache = useEngineStore((s) => s.updateKvCache);
    const updateModelHeaderInfo = useEngineStore((s) => s.updateModelHeaderInfo);
    const updatePermission = useEngineStore((s) => s.updatePermission);
    const pendingKeys = useEngineStore((s) => s.pendingKeys || {});

    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
    const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
    const [pendingMode, setPendingMode] = useState<string | null>(null);

    const isEngineOnline = permissions !== null && fetchStatus === 'success';

    const handleSelectSecurityMode = async (modeId: 'full_access' | 'sandboxed' | 'strict') => {
        if (permissions?.agent_security_mode === modeId) return;
        setPendingMode(modeId);
        try {
            await updateAgentSecurityMode(modeId);
        } finally {
            setPendingMode(null);
        }
    };

    const toggleTokenVisibility = (token: string) => {
        setVisibleTokens((prev) => ({
            ...prev,
            [token]: !prev[token]
        }));
    };

    const handleCopyToken = (token: string) => {
        navigator.clipboard.writeText(token);
        setCopiedToken(token);
        toast.info('API token copied to clipboard');
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const handleToggleApiAuth = () => {
        const isCurrentlyActive = permissions?.api_auth?.required === true;
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
                try {
                    await toggleApiAuth();
                } catch (err: any) {
                    // Handled by toast.promise in useEngineStore
                } finally {
                    setModalConfig(null);
                }
            }
        });
    };

    const tokens = permissions?.api_auth?.tokens || [];
    const hasTokens = tokens.length > 0;
    const MAX_API_KEYS = 5;
    const isMaxKeysReached = tokens.length >= MAX_API_KEYS;

    const handleGenerateKey = async () => {
        if (isMaxKeysReached) {
            toast.error(`Maximum limit of ${MAX_API_KEYS} API keys reached. Revoke an existing key first.`);
            return;
        }
        try {
            await generateApiKey();
        } catch {
            // Handled by toast.promise in useEngineStore
        }
    };

    const handleRevokeKey = (token: string) => {
        const isLastToken = (permissions?.api_auth?.tokens || []).length <= 1;
        setModalConfig({
            title: isLastToken ? 'Revoke Last API Key' : 'Revoke Key',
            message: isLastToken
                ? `Are you sure you want to revoke key ...${token.slice(-6)}? As this is the last active key, revoking it will automatically disable "Require API Authentication" so you do not get locked out of the engine.`
                : `Are you sure you want to revoke key ...${token.slice(-6)}? This will immediately break any external script or integration using this key.`,
            confirmText: isLastToken ? 'Revoke & Disable Auth' : 'Revoke',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await revokeApiKey(token);
                } catch {
                    // Handled by toast.promise in useEngineStore
                } finally {
                    setModalConfig(null);
                }
            }
        });
    };

    return (
        <div className="space-y-8 select-none">
            {!isEngineOnline && (
                <AlertBanner
                    variant="warning"
                    title="Engine is offline or unreachable"
                    message="Please ensure the Cluaiz Engine is running to sync and persist settings to disk. Changes cannot be saved while offline."
                />
            )}

            {/* 0. Agent Security Mode (HITL) */}
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--border-color)] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center font-bold">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Agent Execution Security Mode</h3>
                        <p className="text-xs text-[var(--text-secondary)]">Controls how the AI Agent executes system tools, scripts, and file modifications.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {[
                        {
                            id: 'full_access' as const,
                            title: 'Full Access',
                            badge: 'Autonomous',
                            desc: 'Agent executes all tools and file changes automatically without confirmation prompts.'
                        },
                        {
                            id: 'sandboxed' as const,
                            title: 'Workspace-Gated',
                            badge: 'Recommended',
                            desc: 'Safe workspace reads execute automatically. Writes, outside-jail access, and undeclared capabilities require user approval.'
                        },
                        {
                            id: 'strict' as const,
                            title: 'Strict Approval',
                            badge: 'Maximum Safety',
                            desc: 'Every tool execution and write pauses for explicit user approval. Access outside active workspace jail is hard-blocked (403).'
                        }
                    ].map((item) => {
                        const isSelected = (permissions?.agent_security_mode || 'sandboxed') === item.id;
                        const isCardPending = pendingMode === item.id || (isSelected && Boolean(pendingKeys['agent_security_mode']));
                        const isAnyModePending = pendingMode !== null || Boolean(pendingKeys['agent_security_mode']);
                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={isAnyModePending || !isEngineOnline}
                                onClick={() => handleSelectSecurityMode(item.id)}
                                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer disabled:opacity-60 ${
                                    isSelected
                                        ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] shadow-sm'
                                        : 'bg-[var(--bg-primary)]/40 border-[var(--border-color)] hover:border-[var(--accent-color)]/40'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className={`text-xs font-bold flex items-center gap-1.5 ${isSelected ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>
                                        {item.title}
                                        {isCardPending && (
                                            <Loader2 size={12} className="animate-spin text-[var(--accent-color)]" />
                                        )}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                                        {item.badge}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    {item.desc}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 1. Security & SSO */}
            <SettingSection title="Security & SSO">
                <SettingItem
                    label="Require Login on Boot"
                    description="Ask for biometric or master password when opening the developer hub."
                    toggle
                    active={permissions?.require_login_on_boot === true}
                    onToggle={() => updatePermission('require_login_on_boot', !permissions?.require_login_on_boot)}
                    loading={Boolean(pendingKeys['require_login_on_boot'])}
                    disabled={Boolean(pendingKeys['require_login_on_boot']) || !isEngineOnline}
                />
                <SettingItem
                    label="API Key Storage"
                    description="Where third-party API keys are stored locally."
                    select={KEYSTORE_OPTIONS}
                    value={permissions?.api_key_storage || 'system'}
                    onChange={(val) => updatePermission('api_key_storage', val)}
                    loading={Boolean(pendingKeys['api_key_storage'])}
                    disabled={Boolean(pendingKeys['api_key_storage']) || !isEngineOnline}
                />
            </SettingSection>

            {/* 2. API Keys (Bearer Tokens) */}
            <SettingSection title="API Keys (Bearer Tokens)">
                <SettingItem
                    label="Require API Authentication"
                    description="Enforce Bearer Token authorization for all HTTP REST requests to the engine."
                    toggle
                    active={permissions?.api_auth?.required === true}
                    onToggle={handleToggleApiAuth}
                    loading={Boolean(pendingKeys['api_auth'])}
                    disabled={Boolean(pendingKeys['api_auth']) || !isEngineOnline}
                />

                <AnimatePresence>
                    {permissions?.api_auth?.required === true && (
                        <motion.div
                            key="api-keys-manager-panel"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-[var(--border-color)]"
                        >
                            <SettingItem
                                label={`Manage Engine API Keys (${tokens.length}/${MAX_API_KEYS})`}
                                description={
                                    isMaxKeysReached
                                        ? `Maximum limit of ${MAX_API_KEYS} keys reached. Revoke an existing key to generate a new one.`
                                        : 'Generate a Bearer Token to securely access the engine via HTTP REST.'
                                }
                            >
                                <button
                                    onClick={handleGenerateKey}
                                    disabled={isMaxKeysReached || Boolean(pendingKeys['generate_token']) || !isEngineOnline}
                                    className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--text-primary)]/10 text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isMaxKeysReached ? `Maximum limit of ${MAX_API_KEYS} keys reached` : undefined}
                                >
                                    {Boolean(pendingKeys['generate_token']) ? (
                                        <Loader2 size={14} className="animate-spin text-[var(--accent-color)]" />
                                    ) : (
                                        <Key size={14} className="text-[var(--accent-color)]" />
                                    )}
                                    <span>{isMaxKeysReached ? `Max Keys Reached (${MAX_API_KEYS})` : 'Generate New Key'}</span>
                                </button>
                            </SettingItem>

                            {/* Token List / Empty State */}
                            <div className="border-t border-[var(--border-color)]">
                                {tokens.length === 0 ? (
                                    <div className="px-6 py-4 text-xs text-[var(--text-muted)] italic">
                                        No API keys generated yet.
                                    </div>
                                ) : (
                                    <div className="p-4 max-h-[240px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                                        {tokens.map((token) => {
                                            const isVisible = visibleTokens[token] === true;
                                            const masked = token.length > 16
                                                ? `${token.slice(0, 10)}${'•'.repeat(16)}${token.slice(-6)}`
                                                : '••••••••••••••••';
                                            return (
                                                <div
                                                    key={token}
                                                    className="flex items-center justify-between px-4 py-3 bg-[var(--bg-primary)]/70 border border-[var(--border-color)] rounded-xl transition-all hover:border-[var(--accent-color)]/30 group"
                                                >
                                                    <span className="font-mono text-xs text-[var(--text-primary)] tracking-wide select-all">
                                                        {isVisible ? token : masked}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => toggleTokenVisibility(token)}
                                                            className="p-1.5 rounded-lg hover:bg-[var(--text-primary)]/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                                            title={isVisible ? "Hide Token" : "Show Token"}
                                                        >
                                                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                                        </button>
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
                                                            disabled={Boolean(pendingKeys[`revoke_token_${token}`]) || !isEngineOnline}
                                                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                                                            title="Revoke Token"
                                                        >
                                                            {Boolean(pendingKeys[`revoke_token_${token}`]) ? (
                                                                <Loader2 size={14} className="animate-spin text-rose-400" />
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SettingSection>

            {/* 3. Agent Permissions */}
            <SettingSection title="Agent Permissions">
                <SettingItem
                    label="Auto-execute Shell Commands"
                    description="Allow autonomous agents to run commands without prompting. (DANGEROUS)"
                    toggle
                    active={permissions?.auto_execute_shell === true}
                    onToggle={() => updatePermission('auto_execute_shell', !permissions?.auto_execute_shell)}
                    loading={Boolean(pendingKeys['auto_execute_shell'])}
                    disabled={Boolean(pendingKeys['auto_execute_shell']) || !isEngineOnline}
                />
                <SettingItem
                    label="Workspace Read Access"
                    description="Allow agents to read files in the entire active workspace."
                    toggle
                    active={permissions?.workspace_read_access === true}
                    onToggle={() => updatePermission('workspace_read_access', !permissions?.workspace_read_access)}
                    loading={Boolean(pendingKeys['workspace_read_access'])}
                    disabled={Boolean(pendingKeys['workspace_read_access']) || !isEngineOnline}
                />
            </SettingSection>

            {/* 4. Engine Security & Privacy */}
            <SettingSection title="Engine Security & Privacy">
                <SettingItem
                    label="WASM Firewall Mode"
                    description="Configure security isolation for dynamic WebAssembly extensions."
                    dynamicDescription={DESCRIPTIONS.wasmFirewall[permissions?.wasm_firewall || 'auto']}
                    select={WASM_OPTIONS}
                    value={permissions?.wasm_firewall || 'auto'}
                    onChange={(val) => updateFirewall(val as any)}
                    loading={Boolean(pendingKeys['wasm_firewall'])}
                    disabled={Boolean(pendingKeys['wasm_firewall']) || !isEngineOnline}
                />
                <SettingItem
                    label="Stream Telemetry"
                    description="Control performance and diagnostic metrics streaming."
                    dynamicDescription={DESCRIPTIONS.telemetry[String(permissions?.stream_telemetry === true)]}
                    toggle
                    active={permissions?.stream_telemetry === true}
                    onToggle={() => updateTelemetry(!permissions?.stream_telemetry)}
                    loading={Boolean(pendingKeys['stream_telemetry'])}
                    disabled={Boolean(pendingKeys['stream_telemetry']) || !isEngineOnline}
                />
                <SettingItem
                    label="Model Header"
                    description="Inject model identity metadata headers into chat SSE streams."
                    dynamicDescription={DESCRIPTIONS.modelHeader[String(permissions?.model_header_info === true)]}
                    toggle
                    active={permissions?.model_header_info === true}
                    onToggle={() => updateModelHeaderInfo(!permissions?.model_header_info)}
                    loading={Boolean(pendingKeys['model_header_info'])}
                    disabled={Boolean(pendingKeys['model_header_info']) || !isEngineOnline}
                />
            </SettingSection>

            {/* 5. Context & Memory Permissions */}
            <SettingSection title="Context & Memory Permissions">
                <SettingItem
                    label="Vectorize User Input"
                    description="Automatically creates embedding vectors for incoming user prompts."
                    dynamicDescription={DESCRIPTIONS.vecUser[String(permissions?.vectorize_user_input === true)]}
                    toggle
                    active={permissions?.vectorize_user_input === true}
                    onToggle={() => updateVectorizeUserInput(!permissions?.vectorize_user_input)}
                    loading={Boolean(pendingKeys['vectorize_user_input'])}
                    disabled={Boolean(pendingKeys['vectorize_user_input']) || !isEngineOnline}
                />
                <SettingItem
                    label="Vectorize AI Responses"
                    description="Embeds output responses into the local neural vector store."
                    dynamicDescription={DESCRIPTIONS.vecAi[String(permissions?.vectorize_ai_response === true)]}
                    toggle
                    active={permissions?.vectorize_ai_response === true}
                    onToggle={() => updateVectorizeAiResponse(!permissions?.vectorize_ai_response)}
                    loading={Boolean(pendingKeys['vectorize_ai_response'])}
                    disabled={Boolean(pendingKeys['vectorize_ai_response']) || !isEngineOnline}
                />
                <SettingItem
                    label="Key-Value Cache (KV Cache)"
                    description="Accelerates multi-turn chat sessions by caching model state."
                    dynamicDescription={DESCRIPTIONS.kvCache[String(permissions?.enable_kvcache === true)]}
                    toggle
                    active={permissions?.enable_kvcache === true}
                    onToggle={() => updateKvCache(!permissions?.enable_kvcache)}
                    loading={Boolean(pendingKeys['enable_kvcache'])}
                    disabled={Boolean(pendingKeys['enable_kvcache']) || !isEngineOnline}
                />
            </SettingSection>

            {/* Confirmation / Alert Modal */}
            <AnimatePresence>
                {modalConfig && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4"
                        >
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                {modalConfig.title}
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {modalConfig.message}
                            </p>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalConfig(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--text-primary)]/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={modalConfig.onConfirm}
                                    className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                                        modalConfig.isDestructive
                                            ? 'bg-rose-500 hover:bg-rose-600 text-white'
                                            : 'bg-[var(--accent-color)] hover:opacity-90 text-white'
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

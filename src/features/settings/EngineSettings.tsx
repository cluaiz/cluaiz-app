import { useState, useEffect, useMemo } from 'react';
import { useEngineStore, InstalledModelDetail } from '../../store/engine/useEngineStore';
import { SettingSection, SettingItem, SelectOption } from './SharedComponents';
import { validateSettings, getOverallHealth } from './SettingsHealthValidator';
import { ModelInfoCard } from './ModelInfoCard';
import { ModelInspectorModal } from './ModelInspectorModal';
import { CustomDropdown, DropdownOption } from '../../components/ui/dropdown/CustomDropdown';
import { Loader2 } from 'lucide-react';

const DESC_CONTEXT: Record<string, string> = {
    'Auto': 'System dynamically balances memory consumption and chat history retention.',
    'Off': 'Disables dynamic memory compression. The engine may crash if the conversation becomes excessively long.',
    'Minimal': 'Only retains the current topic and flushes older context (Saves maximum RAM).',
    'Standard': 'Best balance for everyday chats. Retains important older messages while freeing up unused memory.',
    'Aggressive': 'Attempts to compress and retain the entire conversation history. Requires higher CPU processing power.',
    'Extreme': 'Retains absolute context without forgetting. Demands maximum CPU and memory resources.'
};

const DESC_BRAIN_MODE = (active: boolean) => active ? 'Enabled: LLM is completely turned off. Only database and tools will run.' : 'Disabled: Normal mode. Generative AI is active.';
const DESC_LAZY_LOAD = (active: boolean) => active ? 'Enabled: Model loads only on first message. Saves RAM while idle.' : 'Disabled: Model loads instantly on startup.';
const DESC_MLOCK: Record<string, string> = { 'Auto': 'System decides based on RAM availability.', 'On': 'Forces the OS to lock the model in RAM. Prevents swapping and stuttering.', 'Off': 'Allows the OS to swap memory if needed.' };
const DESC_BOOSTER_PROFILE: Record<string, string> = { 'balance': 'Balances speed, memory, and CPU usage.', 'multitasking': 'Leaves room for background apps.', 'max_boost': 'High performance, uses more resources.', 'ultra_max_boost': 'Extreme performance, will lag background apps.', 'hyper_cluster': 'For multi-GPU setups only.', 'edge': 'Optimized for low-power devices and laptops.' };
const DESC_FLASH_ATTN: Record<string, string> = { 'Auto': 'System uses Flash Attention if supported by your hardware.', 'On': 'Forces Flash Attention. Very fast for long contexts.', 'Off': 'Disables Flash Attention. Useful if the model hallucinates.' };
const DESC_KV_QUANT: Record<string, string> = { 'Auto': 'System decides the best quantization level.', 'Kv16': 'Highest quality, uses more RAM.', 'Kv8': 'Good balance of quality and RAM usage.', 'Kv4': 'Maximum compression. Saves massive RAM but may reduce long-context quality slightly.' };
const DESC_SPEC_DEC: Record<string, string> = { 'Auto': 'System decides whether to use a draft model.', 'On': 'Accelerates inference using secondary draft models or lookup tables.', 'Off': 'Generates token-by-token normally.' };
const DESC_MOE: Record<string, string> = { 'Auto': 'System decides MoE expert routing.', 'On': 'Zero-RAM out-of-core streaming for MoE models directly from NVMe SSD with DMA staging.', 'Off': 'Standard in-memory MoE execution.' };
const DESC_HYBRID_MEMORY: Record<string, string> = { 'Auto': 'Dynamically balances layers across VRAM and host RAM.', 'On': 'Forces unified allocation across VRAM and RAM.', 'Off': 'Strict device boundaries.' };

export function EngineSettings() {
    const [activeSubTab, setActiveSubTab] = useState<'models' | 'optimization'>('models');
    const [inspectingModel, setInspectingModel] = useState<InstalledModelDetail | null>(null);

    const {
        fetchStatus,
        permissions,
        booster,
        brainMode,
        hardware,
        installedModelsMap,
        pendingKeys,
        initEngineSettings,
        updatePermission,
        updateBooster,
        updateBoosterBuffer,
        updateModelSlot,
        setBrainMode,
        resetBooster,
    } = useEngineStore();

    const activeChatModel = useEngineStore((s) => s.activeChatModel);
    const activeVectorModel = useEngineStore((s) => s.activeVectorModel);

    const alerts = useMemo(() => {
        if (!booster) return [];
        return validateSettings(booster, hardware, activeChatModel, activeVectorModel);
    }, [booster, hardware, activeChatModel, activeVectorModel]);
    const overallHealth = getOverallHealth(alerts);

    useEffect(() => {
        if (fetchStatus === 'idle') {
            initEngineSettings();
        }
    }, [fetchStatus, initEngineSettings]);

    if (fetchStatus === 'loading' || fetchStatus === 'idle') {
        return (
            <div className="flex h-full items-center justify-center text-gray-400">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium">Connecting to cluaiz Engine natively...</p>
                </div>
            </div>
        );
    }

    if (fetchStatus === 'error' || !permissions || !booster) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl max-w-md text-center space-y-4">
                    <h3 className="text-lg font-bold text-red-300">Engine Disconnected</h3>
                    <p className="text-sm opacity-80">
                        Could not load engine settings. Ensure the cluaiz Engine background daemon is running or click retry.
                    </p>
                    <button onClick={initEngineSettings} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // ── Helper to resolve model details with heuristics & fallback ──
    const resolveModel = (id?: string): InstalledModelDetail | undefined => {
        if (!id) return undefined;
        if (installedModelsMap[id]) return installedModelsMap[id];
        const lower = id.toLowerCase();
        const found = Object.values(installedModelsMap).find(m =>
            m.id.toLowerCase() === lower ||
            (m.id && id.toLowerCase().includes(m.id.toLowerCase())) ||
            (m.id && m.id.toLowerCase().includes(id.toLowerCase()))
        );
        if (found) return found;

        // Clean fallback so card renders immediately when a model is selected
        const format = id.toLowerCase().includes('onnx') ? 'onnx' : 'gguf';
        return {
            id,
            category: 'chat',
            format_type: format,
            huggingface_repo: id.includes('/') ? id : '',
            local_dir: '',
            files: [],
            supported_tasks: ['text-generation', 'chat-completion'],
            requires_gpu: true,
            metadata: {
                architecture: id.split('-')[0] || id,
                parameters: 'Unknown',
                context_window: '131072',
                quantization: id.toLowerCase().includes('q4') ? '15' : 'Standard',
                bit_depth: 'N/A'
            }
        };
    };

    // ── Model Options for the 5 Dedicated Slots (Exact Developer Hub Parity) ──
    const chatModelOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [{ value: '', label: 'None (Unloaded)' }];
        const models = permissions.available_chat_models?.length
            ? permissions.available_chat_models
            : Object.keys(installedModelsMap).filter(id => {
                const m = installedModelsMap[id];
                return m.category === 'chat' || (!m.category && !id.includes('embed') && !id.includes('whisper') && !id.includes('tts') && !id.includes('ocr'));
            });
        models.forEach(id => {
            if (!list.find(o => o.value === id)) list.push({ value: id, label: id });
        });
        return list;
    }, [permissions.available_chat_models, installedModelsMap]);

    const vectorModelOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [{ value: '', label: 'None (Unloaded)' }];
        const models = permissions.available_vector_models?.length
            ? permissions.available_vector_models
            : Object.keys(installedModelsMap).filter(id => {
                const m = installedModelsMap[id];
                return m.category === 'embedding' || id.includes('embed') || id.includes('bge') || id.includes('nomic') || id.includes('minilm');
            });
        models.forEach(id => {
            if (!list.find(o => o.value === id)) list.push({ value: id, label: id });
        });
        return list;
    }, [permissions.available_vector_models, installedModelsMap]);

    const ingestModelOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [{ value: '', label: 'None (Unloaded)' }];
        const models = permissions.available_vision_ingest_models?.length
            ? permissions.available_vision_ingest_models
            : Object.keys(installedModelsMap).filter(id => {
                const m = installedModelsMap[id];
                return m.category === 'ingest' || m.category === 'vision' || id.includes('ocr') || id.includes('nougat') || id.includes('florence') || id.includes('table');
            });
        models.forEach(id => {
            if (!list.find(o => o.value === id)) list.push({ value: id, label: id });
        });
        return list;
    }, [permissions.available_vision_ingest_models, installedModelsMap]);

    const ttsModelOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [{ value: '', label: 'None (Unloaded)' }];
        const models = permissions.available_tts_models?.length
            ? permissions.available_tts_models
            : Object.keys(installedModelsMap).filter(id => {
                const m = installedModelsMap[id];
                return m.category === 'tts' || id.includes('kokoro') || id.includes('piper') || id.includes('melotts') || id.includes('tts');
            });
        models.forEach(id => {
            if (!list.find(o => o.value === id)) list.push({ value: id, label: id });
        });
        return list;
    }, [permissions.available_tts_models, installedModelsMap]);

    const sttModelOptions: DropdownOption[] = useMemo(() => {
        const list: DropdownOption[] = [{ value: '', label: 'None (Unloaded)' }];
        const models = permissions.available_stt_models?.length
            ? permissions.available_stt_models
            : Object.keys(installedModelsMap).filter(id => {
                const m = installedModelsMap[id];
                return m.category === 'stt' || m.category === 'audio' || id.includes('whisper') || id.includes('moonshine') || id.includes('sensevoice');
            });
        models.forEach(id => {
            if (!list.find(o => o.value === id)) list.push({ value: id, label: id });
        });
        return list;
    }, [permissions.available_stt_models, installedModelsMap]);

    // ── Active Selected IDs for each slot ──
    const currentChatId = permissions.chat_models?.text || '';
    const currentVectorId = permissions.vector_models?.text || '';
    const currentIngestId = permissions.ingest_models?.vision || '';
    const currentTtsId = permissions.tts_models?.audio || '';
    const currentSttId = permissions.stt_models?.audio || '';

    const currentChatModel = resolveModel(currentChatId);
    const currentVectorModel = resolveModel(currentVectorId);
    const currentIngestModel = resolveModel(currentIngestId);
    const currentTtsModel = resolveModel(currentTtsId);
    const currentSttModel = resolveModel(currentSttId);

    const healthColors = {
        green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'All Systems Nominal' },
        yellow: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Warnings Detected' },
        red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400', label: 'Critical Issues' },
    };
    const hc = healthColors[overallHealth];

    return (
        <div className="space-y-6 select-none pb-12 font-sans">
            {/* ── Sub-tabs Header: Models & Paths vs LLM Optimization ── */}
            <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl w-fit">
                <button
                    type="button"
                    onClick={() => setActiveSubTab('models')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeSubTab === 'models'
                            ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                    Models & Paths
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSubTab('optimization')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeSubTab === 'optimization'
                            ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                    LLM Optimization
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SUBTAB 1: Models & Paths (Exact Hub Parity)                          */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {activeSubTab === 'models' && (
                <div className="space-y-6">
                    <SettingSection title="Engine Lifecycle & Models">
                        <SettingItem
                            label="Pure Brain Mode (LLM OFF)"
                            description="Run the engine purely as a stateful database and knowledge base. Generative models will be disabled."
                            toggle
                            active={brainMode}
                            loading={Boolean(pendingKeys['brain_mode'])}
                            disabled={Boolean(pendingKeys['brain_mode'])}
                            onToggle={() => setBrainMode(!brainMode)}
                            dynamicDescription={DESC_BRAIN_MODE(brainMode)}
                        />
                        <SettingItem
                            label="Lazy Load Model (On Send)"
                            description="Wait until you send the first message to load the AI model into memory. Saves RAM while idle."
                            toggle
                            active={permissions.lazy_load_model}
                            loading={Boolean(pendingKeys['lazy_load_model'])}
                            disabled={Boolean(pendingKeys['lazy_load_model'])}
                            onToggle={() => updatePermission('lazy_load_model', !permissions.lazy_load_model)}
                            dynamicDescription={DESC_LAZY_LOAD(permissions.lazy_load_model)}
                        />

                        {/* 1. Chat Model Slot */}
                        <div className="p-6 border-b border-[var(--border-color)] space-y-3">
                            <div className="flex items-center justify-between gap-6 w-full">
                                <div className="flex flex-col flex-1 min-w-0 pr-4">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">Chat Model</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Primary conversational LLM & Multimodal Chat VLM loaded into memory.
                                    </span>
                                </div>
                                <div className="w-[340px] shrink-0 flex justify-end">
                                    <CustomDropdown
                                        options={chatModelOptions}
                                        value={currentChatId}
                                        onChange={(v) => updateModelSlot('chat', v)}
                                        placeholder="Select Chat Model..."
                                        className="w-full"
                                        loading={Boolean(pendingKeys['slot_chat'])}
                                        disabled={Boolean(pendingKeys['slot_chat'])}
                                    />
                                </div>
                            </div>
                            {currentChatId && currentChatModel && (
                                <ModelInfoCard
                                    model={currentChatModel}
                                    onInspect={() => setInspectingModel(currentChatModel)}
                                />
                            )}
                        </div>

                        {/* 2. Embedding & Vector Model Slot */}
                        <div className="p-6 border-b border-[var(--border-color)] space-y-3">
                            <div className="flex items-center justify-between gap-6 w-full">
                                <div className="flex flex-col flex-1 min-w-0 pr-4">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">Embedding & Vector Model</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Unified multimodal dense vector embedding model for semantic retrieval and search.
                                    </span>
                                </div>
                                <div className="w-[340px] shrink-0 flex justify-end">
                                    <CustomDropdown
                                        options={vectorModelOptions}
                                        value={currentVectorId}
                                        onChange={(v) => updateModelSlot('vector', v)}
                                        placeholder="Select Vector Model..."
                                        className="w-full"
                                        loading={Boolean(pendingKeys['slot_vector'])}
                                        disabled={Boolean(pendingKeys['slot_vector'])}
                                    />
                                </div>
                            </div>
                            {currentVectorId && currentVectorModel && (
                                <ModelInfoCard
                                    model={currentVectorModel}
                                    onInspect={() => setInspectingModel(currentVectorModel)}
                                />
                            )}
                        </div>

                        {/* 3. Document & Ingest Model Slot */}
                        <div className="p-6 border-b border-[var(--border-color)] space-y-3">
                            <div className="flex items-center justify-between gap-6 w-full">
                                <div className="flex flex-col flex-1 min-w-0 pr-4">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">Document & Ingest Model</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Specialized document OCR, table extraction, and spatial vision model.
                                    </span>
                                </div>
                                <div className="w-[340px] shrink-0 flex justify-end">
                                    <CustomDropdown
                                        options={ingestModelOptions}
                                        value={currentIngestId}
                                        onChange={(v) => updateModelSlot('ingest', v)}
                                        placeholder="Select Document & Ingest Model..."
                                        className="w-full"
                                        loading={Boolean(pendingKeys['slot_ingest'])}
                                        disabled={Boolean(pendingKeys['slot_ingest'])}
                                    />
                                </div>
                            </div>
                            {currentIngestId && currentIngestModel && (
                                <ModelInfoCard
                                    model={currentIngestModel}
                                    onInspect={() => setInspectingModel(currentIngestModel)}
                                />
                            )}
                        </div>

                        {/* 4. Text-To-Speech (TTS) Model Slot */}
                        <div className="p-6 border-b border-[var(--border-color)] space-y-3">
                            <div className="flex items-center justify-between gap-6 w-full">
                                <div className="flex flex-col flex-1 min-w-0 pr-4">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">Text-To-Speech (TTS) Model</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Neural voice synthesis and speech generation model.
                                    </span>
                                </div>
                                <div className="w-[340px] shrink-0 flex justify-end">
                                    <CustomDropdown
                                        options={ttsModelOptions}
                                        value={currentTtsId}
                                        onChange={(v) => updateModelSlot('tts', v)}
                                        placeholder="Select Text-to-Speech (TTS) Model..."
                                        className="w-full"
                                        loading={Boolean(pendingKeys['slot_tts'])}
                                        disabled={Boolean(pendingKeys['slot_tts'])}
                                    />
                                </div>
                            </div>
                            {currentTtsId && currentTtsModel && (
                                <ModelInfoCard
                                    model={currentTtsModel}
                                    onInspect={() => setInspectingModel(currentTtsModel)}
                                />
                            )}
                        </div>

                        {/* 5. Speech-To-Text (STT) Model Slot */}
                        <div className="p-6 last:border-none space-y-3">
                            <div className="flex items-center justify-between gap-6 w-full">
                                <div className="flex flex-col flex-1 min-w-0 pr-4">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">Speech-To-Text (STT) Model</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Automatic speech recognition (ASR) and audio transcription model.
                                    </span>
                                </div>
                                <div className="w-[340px] shrink-0 flex justify-end">
                                    <CustomDropdown
                                        options={sttModelOptions}
                                        value={currentSttId}
                                        onChange={(v) => updateModelSlot('stt', v)}
                                        placeholder="Select Speech-to-Text (STT) Model..."
                                        className="w-full"
                                        loading={Boolean(pendingKeys['slot_stt'])}
                                        disabled={Boolean(pendingKeys['slot_stt'])}
                                    />
                                </div>
                            </div>
                            {currentSttId && currentSttModel && (
                                <ModelInfoCard
                                    model={currentSttModel}
                                    onInspect={() => setInspectingModel(currentSttModel)}
                                />
                            )}
                        </div>
                    </SettingSection>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {/* SUBTAB 2: LLM Optimization (Exact Hub Parity)                         */}
            {/* ═══════════════════════════════════════════════════════════════════════ */}
            {activeSubTab === 'optimization' && (
                <div className="space-y-6">
                    {/* Hardware Health Status Banner */}
                    <div className={`${hc.bg} border ${hc.border} rounded-xl p-4`}>
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${hc.dot} ${overallHealth !== 'green' ? 'animate-pulse' : ''}`} />
                            <span className={`text-sm font-semibold ${hc.text}`}>{hc.label}</span>
                            {hardware && (
                                <span className="ml-auto text-xs text-zinc-400 font-mono">
                                    {hardware.gpu_name?.trim() || 'No GPU'} • {hardware.vram_gb.toFixed(1)} GB VRAM • {hardware.ram_gb.toFixed(0)} GB RAM
                                </span>
                            )}
                        </div>
                        {alerts.length > 0 ? (
                            <div className="space-y-1.5 mt-3">
                                {alerts.map((alert, i) => (
                                    <div key={i} className={`text-xs flex items-start gap-2 ${alert.level === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                                        <span>{alert.level === 'red' ? '🔴' : '🟡'}</span>
                                        <span>{alert.message}</span>
                                    </div>
                                ))}
                                <button
                                    onClick={resetBooster}
                                    disabled={Boolean(pendingKeys['reset_optimization'])}
                                    className="mt-2 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {Boolean(pendingKeys['reset_optimization']) && <Loader2 size={12} className="animate-spin" />}
                                    Reset to Defaults
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-emerald-400/70">Your settings are optimally tuned for your hardware configuration.</p>
                        )}
                    </div>

                    <SettingSection title="LLM Optimization & Hardware Governance">
                        {/* 1. VRAM Safety Buffer */}
                        <div className="p-6 border-b border-[var(--border-color)] space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col max-w-sm">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">VRAM Safety Buffer</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Reserved GPU memory margin to guarantee 0% OOM crashes.
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {Boolean(pendingKeys['custom_vram_buffer_gb']) && (
                                        <Loader2 size={14} className="animate-spin text-blue-400" />
                                    )}
                                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                                        {booster.custom_vram_buffer_gb !== null && booster.custom_vram_buffer_gb !== undefined
                                            ? `${booster.custom_vram_buffer_gb.toFixed(1)} GB`
                                            : 'Auto (% Dynamic)'}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={Boolean(pendingKeys['custom_vram_buffer_gb'])}
                                        onClick={() =>
                                            updateBoosterBuffer(
                                                'vram',
                                                booster.custom_vram_buffer_gb !== null && booster.custom_vram_buffer_gb !== undefined ? null : 2.0
                                            )
                                        }
                                        className="text-xs px-2.5 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pt-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="16"
                                    step="0.1"
                                    disabled={Boolean(pendingKeys['custom_vram_buffer_gb'])}
                                    value={booster.custom_vram_buffer_gb ?? 0}
                                    onChange={(e) => updateBoosterBuffer('vram', parseFloat(e.target.value))}
                                    className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* 2. CPU RAM Safety Buffer */}
                        <div className="p-6 border-b border-[var(--border-color)] space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col max-w-sm">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">CPU RAM Safety Buffer</span>
                                    <span className="text-[11px] text-[var(--text-muted)] font-medium leading-relaxed">
                                        Reserved System RAM headroom for OS and background applications.
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {Boolean(pendingKeys['custom_ram_buffer_gb']) && (
                                        <Loader2 size={14} className="animate-spin text-purple-400" />
                                    )}
                                    <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
                                        {booster.custom_ram_buffer_gb !== null && booster.custom_ram_buffer_gb !== undefined
                                            ? `${booster.custom_ram_buffer_gb.toFixed(1)} GB`
                                            : 'Auto (% Dynamic)'}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={Boolean(pendingKeys['custom_ram_buffer_gb'])}
                                        onClick={() =>
                                            updateBoosterBuffer(
                                                'ram',
                                                booster.custom_ram_buffer_gb !== null && booster.custom_ram_buffer_gb !== undefined ? null : 4.0
                                            )
                                        }
                                        className="text-xs px-2.5 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 pt-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="32"
                                    step="0.5"
                                    disabled={Boolean(pendingKeys['custom_ram_buffer_gb'])}
                                    value={booster.custom_ram_buffer_gb ?? 0}
                                    onChange={(e) => updateBoosterBuffer('ram', parseFloat(e.target.value))}
                                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* 3. Flash Attention */}
                        <SettingItem
                            label="Flash Attention (flash_attn)"
                            description="Enables hardware-optimized attention kernels. Delivers higher throughput for long context."
                            select={['Auto', 'On', 'Off']}
                            value={booster.flash_attention}
                            loading={Boolean(pendingKeys['flash_attention'])}
                            disabled={Boolean(pendingKeys['flash_attention'])}
                            onChange={(v) => updateBooster('flash_attention', v)}
                            dynamicDescription={DESC_FLASH_ATTN[booster.flash_attention]}
                        />

                        {/* 4. Smart Memory Management (Context Shifting) */}
                        <SettingItem
                            label="Smart Memory Management (Context Shifting)"
                            description="System dynamically balances memory consumption and chat history retention."
                            select={['Auto', 'Minimal', 'Standard', 'Aggressive', 'Extreme', 'Off']}
                            value={booster.context_shifting}
                            loading={Boolean(pendingKeys['context_shifting'])}
                            disabled={Boolean(pendingKeys['context_shifting'])}
                            onChange={(v) => updateBooster('context_shifting', v)}
                            dynamicDescription={DESC_CONTEXT[booster.context_shifting]}
                        />

                        {/* 5. KV Cache Quantization */}
                        <SettingItem
                            label="KV Cache Quantization (type_k / type_v)"
                            description="Compresses key-value cache in memory to unlock higher context limits."
                            select={['Auto', 'Kv16', 'Kv8', 'Kv4']}
                            value={booster.kv_cache_quantization}
                            loading={Boolean(pendingKeys['kv_cache_quantization'])}
                            disabled={Boolean(pendingKeys['kv_cache_quantization'])}
                            onChange={(v) => updateBooster('kv_cache_quantization', v)}
                            dynamicDescription={DESC_KV_QUANT[booster.kv_cache_quantization]}
                        />

                        {/* 6. Speculative Decoding */}
                        <SettingItem
                            label="Speculative Decoding (--draft)"
                            description="Accelerates inference using secondary draft models or lookup tables."
                            select={['Auto', 'On', 'Off']}
                            value={booster.speculative_decoding}
                            loading={Boolean(pendingKeys['speculative_decoding'])}
                            disabled={Boolean(pendingKeys['speculative_decoding'])}
                            onChange={(v) => updateBooster('speculative_decoding', v)}
                            dynamicDescription={DESC_SPEC_DEC[booster.speculative_decoding]}
                        />

                        {/* 7. Extreme MoE SSD Streaming */}
                        <SettingItem
                            label="Extreme MoE SSD Streaming"
                            description="Zero-RAM out-of-core streaming for MoE models directly from NVMe SSD with DMA staging."
                            select={['Auto', 'On', 'Off']}
                            value={booster.moe_vram_routing}
                            loading={Boolean(pendingKeys['moe_vram_routing'])}
                            disabled={Boolean(pendingKeys['moe_vram_routing'])}
                            onChange={(v) => updateBooster('moe_vram_routing', v)}
                            dynamicDescription={DESC_MOE[booster.moe_vram_routing]}
                        />

                        {/* 8. Hybrid Memory Mode */}
                        <SettingItem
                            label="Hybrid Memory Mode (VRAM + RAM)"
                            description="Dynamically balances layer placement across GPU VRAM and host RAM."
                            select={['Auto', 'On', 'Off']}
                            value={booster.force_vram_reclaim || 'Off'}
                            loading={Boolean(pendingKeys['force_vram_reclaim'])}
                            disabled={Boolean(pendingKeys['force_vram_reclaim'])}
                            onChange={(v) => updateBooster('force_vram_reclaim', v)}
                            dynamicDescription={DESC_HYBRID_MEMORY[booster.force_vram_reclaim || 'Off']}
                        />

                        {/* 9. Memory Lock (use_mlock) */}
                        <SettingItem
                            label="Memory Lock (use_mlock)"
                            description="Locks model weights in RAM/VRAM to prevent OS pagefile swapping and latency spikes."
                            select={['Auto', 'On', 'Off']}
                            value={booster.force_memory_lock}
                            loading={Boolean(pendingKeys['force_memory_lock'])}
                            disabled={Boolean(pendingKeys['force_memory_lock'])}
                            onChange={(v) => updateBooster('force_memory_lock', v)}
                            dynamicDescription={DESC_MLOCK[booster.force_memory_lock]}
                        />

                        {/* 10. Optimization Profile */}
                        <SettingItem
                            label="Llama Optimization Profile"
                            description="Pre-configured profiles determining how aggressively cluaiz reclaims system resources."
                            select={[
                                { label: 'Edge (Low Power)', value: 'edge' },
                                { label: 'Multitasking', value: 'multitasking' },
                                { label: 'Balanced', value: 'balance' },
                                { label: 'Max Boost', value: 'max_boost' },
                                { label: 'Ultra Max Boost', value: 'ultra_max_boost' },
                                { label: 'Hyper Cluster', value: 'hyper_cluster' }
                            ]}
                            value={booster.mode_run}
                            loading={Boolean(pendingKeys['mode_run'])}
                            disabled={Boolean(pendingKeys['mode_run'])}
                            onChange={(v) => updateBooster('mode_run', v)}
                            dynamicDescription={DESC_BOOSTER_PROFILE[booster.mode_run]}
                        />
                    </SettingSection>
                </div>
            )}

            {/* ── Model Inspector Modal ── */}
            <ModelInspectorModal
                isOpen={!!inspectingModel}
                model={inspectingModel}
                onClose={() => setInspectingModel(null)}
            />
        </div>
    );
}

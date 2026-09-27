import { useState, useEffect, useRef, useCallback } from 'react';
import { SettingSection, SettingItem, SettingSlider } from './SharedComponents';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Check, Loader2 } from 'lucide-react';

interface GgufHardwareExecution {
    n_gpu_layers: number;
    n_ctx: number;
    no_mmap: boolean;
    override_tensor: string;
    batch_size: number;
    ubatch_size: number;
    parallel: number;
    spec_type: string;
    spec_draft_n_max: number;
}

interface GgufTemplatingFlags {
    chat_template_file: string;
    chat_template_kwargs: string;
    jinja: boolean;
    fit: string;
}

interface GgufSamplers {
    temp: number;
    top_k: number;
    top_p: number;
    min_p: number;
    presence_penalty: number;
    repeat_penalty: number;
    frequency_penalty: number;
    seed?: number | null;
}

interface UserMovedFlags {
    think_mode: string;
    response_length: string;
}

interface GgufConfig {
    hardware_and_execution: GgufHardwareExecution;
    templating_flags: GgufTemplatingFlags;
    samplers: GgufSamplers;
    user_moved_flags: UserMovedFlags;
}

interface OnnxConfig {
    n_gpu_layers: number;
    n_ctx: number;
    intra_op_num_threads: number;
    graph_optimization_level: string;
    enable_profiling: boolean;
    inter_op_num_threads: number;
    enable_mem_pattern: boolean;
    enable_cpu_mem_arena: boolean;
    execution_mode: string;
    gpu_mem_limit_bytes: number;
    arena_extend_strategy: string;
    enable_ort_transformers_optimization: boolean;
    kv_cache_data_type: string;
    use_deterministic_compute: boolean;
    user_moved_flags: UserMovedFlags;
}

const DEFAULT_GGUF_CONFIG: GgufConfig = {
    hardware_and_execution: {
        n_gpu_layers: -1,
        n_ctx: 4096,
        no_mmap: false,
        override_tensor: '',
        batch_size: 512,
        ubatch_size: 512,
        parallel: 1,
        spec_type: '',
        spec_draft_n_max: 0
    },
    templating_flags: {
        chat_template_file: '',
        chat_template_kwargs: '',
        jinja: false,
        fit: 'off'
    },
    samplers: {
        temp: 0.7,
        top_k: 40,
        top_p: 0.95,
        min_p: 0.05,
        presence_penalty: 0.0,
        repeat_penalty: 1.1,
        frequency_penalty: 0.0,
        seed: null
    },
    user_moved_flags: {
        think_mode: 'Auto',
        response_length: 'auto'
    }
};

const DEFAULT_ONNX_CONFIG: OnnxConfig = {
    n_gpu_layers: -1,
    n_ctx: 4096,
    intra_op_num_threads: 0,
    graph_optimization_level: 'ORT_ENABLE_ALL',
    enable_profiling: false,
    inter_op_num_threads: 0,
    enable_mem_pattern: true,
    enable_cpu_mem_arena: true,
    execution_mode: 'ORT_SEQUENTIAL',
    gpu_mem_limit_bytes: 0,
    arena_extend_strategy: 'kNextPowerOfTwo',
    enable_ort_transformers_optimization: true,
    kv_cache_data_type: 'ort_fp16',
    use_deterministic_compute: false,
    user_moved_flags: {
        think_mode: 'Auto',
        response_length: 'auto'
    }
};

export function InferenceSettings() {
    const { getBaseUrl } = useConnectionStore();
    const [activeSubTab, setActiveSubTab] = useState<'gguf' | 'onnx'>('gguf');
    const [ggufConfig, setGgufConfig] = useState<GgufConfig>(DEFAULT_GGUF_CONFIG);
    const [onnxConfig, setOnnxConfig] = useState<OnnxConfig>(DEFAULT_ONNX_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const authHeadersRef = useRef<Record<string, string>>({ 'Content-Type': 'application/json' });
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch auth headers & initial configs
    useEffect(() => {
        let isMounted = true;

        const loadConfigs = async () => {
            const baseUrl = getBaseUrl();
            try {
                // Fetch permission token if required
                const pRes = await fetch(`${baseUrl}/v1/system/permission`).catch(() => null);
                if (pRes && pRes.ok) {
                    const pData = await pRes.json();
                    if (pData?.permission?.api_auth?.required && pData.permission.api_auth.tokens?.length > 0) {
                        authHeadersRef.current['Authorization'] = 'Bearer ' + pData.permission.api_auth.tokens[0];
                    }
                }
            } catch (e) {
                console.warn('[InferenceSettings] Auth check failed:', e);
            }

            try {
                const [ggufRes, onnxRes] = await Promise.all([
                    fetch(`${baseUrl}/v1/system/gguf_config`, { headers: authHeadersRef.current }).catch(() => null),
                    fetch(`${baseUrl}/v1/system/onnx_config`, { headers: authHeadersRef.current }).catch(() => null)
                ]);

                if (isMounted) {
                    if (ggufRes && ggufRes.ok) {
                        const data = await ggufRes.json();
                        setGgufConfig({
                            hardware_and_execution: { ...DEFAULT_GGUF_CONFIG.hardware_and_execution, ...(data.hardware_and_execution || {}) },
                            templating_flags: { ...DEFAULT_GGUF_CONFIG.templating_flags, ...(data.templating_flags || {}) },
                            samplers: { ...DEFAULT_GGUF_CONFIG.samplers, ...(data.samplers || {}) },
                            user_moved_flags: {
                                think_mode: data.user_moved_flags?.think_mode || 'Auto',
                                response_length: typeof data.user_moved_flags?.response_length === 'string'
                                    ? data.user_moved_flags.response_length.replace(/"/g, '')
                                    : 'auto'
                            }
                        });
                    }

                    if (onnxRes && onnxRes.ok) {
                        const data = await onnxRes.json();
                        setOnnxConfig({
                            ...DEFAULT_ONNX_CONFIG,
                            ...data,
                            user_moved_flags: {
                                think_mode: data.user_moved_flags?.think_mode || 'Auto',
                                response_length: typeof data.user_moved_flags?.response_length === 'string'
                                    ? data.user_moved_flags.response_length.replace(/"/g, '')
                                    : 'auto'
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('[InferenceSettings] Failed to fetch inference configs:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadConfigs();

        return () => {
            isMounted = false;
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [getBaseUrl]);

    // Save GGUF Config to Backend
    const saveGgufToServer = useCallback(async (updated: GgufConfig) => {
        setSaveStatus('saving');
        try {
            const baseUrl = getBaseUrl();
            const payload = {
                ...updated,
                user_moved_flags: {
                    ...updated.user_moved_flags,
                    response_length: `"${updated.user_moved_flags.response_length}"`
                }
            };
            await fetch(`${baseUrl}/v1/system/gguf_config`, {
                method: 'POST',
                headers: authHeadersRef.current,
                body: JSON.stringify(payload)
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            console.error('[InferenceSettings] Auto-save GGUF failed:', e);
            setSaveStatus('idle');
        }
    }, [getBaseUrl]);

    // Save ONNX Config to Backend
    const saveOnnxToServer = useCallback(async (updated: OnnxConfig) => {
        setSaveStatus('saving');
        try {
            const baseUrl = getBaseUrl();
            const payload = {
                ...updated,
                user_moved_flags: {
                    ...updated.user_moved_flags,
                    response_length: `"${updated.user_moved_flags.response_length}"`
                }
            };
            await fetch(`${baseUrl}/v1/system/onnx_config`, {
                method: 'POST',
                headers: authHeadersRef.current,
                body: JSON.stringify(payload)
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            console.error('[InferenceSettings] Auto-save ONNX failed:', e);
            setSaveStatus('idle');
        }
    }, [getBaseUrl]);

    // GGUF Field Mutators
    const updateGgufHardware = (key: keyof GgufHardwareExecution, val: any) => {
        setGgufConfig(prev => {
            const updated = {
                ...prev,
                hardware_and_execution: { ...prev.hardware_and_execution, [key]: val }
            };
            saveGgufToServer(updated);
            return updated;
        });
    };

    const updateGgufTemplate = (key: keyof GgufTemplatingFlags, val: any) => {
        setGgufConfig(prev => {
            const updated = {
                ...prev,
                templating_flags: { ...prev.templating_flags, [key]: val }
            };
            saveGgufToServer(updated);
            return updated;
        });
    };

    const updateGgufSampler = (key: keyof GgufSamplers, val: number) => {
        setGgufConfig(prev => {
            const updated = {
                ...prev,
                samplers: { ...prev.samplers, [key]: val }
            };
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                saveGgufToServer(updated);
            }, 300);
            return updated;
        });
    };

    const updateGgufUserMoved = (key: keyof UserMovedFlags, val: string) => {
        setGgufConfig(prev => {
            const updated = {
                ...prev,
                user_moved_flags: { ...prev.user_moved_flags, [key]: val }
            };
            saveGgufToServer(updated);
            return updated;
        });
    };

    // ONNX Field Mutators
    const updateOnnxField = (key: keyof OnnxConfig, val: any) => {
        setOnnxConfig(prev => {
            const updated = { ...prev, [key]: val };
            saveOnnxToServer(updated);
            return updated;
        });
    };

    const updateOnnxUserMoved = (key: keyof UserMovedFlags, val: string) => {
        setOnnxConfig(prev => {
            const updated = {
                ...prev,
                user_moved_flags: { ...prev.user_moved_flags, [key]: val }
            };
            saveOnnxToServer(updated);
            return updated;
        });
    };

    return (
        <div className="space-y-8 select-none">
            {/* Sub-tabs header & Auto-save Status */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 p-1 bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] rounded-xl w-fit">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('gguf')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSubTab === 'gguf'
                                ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        GGUF Schemas
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('onnx')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeSubTab === 'onnx'
                                ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        ONNX Schemas
                    </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium">
                    {saveStatus === 'saving' && (
                        <span className="flex items-center gap-1.5 text-[var(--text-muted)] animate-pulse">
                            <Loader2 size={13} className="animate-spin text-[var(--accent-color)]" />
                            Saving changes...
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="flex items-center gap-1.5 text-[var(--accent-color)] font-semibold">
                            <Check size={14} />
                            Persisted to engine
                        </span>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-12 text-[var(--text-muted)] gap-3 text-sm">
                    <Loader2 size={18} className="animate-spin text-[var(--accent-color)]" />
                    Loading inference configurations...
                </div>
            ) : activeSubTab === 'gguf' ? (
                <>
                    {/* GGUF: Hardware & Execution */}
                    <SettingSection title="Hardware & Execution (GGUF)">
                        <SettingItem
                            label="GPU Layers (n_gpu_layers)"
                            description="VRAM layer offload count. -1 for full VRAM offload, 0 for host CPU execution."
                            select={[
                                { value: '-1', label: 'Full GPU (-1 / Auto)' },
                                { value: '0', label: 'CPU Only (0 Layers)' },
                                { value: '8', label: '8 Layers' },
                                { value: '16', label: '16 Layers' },
                                { value: '24', label: '24 Layers' },
                                { value: '32', label: '32 Layers' },
                                { value: '40', label: '40 Layers' },
                                { value: '48', label: '48 Layers' }
                            ]}
                            value={String(ggufConfig.hardware_and_execution.n_gpu_layers)}
                            onChange={(val) => updateGgufHardware('n_gpu_layers', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Context Window Size (n_ctx)"
                            description="Token context window. -1 for native model limit, 0 for dynamic auto sizing."
                            select={[
                                { value: '0', label: 'Dynamic Auto (0)' },
                                { value: '-1', label: 'Max Native (-1)' },
                                { value: '2048', label: '2,048 Tokens' },
                                { value: '4096', label: '4,096 Tokens (Standard)' },
                                { value: '8192', label: '8,192 Tokens' },
                                { value: '16384', label: '16,384 Tokens' },
                                { value: '32768', label: '32,768 Tokens' },
                                { value: '65536', label: '65,536 Tokens' }
                            ]}
                            value={String(ggufConfig.hardware_and_execution.n_ctx)}
                            onChange={(val) => updateGgufHardware('n_ctx', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="No MMAP (no_mmap)"
                            description="Bypasses mmap() file I/O calls. Reads tensor weights directly into physical host RAM."
                            toggle
                            active={ggufConfig.hardware_and_execution.no_mmap}
                            onToggle={() => updateGgufHardware('no_mmap', !ggufConfig.hardware_and_execution.no_mmap)}
                        />
                        <SettingItem
                            label="Override Tensor (override_tensor)"
                            description="Regex tensor placement rules. Forces designated layers (e.g. FFN blocks) to host RAM."
                            select={[
                                { value: '', label: 'Auto - Full GPU' },
                                { value: 'blk\\.(1[0-9]|2[0-9])\\.ffn_.*=CPU', label: 'Offload Middle Layers (8B/7B)' },
                                { value: 'blk\\.(2[0-9]|3[0-9]|4[0-3])\\.ffn_.*=CPU', label: 'Offload Middle Layers (70B)' }
                            ]}
                            value={ggufConfig.hardware_and_execution.override_tensor || ''}
                            onChange={(val) => updateGgufHardware('override_tensor', val)}
                        />
                        <SettingItem
                            label="Batch Size (batch_size)"
                            description="Logical prompt evaluation batch length evaluated per step."
                            select={[
                                { value: '128', label: '128' },
                                { value: '256', label: '256' },
                                { value: '512', label: '512 (Default)' },
                                { value: '1024', label: '1024' },
                                { value: '2048', label: '2048' },
                                { value: '4096', label: '4096' },
                                { value: '8192', label: '8192' }
                            ]}
                            value={String(ggufConfig.hardware_and_execution.batch_size)}
                            onChange={(val) => updateGgufHardware('batch_size', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="UBatch Size (ubatch_size)"
                            description="Physical micro-batch chunk size dispatched per compute kernel launch."
                            select={[
                                { value: '128', label: '128' },
                                { value: '256', label: '256' },
                                { value: '512', label: '512 (Default)' },
                                { value: '1024', label: '1024' },
                                { value: '2048', label: '2048' }
                            ]}
                            value={String(ggufConfig.hardware_and_execution.ubatch_size)}
                            onChange={(val) => updateGgufHardware('ubatch_size', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Parallel Sequences (parallel)"
                            description="Maximum concurrent sequence slots allocated in KV cache state."
                            select={[
                                { value: '1', label: '1 (Single User)' },
                                { value: '2', label: '2 Sequences' },
                                { value: '4', label: '4 Sequences' },
                                { value: '8', label: '8 Sequences' }
                            ]}
                            value={String(ggufConfig.hardware_and_execution.parallel)}
                            onChange={(val) => updateGgufHardware('parallel', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Speculative Type (spec_type)"
                            description="Speculative decoding strategy (draft-mtp or n-gram) for lookahead proposal."
                            select={[
                                { value: '', label: 'None (Disabled)' },
                                { value: 'draft-mtp', label: 'draft-mtp' },
                                { value: 'ngram-mod', label: 'ngram-mod' }
                            ]}
                            value={ggufConfig.hardware_and_execution.spec_type || ''}
                            onChange={(val) => updateGgufHardware('spec_type', val)}
                        />
                        <SettingItem
                            label="Speculative Draft Max (spec_draft_n_max)"
                            description="Max sequence depth for speculative draft lookahead verification."
                            select={[
                                { value: '0', label: '0 (Disabled)' },
                                { value: '1', label: '1 Token' },
                                { value: '2', label: '2 Tokens' },
                                { value: '3', label: '3 Tokens' },
                                { value: '5', label: '5 Tokens' }
                            ]}
                            value={String(ggufConfig.hardware_and_execution.spec_draft_n_max)}
                            onChange={(val) => updateGgufHardware('spec_draft_n_max', parseInt(val, 10))}
                        />
                    </SettingSection>

                    {/* GGUF: Templating Flags */}
                    <SettingSection title="Templating Flags">
                        <SettingItem
                            label="Chat Template File"
                            description="Jinja2 template path for conversation formatting. Empty reads header default."
                            select={[
                                { value: '', label: 'Auto (Read from Model)' }
                            ]}
                            value={ggufConfig.templating_flags.chat_template_file || ''}
                            onChange={(val) => updateGgufTemplate('chat_template_file', val)}
                        />
                        <SettingItem
                            label="Chat Template Kwargs"
                            description="JSON parameters merged into Jinja evaluation context (e.g. {'preserve_thinking': true})."
                            select={[
                                { value: '', label: 'Auto (Default Kwargs)' }
                            ]}
                            value={ggufConfig.templating_flags.chat_template_kwargs || ''}
                            onChange={(val) => updateGgufTemplate('chat_template_kwargs', val)}
                        />
                        <SettingItem
                            label="Enable Jinja (jinja)"
                            description="Toggles Jinja2 template processing engine versus native string formatting."
                            toggle
                            active={ggufConfig.templating_flags.jinja}
                            onToggle={() => updateGgufTemplate('jinja', !ggufConfig.templating_flags.jinja)}
                        />
                        <SettingItem
                            label="Fit (fit)"
                            description="Context window overflow strategy when prompt exceeds maximum context limit."
                            select={[
                                { value: 'off', label: 'Off (Default Error)' },
                                { value: 'on', label: 'On (Fit Context Window)' }
                            ]}
                            value={ggufConfig.templating_flags.fit || 'off'}
                            onChange={(val) => updateGgufTemplate('fit', val)}
                        />
                    </SettingSection>

                    {/* GGUF: Samplers & Penalties */}
                    <SettingSection title="Samplers & Penalties">
                        {[
                            { key: 'temp', label: 'Temperature', min: 0, max: 2, step: 0.01, desc: 'Controls randomness: lower is deterministic, higher is creative.' },
                            { key: 'top_p', label: 'Top-P (Nucleus Sampling)', min: 0, max: 1, step: 0.01, desc: 'Limits sampling pool to tokens comprising cumulative probability.' },
                            { key: 'top_k', label: 'Top-K', min: 0, max: 100, step: 1, desc: 'Restricts candidate pool to top K highest probability tokens.' },
                            { key: 'min_p', label: 'Min-P', min: 0, max: 1, step: 0.01, desc: 'Dynamic threshold based on probability of the most likely token.' },
                            { key: 'presence_penalty', label: 'Presence Penalty', min: 0, max: 2, step: 0.01, desc: 'Penalizes tokens that have appeared at least once.' },
                            { key: 'repeat_penalty', label: 'Repeat Penalty', min: 1, max: 2, step: 0.01, desc: 'Discourages repeating identical token sequences.' },
                            { key: 'frequency_penalty', label: 'Frequency Penalty', min: 0, max: 2, step: 0.01, desc: 'Penalizes tokens proportionally based on frequency.' }
                        ].map((item) => {
                            const val = ggufConfig.samplers[item.key as keyof GgufSamplers] ?? item.min;
                            return (
                                <SettingSlider
                                    key={item.key}
                                    label={item.label}
                                    description={item.desc}
                                    min={item.min}
                                    max={item.max}
                                    step={item.step}
                                    value={val as number}
                                    onChange={(v) => updateGgufSampler(item.key as keyof GgufSamplers, v)}
                                    formatValue={(v) => (item.step < 1 ? v.toFixed(2) : String(v))}
                                />
                            );
                        })}
                    </SettingSection>

                    {/* GGUF: Reasoning & Style Defaults */}
                    <SettingSection title="Reasoning & Style Defaults">
                        <SettingItem
                            label="Think Mode"
                            description="Controls Chain-of-Thought (CoT) reasoning token emission and budget."
                            select={[
                                { value: 'Auto', label: 'Auto (Model Default)' },
                                { value: 'Off', label: 'Off (Think Tag Prefill)' },
                                { value: 'Low', label: 'Low (512 Tokens)' },
                                { value: 'Medium', label: 'Medium (1024 Tokens)' },
                                { value: 'High', label: 'High (Full Reasoning)' }
                            ]}
                            value={ggufConfig.user_moved_flags.think_mode || 'Auto'}
                            onChange={(val) => updateGgufUserMoved('think_mode', val)}
                        />
                        <SettingItem
                            label="Response Length"
                            description="Progressive logit-level EOS bias for graceful answer completion."
                            select={[
                                { value: 'auto', label: 'Auto (Default)' },
                                { value: 'short', label: 'Short (Concise Answers)' },
                                { value: 'medium', label: 'Medium (Standard Length)' },
                                { value: 'long', label: 'Long (Detailed Answers)' }
                            ]}
                            value={ggufConfig.user_moved_flags.response_length || 'auto'}
                            onChange={(val) => updateGgufUserMoved('response_length', val)}
                        />
                    </SettingSection>
                </>
            ) : (
                <>
                    {/* ONNX: Hardware & Execution */}
                    <SettingSection title="Hardware & Execution (ONNX)">
                        <SettingItem
                            label="Hardware Offload (n_gpu_layers)"
                            description="Target Execution Provider backend driver (DirectML / CUDA vs CPU)."
                            select={[
                                { value: '-1', label: 'GPU Full Load (DirectML / CUDA)' },
                                { value: '0', label: 'CPU Only' },
                                { value: '16', label: '16 Layers' },
                                { value: '24', label: '24 Layers' },
                                { value: '32', label: '32 Layers' }
                            ]}
                            value={String(onnxConfig.n_gpu_layers)}
                            onChange={(val) => updateOnnxField('n_gpu_layers', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Context Window Size (n_ctx)"
                            description="Token context window size. -1 for maximum model limit, 0 for dynamic auto sizing."
                            select={[
                                { value: '0', label: 'Dynamic Auto (0)' },
                                { value: '-1', label: 'Max Native (-1)' },
                                { value: '2048', label: '2,048 Tokens' },
                                { value: '4096', label: '4,096 Tokens (Standard)' },
                                { value: '8192', label: '8,192 Tokens' },
                                { value: '16384', label: '16,384 Tokens' },
                                { value: '32768', label: '32,768 Tokens' }
                            ]}
                            value={String(onnxConfig.n_ctx)}
                            onChange={(val) => updateOnnxField('n_ctx', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Intra-Op Threads (Node Execution)"
                            description="Thread count for intra-node operator kernel parallelism. 0 auto-detects CPU core count."
                            select={[
                                { value: '0', label: 'Auto (0 - Native Cores)' },
                                { value: '1', label: '1 Thread' },
                                { value: '2', label: '2 Threads' },
                                { value: '4', label: '4 Threads' },
                                { value: '8', label: '8 Threads' },
                                { value: '16', label: '16 Threads' }
                            ]}
                            value={String(onnxConfig.intra_op_num_threads)}
                            onChange={(val) => updateOnnxField('intra_op_num_threads', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Graph Optimization Level"
                            description="ONNX Runtime graph transformation pass level."
                            select={[
                                { value: 'ORT_ENABLE_ALL', label: 'ORT_ENABLE_ALL (Recommended)' },
                                { value: 'ORT_ENABLE_EXTENDED', label: 'ORT_ENABLE_EXTENDED' },
                                { value: 'ORT_ENABLE_BASIC', label: 'ORT_ENABLE_BASIC' },
                                { value: 'ORT_DISABLE_ALL', label: 'ORT_DISABLE_ALL' }
                            ]}
                            value={onnxConfig.graph_optimization_level}
                            onChange={(val) => updateOnnxField('graph_optimization_level', val)}
                        />
                        <SettingItem
                            label="Enable Profiling"
                            description="Emits Chrome trace JSON profiling logs for operator execution runtimes."
                            toggle
                            active={onnxConfig.enable_profiling}
                            onToggle={() => updateOnnxField('enable_profiling', !onnxConfig.enable_profiling)}
                        />
                    </SettingSection>

                    {/* ONNX: Memory & Hardware Control */}
                    <SettingSection title="Memory & Hardware Control">
                        <SettingItem
                            label="Inter-Op Threads (Graph Execution)"
                            description="Thread count for concurrent graph branch operators. 0 recommended for transformers."
                            select={[
                                { value: '0', label: 'Auto (0 - Recommended for Transformers)' },
                                { value: '1', label: '1 Thread' },
                                { value: '2', label: '2 Threads' },
                                { value: '4', label: '4 Threads' },
                                { value: '8', label: '8 Threads' },
                                { value: '16', label: '16 Threads' }
                            ]}
                            value={String(onnxConfig.inter_op_num_threads)}
                            onChange={(val) => updateOnnxField('inter_op_num_threads', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Enable Memory Pattern"
                            description="Pre-allocates static memory layout patterns for intermediate tensor shapes."
                            toggle
                            active={onnxConfig.enable_mem_pattern}
                            onToggle={() => updateOnnxField('enable_mem_pattern', !onnxConfig.enable_mem_pattern)}
                        />
                        <SettingItem
                            label="Enable CPU Memory Arena"
                            description="Uses arena memory allocator for host CPU allocations to eliminate heap fragmentation."
                            toggle
                            active={onnxConfig.enable_cpu_mem_arena}
                            onToggle={() => updateOnnxField('enable_cpu_mem_arena', !onnxConfig.enable_cpu_mem_arena)}
                        />
                        <SettingItem
                            label="Execution Mode"
                            description="ONNX operator execution strategy (ORT_SEQUENTIAL vs ORT_PARALLEL)."
                            select={[
                                { value: 'ORT_SEQUENTIAL', label: 'ORT_SEQUENTIAL (Default)' },
                                { value: 'ORT_PARALLEL', label: 'ORT_PARALLEL' }
                            ]}
                            value={onnxConfig.execution_mode}
                            onChange={(val) => updateOnnxField('execution_mode', val)}
                        />
                        <SettingItem
                            label="GPU Memory Limit Bytes"
                            description="Maximum VRAM allocation limit for ONNX session. 0 specifies unconstrained allocation."
                            select={[
                                { value: '0', label: 'Unlimited (0)' },
                                { value: '2147483648', label: '2 GB' },
                                { value: '4294967296', label: '4 GB' },
                                { value: '8589934592', label: '8 GB' }
                            ]}
                            value={String(onnxConfig.gpu_mem_limit_bytes)}
                            onChange={(val) => updateOnnxField('gpu_mem_limit_bytes', parseInt(val, 10))}
                        />
                        <SettingItem
                            label="Arena Extend Strategy"
                            description="Arena memory expansion strategy (kNextPowerOfTwo vs kSameAsRequested)."
                            select={[
                                { value: 'kNextPowerOfTwo', label: 'kNextPowerOfTwo (Default)' },
                                { value: 'kSameAsRequested', label: 'kSameAsRequested' }
                            ]}
                            value={onnxConfig.arena_extend_strategy}
                            onChange={(val) => updateOnnxField('arena_extend_strategy', val)}
                        />
                    </SettingSection>

                    {/* ONNX: Quantization & Graph Transformer */}
                    <SettingSection title="Quantization & Graph Transformer">
                        <SettingItem
                            label="Enable ORT Transformers Opt."
                            description="Enables specialized fused operator kernels (MultiHeadAttention, FastGelu) for Transformer graphs."
                            toggle
                            active={onnxConfig.enable_ort_transformers_optimization}
                            onToggle={() => updateOnnxField('enable_ort_transformers_optimization', !onnxConfig.enable_ort_transformers_optimization)}
                        />
                        <SettingItem
                            label="KV Cache Data Type"
                            description="KV cache precision representation for sequence memory footprint."
                            select={[
                                { value: 'ort_fp16', label: 'ort_fp16 (Half memory - Recommended)' },
                                { value: 'ort_fp32', label: 'ort_fp32 (Highest Quality)' },
                                { value: 'ort_int8', label: 'ort_int8 (Quarter memory)' }
                            ]}
                            value={onnxConfig.kv_cache_data_type}
                            onChange={(val) => updateOnnxField('kv_cache_data_type', val)}
                        />
                        <SettingItem
                            label="Use Deterministic Compute"
                            description="Enforces deterministic kernel execution pathways across floating-point compute steps."
                            toggle
                            active={onnxConfig.use_deterministic_compute}
                            onToggle={() => updateOnnxField('use_deterministic_compute', !onnxConfig.use_deterministic_compute)}
                        />
                    </SettingSection>

                    {/* ONNX: Reasoning & Style Defaults */}
                    <SettingSection title="Reasoning & Style Defaults">
                        <SettingItem
                            label="Think Mode"
                            description="Controls Chain-of-Thought (CoT) reasoning token emission and budget."
                            select={[
                                { value: 'Auto', label: 'Auto (Model Default)' },
                                { value: 'Off', label: 'Off (Think Tag Prefill)' },
                                { value: 'Low', label: 'Low (512 Tokens)' },
                                { value: 'Medium', label: 'Medium (1024 Tokens)' },
                                { value: 'High', label: 'High (Full Reasoning)' }
                            ]}
                            value={onnxConfig.user_moved_flags.think_mode || 'Auto'}
                            onChange={(val) => updateOnnxUserMoved('think_mode', val)}
                        />
                        <SettingItem
                            label="Response Length"
                            description="Progressive logit-level EOS bias for graceful answer completion."
                            select={[
                                { value: 'auto', label: 'Auto (Default)' },
                                { value: 'short', label: 'Short (Concise Answers)' },
                                { value: 'medium', label: 'Medium (Standard Length)' },
                                { value: 'long', label: 'Long (Detailed Answers)' }
                            ]}
                            value={onnxConfig.user_moved_flags.response_length || 'auto'}
                            onChange={(val) => updateOnnxUserMoved('response_length', val)}
                        />
                    </SettingSection>
                </>
            )}
        </div>
    );
}

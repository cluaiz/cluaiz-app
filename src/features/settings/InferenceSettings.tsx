import { useState, useEffect } from 'react';
import { SettingSection, SettingItem, SettingSlider } from './SharedComponents';
import { useInferenceStore } from '../../api/engine/inference';
import type { GgufSamplers } from '../../api/engine/inference';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export function InferenceSettings() {
    const [activeSubTab, setActiveSubTab] = useState<'gguf' | 'onnx'>('gguf');

    const {
        gguf: ggufConfig,
        onnx: onnxConfig,
        status,
        isSaving,
        error,
        load,
        updateGgufHardware,
        updateGgufSampler,
        updateGgufUserMoved,
        updateOnnxField,
    } = useInferenceStore();

    // Fetch initial configs on mount
    useEffect(() => {
        load();
    }, [load]);

    const isLoading = status === 'pending' && !ggufConfig;

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
                    {isSaving && (
                        <span className="flex items-center gap-1.5 text-[var(--text-muted)] animate-pulse">
                            <Loader2 size={13} className="animate-spin text-[var(--accent-color)]" />
                            Saving changes...
                        </span>
                    )}
                    {!isSaving && status === 'success' && (
                        <span className="flex items-center gap-1.5 text-[var(--accent-color)] font-semibold">
                            <Check size={14} />
                            Persisted to engine
                        </span>
                    )}
                    {error && (
                        <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                            <AlertCircle size={14} />
                            {error}
                        </span>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-12 text-[var(--text-muted)] gap-3 text-sm">
                    <Loader2 size={18} className="animate-spin text-[var(--accent-color)]" />
                    Loading inference configurations...
                </div>
            ) : activeSubTab === 'gguf' && ggufConfig ? (
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
                            active={Boolean(ggufConfig.hardware_and_execution.no_mmap)}
                            onToggle={() => updateGgufHardware('no_mmap', !ggufConfig.hardware_and_execution.no_mmap)}
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
                            value={String(ggufConfig.hardware_and_execution.batch_size ?? 512)}
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
                            value={String(ggufConfig.hardware_and_execution.ubatch_size ?? 512)}
                            onChange={(val) => updateGgufHardware('ubatch_size', parseInt(val, 10))}
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
                            // null = not set: the model's own default (then llama.cpp's) is used
                            const saved = ggufConfig.samplers[item.key as keyof GgufSamplers];
                            const val = saved ?? item.min;
                            return (
                                <SettingSlider
                                    key={item.key}
                                    label={saved == null ? `${item.label} (model default)` : item.label}
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

                    {/* GGUF: Reasoning Default */}
                    <SettingSection title="Reasoning Default">
                        <SettingItem
                            label="Think Mode"
                            description="Default for chats that do not choose: Auto / On = the model may think and decides itself, Off = no thinking."
                            select={[
                                { value: 'Auto', label: 'Auto (Default)' },
                                { value: 'On', label: 'On' },
                                { value: 'Off', label: 'Off' }
                            ]}
                            value={ggufConfig.user_moved_flags.think_mode || 'Auto'}
                            onChange={(val) => updateGgufUserMoved('think_mode', val)}
                        />
                    </SettingSection>
                </>
            ) : activeSubTab === 'onnx' && onnxConfig ? (
                <>
                    {/* ONNX: Hardware & Execution */}
                    <SettingSection title="Hardware & Execution (ONNX)">
                        <SettingItem
                            label="Hardware Offload (n_gpu_layers)"
                            description="Target Execution Provider backend driver (DirectML / CUDA vs CPU)."
                            select={[
                                { value: '-1', label: 'GPU when available (DirectML / CUDA)' },
                                { value: '0', label: 'CPU Only' }
                            ]}
                            value={String(onnxConfig.n_gpu_layers)}
                            onChange={(val) => updateOnnxField('n_gpu_layers', parseInt(val, 10))}
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
                    </SettingSection>

                    {/* ONNX: Memory & Hardware Control */}
                    <SettingSection title="Memory & Hardware Control">
                        <SettingItem
                            label="Enable CPU Memory Arena"
                            description="Uses arena memory allocator for host CPU allocations to eliminate heap fragmentation."
                            toggle
                            active={onnxConfig.enable_cpu_mem_arena}
                            onToggle={() => updateOnnxField('enable_cpu_mem_arena', !onnxConfig.enable_cpu_mem_arena)}
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

                    {/* ONNX: Determinism */}
                    <SettingSection title="Determinism">
                        <SettingItem
                            label="Use Deterministic Compute"
                            description="Enforces deterministic kernel execution pathways across floating-point compute steps."
                            toggle
                            active={onnxConfig.use_deterministic_compute}
                            onToggle={() => updateOnnxField('use_deterministic_compute', !onnxConfig.use_deterministic_compute)}
                        />
                    </SettingSection>

                </>
            ) : null}
        </div>
    );
}

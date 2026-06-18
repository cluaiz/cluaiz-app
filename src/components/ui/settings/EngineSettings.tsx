import { useEffect } from 'react';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { SettingSection, SettingItem, SelectOption } from './SharedComponents';

const TTL_OPTIONS: SelectOption[] = [
    { label: '12 Hours', value: '12' },
    { label: '1 Day',    value: '24' },
    { label: '3 Days',   value: '72' },
    { label: '1 Week',   value: '168' },
];

const DESC_GPU_LAYERS: Record<string, string> = {
    '-1': 'System automatically balances workload. Runs as much on the GPU as possible for optimal speed.',
    '99': 'Forces the entire model onto the Graphics Card. Delivers maximum generation speed and VRAM utilization.',
    '0': 'Restricts the AI to use only the CPU and System RAM. Slower generation, but highly stable and safe.',
    '32': 'Splits the workload evenly between the GPU and CPU. Recommended for systems with limited VRAM.'
};

const DESC_VRAM_RECLAIM: Record<string, string> = {
    'Auto': 'System intelligently decides when to free memory based on your current hardware load.',
    'On': 'Instantly flushes GPU memory the moment a reply is finished. Keeps your PC completely smooth.',
    'Off': 'Keeps the AI loaded in memory for instant subsequent replies. Background apps may experience slight lag.'
};

const DESC_CONTEXT: Record<string, string> = {
    'Auto': 'System dynamically balances memory consumption and chat history retention.',
    'Off': 'Disables dynamic memory compression. The engine may crash if the conversation becomes excessively long.',
    'Minimal': 'Only retains the current topic and flushes older context (Saves maximum RAM).',
    'Standard': 'Best balance for everyday chats. Retains important older messages while freeing up unused memory.',
    'Aggressive': 'Attempts to compress and retain the entire conversation history. Requires higher CPU processing power.',
    'Extreme': 'Retains absolute context without forgetting. Demands maximum CPU and memory resources.'
};

const DESC_THINK_MODE: Record<string, string> = {
    'Auto': 'Engages reasoning processes exclusively for complex mathematical or coding queries.',
    'On': 'Forces the AI to narrate its internal step-by-step reasoning before providing the final answer.',
    'Off': 'Delivers direct answers immediately without displaying its internal thought process.'
};

const DESC_BRAIN_MODE = (active: boolean) => active ? 'Enabled: LLM is completely turned off. Only database and tools will run.' : 'Disabled: Normal mode. Generative AI is active.';
const DESC_LAZY_LOAD = (active: boolean) => active ? 'Enabled: Model loads only on first message. Saves RAM while idle.' : 'Disabled: Model loads instantly on startup.';
const DESC_WASM_FIREWALL: Record<string, string> = { 'auto': 'Blocks dangerous plugins automatically based on heuristics.', 'strict': 'Maximum security. All WASM plugins are heavily restricted.', 'off': 'No restrictions. Use only with trusted plugins.' };
const DESC_TELEMETRY = (active: boolean) => active ? 'Enabled: Sending anonymous performance data.' : 'Disabled: No data leaves your machine.';
const DESC_VEC_USER = (active: boolean) => active ? 'Enabled: Your chats are saved into the long-term semantic memory graph.' : 'Disabled: User inputs are forgotten after the session.';
const DESC_VEC_AI = (active: boolean) => active ? 'Enabled: AI responses are saved into the semantic memory graph.' : 'Disabled: AI responses are not memorized permanently.';
const DESC_MLOCK: Record<string, string> = { 'Auto': 'System decides based on RAM availability.', 'On': 'Forces the OS to lock the model in RAM. Prevents swapping and stuttering.', 'Off': 'Allows the OS to swap memory if needed.' };
const DESC_BOOSTER_PROFILE: Record<string, string> = { 'balance': 'Balances speed, memory, and CPU usage.', 'multitasking': 'Leaves room for background apps.', 'max_boost': 'High performance, uses more resources.', 'ultra_max_boost': 'Extreme performance, will lag background apps.', 'hyper_cluster': 'For multi-GPU setups only.', 'edge': 'Optimized for low-power devices and laptops.' };
const DESC_FLASH_ATTN: Record<string, string> = { 'Auto': 'System uses Flash Attention if supported by your hardware.', 'On': 'Forces Flash Attention. Very fast for long contexts.', 'Off': 'Disables Flash Attention. Useful if the model hallucinates.' };
const DESC_KV_QUANT: Record<string, string> = { 'Auto': 'System decides the best quantization level.', 'Kv16': 'Highest quality, uses more RAM.', 'Kv8': 'Good balance of quality and RAM usage.', 'Kv4': 'Maximum compression. Saves massive RAM but may reduce long-context quality slightly.' };
const DESC_TURBO: Record<string, string> = { 'Auto': 'System decides based on available memory bandwidth.', 'On': 'Compresses tensors dynamically for faster processing.', 'Off': 'Processes at standard precision.' };
const DESC_SPEC_DEC: Record<string, string> = { 'Auto': 'System decides whether to use a draft model.', 'On': 'Generates tokens faster by guessing ahead using a tiny model.', 'Off': 'Generates token-by-token normally.' };
const DESC_AUTO_ROUND: Record<string, string> = { 'Auto': 'System decides when to round weights.', 'On': 'Aggressively compresses the model to save VRAM.', 'Off': 'Maintains original model weight precision.' };
const DESC_DFLASH: Record<string, string> = { 'Auto': 'System dynamically allocates flash attention buffers.', 'On': 'Forces dynamic allocation, saving VRAM at the cost of slight CPU overhead.', 'Off': 'Pre-allocates buffers. Faster but uses more VRAM.' };
const DESC_MOE: Record<string, string> = { 'Auto': 'System decides MoE expert routing.', 'On': 'Optimizes VRAM strictly for Mixture-of-Experts models.', 'Off': 'Standard routing.' };


export function EngineSettings() {
    const { 
        fetchStatus,
        permissions,
        booster,
        brainMode,
        initEngineSettings,
        updatePermission,
        updateBooster,
        setBrainMode,
    } = useEngineStore();

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
                    <p>Connecting to Cluaize Engine natively...</p>
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
                        Could not load Native settings. Ensure the Cluaize Engine background daemon is running or click retry.
                    </p>
                    <button onClick={initEngineSettings} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors">
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // Build chat model options — use available_chat_models if provided, else fall back to available_models
    const chatModelOptions: string[] = permissions.available_chat_models?.length
        ? permissions.available_chat_models
        : permissions.available_models ?? ['llama3:8b'];

    // Build vector model options — use available_vector_models if provided, else fall back to available_models
    const vectorModelOptions: string[] = permissions.available_vector_models?.length
        ? permissions.available_vector_models
        : permissions.available_models ?? ['all-minilm-l6-v2'];

    return (
        <div className="space-y-8 select-none pb-12">
            <SettingSection title="Engine Lifecycle">
                <SettingItem
                    label="Pure Brain Mode (LLM OFF)"
                    description="Run the engine purely as a stateful database and knowledge base. The AI model will be strictly disabled."
                    toggle
                    active={brainMode}
                    onToggle={() => setBrainMode(!brainMode)}
                    dynamicDescription={DESC_BRAIN_MODE(brainMode)}
                />
                <SettingItem
                    label="Lazy Load Model (On Send)"
                    description="Wait until you send the first message to load the AI model into memory."
                    toggle
                    active={permissions.lazy_load_model}
                    onToggle={() => updatePermission('lazy_load_model', !permissions.lazy_load_model)}
                    dynamicDescription={DESC_LAZY_LOAD(permissions.lazy_load_model)}
                />
            </SettingSection>

            <SettingSection title="Security & Privacy">
                <SettingItem
                    label="WASM Firewall Mode"
                    description="Controls execution boundaries for WebAssembly plugins and code interpretation."
                    select={['auto', 'strict', 'off']}
                    value={permissions.wasm_firewall}
                    onChange={(v) => updatePermission('wasm_firewall', v)}
                    dynamicDescription={DESC_WASM_FIREWALL[permissions.wasm_firewall]}
                />
                <SettingItem
                    label="Stream Telemetry"
                    description="Log anonymous telemetry regarding token generation speeds to help improve engine routing."
                    toggle
                    active={permissions.stream_telemetry}
                    onToggle={() => updatePermission('stream_telemetry', !permissions.stream_telemetry)}
                    dynamicDescription={DESC_TELEMETRY(permissions.stream_telemetry)}
                />
            </SettingSection>

            <SettingSection title="Vector DB & Semantic Memory">
                <SettingItem
                    label="Vectorize User Input"
                    description="Automatically embed and store your chat inputs into the semantic graph for long-term memory."
                    toggle
                    active={permissions.vectorize_user_input}
                    onToggle={() => updatePermission('vectorize_user_input', !permissions.vectorize_user_input)}
                    dynamicDescription={DESC_VEC_USER(permissions.vectorize_user_input)}
                />
                <SettingItem
                    label="Vectorize AI Responses"
                    description="Automatically embed AI generated responses into the semantic graph."
                    toggle
                    active={permissions.vectorize_ai_response}
                    onToggle={() => updatePermission('vectorize_ai_response', !permissions.vectorize_ai_response)}
                    dynamicDescription={DESC_VEC_AI(permissions.vectorize_ai_response)}
                />
                <SettingItem
                    label="Temporary Chat TTL"
                    description="Time To Live before temporary chat memories are garbage collected."
                    select={TTL_OPTIONS}
                    value={permissions.temporary_chat_ttl_hours.toString()}
                    onChange={(v) => updatePermission('temporary_chat_ttl_hours', parseInt(v))}
                />
            </SettingSection>

            <SettingSection title="Hardware & Optimization">
                <SettingItem
                    label="Default Chat Model"
                    description="The primary generative AI model loaded into memory for conversation."
                    select={chatModelOptions}
                    value={permissions.chat_models.text || ''}
                    onChange={(v) => updatePermission('chat_models', { ...permissions.chat_models, text: v })}
                />
                <SettingItem
                    label="Default Vector Model"
                    description="The embedding model used for semantic graph memory and search."
                    select={vectorModelOptions}
                    value={permissions.vector_models.text || ''}
                    onChange={(v) => updatePermission('vector_models', { ...permissions.vector_models, text: v })}
                />
                <SettingItem
                    label="Force OS Memory Lock (mlock)"
                    description="Prevent the OS from swapping the model to the pagefile. Highly recommended if VRAM is low."
                    select={['Auto', 'On', 'Off']}
                    value={booster.force_memory_lock}
                    onChange={(v) => updateBooster('force_memory_lock', v)}
                    dynamicDescription={DESC_MLOCK[booster.force_memory_lock]}
                />
            </SettingSection>

            <SettingSection title="System Booster (Advanced Config)">
                <SettingItem
                    label="Booster Engine Profile"
                    description="Pre-configured profiles determining how aggressively Cluaize reclaims system resources."
                    select={['balance', 'multitasking', 'max_boost', 'ultra_max_boost', 'hyper_cluster', 'edge']}
                    value={booster.mode_run}
                    onChange={(v) => updateBooster('mode_run', v)}
                    dynamicDescription={DESC_BOOSTER_PROFILE[booster.mode_run]}
                />
                <SettingItem
                    label="Flash Attention"
                    description="Accelerates sequence lengths during generation. Disable if you experience hallucination bugs."
                    select={['Auto', 'On', 'Off']}
                    value={booster.flash_attention}
                    onChange={(v) => updateBooster('flash_attention', v)}
                    dynamicDescription={DESC_FLASH_ATTN[booster.flash_attention]}
                />
                <SettingItem
                    label="Smart Memory Management (Context Shifting)"
                    description="Controls how the AI manages its memory during long chats to prevent crashes."
                    select={['Auto', 'Off', 'Minimal', 'Standard', 'Aggressive', 'Extreme']}
                    value={booster.context_shifting}
                    onChange={(v) => updateBooster('context_shifting', v)}
                    dynamicDescription={DESC_CONTEXT[booster.context_shifting]}
                />
                <SettingItem
                    label="KV Cache Quantization"
                    description="Compress memory so you can have longer conversations without running out of RAM."
                    select={['Auto', 'Kv16', 'Kv8', 'Kv4']}
                    value={booster.kv_cache_quantization}
                    onChange={(v) => updateBooster('kv_cache_quantization', v)}
                    dynamicDescription={DESC_KV_QUANT[booster.kv_cache_quantization]}
                />
                <SettingItem
                    label="Turbo Quantization"
                    description="Accelerates processing by compressing AI brain-power on the fly."
                    select={['Auto', 'On', 'Off']}
                    value={booster.turbo_quant}
                    onChange={(v) => updateBooster('turbo_quant', v)}
                    dynamicDescription={DESC_TURBO[booster.turbo_quant]}
                />
                <SettingItem
                    label="Speculative Decoding"
                    description="Uses a tiny invisible model to predict the next words to generate answers faster."
                    select={['Auto', 'On', 'Off']}
                    value={booster.speculative_decoding}
                    onChange={(v) => updateBooster('speculative_decoding', v)}
                    dynamicDescription={DESC_SPEC_DEC[booster.speculative_decoding]}
                />
                <SettingItem
                    label="Auto-Round Quantization"
                    description="Automatically compresses the model to fit into smaller Graphic Cards."
                    select={['Auto', 'On', 'Off']}
                    value={booster.auto_round}
                    onChange={(v) => updateBooster('auto_round', v)}
                    dynamicDescription={DESC_AUTO_ROUND[booster.auto_round]}
                />
                <SettingItem
                    label="Dynamic Flash Attention (dflash)"
                    description="Smartly saves Graphic Card memory during generation."
                    select={['Auto', 'On', 'Off']}
                    value={booster.dflash}
                    onChange={(v) => updateBooster('dflash', v)}
                    dynamicDescription={DESC_DFLASH[booster.dflash]}
                />
                <SettingItem
                    label="Memory Cleaning (Force VRAM Reclaim)"
                    description="Choose how aggressively to free up Graphics Card memory after the AI answers."
                    select={['Auto', 'On', 'Off']}
                    value={booster.force_vram_reclaim}
                    onChange={(v) => updateBooster('force_vram_reclaim', v)}
                    dynamicDescription={DESC_VRAM_RECLAIM[booster.force_vram_reclaim]}
                />
                <SettingItem
                    label="GPU Processing Mode (n_gpu_layers)"
                    description="Decide how much of the AI's brain runs on your Graphics Card vs Processor."
                    select={[
                        { label: 'Auto', value: '-1' },
                        { label: 'Only GPU', value: '99' },
                        { label: 'Only CPU', value: '0' },
                        { label: 'Hybrid', value: '32' }
                    ]}
                    value={booster.n_gpu_layers.toString()}
                    onChange={(v) => updateBooster('n_gpu_layers', parseInt(v))}
                    dynamicDescription={DESC_GPU_LAYERS[booster.n_gpu_layers.toString()]}
                />
                <SettingItem
                    label="Chain-of-Thought (Think Mode)"
                    description="Let the AI think out loud and solve problems step-by-step before giving the final answer."
                    select={['Auto', 'On', 'Off']}
                    value={booster.think_mode}
                    onChange={(v) => updateBooster('think_mode', v)}
                    dynamicDescription={DESC_THINK_MODE[booster.think_mode]}
                />
                <SettingItem
                    label="MoE VRAM Routing"
                    description="Advanced smart routing for extremely large multi-expert models."
                    select={['Auto', 'On', 'Off']}
                    value={booster.moe_vram_routing}
                    onChange={(v) => updateBooster('moe_vram_routing', v)}
                    dynamicDescription={DESC_MOE[booster.moe_vram_routing]}
                />
            </SettingSection>
        </div>
    );
}

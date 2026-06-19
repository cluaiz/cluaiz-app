import { BoosterControl, HardwareInfo, SettingAlert } from '../../../store/engine/useEngineStore';

/**
 * Validates booster settings against real hardware and returns alerts.
 * This is the intelligent status system that prevents users from
 * setting dangerous combinations that break the engine.
 */
export function validateSettings(
    booster: BoosterControl,
    hardware: HardwareInfo | null,
    activeChatModel: any | null,
    activeVectorModel: any | null
): SettingAlert[] {
    const alerts: SettingAlert[] = [];

    // If hardware data is not available yet, we can only do basic checks
    if (!hardware) {
        // Force VRAM Reclaim ON but zero GPU layers — contradictory regardless of hardware
        if (booster.force_vram_reclaim === 'On' && booster.n_gpu_layers === 0) {
            alerts.push({
                level: 'red',
                message: 'VRAM Reclaim is ON but GPU layers is set to CPU-Only (0). There is no VRAM to reclaim.'
            });
        }
        return alerts;
    }

    const vram = hardware.vram_gb;
    const ram = hardware.ram_gb;
    const hasGpu = hardware.has_gpu;

    // ─── RED: Critical / Will Break ─────────────────────────────────

    const chatVramNeeded = activeChatModel ? (activeChatModel.ram_required_gb || 0) : 0;
    const vectorVramNeeded = activeVectorModel ? (activeVectorModel.ram_required_gb || 0) : 0;
    const totalVramNeeded = chatVramNeeded + vectorVramNeeded;
    
    // Minimum safe boundary (even the smallest models need ~0.5 GB)
    const baselineVram = totalVramNeeded > 0 ? totalVramNeeded : 1.5;

    // GPU-only mode but no GPU detected
    if (booster.n_gpu_layers === 99 && !hasGpu) {
        alerts.push({
            level: 'red',
            message: 'GPU-Only mode is selected but no GPU was detected. The engine will crash on model load.'
        });
    }

    // GPU-only mode but combined VRAM is too small
    if (booster.n_gpu_layers === 99 && hasGpu && vram < baselineVram) {
        let culprit = "";
        if (chatVramNeeded > vram) culprit = `Chat model is too heavy (${chatVramNeeded.toFixed(1)}GB). `;
        else if (vectorVramNeeded > vram) culprit = `Vector model is too heavy (${vectorVramNeeded.toFixed(1)}GB). `;

        alerts.push({
            level: 'red',
            message: `GPU-Only mode failed: Combined active models need ~${baselineVram.toFixed(1)} GB VRAM. ${culprit}Your GPU only has ${vram.toFixed(1)} GB. Switch to Auto (-1).`
        });
    }

    // Speculative decoding ON with low VRAM — loads TWO models
    if (booster.speculative_decoding === 'On' && hasGpu && vram < 8) {
        alerts.push({
            level: 'red',
            message: `Speculative Decoding loads a second draft model. Your ${vram.toFixed(1)} GB VRAM cannot fit two models. Turn it Off.`
        });
    }

    // Force VRAM Reclaim ON but zero GPU layers — contradictory
    if (booster.force_vram_reclaim === 'On' && booster.n_gpu_layers === 0) {
        alerts.push({
            level: 'red',
            message: 'VRAM Reclaim is ON but GPU layers is set to CPU-Only (0). There is no VRAM to reclaim.'
        });
    }

    // Hyper Cluster mode on a single-GPU consumer machine
    if (booster.mode_run === 'hyper_cluster' && hasGpu && vram < 24) {
        alerts.push({
            level: 'red',
            message: 'Hyper Cluster mode is designed for multi-GPU server racks. Running it on a consumer GPU will freeze your system.'
        });
    }
    // ─── YELLOW: Warning / May Cause Issues ─────────────────────────

    // CPU-Only mode — slow TPS for large models based on real dynamic parameters
    if (booster.n_gpu_layers === 0 && hasGpu) {
        // Dynamic check: If total model weight exceeds half the system RAM or is structurally large
        const isLarge = (totalVramNeeded > (ram / 2)) || (totalVramNeeded > 3.0);
        
        if (isLarge) {
            alerts.push({
                level: 'yellow',
                message: `CPU-Only Mode: Your GPU (${hardware?.gpu_name?.trim() || 'unknown'}) is bypassed. The loaded models (Chat+Vector) require ~${baselineVram.toFixed(1)}GB memory. Running this entirely on CPU will suffer severe TPS drops. Switch to Auto.`
            });
        }
    }

    // Think Mode TPS / TTFT Warning
    if (booster.think_mode === 'On') {
        alerts.push({
            level: 'yellow',
            message: 'Think Mode is ON. Time-To-First-Token (TTFT) will increase and overall visible TPS will drop as the AI generates hidden internal reasoning first.'
        });
    }

    // Ultra Max Boost on laptop-class hardware
    if (booster.mode_run === 'ultra_max_boost' && vram > 0 && vram < 8) {
        alerts.push({
            level: 'yellow',
            message: 'Ultra Max Boost reclaims all system resources. On systems with limited VRAM, this may cause OS-level lag.'
        });
    }

    // Extreme context shifting — heavy CPU usage
    if (booster.context_shifting === 'Extreme') {
        alerts.push({
            level: 'yellow',
            message: 'Extreme context shifting causes heavy recalculations. TPS will drop significantly during long conversations.'
        });
    }

    // KV4 quantization — quality loss vs RAM
    if (booster.kv_cache_quantization === 'Kv4') {
        alerts.push({
            level: 'yellow',
            message: 'KV-Cache at 4-bit saves massive RAM for 100k+ contexts, but causes degradation in reasoning for smaller models.'
        });
    }

    // Flash Attention OFF — missing optimization
    if (booster.flash_attention === 'Off') {
        alerts.push({
            level: 'yellow',
            message: 'Flash Attention is disabled. TPS will degrade exponentially as the conversation context grows.'
        });
    }

    // Memory Lock ON with plenty of RAM — unnecessary
    if (booster.force_memory_lock === 'On' && ram > 16) {
        alerts.push({
            level: 'yellow',
            message: `Memory Lock (mlock) is ON. With ${ram.toFixed(0)} GB RAM, OS swapping is unlikely. Auto mode is safer.`
        });
    }

    return alerts;
}

/**
 * Returns the overall health level based on the worst alert.
 */
export function getOverallHealth(alerts: SettingAlert[]): 'green' | 'yellow' | 'red' {
    if (alerts.some(a => a.level === 'red')) return 'red';
    if (alerts.some(a => a.level === 'yellow')) return 'yellow';
    return 'green';
}

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Cpu, HardDrive, Layers, Sparkles, Zap } from 'lucide-react';
import type { ChatModelLoadState } from '../../../store/chat/types';
import { useEngineStore } from '../../../store/engine/useEngineStore';

interface ModelLoadCardProps {
    modelLoad?: ChatModelLoadState;
}

const formatSec = (ms?: number) => {
    if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return '';
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
};

function inferModelSpecs(modelId: string | undefined, installedMap: Record<string, any>) {
    const cleanId = modelId || '';
    const entry = installedMap[cleanId]
        || Object.values(installedMap).find((m: any) => m?.id?.toLowerCase() === cleanId.toLowerCase());
    const primaryBytes = entry?.files?.reduce((acc: number, f: any) => acc + (Number(f?.size_bytes) || 0), 0) || 0;
    const sizeGb = primaryBytes > 0 ? (primaryBytes / 1024 ** 3) : undefined;

    const paramMatch = cleanId.match(/(?:^|[-_])(\d+(?:\.\d+)?[bBmM])(?:[-_]|$)/);
    const rawParams = entry?.metadata?.parameters && entry.metadata.parameters !== 'Unknown'
        ? String(entry.metadata.parameters)
        : (paramMatch ? paramMatch[1].toUpperCase() : undefined);

    const quantMatch = cleanId.match(/(Q\d+_[A-Z0-9_]+|F16|BF16|IQ\d+_[A-Z0-9_]+|MXFP4)/i);
    const quant = quantMatch
        ? quantMatch[1].toUpperCase()
        : (entry?.metadata?.quantization && entry.metadata.quantization !== '15' && entry.metadata.quantization !== 'Standard'
            ? String(entry.metadata.quantization)
            : undefined);

    const arch = entry?.metadata?.architecture && entry.metadata.architecture !== 'unknown'
        ? String(entry.metadata.architecture).toUpperCase()
        : (cleanId.split(/[-_]/)[0]?.toUpperCase() || 'LLM');

    const prettyName = cleanId
        .replace(/-gguf.*$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()) || 'Local Model';

    return { prettyName, sizeGb, params: rawParams, quant, arch };
}

/**
 * Visual Architecture & 3-Tier Hardware Split Diagram (GPU VRAM · System RAM · SSD Disk Stream)
 * for Chat model loads. Renders only on turns where an actual model load occurred.
 */
export const ModelLoadCard: React.FC<ModelLoadCardProps> = ({ modelLoad }) => {
    const [isOpen, setIsOpen] = useState(modelLoad?.status === 'failed');
    const installedModelsMap = useEngineStore(s => s.installedModelsMap);

    if (!modelLoad || (modelLoad.status !== 'loading' && modelLoad.steps.length === 0 && !modelLoad.plan)) {
        return null;
    }

    const { status, steps, plan, loadMs } = modelLoad;
    const loadedStep = [...steps].reverse().find(step => step.kind === 'loaded');
    const startedStep = steps.find(step => step.kind === 'started');
    const retrySteps = steps.filter(step => step.kind === 'retry');

    const modelId = plan?.model_id || modelLoad.model || loadedStep?.model || startedStep?.model;
    const specs = inferModelSpecs(modelId, installedModelsMap);

    const totalBlocks = plan?.total_layers ?? 0;
    const rawGpuLayers = plan?.n_gpu_layers ?? loadedStep?.n_gpu_layers ?? startedStep?.n_gpu_layers;
    const gpuBlocks = plan?.gpu_blocks ?? (rawGpuLayers !== undefined
        ? (rawGpuLayers < 0 ? totalBlocks : rawGpuLayers === 0 ? 0 : Math.min(totalBlocks || Math.max(0, rawGpuLayers - 1), Math.max(0, rawGpuLayers - 1)))
        : 0);
    const ramBlocks = plan?.ram_blocks ?? Math.max(0, totalBlocks - gpuBlocks);
    const outputHeadOnGpu = rawGpuLayers !== undefined && rawGpuLayers !== 0;
    const cpuMoe = plan?.n_cpu_moe ?? loadedStep?.n_cpu_moe ?? startedStep?.n_cpu_moe ?? 0;

    const rawPlacement = plan?.placement || loadedStep?.placement || startedStep?.placement || '';
    const diskMatch = plan?.planner?.match(/(\d+(?:\.\d+)?)\s*GB[^;,.]*?(?:from disk|on disk|SSD)/i);
    const diskStreamGb = plan?.disk_stream_gb ?? (diskMatch ? parseFloat(diskMatch[1]) : 0);
    const isSsdStreaming = rawPlacement === 'SsdStreaming' || diskStreamGb > 0 || /from disk/i.test(plan?.planner || '');

    const vramTaken = loadedStep?.vram_taken_gb;
    const vramPlanned = plan?.vram_planned_gb ?? loadedStep?.vram_planned_gb ?? startedStep?.vram_planned_gb;
    const vramGb = vramTaken ?? vramPlanned ?? 0;
    const ramGb = plan?.ram_planned_gb ?? 0;
    const totalFileGb = specs.sizeGb ?? ((plan?.vram_weights_gb && plan?.ram_weights_gb) ? (plan.vram_weights_gb + plan.ram_weights_gb + diskStreamGb) : undefined);

    const freeBufferMatch = plan?.planner?.match(/(\d+(?:\.\d+)?)\s*GB of VRAM kept free/i);
    const vramBufferGb = plan?.vram_buffer_gb ?? (freeBufferMatch ? parseFloat(freeBufferMatch[1]) : undefined);

    const nCtx = plan?.n_ctx ?? loadedStep?.n_ctx ?? startedStep?.n_ctx ?? 0;
    const effectiveMs = loadMs ?? plan?.model_load_ms ?? loadedStep?.ms;
    const durationText = formatSec(effectiveMs);

    const gpuShare = totalBlocks > 0 ? Math.round((gpuBlocks / totalBlocks) * 100) : (outputHeadOnGpu ? 100 : 0);
    const ramShare = totalBlocks > 0 ? Math.max(0, 100 - gpuShare) : 0;

    const placementTitle = plan?.placement_label
        || (isSsdStreaming ? 'MoE / Weights SSD Disk Streaming'
            : totalBlocks > 0 && gpuBlocks === totalBlocks && cpuMoe === 0 ? 'Full GPU'
            : cpuMoe > 0 ? 'MoE GPU + RAM Split'
            : gpuBlocks > 0 && ramBlocks > 0 ? 'GPU + RAM Hybrid Split'
            : gpuBlocks === 0 ? 'CPU & System RAM' : (rawPlacement || 'Engine Plan'));

    // While loading, only the inline live Engine event message is rendered by MessageBubble; no card is shown.
    if (status === 'loading') {
        return null;
    }

    const splitSummary = totalBlocks > 0
        ? [
            `${gpuBlocks}/${totalBlocks} GPU`,
            ramBlocks > 0 ? `${ramBlocks} RAM` : undefined,
            cpuMoe > 0 ? `${cpuMoe} MoE ${isSsdStreaming ? 'SSD/RAM' : 'RAM'}` : undefined,
            isSsdStreaming && diskStreamGb > 0 ? `${diskStreamGb.toFixed(2)} GB SSD` : undefined,
        ].filter(Boolean).join(' · ')
        : placementTitle;

    // Build per-layer block state: 'gpu' | 'moe_split' | 'ram' | 'ssd'
    const moeStartBlock = cpuMoe > 0 && totalBlocks > 0 ? Math.max(0, gpuBlocks - cpuMoe) : gpuBlocks;
    const blockKinds: Array<'gpu' | 'moe_ram' | 'moe_ssd' | 'ram' | 'ssd'> = totalBlocks > 0
        ? Array.from({ length: totalBlocks }, (_, i) => {
            if (i < gpuBlocks) {
                if (cpuMoe > 0 && i >= moeStartBlock) {
                    return isSsdStreaming ? 'moe_ssd' : 'moe_ram';
                }
                return 'gpu';
            }
            return isSsdStreaming ? 'ssd' : 'ram';
        })
        : [];

    return (
        <div className="w-full my-1 select-text text-left" style={{ fontSize: 'calc(var(--chat-bubble-font-size, 14px) * 0.88)' }}>
            {/* Subtle inline trigger matching "Thought for 1.9s" */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors py-1 cursor-pointer group/load"
            >
                {status === 'failed' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/85 shrink-0" />
                )}
                <span className={`font-normal text-xs ${status === 'failed' ? 'text-red-400' : 'text-zinc-400 group-hover/load:text-zinc-200'}`}>
                    {status === 'failed' ? 'Model load failed' : (durationText ? `Model loaded in ${durationText}` : 'Model loaded')}
                    {splitSummary ? ` · ${splitSummary}` : ''}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 group-hover/load:text-zinc-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="mt-1.5 mb-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-secondary)]/30 backdrop-blur-sm p-4 space-y-4 text-xs">
                    {/* ── STAGE 1: MODEL IDENTITY & ARCHITECTURE BLUEPRINT HEADER ── */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] shrink-0">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-[var(--text-primary)] truncate">{specs.prettyName}</span>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30">
                                        {placementTitle}
                                    </span>
                                </div>
                                <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                                    {modelId}
                                </div>
                            </div>
                        </div>

                        {/* Model Spec Pills: Size, Parameters, Quant, Blocks, Attention/KV */}
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                            {specs.params && (
                                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)]/70 border border-[var(--border-color)]/70 text-[var(--text-primary)] font-semibold">
                                    {specs.params} Params
                                </span>
                            )}
                            {totalFileGb !== undefined && totalFileGb > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)]/70 border border-[var(--border-color)]/70 text-[var(--text-secondary)]">
                                    {totalFileGb.toFixed(2)} GB Model
                                </span>
                            )}
                            {specs.quant && (
                                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)]/70 border border-[var(--border-color)]/70 text-[var(--text-secondary)]">
                                    {specs.quant}
                                </span>
                            )}
                            {totalBlocks > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)]/70 border border-[var(--border-color)]/70 text-[var(--text-secondary)]">
                                    {totalBlocks} Blocks + Head
                                </span>
                            )}
                            {nCtx > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-primary)]/70 border border-[var(--border-color)]/70 text-[var(--text-secondary)]">
                                    {nCtx.toLocaleString()} Context
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── STAGE 2: 3-TIER VISUAL HARDWARE ROUTING DIAGRAM (GPU VRAM · CPU RAM · SSD DISK) ── */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 @2xl/chat:grid-cols-11 gap-3 items-stretch">
                            {/* Left Source Node: Model Architecture */}
                            <div className="@2xl/chat:col-span-3 rounded-xl border border-[var(--border-color)]/70 bg-[var(--bg-primary)]/50 p-3 flex flex-col justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                                        <Layers className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                        <span>Model Architecture</span>
                                    </div>
                                    <div className="text-xs font-bold text-[var(--text-primary)]">
                                        {totalBlocks > 0 ? `${totalBlocks} Transformer Layers` : `${specs.arch} Graph`}
                                    </div>
                                </div>

                                <div className="my-2.5 space-y-1.5 text-[11px] font-mono">
                                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                                        <span>Attention</span>
                                        <span className="text-[var(--text-primary)] font-semibold">
                                            Flash {plan?.settings?.flash_attn || 'Auto'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                                        <span>KV Cache</span>
                                        <span className="text-[var(--text-primary)] font-semibold">
                                            {plan?.cache_type || 'Auto'} ({plan?.offload_kqv === false ? 'RAM' : 'GPU'})
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                                        <span>Output Head</span>
                                        <span className="text-emerald-400 font-semibold">
                                            {outputHeadOnGpu ? 'On GPU' : 'On CPU'}
                                        </span>
                                    </div>
                                    {cpuMoe > 0 && (
                                        <div className="flex items-center justify-between text-[var(--text-secondary)]">
                                            <span>MoE Experts</span>
                                            <span className="text-amber-300 font-semibold">
                                                {cpuMoe} layers offloaded
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-[10px] font-mono text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-color)]/40">
                                    Batch {plan?.settings?.n_batch ?? 512} / ubatch {plan?.settings?.n_ubatch ?? 512}
                                </div>
                            </div>

                            {/* Center SVG 3-Branch Routing Bus Connector */}
                            <div className="hidden @2xl/chat:flex @2xl/chat:col-span-1 items-center justify-center">
                                <svg className="w-full h-44 overflow-visible" viewBox="0 0 48 160" fill="none">
                                    {/* Branch 1 -> GPU VRAM */}
                                    <path
                                        d="M 0 80 C 24 80, 20 24, 48 24"
                                        stroke="#10b981"
                                        strokeWidth="2"
                                        strokeDasharray={gpuBlocks > 0 ? 'none' : '3 3'}
                                        opacity={gpuBlocks > 0 ? 0.9 : 0.25}
                                    />
                                    <circle cx="45" cy="24" r="3" fill="#10b981" opacity={gpuBlocks > 0 ? 1 : 0.25} />
                                    {/* Branch 2 -> System RAM */}
                                    <path
                                        d="M 0 80 C 24 80, 24 80, 48 80"
                                        stroke="#38bdf8"
                                        strokeWidth="2"
                                        strokeDasharray={ramBlocks > 0 || cpuMoe > 0 ? 'none' : '3 3'}
                                        opacity={ramBlocks > 0 || cpuMoe > 0 ? 0.9 : 0.25}
                                    />
                                    <circle cx="45" cy="80" r="3" fill="#38bdf8" opacity={ramBlocks > 0 || cpuMoe > 0 ? 1 : 0.25} />
                                    {/* Branch 3 -> SSD Disk Stream */}
                                    <path
                                        d="M 0 80 C 24 80, 20 136, 48 136"
                                        stroke="#f59e0b"
                                        strokeWidth="2"
                                        strokeDasharray={isSsdStreaming ? 'none' : '3 3'}
                                        opacity={isSsdStreaming ? 0.9 : 0.22}
                                    />
                                    <circle cx="45" cy="136" r="3" fill="#f59e0b" opacity={isSsdStreaming ? 1 : 0.22} />
                                    <circle cx="3" cy="80" r="3.5" fill="var(--accent-color)" />
                                </svg>
                            </div>

                            {/* Right 3 Hardware Targets: GPU VRAM + CPU System RAM + SSD Disk Stream */}
                            <div className="@2xl/chat:col-span-7 flex flex-col gap-2 justify-between">
                                {/* Lane 1: GPU (VRAM) */}
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 space-y-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                            <span className="font-bold text-xs text-[var(--text-primary)]">1. GPU · VRAM Execution</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                                {totalBlocks > 0 ? `${gpuBlocks} / ${totalBlocks} Blocks (${gpuShare}%)` : 'Active'}
                                            </span>
                                        </div>
                                        <span className="font-mono text-xs font-bold text-emerald-400">
                                            {vramGb > 0 ? `${vramGb.toFixed(2)} GB VRAM` : '0.00 GB VRAM'}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
                                        <span>
                                            Blocks: <b className="text-[var(--text-primary)]">{gpuBlocks > 0 ? `Layers 1–${gpuBlocks}` : 'None'}</b>
                                            {cpuMoe > 0 ? ' (Attention on GPU)' : ''}
                                        </span>
                                        {outputHeadOnGpu && <span>+ <b className="text-emerald-300">Output Head</b></span>}
                                        {plan?.offload_kqv !== false && <span>+ <b className="text-emerald-300">KV ({plan?.cache_type || 'Auto'})</b></span>}
                                        {vramBufferGb !== undefined && vramBufferGb > 0 && (
                                            <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                                                Reserve: {vramBufferGb.toFixed(2)} GB free
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Lane 2: System RAM & CPU */}
                                <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2.5 space-y-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                            <span className="font-bold text-xs text-[var(--text-primary)]">2. CPU · System RAM</span>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                                {totalBlocks > 0 && ramBlocks > 0
                                                    ? `${ramBlocks} / ${totalBlocks} Blocks (${ramShare}%)`
                                                    : cpuMoe > 0 ? `${cpuMoe} MoE Expert Layers` : '0 Blocks'}
                                            </span>
                                        </div>
                                        <span className="font-mono text-xs font-bold text-sky-400">
                                            {ramGb > 0 ? `${ramGb.toFixed(2)} GB RAM` : '0.00 GB RAM'}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
                                        <span>
                                            Blocks: <b className="text-[var(--text-primary)]">
                                                {ramBlocks > 0 ? `Layers ${gpuBlocks + 1}–${totalBlocks}` : 'None (full blocks on GPU)'}
                                            </b>
                                        </span>
                                        {cpuMoe > 0 && (
                                            <span>
                                                + <b className="text-sky-300">{cpuMoe} MoE Experts in RAM</b>
                                            </span>
                                        )}
                                        {plan?.settings?.n_threads && (
                                            <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                                                {plan.settings.n_threads} CPU threads
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Lane 3: SSD / NVMe Disk Streaming */}
                                <div className={`rounded-xl border px-3 py-2.5 space-y-1 ${
                                    isSsdStreaming
                                        ? 'border-amber-500/40 bg-amber-500/[0.08]'
                                        : 'border-[var(--border-color)]/50 bg-[var(--bg-primary)]/30 opacity-75'
                                }`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <HardDrive className={`w-3.5 h-3.5 shrink-0 ${isSsdStreaming ? 'text-amber-400' : 'text-[var(--text-muted)]'}`} />
                                            <span className="font-bold text-xs text-[var(--text-primary)]">3. SSD · Disk Streaming (mmap)</span>
                                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                                isSsdStreaming
                                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]'
                                            }`}>
                                                {isSsdStreaming ? 'Active MoE / Weight Stream' : '0 Blocks on SSD'}
                                            </span>
                                        </div>
                                        <span className={`font-mono text-xs font-bold ${isSsdStreaming ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
                                            {diskStreamGb > 0 ? `${diskStreamGb.toFixed(2)} GB Streamed` : '0.00 GB SSD'}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--text-secondary)]">
                                        <span>
                                            {isSsdStreaming
                                                ? <>Cold MoE experts / weights read on-demand from SSD via <b className="text-amber-300">OS mmap</b></>
                                                : <>All active weights fit in VRAM + RAM (no disk streaming required)</>}
                                        </span>
                                        {plan?.settings?.use_mmap !== undefined && (
                                            <span className="text-[10px] text-[var(--text-muted)]">
                                                mmap {plan.settings.use_mmap ? 'on' : 'off'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Visual Block-by-Block Hardware Matrix Diagram */}
                        {blockKinds.length > 0 && (
                            <div className="rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-primary)]/45 p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                    <span className="font-semibold text-[var(--text-primary)]">
                                        Layer-by-Layer Hardware Map ({totalBlocks} Blocks + Output Head)
                                    </span>
                                    <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
                                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                                            GPU VRAM ({Math.max(0, gpuBlocks - cpuMoe)} full{outputHeadOnGpu ? ' + Head' : ''})
                                        </span>
                                        {cpuMoe > 0 && (
                                            <span className="inline-flex items-center gap-1.5 text-amber-300">
                                                <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-emerald-400 to-amber-400 inline-block" />
                                                MoE Split: Attn GPU + Experts {isSsdStreaming ? 'SSD' : 'RAM'} ({cpuMoe})
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1.5 text-sky-400">
                                            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400/80 inline-block" />
                                            System RAM ({isSsdStreaming ? 0 : ramBlocks} blocks)
                                        </span>
                                        {isSsdStreaming && (
                                            <span className="inline-flex items-center gap-1.5 text-amber-400">
                                                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                                                SSD Stream ({diskStreamGb > 0 ? `${diskStreamGb.toFixed(2)} GB` : `${ramBlocks} blocks`})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Individual Transformer Block Cells */}
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                    {blockKinds.map((kind, idx) => {
                                        const style = kind === 'gpu'
                                            ? 'bg-emerald-500/25 border border-emerald-400/60 text-emerald-300'
                                            : kind === 'moe_ram'
                                                ? 'bg-gradient-to-b from-emerald-500/30 to-sky-500/30 border border-sky-400/60 text-emerald-200'
                                                : kind === 'moe_ssd'
                                                    ? 'bg-gradient-to-b from-emerald-500/30 to-amber-500/35 border border-amber-400/60 text-amber-200'
                                                    : kind === 'ssd'
                                                        ? 'bg-amber-500/25 border border-amber-400/60 text-amber-300'
                                                        : 'bg-sky-500/20 border border-sky-400/50 text-sky-300';
                                        const label = kind === 'gpu'
                                            ? 'Full Block on GPU (VRAM)'
                                            : kind === 'moe_ram'
                                                ? 'MoE Split: Attention on GPU + Experts in System RAM'
                                                : kind === 'moe_ssd'
                                                    ? 'MoE Split: Attention on GPU + Experts streamed from SSD'
                                                    : kind === 'ssd'
                                                        ? 'Block streamed from SSD via mmap'
                                                        : 'Block in System RAM (CPU)';
                                        return (
                                            <div
                                                key={idx}
                                                title={`Block ${idx + 1}: ${label}`}
                                                className={`h-5 flex-1 min-w-[14px] max-w-[28px] rounded text-[9px] font-mono font-bold flex items-center justify-center transition-transform hover:scale-110 ${style}`}
                                            >
                                                {idx + 1}
                                            </div>
                                        );
                                    })}
                                    {/* Output Head Cell */}
                                    <div
                                        title={`Output Head: ${outputHeadOnGpu ? 'GPU (VRAM)' : 'CPU (System RAM)'}`}
                                        className={`h-5 px-2 rounded text-[9px] font-mono font-bold flex items-center justify-center shrink-0 ${
                                            outputHeadOnGpu
                                                ? 'bg-emerald-500/35 border border-emerald-300 text-emerald-200'
                                                : 'bg-sky-500/25 border border-sky-300 text-sky-200'
                                        }`}
                                    >
                                        HEAD
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── STAGE 3: VISUAL EXECUTION TIMELINE ── */}
                    <div className="pt-2 border-t border-[var(--border-color)]/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex flex-wrap items-center gap-1.5 text-[var(--text-secondary)]">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/60">
                                1. Planned ({placementTitle})
                            </span>
                            <span className="text-[var(--text-muted)]">→</span>
                            {retrySteps.map((retry, idx) => (
                                <React.Fragment key={idx}>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300" title={retry.detail}>
                                        Retry #{retry.attempt ?? idx + 2}: {retry.placement || 'Smaller placement'}
                                    </span>
                                    <span className="text-[var(--text-muted)]">→</span>
                                </React.Fragment>
                            ))}
                            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/60">
                                2. Weights 100%
                            </span>
                            <span className="text-[var(--text-muted)]">→</span>
                            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/60">
                                3. KV & Buffers ({nCtx > 0 ? `${nCtx.toLocaleString()} ctx` : 'Ready'})
                            </span>
                            <span className="text-[var(--text-muted)]">→</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                                ✓ Warmed Up{durationText ? ` · ${durationText}` : ''}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

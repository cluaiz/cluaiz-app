import { systemApi } from '../../api/engine/system/system.api';
import type { PublicModel } from '../../api/catalogue/models';

export interface CachedHardwareProfile {
  osName: string;
  isMacUnified: boolean;
  ramGb: number;
  vramGb: number;
  gpuName: string;
  timestamp: number;
}

const STORAGE_KEY = 'cluaiz_cached_hardware_profile';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function parseParamBillions(paramStr?: string): number {
  if (!paramStr) return 0;
  const clean = paramStr.replace(/,/g, '').trim();
  const match = clean.match(/([0-9]+(?:\.[0-9]+)?)\s*([BMKTP]?)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  if (unit === 'T') return val * 1000;
  if (unit === 'B') return val;
  if (unit === 'M') return val / 1000;
  if (unit === 'K') return val / 1000000;
  return val;
}

/**
 * Reads cached hardware profile from localStorage or probes local engine/browser.
 */
export async function getSystemHardwareProfile(): Promise<CachedHardwareProfile> {
  if (typeof window !== 'undefined') {
    try {
      const cachedRaw = localStorage.getItem(STORAGE_KEY);
      if (cachedRaw) {
        const parsed: CachedHardwareProfile = JSON.parse(cachedRaw);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.ramGb > 0) {
          return parsed;
        }
      }
    } catch {
      // Storage restricted, proceed to probe
    }
  }

  // Probe via Engine API
  try {
    const sysInfo = await systemApi.getSystemInfo();
    const hw = sysInfo.hardware;
    const osName = hw.os_name || (typeof navigator !== 'undefined' ? navigator.platform : 'Unknown');
    const isMac = osName.toLowerCase().includes('darwin') || osName.toLowerCase().includes('mac');
    const isArm = hw.architecture?.toLowerCase().includes('arm') || hw.architecture?.toLowerCase().includes('aarch64');
    const isMacUnified = isMac && isArm;

    const ramGb = Math.round(hw.memory?.total_gb || 8);
    let vramGb = 0;
    let gpuName = 'Integrated Engine Compute';

    if (hw.gpus && hw.gpus.length > 0) {
      gpuName = hw.gpus[0].name || gpuName;
      vramGb = hw.gpus.reduce((sum, g) => sum + (g.vram_total_gb || (g.vram_total_bytes / (1024 ** 3)) || 0), 0);
    }

    if (isMacUnified) {
      // macOS Apple Silicon allocates up to 75% of unified memory to GPU metal buffers
      vramGb = Math.round(ramGb * 0.75);
      gpuName = 'Apple Silicon Unified Memory';
    }

    const profile: CachedHardwareProfile = {
      osName,
      isMacUnified,
      ramGb: Math.max(4, ramGb),
      vramGb: Math.max(vramGb > 0 ? Math.round(vramGb) : 2, 2),
      gpuName,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch { /* ignore storage error */ }

    return profile;
  } catch {
    // Graceful fallback to browser environment hints
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent || navigator.platform);
    const navMem = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? Number((navigator as { deviceMemory?: number }).deviceMemory) || 8
      : 8;

    const profile: CachedHardwareProfile = {
      osName: isMac ? 'macOS' : (typeof navigator !== 'undefined' && navigator.userAgent.includes('Win') ? 'Windows' : 'Linux'),
      isMacUnified: isMac,
      ramGb: navMem,
      vramGb: isMac ? Math.round(navMem * 0.75) : 4,
      gpuName: isMac ? 'Apple Silicon Unified Memory' : 'Host GPU Compute',
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch { /* ignore */ }

    return profile;
  }
}

export interface RecommendationResult {
  score: number;
  badge: string;
  reason: string;
}

/**
 * Cluaiz Hybrid Scoring: Evaluates VRAM + RAM + SSD MoE Streaming fit for host hardware.
 */
export function calculateModelHardwareScore(
  model: PublicModel,
  hw: CachedHardwareProfile
): RecommendationResult {
  const paramB = parseParamBillions(model.parameters);
  
  // Estimate smallest available download package in GB
  let minPackageGb = 0;
  if (model.variants && model.variants.length > 0) {
    const minBytes = Math.min(...model.variants.map((v) => v.bytes || 0).filter((b) => b > 0));
    if (minBytes > 0 && Number.isFinite(minBytes)) {
      minPackageGb = minBytes / (1024 ** 3);
    }
  }
  if (minPackageGb <= 0 && paramB > 0) {
    // Default estimated 4-bit quant footprint ~ 0.65 GB per billion params
    minPackageGb = paramB * 0.65;
  }

  const vram = hw.vramGb;
  const ram = hw.ramGb;
  const isMacUnified = hw.isMacUnified;

  // 1. Apple Silicon Unified Architecture
  if (isMacUnified) {
    const unifiedLimit = ram * 0.75;
    if (minPackageGb <= unifiedLimit) {
      const sweetRatio = minPackageGb / unifiedLimit;
      const score = sweetRatio >= 0.25 && sweetRatio <= 0.85 ? 98 : 92;
      return {
        score,
        badge: 'Unified GPU Fit',
        reason: `Fits fully into macOS Unified Memory (${ram} GB). Fastest execution.`,
      };
    }
    if (minPackageGb <= ram) {
      return {
        score: 85,
        badge: 'High RAM Fit',
        reason: `Fits within total Unified Memory with light host paging.`,
      };
    }
    // Cluaiz SSD Streaming fits larger models smoothly
    return {
      score: 72,
      badge: 'SSD Stream',
      reason: `Cluaiz SSD Streaming streams weights without memory exhaustion.`,
    };
  }

  // 2. Windows & Linux Dedicated GPU + RAM Architecture
  // Tier 1: Pure GPU VRAM (fastest zero-overhead path)
  if (minPackageGb <= vram * 0.9) {
    const sweetRatio = minPackageGb / Math.max(1, vram);
    const score = sweetRatio >= 0.3 && sweetRatio <= 0.9 ? 99 : 93;
    return {
      score,
      badge: 'Direct GPU',
      reason: `Fits completely in ${vram} GB dedicated VRAM.`,
    };
  }

  // Tier 2: Hybrid VRAM + RAM Layer Offloading
  const hybridPool = vram + ram;
  if (minPackageGb <= hybridPool * 0.85) {
    return {
      score: 84,
      badge: 'Hybrid Fit',
      reason: `Runs via Cluaiz hybrid offloading split across VRAM (${vram} GB) + RAM (${ram} GB).`,
    };
  }

  // Tier 3: Cluaiz SSD MoE Streaming (Disk streaming for 14B - 32B+ models)
  // Even if 4GB RAM + 4GB VRAM, Cluaiz streams weights directly from SSD
  if (minPackageGb <= 45 || paramB <= 35) {
    return {
      score: 76,
      badge: 'SSD Stream Fit',
      reason: `Cluaiz SSD Streaming streams weights directly from drive without crashing.`,
    };
  }

  // Tier 4: Huge models (> 70B)
  return {
    score: 55,
    badge: 'Heavy MoE Stream',
    reason: `Viable via SSD Streaming, requires NVMe read throughput.`,
  };
}


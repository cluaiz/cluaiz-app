import { Sparkles, Zap, Code } from 'lucide-react';
import BorderGlow from '../ui/BorderGlow';
import ClickSpark from '../ui/ClickSpark';
import { Backlight } from '../ui/Backlight';
import { RichHoverCard } from '../ui/RichHoverCard';
import type { ShowcaseDemoState } from './state';
export function EffectDemos(state: ShowcaseDemoState){
const {borderRadius, selectedId}=state;
return <>
{selectedId === 'borderglow' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-xl">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">BorderGlow Interactive Edge</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Hover your cursor along the perimeter to see specular dynamic glow.</p>
                            </div>
                            <BorderGlow
                                edgeSensitivity={30}
                                glowColor="var(--accent-color)"
                                backgroundColor="var(--bg-secondary)"
                                borderRadius={16}
                                glowRadius={35}
                                glowIntensity={1.2}
                                animated={true}
                            >
                                <div className="p-8 text-center select-none">
                                    <Zap className="w-6 h-6 text-[var(--accent-color)] mx-auto mb-2" />
                                    <h4 className="text-sm font-bold text-[var(--text-primary)]">Specular Edge Tracker</h4>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Conic gradient mask calculates live proximity angle.</p>
                                </div>
                            </BorderGlow>
                        </div>
                    )}
{selectedId === 'clickspark' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-xl">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">ClickSpark Canvas Physics</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Click anywhere in the target below to spawn hardware accelerated particles.</p>
                            </div>
                            <ClickSpark sparkColor="var(--accent-color)" sparkCount={14} sparkRadius={25} duration={450}>
                                <div className="p-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-center cursor-pointer select-none">
                                    <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-[var(--text-primary)]">Click to ignite particle sparks</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Canvas overlay emits multi-angle spark lines.</p>
                                </div>
                            </ClickSpark>
                        </div>
                    )}
{selectedId === 'richhovercard' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">RichHoverCard Inspect Portal</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Hover over the token chip below to preview source code context.</p>
                            </div>
                            <div className="pt-2">
                                <RichHoverCard
                                    title="cuda_memory.rs"
                                    filePath="src/engine/cuda_memory.rs"
                                    lineRange="45-120"
                                    previewText="VMM allocation pool managing NVMM virtual addresses."
                                    userPrompt="Inspect zero-copy host pinned buffer"
                                    aiSnippet="Page locked host memory allocated via cudaHostAllocMapped."
                                >
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent-color)] cursor-help">
                                        <Code className="w-3.5 h-3.5" />
                                        <span>Hover over cuda_memory.rs</span>
                                    </span>
                                </RichHoverCard>
                            </div>
                        </div>
                    )}
{selectedId === 'backlight' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Backlight Ambient Blur</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">SVG Gaussian blur creating ambient diffused halo.</p>
                            </div>
                            <div className="relative p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden text-center">
                                <Backlight blur={28} className="absolute inset-0 opacity-40">
                                    <div className="w-24 h-24 rounded-full bg-[var(--accent-color)] mx-auto" />
                                </Backlight>
                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-[var(--text-primary)]">Ambient Glow Surface</p>
                                </div>
                            </div>
                        </div>
                    )}
</>;
}

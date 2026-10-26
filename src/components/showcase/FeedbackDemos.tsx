import { AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { AlertBanner } from '../ui/AlertBanner';
import { Tooltip } from '../ui/tooltip';
import { toast } from '../ui/toast';
import type { ShowcaseDemoState } from './state';
export function FeedbackDemos(state: ShowcaseDemoState){
const {selectedId}=state;
return <>
{selectedId === 'tooltip' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Floating Hint Tooltip</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Hover over the button below to see auto-repositioning tooltip.</p>
                            </div>
                            <div className="pt-2">
                                <Tooltip title="Direct CUDA Memory Bridge" subtitle="Bypasses CPU bus transfers">
                                    <Button variant="outline" size="sm">
                                        Hover For Tooltip
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>
                    )}
{selectedId === 'toast' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Live Toast Notification Stack</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Click any button below to dispatch live floating notifications:</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.success('Compilation finished with 0 errors.', { title: 'Cargo Build' })}
                                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                    Success Toast
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.error('Out of VRAM: Falling back to System RAM.', { title: 'CUDA Allocation' })}
                                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                    <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Error Toast
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.warning('High memory pressure detected (>85%).', { title: 'Memory Guard' })}
                                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                    Warning Toast
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.info('Connected to Cluaiz Gateway daemon on port 8080.', { title: 'Engine Daemon' })}
                                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                >
                                    <Info className="w-3.5 h-3.5 mr-1.5" />
                                    Info Toast
                                </Button>
                            </div>
                        </div>
                    )}
{selectedId === 'alertbanner' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">All AlertBanner Variants</h3>
                            <div className="space-y-3">
                                <AlertBanner variant="info" title="Engine Update" message="Cluaiz Inference Daemon v1.2 is ready to run." />
                                <AlertBanner variant="success" title="Kernel Compiled" message="All 14 CUDA PTX shaders loaded into VRAM." />
                                <AlertBanner variant="warning" title="Memory Warning" message="Shared host RAM usage has exceeded 80%." />
                                <AlertBanner variant="error" title="Inference Failure" message="OOM triggered during long context decoding." />
                            </div>
                        </div>
                    )}
</>;
}

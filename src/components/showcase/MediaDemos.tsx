
import { BinaryFileCard } from '../preview/BinaryFileCard';
import { Bot as AnimatedBot } from '../animate-ui/icons/bot';
import { Calendar as AnimatedCalendar } from '../animate-ui/icons/calendar';
import { Clipboard as AnimatedClipboard } from '../animate-ui/icons/clipboard';
import { Pause as AnimatedPause } from '../animate-ui/icons/pause';
import { Play as AnimatedPlay } from '../animate-ui/icons/play';
import { PhoneCall as AnimatedPhoneCall } from '../animate-ui/icons/phone-call';
import { SlidersHorizontal as AnimatedSliders } from '../animate-ui/icons/sliders-horizontal';
import { RotateCw as AnimatedRotateCw } from '../animate-ui/icons/rotate-cw';
import { Search as AnimatedSearch } from '../animate-ui/icons/search';
import { X as AnimatedX } from '../animate-ui/icons/x';
import type { ShowcaseDemoState } from './state';
export function MediaDemos(state: ShowcaseDemoState){
const {selectedId}=state;
return <>
{selectedId === 'animatedicons' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                10 Physics-Driven Micro-Interaction Icons (Hover to Animate)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                    { label: 'Bot', icon: <AnimatedBot size={24} /> },
                                    { label: 'Calendar', icon: <AnimatedCalendar size={24} /> },
                                    { label: 'Clipboard', icon: <AnimatedClipboard size={24} /> },
                                    { label: 'Sliders', icon: <AnimatedSliders size={24} /> },
                                    { label: 'RotateCw', icon: <AnimatedRotateCw size={24} /> },
                                    { label: 'Search', icon: <AnimatedSearch size={24} /> },
                                    { label: 'Phone', icon: <AnimatedPhoneCall size={24} /> },
                                    { label: 'Play', icon: <AnimatedPlay size={24} /> },
                                    { label: 'Pause', icon: <AnimatedPause size={24} /> },
                                    { label: 'Close', icon: <AnimatedX size={24} /> },
                                ].map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] flex flex-col items-center justify-center gap-2 hover:border-[var(--accent-color)] transition-colors cursor-pointer group"
                                    >
                                        <div className="text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="text-[10px] font-mono text-[var(--text-muted)]">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
{selectedId === 'binarypreview' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Binary File Fallback Previews</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-primary)]">
                                    <BinaryFileCard fileName="cluaiz_engine_v1.tar.gz" filePath="/downloads/cluaiz_engine_v1.tar.gz" />
                                </div>
                                <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-primary)]">
                                    <BinaryFileCard fileName="ptx_compiler_daemon.exe" filePath="/bin/ptx_compiler_daemon.exe" />
                                </div>
                            </div>
                        </div>
                    )}
</>;
}

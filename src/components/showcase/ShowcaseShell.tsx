import { Copy } from 'lucide-react';
import { ToastContainer } from '../ui/toast/ToastContainer';
import { useShowcaseState } from './state';
import { FoundationDemos } from './FoundationDemos';
import { PrimitiveDemos } from './PrimitiveDemos';
import { DropdownDemos } from './DropdownDemos';
import { OverlayDemos } from './OverlayDemos';
import { EffectDemos } from './EffectDemos';
import { FeedbackDemos } from './FeedbackDemos';
import { MediaDemos } from './MediaDemos';
import { ComponentReference } from './ComponentReference';
import { DeveloperGuide } from './DeveloperGuide';
/** The design system's live stage; the Toolkit sidebar shows its directory */
export function ShowcaseShell(){
const state=useShowcaseState();
const {selectedId, copiedText, copyToClipboard, activeItem}=state;
return (
        <div className="flex h-full w-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-sans">
            {/* Dedicated Toast Container for interactive testing */}
            <ToastContainer />

            {/* RIGHT MAIN PANEL: LIVE DESIGN STAGE */}
            <main className="flex-1 h-full overflow-y-auto flex flex-col">
                {/* Header Canvas Banner */}
                <div className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/20 px-8 py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                                    {activeItem.label}
                                </h1>
                                <span className="font-mono text-[10px] text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded-md border border-[var(--accent-color)]/20">
                                    {activeItem.path}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {activeItem.description}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(activeItem.path)}
                                className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{copiedText === activeItem.path ? 'Copied Path!' : 'Copy Path'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <DeveloperGuide onCopy={copyToClipboard} copiedText={copiedText} />
                <ComponentReference id={selectedId} onCopy={copyToClipboard} copiedText={copiedText} />
                {state.copyError && <p role="alert" className="p-3 text-sm text-[var(--text-primary)]">{state.copyError}</p>}
                {/* Preview Playground Stage */}
                <div className="flex-1 p-8 max-w-5xl space-y-8">
                    {/* 0A. TYPOGRAPHY FOUNDATIONS */}
                    <FoundationDemos {...state}/>
<PrimitiveDemos {...state}/>
<DropdownDemos {...state}/>
<OverlayDemos {...state}/>
<EffectDemos {...state}/>
<FeedbackDemos {...state}/>
<MediaDemos {...state}/>

                </div>
            </main>
        </div>
    );
}

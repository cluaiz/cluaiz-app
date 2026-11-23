import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Brain, RotateCcw, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Slider } from '../../../components/ui/Slider';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { AccordionGroup } from '../../../components/ui/Accordion';
import { useChatStore } from '../../../store/chat/useChatStore';
import { controlsFor, useChatControlsStore, type SamplingKey } from '../../../store/chat/useChatControlsStore';

type SliderKey = Exclude<SamplingKey, 'seed'>;

/**
 * Each slider in plain words. `start` is only where the knob sits while the field is unset ("Auto"); nothing
 * is sent until the user moves it, so the Engine's own default applies.
 */
const SLIDERS: Record<SliderKey, { label: string; help: string; min: number; max: number; step: number; start: number }> = {
    temperature: { label: 'Creativity', help: 'Low: exact and steady. High: more varied.', min: 0, max: 2, step: 0.05, start: 0.8 },
    max_tokens: { label: 'Answer length', help: 'The longest answer, in tokens.', min: 64, max: 8192, step: 64, start: 2048 },
    top_p: { label: 'Top P', help: 'Picks only from the likeliest words that add up to this share.', min: 0, max: 1, step: 0.05, start: 0.95 },
    top_k: { label: 'Top K', help: 'Picks only from this many likeliest words.', min: 0, max: 200, step: 1, start: 40 },
    min_p: { label: 'Min P', help: 'Drops words much less likely than the best one.', min: 0, max: 1, step: 0.01, start: 0.05 },
    repetition_penalty: { label: 'Less repeating', help: 'Above 1 repeats itself less.', min: 0.5, max: 2, step: 0.05, start: 1 },
    presence_penalty: { label: 'New topics', help: 'Higher moves on to new topics more.', min: -2, max: 2, step: 0.1, start: 0 },
    frequency_penalty: { label: 'Fewer repeated words', help: 'Higher uses the same words less often.', min: -2, max: 2, step: 0.1, start: 0 },
};
const MAIN: SliderKey[] = ['temperature', 'max_tokens'];
const ADVANCED: SliderKey[] = ['top_p', 'top_k', 'min_p', 'repetition_penalty', 'presence_penalty', 'frequency_penalty'];
/** "Same answer every time" fixes the seed to this number */
const FIXED_SEED = 42;

/** Thinking settings the input already keeps (saved in the Engine for every chat), edited here */
export interface ThinkingControls {
    effort: string | number;
    chooseEffort(value: string | number): void;
    budgetMessage: string;
    setBudgetMessage(text: string): void;
    saveBudgetMessage(): void;
}

/** The chat's settings, opened from the input's + menu or the effort popover: instructions, creativity, length, thinking, the rest under Advanced */
export function ChatSettingsDialog({ thinking }: { thinking: ThinkingControls }) {
    const open = useChatControlsStore(s => s.panelOpen), setOpen = useChatControlsStore(s => s.setPanelOpen);
    const chatId = useChatStore(s => s.activeSessionId);
    const byChat = useChatControlsStore(s => s.byChat), update = useChatControlsStore(s => s.update), reset = useChatControlsStore(s => s.reset);
    const [advanced, setAdvanced] = useState(false);
    if (!open) return null;
    const controls = controlsFor(byChat, chatId);
    const changed = ADVANCED.filter(key => controls[key] !== undefined).length + (controls.seed !== undefined ? 1 : 0);

    const row = (key: SliderKey) => {
        const item = SLIDERS[key], value = controls[key];
        return <div key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
                <span><span className="font-semibold text-[var(--text-primary)]">{item.label}</span>
                    <span className="block text-[11px] text-[var(--text-muted)]">{item.help}</span></span>
                <span className="flex items-center gap-1">
                    <span className={`font-mono text-xs ${value === undefined ? 'text-[var(--text-muted)]' : 'text-[var(--accent-color)]'}`}>{value ?? 'Auto'}</span>
                    {value !== undefined && <button type="button" aria-label={`${item.label}: back to Auto`} title="Back to Auto"
                        onClick={() => update(chatId, { [key]: undefined })}
                        className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><RotateCcw size={12} /></button>}
                </span>
            </div>
            <Slider min={item.min} max={item.max} step={item.step} value={value ?? item.start} height={28}
                onChange={next => update(chatId, { [key]: Number(next.toFixed(2)) })} />
        </div>;
    };

    // On the page body: the input sits in a moving (transformed) box, which would trap a fixed window inside it
    return createPortal(<Dialog open onOpenChange={value => setOpen(value)}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <DialogHeader className="!mb-0 !flex-row shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] !px-4 !py-3 !text-left">
                <DialogTitle><span className="flex items-center gap-2 text-base"><SlidersHorizontal size={16} /> Chat settings</span></DialogTitle>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => reset(chatId)} title="Everything back to Auto"><RotateCcw size={13} /> Reset</Button>
                    <Button variant="ghost" size="icon" aria-label="Close chat settings" onClick={() => setOpen(false)}><X size={16} /></Button>
                </div>
            </DialogHeader>
            <div className="flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
                <p className="text-xs text-[var(--text-muted)]">{chatId ? 'For this chat.' : 'For new chats.'} Auto lets the Engine choose.</p>
                <label className="block space-y-1">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Instructions</span>
                    <textarea value={controls.systemPrompt ?? ''} rows={3} placeholder="For example: answer in short, simple sentences"
                        onChange={event => update(chatId, { systemPrompt: event.target.value })}
                        className="ui-input w-full resize-y py-2 text-sm" />
                </label>
                {MAIN.map(row)}
                <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]"><Brain size={14} /> Thinking budget</span>
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-xs text-[var(--accent-color)]">{typeof thinking.effort === 'number' ? `${thinking.effort} tokens` : String(thinking.effort)}</span>
                            {typeof thinking.effort === 'number' && <button type="button" aria-label="Thinking budget: back to Auto" title="Back to Auto"
                                onClick={() => thinking.chooseEffort('auto')} className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><RotateCcw size={12} /></button>}
                        </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">How long the model may think, in tokens. The effort button in the input picks Low to Max; this sets an exact number. Saved for every chat.</p>
                    <Slider min={0} max={32768} step={256} height={28} value={typeof thinking.effort === 'number' ? thinking.effort : 4096}
                        onChange={next => thinking.chooseEffort(Math.round(next))} />
                    <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">When thinking runs out, write</span>
                        <input value={thinking.budgetMessage} placeholder="For example: I have to answer now."
                            onChange={event => thinking.setBudgetMessage(event.target.value)} onBlur={thinking.saveBudgetMessage}
                            className="ui-input h-9 w-full text-sm" />
                    </label>
                </div>
                <AccordionGroup icon={<Settings2 size={13} />} title="Advanced" count={changed ? `${changed} changed` : ''}
                    open={advanced} onToggle={() => setAdvanced(value => !value)}>
                    <div className="space-y-5 p-3">
                        {ADVANCED.map(row)}
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-[var(--text-primary)]">Same answer every time</div>
                                <p className="text-[11px] text-[var(--text-muted)]">The same question gets the same answer.</p>
                            </div>
                            <ToggleSwitch active={controls.seed !== undefined} aria-label="Same answer every time"
                                onToggle={() => update(chatId, { seed: controls.seed === undefined ? FIXED_SEED : undefined })} />
                        </div>
                    </div>
                </AccordionGroup>
            </div>
        </DialogContent>
    </Dialog>, document.body);
}

import {
    Bot, Braces, CalendarClock, CodeXml, CornerDownLeft, Cpu, FolderOpen, GitBranch, Hand, Hourglass, MessageSquare, OctagonX,
    Plug, Power, Radar, Radio, RefreshCw, Repeat, ShieldCheck, Split, Timer, Variable, Webhook, Workflow, Wrench, Zap, Columns3,
    type LucideIcon,
} from 'lucide-react';

/** How a step kind or trigger looks on the canvas, and what a new one holds */
export interface KindView {
    label: string;
    icon: LucideIcon;
    /** The icon's colour class, as the Toolkit's sections colour theirs */
    tint: string;
    /** A new one, before the owner fills it in */
    template: Record<string, unknown>;
}

/**
 * Step kinds of `cluaiz.flow/1`, in the Engine's order (`format/tables.rs`): the order decides which key names
 * a step's kind. The Engine stays the owner of what each holds; this is only how the App draws and starts them.
 */
export const STEP_KINDS: Record<string, KindView> = {
    tool: { label: 'Tool', icon: Wrench, tint: 'text-blue-400', template: { tool: '', with: {} } },
    call: { label: 'Method', icon: Braces, tint: 'text-cyan-400', template: { call: '', with: {} } },
    ask: { label: 'Ask a model', icon: MessageSquare, tint: 'text-purple-400', template: { ask: '' } },
    agent: { label: 'Agent', icon: Bot, tint: 'text-violet-400', template: { agent: '', tools: [] } },
    code: { label: 'Code', icon: CodeXml, tint: 'text-emerald-400', template: { code: '' } },
    if: { label: 'If', icon: GitBranch, tint: 'text-amber-400', template: { if: true, then: [] } },
    switch: { label: 'Switch', icon: Split, tint: 'text-amber-400', template: { switch: [{ name: 'first', when: true, do: [] }], default: [] } },
    each: { label: 'For each', icon: Repeat, tint: 'text-orange-400', template: { each: [], as: 'item', do: [] } },
    parallel: { label: 'Parallel', icon: Columns3, tint: 'text-orange-400', template: { parallel: { first: [], second: [] } } },
    repeat: { label: 'Repeat', icon: RefreshCw, tint: 'text-orange-400', template: { repeat: [], until: true, max: 10 } },
    wait: { label: 'Wait', icon: Hourglass, tint: 'text-sky-400', template: { wait: { for: '1m' } } },
    approve: { label: 'Approve', icon: ShieldCheck, tint: 'text-sky-400', template: { approve: 'Continue?' } },
    set: { label: 'Set values', icon: Variable, tint: 'text-teal-400', template: { set: { name: '' } } },
    run: { label: 'Run a flow', icon: Workflow, tint: 'text-pink-400', template: { run: '' } },
    emit: { label: 'Send an event', icon: Radio, tint: 'text-pink-400', template: { emit: '' } },
    return: { label: 'Return', icon: CornerDownLeft, tint: 'text-[var(--text-secondary)]', template: { return: {} } },
    fail: { label: 'Fail', icon: OctagonX, tint: 'text-red-400', template: { fail: 'Stopped' } },
};

export const TRIGGER_KINDS: Record<string, KindView> = {
    manual: { label: 'By hand', icon: Hand, tint: 'text-[var(--text-secondary)]', template: { manual: {} } },
    schedule: { label: 'Schedule', icon: CalendarClock, tint: 'text-sky-400', template: { schedule: '0 9 * * *' } },
    every: { label: 'Every', icon: Timer, tint: 'text-sky-400', template: { every: '1h' } },
    webhook: { label: 'Webhook', icon: Webhook, tint: 'text-pink-400', template: { webhook: { secret: 'env:FLOW_SECRET' } } },
    poll: { label: 'Poll', icon: Radar, tint: 'text-cyan-400', template: { poll: { tool: '', every: '5m' } } },
    file: { label: 'File', icon: FolderOpen, tint: 'text-amber-400', template: { file: { path: '' } } },
    engine: { label: 'Engine event', icon: Cpu, tint: 'text-violet-400', template: { engine: '' } },
    event: { label: 'Flow event', icon: Zap, tint: 'text-violet-400', template: { event: '' } },
    tool: { label: 'Called as a tool', icon: Plug, tint: 'text-blue-400', template: { tool: { description: '' } } },
    startup: { label: 'On startup', icon: Power, tint: 'text-emerald-400', template: { startup: {} } },
};

const keyOf = (table: Record<string, KindView>, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(table).find(key => key in value) ?? null : null;

/** The step kind a step's keys name, or null */
export const stepKind = (step: unknown) => keyOf(STEP_KINDS, step);
/** The trigger kind an `on` item's keys name, or null */
export const triggerKind = (trigger: unknown) => keyOf(TRIGGER_KINDS, trigger);

import { useMemo, useState } from 'react';
import { Braces, Search, X, Zap, Wrench, GitBranch, Sparkles } from 'lucide-react';
import { AccordionGroup, AccordionItem } from '../../../components/ui/Accordion';
import { Input } from '../../../components/ui/Input';
import type { FlowNodeRef } from '../../../api/engine/automation';
import { STEP_KINDS, TRIGGER_KINDS, type KindView } from '../model/kinds';
import { DRAG_TYPE } from '../canvas/FlowCanvas';

/** What the palette hands over: a trigger, a step kind, or an installed tool / CEP method for a step */
export type PaletteItem = { type: 'trigger'; kind: string } | { type: 'step'; kind: string } | { type: 'node'; node: FlowNodeRef };

interface Entry { key: string; title: string; description: string; icon: React.ReactNode; item: PaletteItem }
interface Group { id: string; title: string; icon: React.ReactNode; entries: Entry[] }

const LOGIC = ['if', 'switch', 'each', 'parallel', 'repeat', 'wait', 'approve', 'set', 'run', 'emit', 'return', 'fail'];
const MODEL = ['ask', 'agent', 'code'];

const kindEntry = (type: 'trigger' | 'step', kind: string, view: KindView, description = ''): Entry => {
    const Icon = view.icon;
    return { key: `${type}:${kind}`, title: view.label, description, icon: <Icon className={`w-3.5 h-3.5 shrink-0 ${view.tint}`} />, item: { type, kind } };
};

const nodeEntry = (node: FlowNodeRef): Entry => {
    const view = STEP_KINDS[node.step];
    const Icon = view.icon;
    return { key: `node:${node.ref}`, title: node.title || node.ref, description: node.description || node.ref,
        icon: <Icon className={`w-3.5 h-3.5 shrink-0 ${view.tint}`} />, item: { type: 'node', node } };
};

/** The palette: triggers, step kinds, and every installed tool and method a step can run, searchable; click or drag one in */
export function NodePalette({ nodes, descriptions, inserting, onPick, onClose }: {
    nodes: FlowNodeRef[]; descriptions: Record<string, string>; inserting: boolean;
    onPick: (item: PaletteItem) => void; onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<Record<string, boolean>>({ triggers: true, logic: true, models: true });
    const groups = useMemo<Group[]>(() => {
        const all: Group[] = [
            { id: 'triggers', title: 'Triggers', icon: <Zap className="w-3.5 h-3.5 text-sky-400" />,
                entries: Object.entries(TRIGGER_KINDS).map(([kind, view]) => kindEntry('trigger', kind, view, descriptions[`trigger:${kind}`])) },
            { id: 'models', title: 'Models and code', icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
                entries: MODEL.map(kind => kindEntry('step', kind, STEP_KINDS[kind], descriptions[`step:${kind}`])) },
            { id: 'logic', title: 'Logic and flow', icon: <GitBranch className="w-3.5 h-3.5 text-amber-400" />,
                entries: LOGIC.map(kind => kindEntry('step', kind, STEP_KINDS[kind], descriptions[`step:${kind}`])) },
            { id: 'tools', title: 'Installed tools', icon: <Wrench className="w-3.5 h-3.5 text-blue-400" />,
                entries: nodes.filter(node => node.step === 'tool').map(nodeEntry) },
            { id: 'methods', title: 'Engine methods', icon: <Braces className="w-3.5 h-3.5 text-cyan-400" />,
                entries: nodes.filter(node => node.step === 'call').map(nodeEntry) },
        ];
        const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return all.map(group => ({ ...group, entries: group.entries.filter(entry =>
            words.every(word => `${entry.title} ${entry.description} ${entry.key}`.toLowerCase().includes(word))) }))
            .filter(group => group.entries.length);
    }, [nodes, descriptions, query]);
    const searching = query.trim().length > 0;

    return <aside className="absolute left-3 top-3 bottom-3 z-20 w-72 flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">Add to the flow</h3>
                <p className="text-[10px] text-[var(--text-muted)]">{inserting ? 'Goes where you pressed +' : 'Goes after the selected step, or at the end'}</p>
            </div>
            <button type="button" onClick={onClose} title="Close" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-3 pb-2">
            <Input sizeVariant="sm" autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search steps, tools, methods…"
                leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />} wrapperClassName="w-full" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 space-y-1.5">
            {groups.map(group => <AccordionGroup key={group.id} icon={group.icon} title={group.title} count={group.entries.length}
                open={searching || Boolean(open[group.id])} onToggle={() => setOpen(state => ({ ...state, [group.id]: !state[group.id] }))}>
                {group.entries.map(entry => <AccordionItem key={entry.key} selected={false} title={entry.description} onClick={() => onPick(entry.item)}>
                    <span draggable className="flex items-center gap-2 min-w-0 w-full"
                        onDragStart={event => { event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(entry.item)); event.dataTransfer.effectAllowed = 'copy'; }}>
                        {entry.icon}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[var(--text-primary)]">{entry.title}</span>
                            {entry.description && entry.description !== entry.title && <span className="block truncate text-[10px] text-[var(--text-muted)]">{entry.description}</span>}
                        </span>
                    </span>
                </AccordionItem>)}
            </AccordionGroup>)}
            {!groups.length && <p className="p-4 text-center text-xs text-[var(--text-muted)]">Nothing matches &ldquo;{query}&rdquo;</p>}
        </div>
    </aside>;
}

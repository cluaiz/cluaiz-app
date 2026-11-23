import { Bot, MessageSquare, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import type { FlowSummary } from '../../../api/engine/automation';
import { flowKey } from '../useFlows';
import { ago, errorsOf } from '../home/homeText';

/**
 * Agents: workflows with a `tool` trigger. When one is on (valid, permissions confirmed), every chat can call it as
 * `flow_<name>` when the message fits its name or description (Engine: docs/automation/triggers.md, `tool`).
 */
export function AgentsPage({ agents, busy, onNew, onOpen, onToggle }: {
    agents: FlowSummary[]; busy: string | null; onNew: () => void; onOpen: (flow: FlowSummary) => void; onToggle: (flow: FlowSummary, on: boolean) => void;
}) {
    return <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
                An agent is a workflow your chats can use as a tool. Turn on <b>Use in chat</b>, then ask for it in any chat; the chat calls it when your message fits what it does.
            </p>
            <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New agent</Button>
        </div>

        {agents.length === 0
            ? <section className="rounded-2xl border border-dashed border-[var(--border-color)] p-10 text-center">
                <Bot className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">No agents yet</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-secondary)]">Give it a name, say what it does and which tools it may use. It becomes a tool in your chats.</p>
                <Button className="mt-4" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> Create your first agent</Button>
            </section>
            : <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                {agents.map(agent => {
                    const key = flowKey(agent);
                    const errors = errorsOf(agent);
                    return <article key={key} className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"><Bot className="h-5 w-5" /></span>
                            <button type="button" onClick={() => onOpen(agent)} className="min-w-0 flex-1 text-left cursor-pointer">
                                <span className="block truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent-color)]">{agent.name}</span>
                                <span className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{agent.description || 'No description: chats will not know when to call it.'}</span>
                            </button>
                        </div>
                        {errors.length > 0 && <p role="alert" className="text-xs text-red-400">{errors[0].message}</p>}
                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-color)]/60 pt-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                <MessageSquare className="h-3.5 w-3.5" /> flow_{agent.name.replace(/-/g, '_')}
                                {agent.last_run && <span>· used {ago(agent.last_run.finished_at)}</span>}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">Use in chat
                                <ToggleSwitch active={agent.enabled} loading={busy === key} disabled={Boolean(busy) || errors.length > 0} onToggle={() => onToggle(agent, !agent.enabled)} />
                            </span>
                        </div>
                    </article>;
                })}
            </div>}
    </div>;
}

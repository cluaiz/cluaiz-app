import { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileCode2, LayoutGrid, Loader2, Map as MapIcon, Play, Plus, Redo2, Save, TriangleAlert, Undo2, Workflow } from 'lucide-react';
import type { FlowProblem } from '../../../api/engine/automation';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Tooltip } from '../../../components/ui/tooltip';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { when } from '../RunStatusBadge';
import type { FlowDocument } from './useFlowDocument';
import type { useFlowRuns } from './useFlowRuns';

interface StudioToolbarProps {
    doc: FlowDocument;
    runs: ReturnType<typeof useFlowRuns>;
    problems: FlowProblem[];
    miniMap: boolean; yamlView: boolean; paletteOpen: boolean;
    onBack: () => void; onPalette: () => void; onTidy: () => void; onMiniMap: () => void; onYaml: () => void;
    onRun: () => void; onSave: () => void; onFlowSettings: () => void; onProblem: (problem: FlowProblem) => void;
}

function IconButton({ title, onClick, active, disabled, children }: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
    return <Tooltip title={title} position="bottom">
        <Button size="icon" variant="ghost" aria-label={title} disabled={disabled} onClick={onClick}
            className={active ? '!text-[var(--accent-color)] !bg-[var(--accent-color)]/10' : ''}>{children}</Button>
    </Tooltip>;
}

/** The flow's name and checks on the left; building, viewing, running and saving on the right */
export function StudioToolbar({ doc, runs, problems, miniMap, yamlView, paletteOpen, onBack, onPalette, onTidy, onMiniMap, onYaml,
    onRun, onSave, onFlowSettings, onProblem }: StudioToolbarProps) {
    const [listOpen, setListOpen] = useState(false);
    const errors = problems.filter(problem => problem.severity === 'error').length;
    const name = typeof doc.value?.name === 'string' ? doc.value.name : doc.summary?.name ?? 'Flow';
    const icon = 'w-4 h-4';

    return <div className="@container shrink-0 flex items-center gap-1.5 px-2 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <IconButton title="All flows" onClick={onBack}><ArrowLeft className={icon} /></IconButton>
        <button type="button" onClick={onFlowSettings} title="Flow settings"
            className="flex items-center gap-2 min-w-0 shrink rounded-md px-1.5 py-1 hover:bg-[var(--bg-tertiary)] cursor-pointer">
            <Workflow className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</span>
            {doc.dirty && <span title="Not saved" className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
        </button>
        {doc.isNew && <Tabs variant="pill" items={[{ id: 'user', label: 'User' }, { id: 'project', label: 'Project' }]} value={doc.scope} onChange={doc.setScope} />}
        <div className="relative shrink-0">
            <button type="button" onClick={() => problems.length && setListOpen(open => !open)}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${problems.length ? 'cursor-pointer' : 'cursor-default'} ${
                    errors ? 'border-red-500/40 text-red-400' : problems.length ? 'border-amber-500/40 text-amber-400' : 'border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                {doc.checking ? <Loader2 className="w-3 h-3 animate-spin" /> : problems.length ? <TriangleAlert className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3 text-green-400" />}
                {doc.checking ? 'Checking' : problems.length ? `${problems.length} problem${problems.length === 1 ? '' : 's'}` : 'Valid'}
            </button>
            {listOpen && problems.length > 0 && <ul className="absolute left-0 top-full mt-1 z-30 w-80 max-h-72 overflow-y-auto custom-scrollbar rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl p-1">
                {problems.map((problem, index) => <li key={index}>
                    <button type="button" onClick={() => { setListOpen(false); onProblem(problem); }}
                        className="w-full text-left rounded px-2 py-1.5 hover:bg-[var(--bg-tertiary)] cursor-pointer">
                        <span className={`block text-[11px] ${problem.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{problem.message}</span>
                        <span className="block text-[10px] font-mono text-[var(--text-muted)]">{problem.line ? `line ${problem.line} · ` : ''}{problem.path || 'flow'}</span>
                    </button>
                </li>)}
            </ul>}
        </div>

        <div className="flex-1 min-w-2" />
        <div className="shrink-0 flex items-center gap-0.5">
        <IconButton title="Add a step or trigger" active={paletteOpen} disabled={yamlView} onClick={onPalette}><Plus className={icon} /></IconButton>
        <IconButton title="Undo (Ctrl+Z)" disabled={!doc.canUndo} onClick={doc.undo}><Undo2 className={icon} /></IconButton>
        <IconButton title="Redo (Ctrl+Y)" disabled={!doc.canRedo} onClick={doc.redo}><Redo2 className={icon} /></IconButton>
        <IconButton title="Tidy up the layout" disabled={yamlView} onClick={onTidy}><LayoutGrid className={icon} /></IconButton>
        <IconButton title="Mini map" active={miniMap} disabled={yamlView} onClick={onMiniMap}><MapIcon className={icon} /></IconButton>
        <IconButton title={yamlView ? 'Back to the canvas' : 'The whole file as YAML'} active={yamlView} onClick={onYaml}><FileCode2 className={icon} /></IconButton>
        {runs.runs.length > 0 && <div className="w-36 hidden @[720px]:block">
            <CustomDropdown floating value={runs.shown ?? ''} placeholder="Show a run"
                options={[{ value: '', label: 'No run shown' }, ...runs.runs.map(run => ({ value: run.run_id, label: `${run.status} · ${when(run.created_at)}` }))]}
                onChange={value => runs.setShown(value || null)} />
        </div>}
        <Button size="sm" variant="outline" disabled={doc.isNew || runs.starting || errors > 0} onClick={onRun}
            title={doc.isNew ? 'Save the flow before running it' : 'Run'}>
            {runs.starting ? <Loader2 className="w-3.5 h-3.5 @[640px]:mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 @[640px]:mr-1" />}<span className="hidden @[640px]:inline">Run</span>
        </Button>
        <Button size="sm" disabled={!doc.dirty || doc.saving} onClick={onSave} title="Save (Ctrl+S)">
            {doc.saving ? <Loader2 className="w-3.5 h-3.5 @[640px]:mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 @[640px]:mr-1" />}<span className="hidden @[640px]:inline">Save</span>
        </Button>
        </div>
    </div>;
}

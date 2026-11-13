import { useEffect, useMemo, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { parse } from 'yaml';
import { CodeEditor } from '../../../components/ui/CodeEditor';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { SchemaForm, type Schema } from '../../../components/ui/SchemaForm';
import { Tabs } from '../../../components/ui/Tabs';
import type { FlowNodeRef, FlowProblem, JsonSchema, RunStep } from '../../../api/engine/automation';
import { setValue, toYaml, valueAt, type FlowPath, type FlowValue } from '../model/flowDoc';
import { STEP_KINDS, TRIGGER_KINDS } from '../model/kinds';
import type { GraphNode } from '../model/flowGraph';
import type { FlowDocument } from './useFlowDocument';
import { kindSchema, resolveRef } from './useFlowCatalog';

type Tab = 'settings' | 'options' | 'run' | 'yaml';
/** Flow fields drawn on the canvas or kept for applications, not in the settings form */
const FLOW_ELSEWHERE = ['flow', 'steps', 'on', 'on_error', 'ui', 'meta'];

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isSteps = (part: unknown) => object(part) && part.$ref === '#/$defs/steps';

/** The step-kind fields every kind shares (`COMMON` of the Engine's tables), read off the schema */
function commonFields(schema: JsonSchema): string[] {
    const defs = object(schema.$defs) ? schema.$defs : {};
    const branches = object(defs.step) && Array.isArray(defs.step.oneOf) ? defs.step.oneOf.filter(object) : [];
    const keys = branches.map(branch => Object.keys(object(branch.properties) ? branch.properties : {}));
    return keys.length ? keys[0].filter(key => keys.every(list => list.includes(key))) : [];
}

function YamlPart({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
    const text = useMemo(() => toYaml(value), [value]);
    const [draft, setDraft] = useState(text);
    const [error, setError] = useState('');
    useEffect(() => { setDraft(text); setError(''); }, [text]);
    return <div className="space-y-1.5">
        <CodeEditor value={draft} language="yaml" height={320} showToolbar={false} showStatusBar={false} showLineNumbers onChange={next => {
            setDraft(next);
            try { const parsed = parse(next); if (object(parsed)) { setError(''); onChange(parsed); } else setError('This part must stay an object'); }
            catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        }} />
        {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>;
}

function RunRecord({ records }: { records: RunStep[] }) {
    if (!records.length) return <p className="text-[11px] text-[var(--text-muted)]">This step has no record in the run shown. Run the flow, or pick a run, to see what went in and came out.</p>;
    return <div className="space-y-4">
        {records.map((record, index) => <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--text-primary)]">{record.status}</span>
                <span className="text-[var(--text-muted)] font-mono">
                    {record.attempts?.length ?? 0} attempt{record.attempts?.length === 1 ? '' : 's'}
                    {record.attempts?.length ? ` · ${record.attempts.reduce((sum, attempt) => sum + (attempt.ms ?? 0), 0)} ms` : ''}
                </span>
            </div>
            {record.error?.message && <p className="text-[11px] text-red-400">{record.error.kind ? `${record.error.kind}: ` : ''}{record.error.message}</p>}
            {(['input', 'output'] as const).map(part => record[part] !== undefined && <div key={part} className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{part}</span>
                <CodeEditor value={JSON.stringify(record[part], null, 2)} language="json" readOnly height={160} showToolbar={false} showStatusBar={false} />
            </div>)}
        </div>)}
    </div>;
}

/**
 * The selected step, trigger or the flow itself: a form made from the Engine's schema of that kind, the
 * fields every step shares, the run's record of it, and its own YAML. Every change goes into the file.
 */
export function Inspector({ doc, node, schema, nodes, problems, records, onClose }: {
    doc: FlowDocument; node: GraphNode | 'flow'; schema: JsonSchema; nodes: FlowNodeRef[];
    problems: FlowProblem[]; records: RunStep[]; onClose: () => void;
}) {
    const [chosen, setTab] = useState<Tab>('settings');
    const resolve = (part: Schema) => resolveRef(schema, part);
    const path: FlowPath = node === 'flow' ? [] : node.type === 'step' || node.type === 'trigger' ? node.data.path : [];
    const value = (path.length ? valueAt(doc.value, path) : doc.value) as FlowValue | undefined;
    const set = (field: FlowPath, next: unknown) => doc.change(setValue([...path, ...field], next), `${path.join('.')}:${field.join('.')}`);

    if (node !== 'flow' && node.type !== 'step' && node.type !== 'trigger') return null;
    const isStep = node !== 'flow' && node.type === 'step';
    const kind = node === 'flow' ? '' : node.data.kind;
    const view = node === 'flow' ? null : isStep ? STEP_KINDS[kind] : TRIGGER_KINDS[kind];
    const branch = node === 'flow' ? null : kindSchema(schema, isStep ? 'step' : 'trigger', kind);
    const common = isStep ? commonFields(schema) : [];
    const properties = object(branch?.properties) ? branch!.properties as Record<string, unknown> : {};
    const ownFields = Object.keys(properties).filter(name => !common.includes(name) && !isSteps(properties[name]));
    const ref = isStep && (kind === 'tool' || kind === 'call') && typeof value?.[kind] === 'string' ? nodes.find(item => item.ref === value[kind]) : undefined;
    const tabs: Tab[] = isStep ? ['settings', 'options', 'run', 'yaml'] : ['settings', 'yaml'];
    const tab = tabs.includes(chosen) ? chosen : 'settings';
    const Icon = view?.icon ?? Settings2;

    const picker = (step: 'tool' | 'call') => (current: unknown, put: (value: unknown) => void) =>
        <CustomDropdown floating allowCustomInput value={typeof current === 'string' ? current : ''} placeholder={`Pick a ${step === 'tool' ? 'tool' : 'method'}`}
            options={nodes.filter(item => item.step === step).map(item => ({ value: item.ref, label: item.title || item.ref, description: item.ref }))}
            onChange={put} />;

    const settings = () => {
        if (node === 'flow') {
            const root = { ...schema, properties: object(schema.properties) ? schema.properties : {} };
            return <SchemaForm schema={root} value={value} resolve={resolve} onChange={(name, next) => set([name], next)}
                exclude={[...FLOW_ELSEWHERE, ...(doc.isNew ? [] : ['name'])]} />;
        }
        const withSchema = ref?.input_schema && object(ref.input_schema.properties) ? ref.input_schema as Schema : null;
        return <div className="space-y-5">
            <SchemaForm schema={{ ...branch, properties: Object.fromEntries(ownFields.map(name => [name, properties[name]])) }} value={value}
                resolve={resolve} onChange={(name, next) => set([name], next)}
                custom={kind === 'tool' || kind === 'call' ? { [kind]: picker(kind) } : {}} />
            {isStep && <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Input · with</h4>
                {withSchema
                    ? <SchemaForm schema={withSchema} value={value?.with} onChange={(name, next) => set(['with', name], next)} />
                    : <SchemaForm schema={{ properties: { with: properties.with ?? {} } }} value={value} onChange={(name, next) => set([name], next)} />}
            </div>}
        </div>;
    };

    return <aside className="absolute right-3 top-3 bottom-3 z-20 w-[340px] flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-3 border-b border-[var(--border-color)]">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
                <Icon className={`w-4 h-4 ${view?.tint ?? 'text-[var(--text-secondary)]'}`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{node === 'flow' ? 'Flow' : isStep ? view?.label : `Trigger · ${view?.label}`}</div>
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{node === 'flow' ? String(doc.value?.name ?? '') : node.data.title}</div>
                {isStep && <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">id: {node.data.stepId}</div>}
            </div>
            <button type="button" onClick={onClose} title="Close" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        {problems.length > 0 && <ul className="px-3 py-2 space-y-1 border-b border-[var(--border-color)] bg-red-500/5">
            {problems.map((problem, index) => <li key={index} className={`text-[11px] ${problem.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                <span className="font-mono opacity-70">{problem.path.split('/').slice(path.length + 1).join('.') || problem.code}</span> {problem.message}
            </li>)}
        </ul>}
        {node !== 'flow' && <div className="px-3 pt-2">
            <Tabs variant="underline" items={tabs.map(id => ({ id, label: id === 'yaml' ? 'YAML' : id[0].toUpperCase() + id.slice(1) }))} value={tab} onChange={setTab} />
        </div>}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {(node === 'flow' || tab === 'settings') && settings()}
            {node !== 'flow' && tab === 'options' && <SchemaForm schema={{ properties: Object.fromEntries(common.filter(name => name !== 'with').map(name => [name, properties[name]])) }}
                value={value} resolve={resolve} onChange={(name, next) => set([name], next)} />}
            {node !== 'flow' && tab === 'run' && <RunRecord records={records} />}
            {node !== 'flow' && tab === 'yaml' && <YamlPart value={value} onChange={next => doc.change(setValue(path, next), `yaml:${path.join('.')}`)} />}
        </div>
    </aside>;
}

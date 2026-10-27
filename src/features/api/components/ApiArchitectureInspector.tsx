import React, { useState } from 'react';
import { BookOpen, Code } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { ApiEndpoint, InstalledModel } from '../types';
import type { ArchitectureItem } from '../utils/architectureGraph';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';

interface Props { item: ArchitectureItem; model?: InstalledModel; selectedModel: string; connection: string;
    onOpen: (endpoint: ApiEndpoint, docs: boolean) => void }

function Example({ title, source, choices }: { title: string; source?: string; choices?: ApiEndpoint['payload_examples'] }) {
    const [choice, setChoice] = useState('');
    const content = choices?.find(item => item.id === choice)?.payload || source;
    if (!content) return <p className="text-[var(--text-muted)]">No example documented. Open the full reference for this contract.</p>;
    return <details className="mt-2" data-architecture-interactive>
        <summary className="cursor-pointer text-[var(--accent-color)]">{title} · documented example</summary>
        {choices?.length ? <div className="mt-2"><CustomDropdown floating value={choice} onChange={setChoice} placeholder="Choose documented input example"
            options={[{ value: '', label: 'Default request' }, ...choices.map(item => ({ value: item.id, label: item.title }))]} /></div> : null}
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--bg-primary)] p-2 text-[11px] leading-5">{content.slice(0, 4000)}</pre>
        {content.length > 4000 && <p>Preview shortened; the complete example remains in Documentation.</p>}
    </details>;
}

/** Connected graph content. This component no longer owns a separate sidebar or API list. */
export function ApiArchitectureInspector({ item, model, selectedModel, connection, onOpen }: Props) {
    const { owner, endpoint, detail } = item;
    return <div data-architecture-interactive className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-xs leading-5 text-[var(--text-secondary)]" style={{ touchAction: 'pan-y' }}>
        {detail === 'input' && <>
            <p>{endpoint ? 'Fields accepted by this API:' : owner.input}</p>
            {endpoint && <>
                <dl className="mt-2 space-y-2">{endpoint.params?.map(param => <div key={param.name}>
                    <dt className="break-words font-mono text-[var(--text-primary)]">{param.name} <span className="font-sans text-[10px] text-[var(--text-muted)]">{param.req ? 'Required' : 'Optional'} · {param.type}</span></dt>
                    <dd>{param.desc}</dd>
                </div>)}</dl>
                {!endpoint.params?.length && <p className="mt-2">No parameter fields documented.</p>}
                <Example title="Request" source={endpoint.request_payload} choices={endpoint.payload_examples} />
            </>}
        </>}
        {detail === 'processing' && <>
            <p className="text-[var(--text-primary)]">{endpoint?.desc || owner.purpose}</p>
            {endpoint && <p className="mt-2">{endpoint.execution === 'task'
                ? 'Returns a task handle. Progress and final output follow the documented task contract.'
                : 'Follow the endpoint reference for synchronous or streaming response behavior.'}</p>}
            {endpoint && <><p className="mt-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Domain context</p>
            <p>{owner.purpose}</p></>}
            {owner.id === 'transport' && <p className="mt-2 break-all">Configured connection: {connection}. Online state is not measured here.</p>}
            {endpoint && <div className="mt-3 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onOpen(endpoint, false)} aria-label={`Open payload for ${endpoint.method} ${endpoint.path}`}><Code size={13} /> Payload</Button>
                <Button size="sm" variant="ghost" onClick={() => onOpen(endpoint, true)} aria-label={`Read documentation for ${endpoint.method} ${endpoint.path}`}><BookOpen size={13} /> Docs</Button>
            </div>}
        </>}
        {detail === 'output' && <>
            <p>{endpoint ? 'Response shape from the reference. This is an example, not a live result.' : owner.output}</p>
            {endpoint && <Example title="Response" source={endpoint.response} />}
        </>}
        {detail === 'state' && <><p>{owner.state}</p><p className="mt-3 text-[var(--text-muted)]">{owner.caution}</p></>}
        {detail === 'model' && <>
            <p>{owner.model}</p>
            <p className="mt-3 break-all">Explorer selection: {selectedModel || 'Automatic'}</p>
            {model && <p className="mt-2">Inventory snapshot: {model.format_type || 'Format not reported'} · {model.supported_tasks?.join(', ') || 'Tasks not reported'}</p>}
            <p className="mt-2 text-[var(--text-muted)]">Loaded model, device and context are not measured here. Inventory is not proof of compatibility.</p>
        </>}
    </div>;
}

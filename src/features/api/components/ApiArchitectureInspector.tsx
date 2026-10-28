import React, { useMemo, useState } from 'react';
import { BookOpen, Code } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { ApiEndpoint, InstalledModel } from '../types';
import type { ArchitectureItem } from '../utils/architectureGraph';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { ApiDiagram, documentationParts } from './ApiDocumentation';

interface Props { item: ArchitectureItem; model?: InstalledModel; selectedModel: string; connection: string;
    onOpen: (endpoint: ApiEndpoint, docs: boolean) => void }

// Explanatory module flows, not another API registry or a live trace. Endpoint flows come from their own docs.
const flows: Record<string, string> = {
    client: 'flowchart TD\n A["Human, CLI or extension action"] --> B["Existing App client"]\n B --> C["Configured Engine connection"]\n C --> D["Actual response or stream"]\n D --> E["App presents output or error"]',
    transport: 'flowchart TD\n A["Configured HTTP or native connection"] --> B{"Request contract"}\n B --> C["Dedicated inference route"]\n B --> D["CEP logical method and params"]\n C --> E["Existing authenticated transport"]\n D --> E\n E --> F["JSON, task, audio or stream response"]',
    guard: 'flowchart TD\n A["Incoming request"] --> B["Identify caller and operation"]\n B --> C{"Applicable scope, path and approval policy"}\n C -->|Allowed| D["Dispatch to owning Engine service"]\n C -->|Approval needed| E["Ask caller to approve"]\n C -->|Denied| F["Return explicit refusal"]\n E --> G{"Actual decision"}\n G -->|Approved| D\n G -->|Refused| F',
    inference: 'flowchart TD\n A["Messages or media input"] --> B["Select documented task"]\n B --> C{"Native extraction or model task"}\n C -->|Native| D["Extract supported content"]\n C -->|Model| E["Validate compatible installed model"]\n E --> F["Prepare input and execute backend"]\n D --> G["Return actual output or error"]\n F --> G',
    memory: 'flowchart TD\n A["Conversation or context request"] --> B{"Requested responsibility"}\n B --> C["Search and open original conversation evidence"]\n B --> D["Manage durable facts and preferences"]\n B --> E["Plan relevant context within budget"]\n B --> F["Inspect compatible saved KV"]\n C --> G["Owning storage or RAM result"]\n D --> G\n E --> G\n F --> G',
    notes: 'flowchart TD\n A{"Note source"} -->|Human| B["Validate text, scope and owner"]\n A -->|Model tool offered| C["Apply configured remember policy"]\n C --> D{"Proposed or confirmed"}\n B --> E["Shared NoteStore"]\n D --> E\n E --> F["Read notes in applicable scope"]\n F --> G["Relevant confirmed facts can enter context"]\n E --> H["Pin, confirm or invalidate through explicit actions"]',
    context: 'flowchart TD\n A["Next request and chat identity"] --> B["Gather eligible history and notes"]\n B --> C["Apply model context budget"]\n C --> D["Select relevant prompt material"]\n D --> E["Run requested inference"]\n D --> F["Preview or context report"]\n F --> G["Reports and background jobs have their documented lifetimes"]',
    kv: 'flowchart TD\n A["Saved processing cache request"] --> B{"Compatible cache exists"}\n B -->|Yes| C["Reuse compatible processing state"]\n B -->|No| D["Process input normally"]\n C --> E["Actual model task"]\n D --> E\n F["Explicit status or cleanup"] --> G["Saved KV files"]\n G --> H["Conversation text remains a separate owner"]',
    tools: 'flowchart TD\n A["Selected tool, skill or MCP bindings"] --> B["Offer instructions and schemas"]\n B --> C["Compatible model proposes structured action"]\n C --> D{"Host permissions and approval"}\n D -->|Allowed| E["Execute through owning tool host"]\n D -->|Denied| F["Return explicit refusal"]\n E --> G["Tool result returns to the conversation loop"]',
    files: 'flowchart TD\n A["Path and requested operation"] --> B["Resolve through shared workspace roots"]\n B --> C{"Authorized scope and path"}\n C -->|Allowed| D["Read, list or change through filesystem owner"]\n C -->|Denied| E["Return explicit refusal"]\n D --> F["Actual entries, content or operation result"]',
    models: 'flowchart TD\n A["Inspect available or installed packages"] --> B{"Explicit requested action"}\n B --> C["Download or install declared package files"]\n B --> D["Inspect package metadata"]\n B --> E["Load compatible model for requested task"]\n B --> F["Unload or remove explicit target"]\n C --> G["Return task progress or actual result"]\n D --> G\n E --> G\n F --> G',
    system: 'flowchart TD\n A["System, config or storage request"] --> B["Validate requested operation"]\n B --> C["Owning Engine service"]\n C --> D["Read actual state or apply explicit change"]\n D --> E["Return measured data, acknowledgment or error"]',
    runtime: 'flowchart TD\n A["Compatible installed package"] --> B["Explicit load or inference request"]\n B --> C["Existing runtime planner and backend"]\n C --> D["Prepare task-specific input"]\n D --> E["Run supported computation"]\n E --> F["Return actual task output or error"]',
    saved: 'flowchart TD\n A["Owning service requests read or write"] --> B{"Separate storage responsibility"}\n B --> C["Conversation events"]\n B --> D["Durable notes"]\n B --> E["Authorized files"]\n B --> F["Compatible saved KV"]\n C --> G["Actual storage result"]\n D --> G\n E --> G\n F --> G',
};

function Example({ title, source, choices }: { title: string; source?: string; choices?: ApiEndpoint['payload_examples'] }) {
    const [choice, setChoice] = useState('');
    const content = choices?.find(item => item.id === choice)?.payload || source;
    if (!content) return null;
    return <details className="mt-2">
        <summary className="cursor-pointer text-[var(--accent-color)]">{title} · documented example</summary>
        {choices?.length ? <div className="mt-2"><CustomDropdown floating value={choice} onChange={setChoice} placeholder="Choose input example"
            options={[{ value: '', label: 'Default request' }, ...choices.map(item => ({ value: item.id, label: item.title }))]} /></div> : null}
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all bg-[var(--bg-primary)] p-2 text-[11px]">{content.slice(0, 4000)}</pre>
        {content.length > 4000 && <p>Preview shortened; open Docs for the full example.</p>}
    </details>;
}

/** One selected process diagram. API diagrams reuse the same parser and strict renderer as Documentation. */
export function ApiArchitectureInspector({ item, model, selectedModel, connection, onOpen }: Props) {
    const { owner, endpoint, group } = item;
    const diagram = useMemo(() => {
        if (!endpoint) return flows[group?.title.toLowerCase() || ''] || flows[owner.id];
        const diagrams = documentationParts(endpoint.docs_content || '').filter(part => part.kind === 'diagram');
        return (diagrams.find(part => /^(?:flowchart|graph|sequenceDiagram)\b/.test(part.content.trimStart())) || diagrams[0])?.content;
    }, [endpoint, owner.id, group?.title]);
    return <div className="cursor-auto px-4 pb-4 text-xs leading-5 text-[var(--text-secondary)] [&_figure]:overflow-visible [&_figure_svg]:h-auto [&_figure_svg]:max-w-full">
        <p className="text-[var(--text-primary)]">{endpoint?.desc || owner.purpose}</p>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">{endpoint ? 'Process from this endpoint reference · not live execution' : 'Component explanation · applicable paths depend on the request'}</p>
        {diagram ? <ApiDiagram content={diagram} compact /> : <p role="status" className="mt-3">No process diagram is documented for this node. Open its reference for details.</p>}
        {endpoint && <>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => onOpen(endpoint, false)} aria-label={'Open payload for ' + endpoint.method + ' ' + endpoint.path}><Code size={13} /> Payload</Button>
                <Button size="sm" variant="ghost" onClick={() => onOpen(endpoint, true)} aria-label={'Read documentation for ' + endpoint.method + ' ' + endpoint.path}><BookOpen size={13} /> Docs</Button>
            </div>
            <Example title="Request" source={endpoint.request_payload} choices={endpoint.payload_examples} />
            <Example title="Response" source={endpoint.response} />
        </>}
        <details className="mt-3"><summary className="cursor-pointer text-[var(--text-muted)]">Storage, model and connection context</summary>
            <p>{owner.state}</p><p className="mt-2">{owner.model}</p><p className="mt-2">{owner.caution}</p>
            <p className="mt-2 break-all">Configured connection: {connection}. Selected model: {selectedModel || 'Automatic'}.</p>
            {model && <p>Inventory snapshot: {model.format_type || 'Format not reported'} · {model.supported_tasks?.join(', ') || 'Tasks not reported'}.</p>}
            <p>Loaded model, device and context are not measured here.</p>
        </details>
    </div>;
}

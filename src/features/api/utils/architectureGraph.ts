import type { ApiEndpoint, ApiGroup } from '../types';
import { catalogPillars } from './catalogGroups';
import { requestPath } from './requestPayload';

export interface ArchitectureGroup { id: string; title: string; endpoints: ApiEndpoint[] }
export interface ArchitectureNode {
    id: string; title: string; subtitle: string; purpose: string;
    input: string; output: string; state: string; model: string; caution: string;
    lane: 'client' | 'engine' | 'runtime' | 'storage'; groups: ArchitectureGroup[];
}
export interface ArchitectureEdge { from: string; to: string; label: string }
export interface ArchitectureGraph { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; count: number }
export interface ArchitectureStep { node: string; title: string; detail: string }
export interface ArchitectureScenario {
    id: string; title: string; requires: string[]; steps: ArchitectureStep[];
}

/** Selection identity is not the shared CEP transport URL. */
export const architectureEndpointKey = (endpoint: ApiEndpoint) => `${endpoint.method} ${endpoint.path}`;
export const architectureTransport = (endpoint: ApiEndpoint) => endpoint.transport_path ? `CEP · ${requestPath(endpoint)}` : `REST · ${requestPath(endpoint)}`;

type Copy = Omit<ArchitectureNode, 'id' | 'groups'>;
const copy: Record<string, Copy> = {
    client: { title: 'App & clients', subtitle: 'Human actions and conversations', lane: 'client',
        purpose: 'The App, CLI or extension sends a request. The human stays in control of approvals and saved information.',
        input: 'Your message, a file, a selected model, or an explicit action.', output: 'A request through the existing client transport.',
        state: 'The App keeps its own UI and conversation state.', model: 'No inference happens in this diagram.',
        caution: 'Opening a diagram node only explains the system. It never runs its APIs.' },
    transport: { title: 'Connection', subtitle: 'HTTP / native transport', lane: 'engine',
        purpose: 'Requests use the selected Engine connection. CEP methods share a wire route; inference APIs retain their dedicated routes.',
        input: 'A logical method and its parameters, or a dedicated REST payload.', output: 'The Engine response or a streamed answer.',
        state: 'Connection settings and request ownership stay in the existing API client.', model: 'A transport is not a model runtime.',
        caution: 'A configured connection is not proof that the Engine is online. No second connection is opened by this map.' },
    guard: { title: 'Request checks', subtitle: 'Auth · scope · approval · paths', lane: 'engine',
        purpose: 'The applicable Engine checks decide whether a request may continue. Filesystem and tool actions have their own rules.',
        input: 'Caller identity, operation, arguments and applicable permissions.', output: 'An allowed operation, a refusal, or an approval request.',
        state: 'Policies and approvals belong to the Engine; the App presents the result.', model: 'Model instructions do not replace permission enforcement.',
        caution: 'This is an architecture explanation, not a claim that every security property has been verified.' },
    inference: { title: 'Chat & media', subtitle: 'Prepare input and run a task', lane: 'engine',
        purpose: 'Chat, speech, transcription, vectors and ingestion each follow their documented task contract. Some extraction is native; compatible model tasks use a runtime.',
        input: 'Messages, text, audio, images or documents and compatible installed-model choices.', output: 'An answer, audio, transcript, vectors or extracted content.',
        state: 'Task retention, progress and conversation settings follow the actual request.', model: 'Only tasks that need a compatible model use the runtime.',
        caution: 'Ingest can extract without a model. A selected format alone does not prove model compatibility.' },
    memory: { title: 'Memory & context', subtitle: 'Recall · facts · planning · saved KV', lane: 'engine',
        purpose: 'Conversation events preserve what happened. Notes hold durable facts. Context chooses what the next prompt includes. Saved KV can reuse compatible processing.',
        input: 'An actual chat id, query, note, context request or cache action.', output: 'Original records, note acknowledgments, reports, job status or cache usage.',
        state: 'Engine event/notes storage, RAM reports and saved KV have different lifetimes.', model: 'Many reads need no model. Context preview can load one for its tokenizer.',
        caution: 'memory.import is RAM recovery for client-owned events. Invalidation retains history; cache cleanup is not chat deletion. User controls are still being integrated.' },
    tools: { title: 'Agents & tools', subtitle: 'Skills · plugins · MCP · approvals', lane: 'engine',
        purpose: 'The Engine offers relevant instructions and function schemas. A model requests an action; the host executes it and returns a result.',
        input: 'Tool bindings, schemas, skill instructions and structured action arguments.', output: 'A tool result, permission request or explicit failure.',
        state: 'Installation, session bindings and remembered approvals are distinct.', model: 'Compatible tool use needs model ability, a matching template and the host loop.',
        caution: 'Internal recall, open_memory, remember and task_update are AI tools, not extra HTTP endpoints. They are not offered on every turn.' },
    files: { title: 'Files & workspace', subtitle: 'Authorized paths and file operations', lane: 'engine',
        purpose: 'Filesystem methods resolve paths and operate within the applicable caller roots. Workspace methods select the working folder.',
        input: 'A real path, file content or workspace selection.', output: 'File contents, directory entries or an acknowledged operation.',
        state: 'The actual filesystem and selected workspace.', model: 'Listing or reading a file does not require inference.',
        caution: 'Copying, renaming and deletion are real operations. Inspecting this map does not perform them.' },
    models: { title: 'Model lifecycle', subtitle: 'Inventory · install · load · inspect', lane: 'engine',
        purpose: 'Model management discovers installed packages and handles explicit download, inspection, loading and removal requests.',
        input: 'A selected registry/model identity and operation.', output: 'Inventory, metadata, task acknowledgment or an actual error.',
        state: 'Model packages, registry and runtime load state.', model: 'Installed, selected and loaded mean different things.',
        caution: 'This overview does not download, load, switch or delete a model.' },
    system: { title: 'System & settings', subtitle: 'Configuration and observability', lane: 'engine',
        purpose: 'System, configuration, storage and other infrastructure methods expose their own documented controls and measurements.',
        input: 'A read request or a deliberate validated settings/action request.', output: 'The Engine data or acknowledgment, without guessed telemetry.',
        state: 'Settings, storage and applicable process/task state.', model: 'Most inspection and settings operations do not run inference.',
        caution: 'Browsing is read-only. A displayed API is not proof that its user-facing App control is complete.' },
    runtime: { title: 'Model & runtime', subtitle: 'Compatible GGUF / ONNX execution', lane: 'runtime',
        purpose: 'The runtime processes prepared input. A capable model may request a tool; the Engine executes it and feeds the result back for the next step.',
        input: 'Prepared context, compatible model data and tool results.', output: 'Generated output or a structured tool request.',
        state: 'Loaded weights and working memory; compatible saved KV is a separate disk cache.', model: 'Selected and installed details below are catalog metadata, not live loaded-state measurements.',
        caution: 'Tool formatting support is not a reliability benchmark. Neither this map nor model selection certifies all capabilities.' },
    saved: { title: 'Saved state', subtitle: 'Events · notes · files · cache', lane: 'storage',
        purpose: 'Durable events, facts, files and saved processing state have separate owners. Context reports are kept in RAM, not as a permanent archive.',
        input: 'An actual authorized read/write from its owning Engine service.', output: 'Stored data, a save acknowledgment or an error.',
        state: 'Engine-owned data by default; external conversation events must be persisted by their client.', model: 'Saved KV is reusable processing state, not model training or a replacement for text history.',
        caution: 'Saved must follow an actual acknowledgment. Deleting a chat does not imply physical removal of all shared blobs or global notes.' },
};

const categories: Record<string, string> = { 'ai-inference': 'inference', 'agents-tools': 'tools', filesystem: 'files', models: 'models', system: 'system' };
const memoryDomains = new Set(['memory', 'notes', 'context', 'kv']);
const makeNode = (id: string, groups: ArchitectureGroup[] = []): ArchitectureNode => ({ id, ...copy[id], groups });

/** Module relationships are descriptive; API membership and examples always come from the catalog. */
export function buildArchitectureGraph(catalog: ApiGroup[]): ArchitectureGraph {
    const buckets = new Map<string, ArchitectureGroup[]>();
    const seen = new Set<string>();
    const add = (id: string, group: ArchitectureGroup) => {
        const endpoints = group.endpoints.filter(endpoint => {
            const key = architectureEndpointKey(endpoint);
            if (seen.has(key)) return false;
            seen.add(key); return true;
        });
        if (endpoints.length) buckets.set(id, [...(buckets.get(id) || []), { ...group, endpoints }]);
    };
    for (const pillar of catalogPillars(catalog)) {
        for (const group of pillar.subgroups) {
            add(pillar.category === 'ai-inference' && memoryDomains.has(group.title.toLowerCase()) ? 'memory' : categories[pillar.category], group);
        }
    }
    // A newly documented category must remain reachable even before presentation metadata exists.
    for (const group of catalog) add('other', { id: `other/${group.group}`, title: group.group, endpoints: group.endpoints });
    const domains = ['inference', 'memory', 'tools', 'files', 'models', 'system'].filter(id => buckets.has(id)).map(id => makeNode(id, buckets.get(id)));
    if (buckets.has('other')) domains.push({ ...makeNode('system', buckets.get('other')), id: 'other', title: 'Other APIs', subtitle: 'Additional documented groups' });
    const nodes = [makeNode('client'), makeNode('transport'), makeNode('guard'), ...domains, makeNode('runtime'), makeNode('saved')];
    const edges: ArchitectureEdge[] = [
        { from: 'client', to: 'transport', label: 'Request / response' },
        { from: 'transport', to: 'guard', label: 'Applicable checks' },
        ...domains.map(node => ({ from: 'guard', to: node.id, label: 'Dispatch / result' })),
        { from: 'inference', to: 'memory', label: 'Relevant context / retained events and notes' },
        { from: 'inference', to: 'runtime', label: 'Task input / output' },
        { from: 'tools', to: 'runtime', label: 'Tool request / result' },
        { from: 'models', to: 'runtime', label: 'Load / inspect' },
        { from: 'memory', to: 'saved', label: 'Read / write' },
        { from: 'files', to: 'saved', label: 'Filesystem' },
        { from: 'system', to: 'saved', label: 'Config / storage' },
        { from: 'runtime', to: 'saved', label: 'Compatible saved KV' },
    ].filter(edge => nodes.some(node => node.id === edge.from) && nodes.some(node => node.id === edge.to));
    return { nodes, edges, count: seen.size };
}

const step = (node: string, title: string, detail: string): ArchitectureStep => ({ node, title, detail });
const requestSteps = [step('client', 'Human or client starts', 'A real message or deliberate action starts the workflow.'),
    step('transport', 'Use the existing connection', 'The shared API client owns routing and authentication.'),
    step('guard', 'Apply the relevant checks', 'The Engine can allow, refuse or ask for approval.')];

/** Educational steps, not executable requests or a claim about current live activity. */
export const architectureScenarios: ArchitectureScenario[] = [
    { id: 'chat', title: 'Chat answer', requires: ['chat'], steps: [...requestSteps,
        step('inference', 'Prepare context', 'Select relevant history, notes and tools within the actual context budget.'),
        step('runtime', 'Generate the answer', 'The compatible selected model processes the prepared input.'),
        step('client', 'Show the real response', 'The App renders the answer and actual stream/error events.')] },
    { id: 'recall', title: 'Find an earlier decision', requires: ['memory'], steps: [...requestSteps,
        step('memory', 'Search and open the source', 'Use search results and their references to retrieve an original message.'),
        step('saved', 'Read conversation records', 'The original content belongs to the conversation event store.'),
        step('memory', 'Return evidence', 'A model can request recall/open_memory when those tools are offered.'),
        step('runtime', 'Answer from the result', 'The Engine gives the retrieved evidence to the model; retrieval quality still needs testing.')] },
    { id: 'human-note', title: 'Human adds an AI note', requires: ['notes'], steps: [...requestSteps,
        step('memory', 'Choose text and scope', 'A human can create a note for a chat, workspace or global use.'),
        step('saved', 'Save and acknowledge', 'The Engine returns the stored note or an explicit error.'),
        step('client', 'Show the actual saved note', 'The planned AI Memory panel will display origin, scope, status and source. It is not built by this overview.')] },
    { id: 'ai-note', title: 'AI asks to remember', requires: ['notes', 'chat'], steps: [...requestSteps,
        step('runtime', 'Model requests remember', 'A compatible model can request the internal remember tool when offered.'),
        step('memory', 'Apply notes policy', 'The Engine can create a proposed note or confirm it under the configured policy.'),
        step('client', 'Human review when required', 'Confirmation needs a user-facing control; prose saying I will remember is not proof of saving.'),
        step('saved', 'Persist through the correct owner', 'Engine notes and externally owned note events have different storage contracts.')] },
    { id: 'tools', title: 'Tool, skill or MCP action', requires: ['tools'], steps: [...requestSteps,
        step('tools', 'Offer relevant tools', 'The Engine compiles selected instructions and function schemas.'),
        step('runtime', 'Model requests an action', 'The model supplies structured arguments; it does not execute the action.'),
        step('guard', 'Check the action', 'Permissions and any required human approval belong to the host.'),
        step('tools', 'Execute and return a result', 'The result returns through the Engine to the model and App.')] },
    { id: 'ingest', title: 'Document or image input', requires: ['ingest'], steps: [...requestSteps,
        step('inference', 'Resolve the input contract', 'Native extraction and optional compatible-model processing follow different documented payloads.'),
        step('saved', 'Return extracted or structured content', 'A document does not always require a model. Open the actual endpoint examples to choose a supported input.')] },
    { id: 'speech', title: 'Speech and transcription', requires: ['tts', 'stt'], steps: [...requestSteps,
        step('inference', 'Choose the audio task', 'Text-to-speech produces audio; transcription processes speech input.'),
        step('runtime', 'Use a compatible audio model', 'Language, voice and format are model/task-specific.'),
        step('client', 'Return actual output', 'Use the documented audio or transcript response, not an invented success.')] },
    { id: 'vectors', title: 'Create embeddings', requires: ['embeddings'], steps: [...requestSteps,
        step('inference', 'Validate the embedding input', 'Text and image input support depends on the selected installed model.'),
        step('runtime', 'Compute vectors', 'The supported backend returns actual numerical embeddings.'),
        step('client', 'Use the returned vectors', 'This is distinct from the conversation memory search index.')] },
    { id: 'models', title: 'Model lifecycle', requires: ['models'], steps: [...requestSteps,
        step('models', 'Inspect or manage a package', 'Inventory, download, load and removal are separate explicit operations.'),
        step('runtime', 'Load only on request', 'Browsing this diagram does not change model state.')] },
    { id: 'cache', title: 'Inspect saved KV', requires: ['kv'], steps: [...requestSteps,
        step('memory', 'Read actual saved-cache usage', 'KV controls describe saved processing files and actual cache records.'),
        step('saved', 'Separate cache from history', 'Clearing saved KV is not deleting conversation text or unloading weights.')] },
];

export function availableArchitectureScenarios(graph: ArchitectureGraph) {
    const groups = new Set(graph.nodes.flatMap(node => node.groups.map(group => group.title.toLowerCase())));
    return architectureScenarios.map(scenario => ({ ...scenario, available: scenario.requires.every(group => groups.has(group)) }));
}

export function architectureSearch(node: ArchitectureNode, query: string): ArchitectureGroup[] {
    const needle = query.trim().toLowerCase();
    return node.groups.map(group => ({ ...group, endpoints: group.endpoints.filter(endpoint => !needle
        || `${group.title} ${endpoint.method} ${endpoint.path} ${endpoint.desc}`.toLowerCase().includes(needle)) })).filter(group => group.endpoints.length);
}

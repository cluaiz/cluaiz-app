import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Network, Search } from 'lucide-react';
import { useApiStore } from '../../../store/api/useApiStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { ApiArchitectureCanvas } from './ApiArchitectureCanvas';
import { ApiArchitectureInspector } from './ApiArchitectureInspector';
import { architectureSearch, availableArchitectureScenarios, buildArchitectureGraph, type ArchitectureNode } from '../utils/architectureGraph';
import type { ApiEndpoint } from '../types';

/** Read-only explanation and navigation. Execution stays in the existing request editor. */
export const ApiArchitectureLanding: React.FC = () => {
    const { apiData, isLoadingData, installedModels, selectedModel, selectEndpoint, setActiveTab, loadApiData } = useApiStore();
    const protocol = useConnectionStore(state => state.protocol);
    const connection = useConnectionStore(state => state.getBaseUrl());
    const initialScope = useRef(`${protocol}:${connection}`);
    const searchRef = useRef<HTMLInputElement>(null);
    const lastNode = useRef<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [scenarioId, setScenarioId] = useState('');
    const [stepIndex, setStepIndex] = useState(0);
    const graph = useMemo(() => buildArchitectureGraph(apiData), [apiData]);
    const scenarios = useMemo(() => availableArchitectureScenarios(graph), [graph]);
    const scenario = scenarios.find(item => item.id === scenarioId);
    const currentStep = scenario?.available ? scenario.steps[stepIndex] : undefined;
    const searchGroups = useMemo(() => graph.nodes.flatMap(node => architectureSearch(node, query)
        .map(group => ({ ...group, id: `${node.id}:${group.id}`, title: `${node.title} / ${group.title}` }))), [graph, query]);
    const searchNode: ArchitectureNode = { ...graph.nodes[0], id: 'search', title: 'API search results', subtitle: 'From the loaded documentation catalog',
        lane: 'engine', purpose: 'Search the actual API names, paths, descriptions and groups. Open the existing payload editor or full documentation.',
        input: 'Your local search text.', output: 'Matching documented methods.', state: 'No Engine state changes.',
        model: 'Searching this catalog does not run a model.', caution: 'Documentation availability does not prove every App control or model has been tested.',
        groups: searchGroups };
    const activeNode = query.trim() ? searchNode : graph.nodes.find(node => node.id === selected);
    const highlighted = query.trim() ? graph.nodes.filter(node => architectureSearch(node, query).length).map(node => node.id)
        : scenario?.available ? scenario.steps.slice(0, stepIndex + 1).map(step => step.node) : [];
    // Inventory has no source tag. Never present an old snapshot as current after a connection switch.
    const model = initialScope.current === `${protocol}:${connection}`
        ? installedModels.find(item => item.id === selectedModel) : undefined;
    const modelLabel = selectedModel && selectedModel !== 'auto' ? `Selected: ${selectedModel}` : 'Automatic selection · resolved by the request';

    function explore(id: string) {
        lastNode.current = id;
        setSelected(id); setQuery(''); setScenarioId(''); setStepIndex(0);
    }
    function chooseScenario(id: string) {
        const chosen = scenarios.find(item => item.id === id);
        setScenarioId(id); setStepIndex(0); setQuery('');
        setSelected(chosen?.available ? chosen.steps[0].node : null);
    }
    function changeStep(index: number) {
        if (!scenario?.available || index < 0 || index >= scenario.steps.length) return;
        setStepIndex(index); setSelected(scenario.steps[index].node);
    }
    function closeInspector() {
        setSelected(null); setQuery('');
        const target = lastNode.current && document.getElementById(`architecture-node-${lastNode.current}`);
        if (target) target.focus(); else searchRef.current?.focus();
    }
    function openEndpoint(endpoint: ApiEndpoint, docs: boolean) {
        selectEndpoint(endpoint);
        if (docs) setActiveTab('docs');
    }

    return <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--bg-primary)] p-3 sm:p-4" data-testid="api-architecture">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 pb-3">
            <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]"><Network size={19} className="text-[var(--accent-color)]" /> API architecture</h1>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">Explore how clients, the Engine, tools, models and saved information work together.</p>
            </div>
            <span role="status" className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-[11px] text-[var(--text-muted)]">
                {isLoadingData ? 'Loading catalog…' : `${graph.count} documented APIs · explanation view`}
            </span>
        </header>
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
            <Input ref={searchRef} aria-label="Search architecture APIs" value={query}
                onChange={event => { setQuery(event.target.value); setSelected(null); setScenarioId(''); }}
                placeholder="Find an API, path or description…" leftIcon={<Search size={14} />}
                wrapperClassName="min-w-[180px] flex-1" />
            <div className="w-full sm:w-[265px]" aria-label="Example walkthrough selection">
                <CustomDropdown floating value={scenarioId} onChange={chooseScenario} placeholder="Choose an example walkthrough"
                    options={[{ value: '', label: 'Overview · explore freely' }, ...scenarios.map(item => ({
                        value: item.id, label: item.title + (item.available ? '' : ' · unavailable'), description: item.available ? 'Explanation only · does not execute requests' : 'Required APIs are absent from the loaded catalog'
                    }))]} />
            </div>
        </div>
        {!isLoadingData && graph.count === 0 && <div role="status" className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] p-3 text-xs text-[var(--text-secondary)]">
            No API catalog is available. The map describes relationships; endpoint lists remain empty.
            <Button variant="outline" size="sm" onClick={() => { void loadApiData(); }}>Retry catalog</Button>
        </div>}
        {scenario && <section aria-label="Example walkthrough" className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-color)]">Example · not live activity</p>
                <h2 className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{currentStep ? `${stepIndex + 1} / ${scenario.steps.length} · ${currentStep.title}` : 'Unavailable in this catalog'}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{currentStep?.detail || 'This example needs APIs that are not present. No request has been sent.'}</p>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Previous example step" disabled={!scenario.available || stepIndex === 0} onClick={() => changeStep(stepIndex - 1)}><ArrowLeft size={15} /></Button>
                <Button variant="ghost" size="icon" aria-label="Next example step" disabled={!scenario.available || stepIndex === scenario.steps.length - 1} onClick={() => changeStep(stepIndex + 1)}><ArrowRight size={15} /></Button>
                <Button variant="ghost" size="sm" onClick={() => chooseScenario('')}>Exit example</Button>
            </div>
        </section>}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
            <ApiArchitectureCanvas graph={graph} selected={activeNode?.id || null} highlighted={highlighted} modelLabel={modelLabel} onSelect={explore} />
            {activeNode && <ApiArchitectureInspector node={activeNode} query={query} selectedModel={selectedModel}
                model={model} connection={protocol === 'ffi' ? 'Native Engine transport (configured)' : connection}
                onClose={closeInspector} onOpen={openEndpoint} />}
        </main>
    </div>;
};

export default ApiArchitectureLanding;

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Search, X } from 'lucide-react';
import { useApiStore } from '../../../store/api/useApiStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { ApiArchitectureCanvas } from './ApiArchitectureCanvas';
import { architectureView, availableArchitectureScenarios, buildArchitectureGraph } from '../utils/architectureGraph';
import type { ApiEndpoint } from '../types';

/** Catalog projection and navigation only. Execution stays in the existing request editor. */
export const ApiArchitectureLanding: React.FC = () => {
    const { apiData, isLoadingData, installedModels, selectedModel, selectEndpoint, setActiveTab, loadApiData } = useApiStore();
    const protocol = useConnectionStore(state => state.protocol), connection = useConnectionStore(state => state.getBaseUrl());
    const initialScope = useRef(protocol + ':' + connection);
    const [path, setPath] = useState<string[]>([]), [query, setQuery] = useState('');
    const [navigationId, setNavigationId] = useState(0);
    const [scenarioId, setScenarioId] = useState(''), [stepIndex, setStepIndex] = useState(0);
    const graph = useMemo(() => buildArchitectureGraph(apiData), [apiData]);
    const scenarios = useMemo(() => availableArchitectureScenarios(graph), [graph]);
    const scenario = scenarios.find(value => value.id === scenarioId);
    const currentStep = scenario?.available ? scenario.steps[stepIndex] : undefined;
    const view = useMemo(() => {
        const result = architectureView(graph, path, query);
        if (!currentStep) return result;
        const parent = result.items.find(item => item.owner.id === currentStep.node);
        if (!parent) return result;
        const annotation = { ...parent, id: 'example-step', title: currentStep.title, subtitle: '', kind: 'detail' as const,
            detail: 'processing' as const, endpoint: undefined, column: Math.max(...result.items.map(item => item.column)) + 1,
            owner: { ...parent.owner, purpose: currentStep.detail } };
        return { ...result, items: [...result.items, annotation], focusId: annotation.id,
            edges: [...result.edges, { from: parent.id, to: annotation.id, label: 'Example step · not live' }] };
    }, [graph, path, query, currentStep]);
    const model = initialScope.current === protocol + ':' + connection ? installedModels.find(item => item.id === selectedModel) : undefined;
    const modelLabel = selectedModel && selectedModel !== 'auto' ? 'Selected: ' + selectedModel : 'Automatic selection · resolved by request';
    function navigate(next: string[]) { setPath(next); setQuery(''); setScenarioId(''); setStepIndex(0); setNavigationId(id => id + 1); }
    function chooseScenario(id: string) {
        const chosen = scenarios.find(item => item.id === id);
        setScenarioId(id); setStepIndex(0); setQuery(''); setPath(chosen?.available ? [chosen.steps[0].node] : []); setNavigationId(value => value + 1);
    }
    function changeStep(index: number) {
        if (!scenario?.available || index < 0 || index >= scenario.steps.length) return;
        setStepIndex(index); setPath([scenario.steps[index].node]);
    }
    function back() {
        navigate(view.path.slice(0, -1));
        requestAnimationFrame(() => (document.querySelector('[aria-label="Graph breadcrumb"] button:last-child') as HTMLButtonElement)?.focus());
    }
    function openEndpoint(endpoint: ApiEndpoint, docs: boolean) { selectEndpoint(endpoint); if (docs) setActiveTab('docs'); }
    const toolbar = <>
        <Button variant="ghost" size="icon" aria-label="Back in graph" disabled={!view.path.length && !query} onClick={back}><ArrowLeft size={15} /></Button>
        <nav aria-label="Graph breadcrumb" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {view.breadcrumbs.map((crumb, i) => <React.Fragment key={JSON.stringify(crumb.path)}>
                {i > 0 && <ChevronRight size={11} className="shrink-0 text-[var(--text-muted)]" />}
                <button type="button" title={crumb.title} onClick={() => navigate(crumb.path)}
                    className="max-w-36 shrink-0 truncate rounded px-1.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-color)] focus-visible:outline focus-visible:outline-[var(--accent-color)]">{crumb.title}</button>
            </React.Fragment>)}
        </nav>
        <span role="status" className="text-[10px] text-[var(--text-muted)]">{isLoadingData ? 'Loading…' : view.matches !== undefined ? view.matches + ' matches' : graph.count + ' APIs'}</span>
        <div className="shrink-0" style={{ width: 160 }}><Input aria-label="Search architecture APIs" value={query} onChange={event => { setQuery(event.target.value); setScenarioId(''); }}
            placeholder="Find API…" leftIcon={<Search size={13} />} sizeVariant="sm" /></div>
        {query && <Button variant="ghost" size="icon" aria-label="Clear graph search" onClick={() => setQuery('')}><X size={13} /></Button>}
        <div className="shrink-0" style={{ width: 144 }} aria-label="Example walkthrough selection"><CustomDropdown floating value={scenarioId} onChange={chooseScenario}
            placeholder="Examples" options={[{ value: '', label: 'Explore freely' }, ...scenarios.map(item => ({ value: item.id,
                label: item.title + (item.available ? '' : ' · unavailable'), description: 'Explanation only · no request executes' }))]} /></div>
        {scenario && <>
            <span className="text-[10px] text-[var(--text-secondary)]">{scenario.available ? 'Example ' + (stepIndex + 1) + '/' + scenario.steps.length : 'APIs unavailable'}</span>
            <Button variant="ghost" size="icon" aria-label="Previous example step" disabled={!scenario.available || !stepIndex} onClick={() => changeStep(stepIndex - 1)}><ArrowLeft size={13} /></Button>
            <Button variant="ghost" size="icon" aria-label="Next example step" disabled={!scenario.available || stepIndex === scenario.steps.length - 1} onClick={() => changeStep(stepIndex + 1)}><ArrowRight size={13} /></Button>
            <Button variant="ghost" size="icon" aria-label="Exit example" onClick={() => chooseScenario('')}><X size={13} /></Button>
        </>}
    </>;
    return <div className="relative h-full min-h-0 w-full min-w-0 bg-[var(--bg-primary)]" data-testid="api-architecture"
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); back(); } }}>
        <ApiArchitectureCanvas view={view} navigationKey={navigationId + ':' + query + ':' + stepIndex} highlighted={currentStep ? [currentStep.node] : []} modelLabel={modelLabel} toolbar={toolbar}
            model={model} selectedModel={selectedModel} connection={protocol === 'ffi' ? 'Native Engine transport (configured)' : connection}
            onNavigate={navigate} onOpen={openEndpoint} />
        {!isLoadingData && !graph.count && <div role="status" className="absolute left-4 top-24 flex items-center gap-2 bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">
            Catalog unavailable. No endpoints invented.<Button size="sm" variant="outline" onClick={() => { void loadApiData(); }}>Retry catalog</Button>
        </div>}
    </div>;
};

export default ApiArchitectureLanding;

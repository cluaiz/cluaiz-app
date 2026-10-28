import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Search, X } from 'lucide-react';
import { useApiStore } from '../../../store/api/useApiStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CustomDropdown } from '../../../components/ui/dropdown/CustomDropdown';
import { ApiArchitectureCanvas } from './ApiArchitectureCanvas';
import { appendArchitectureReveal, architecturePathContains, architectureView, availableArchitectureScenarios, buildArchitectureGraph, type ArchitectureReveal } from '../utils/architectureGraph';
import type { ApiEndpoint } from '../types';

/** Selection, retained expansions and viewport are independent. Only the existing editor executes requests. */
export const ApiArchitectureLanding: React.FC = () => {
    const { apiData, isLoadingData, installedModels, selectedModel, selectEndpoint, setActiveTab, loadApiData } = useApiStore();
    const protocol = useConnectionStore(state => state.protocol), connection = useConnectionStore(state => state.getBaseUrl());
    const initialScope = useRef(protocol + ':' + connection);
    const [path, setPath] = useState<string[]>([]), [history, setHistory] = useState<ArchitectureReveal[]>([]);
    const [closed, setClosed] = useState<string[][]>([]), [detailPath, setDetailPath] = useState<string[] | null>(null);
    const [query, setQuery] = useState(''), [matchIndex, setMatchIndex] = useState(-1);
    const [scenarioId, setScenarioId] = useState(''), [stepIndex, setStepIndex] = useState(0);
    const [resetKey, setResetKey] = useState(0);
    const graph = useMemo(() => buildArchitectureGraph(apiData), [apiData]);
    const scenarios = useMemo(() => availableArchitectureScenarios(graph), [graph]);
    const scenario = scenarios.find(value => value.id === scenarioId);
    const currentStep = scenario?.available ? scenario.steps[stepIndex] : undefined;
    const activeExample = currentStep ? scenarioId + ':' + stepIndex : undefined;
    const view = useMemo(() => architectureView(graph, path, query, history, activeExample, closed, detailPath), [graph, path, query, history, activeExample, closed, detailPath]);
    const model = initialScope.current === protocol + ':' + connection ? installedModels.find(item => item.id === selectedModel) : undefined;
    const modelLabel = selectedModel && selectedModel !== 'auto' ? 'Selected: ' + selectedModel : 'Automatic selection · resolved by request';
    function reveal(next: string[], keepQuery = false) {
        setHistory(previous => appendArchitectureReveal(previous, next)); setPath(next);
        setClosed(previous => previous.filter(branch => !architecturePathContains(branch, next))); setDetailPath(next.length ? next : null);
        if (!keepQuery) { setQuery(''); setMatchIndex(-1); }
        setScenarioId(''); setStepIndex(0);
    }
    function collapse(next: string[]) {
        const branches = [next, ...history.filter(entry => architecturePathContains(next, entry.path)).map(entry => entry.path)];
        setClosed(previous => [...new Map([...previous, ...branches].map(branch => [JSON.stringify(branch), branch])).values()]);
        setDetailPath(null); setPath(next); setScenarioId(''); setQuery(''); setMatchIndex(-1);
    }
    function toggle(next: string[]) {
        const key = JSON.stringify(next);
        if (key === JSON.stringify(view.path) && view.items.some(item => item.parentId === key)) collapse(next);
        else reveal(next);
    }
    function showStep(id: string, index: number) {
        const chosen = scenarios.find(item => item.id === id);
        if (!chosen?.available || index < 0 || index >= chosen.steps.length) return;
        const step = chosen.steps[index], next = [step.node];
        setHistory(previous => appendArchitectureReveal(previous, next, { id: id + ':' + index, title: step.title, detail: step.detail }));
        setClosed(previous => previous.filter(branch => !architecturePathContains(branch, next))); setDetailPath(next);
        setPath(next); setScenarioId(id); setStepIndex(index); setQuery(''); setMatchIndex(-1);
    }
    function chooseScenario(id: string) {
        if (!id) { setScenarioId(''); setStepIndex(0); setPath([]); setDetailPath(null); return; }
        const chosen = scenarios.find(item => item.id === id);
        if (!chosen?.available) { setScenarioId(id); setPath([]); setDetailPath(null); return; }
        showStep(id, 0);
    }
    function nextMatch(direction: number) {
        const matches = view.matchPaths || []; if (!matches.length) return;
        const index = matchIndex < 0 ? (direction > 0 ? 0 : matches.length - 1)
            : (matchIndex + direction + matches.length) % matches.length;
        setMatchIndex(index); reveal(matches[index].path, true);
    }
    function back() {
        if (query) { setQuery(''); setMatchIndex(-1); return; }
        reveal(view.path.slice(0, -1));
        requestAnimationFrame(() => (document.querySelector('[aria-label="Graph breadcrumb"] button:last-child') as HTMLButtonElement)?.focus());
    }
    function openEndpoint(endpoint: ApiEndpoint, docs: boolean) { selectEndpoint(endpoint); if (docs) setActiveTab('docs'); }
    function resetGraph() {
        setPath([]); setHistory([]); setClosed([]); setDetailPath(null);
        setQuery(''); setMatchIndex(-1); setScenarioId(''); setStepIndex(0);
        setResetKey(previous => previous + 1);
    }
    const toolbar = <>
        <Button variant="ghost" size="icon" aria-label="Back in graph" disabled={!view.path.length && !query} onClick={back}><ArrowLeft size={15} /></Button>
        <nav aria-label="Graph breadcrumb" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {view.breadcrumbs.map((crumb, i) => <React.Fragment key={JSON.stringify(crumb.path)}>
                {i > 0 && <ChevronRight size={11} className="shrink-0 text-[var(--text-muted)]" />}
                <button type="button" title={crumb.title} onClick={() => reveal(crumb.path)}
                    className="max-w-36 shrink-0 truncate rounded px-1.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-color)] focus-visible:outline focus-visible:outline-[var(--accent-color)]">{crumb.title}</button>
            </React.Fragment>)}
        </nav>
        <span role="status" className="text-[10px] text-[var(--text-muted)]">{isLoadingData ? 'Loading…' : graph.count + ' APIs'}</span>
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5 pr-4" data-architecture-search-controls>
            <div className="min-w-0 shrink-0" style={{ width: 'clamp(180px, 22vw, 260px)', maxWidth: '100%' }}>
                <Input aria-label="Search architecture APIs" value={query}
                    onChange={event => { setQuery(event.target.value); setMatchIndex(-1); setScenarioId(''); }}
                    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); nextMatch(event.shiftKey ? -1 : 1); } }}
                    placeholder="Search APIs · Enter to reveal" leftIcon={<Search size={13} />} sizeVariant="sm" />
            </div>
            {query && <>
                <span role="status" className="text-[10px] text-[var(--text-secondary)]">{view.matches} matches</span>
                <Button variant="ghost" size="icon" aria-label="Previous API match" disabled={!view.matches} onClick={() => nextMatch(-1)}><ArrowLeft size={13} /></Button>
                <Button variant="ghost" size="icon" aria-label="Next API match" disabled={!view.matches} onClick={() => nextMatch(1)}><ArrowRight size={13} /></Button>
                <Button variant="ghost" size="icon" aria-label="Clear graph search" onClick={() => { setQuery(''); setMatchIndex(-1); }}><X size={13} /></Button>
            </>}
            <div className="shrink-0" style={{ width: 160 }} aria-label="Example walkthrough selection"><CustomDropdown floating value={scenarioId} onChange={chooseScenario}
                placeholder="Examples" options={[{ value: '', label: 'Examples' }, ...scenarios.map(item => ({ value: item.id,
                    label: item.title + (item.available ? '' : ' · unavailable'), description: 'Explanation only · no request executes' }))]} /></div>
            {scenario && <>
                <span className="text-[10px] text-[var(--text-secondary)]">{scenario.available ? 'Example ' + (stepIndex + 1) + '/' + scenario.steps.length : 'APIs unavailable'}</span>
                <Button variant="ghost" size="icon" aria-label="Previous example step" disabled={!scenario.available || !stepIndex} onClick={() => showStep(scenarioId, stepIndex - 1)}><ArrowLeft size={13} /></Button>
                <Button variant="ghost" size="icon" aria-label="Next example step" disabled={!scenario.available || stepIndex === scenario.steps.length - 1} onClick={() => showStep(scenarioId, stepIndex + 1)}><ArrowRight size={13} /></Button>
                <Button variant="ghost" size="icon" aria-label="Exit example" onClick={() => chooseScenario('')}><X size={13} /></Button>
            </>}
        </div>
    </>;
    return <div className="relative h-full min-h-0 w-full min-w-0 bg-[var(--bg-primary)]" data-testid="api-architecture"
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); back(); } }}>
        <ApiArchitectureCanvas key={resetKey} onReset={resetGraph} view={view} ready={graph.count > 0} highlighted={currentStep ? [currentStep.node] : []} modelLabel={modelLabel} toolbar={toolbar}
            model={model} selectedModel={selectedModel} connection={protocol === 'ffi' ? 'Native Engine transport (configured)' : connection}
            onNavigate={toggle} onCollapse={collapse} onOpen={openEndpoint} />
        {!isLoadingData && !graph.count && <div role="status" className="absolute left-4 top-24 flex items-center gap-2 bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">
            Catalog unavailable. No endpoints invented.<Button size="sm" variant="outline" onClick={() => { void loadApiData(); }}>Retry catalog</Button>
        </div>}
    </div>;
};

export default ApiArchitectureLanding;

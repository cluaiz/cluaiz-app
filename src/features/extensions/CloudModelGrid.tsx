import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Plug, Plus } from 'lucide-react';
import type { CloudModel, CloudProvider } from '../../api/catalogue/providers';
import { providersApi, type ModelProvider, type ProviderModel } from '../../api/engine/providers';
import { errorMessage } from '../../api/client/errors';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/toast';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushViewRoute } from '../../core/router';
import { useProvidersStore } from '../../store/cloud/useProvidersStore';
import { CatalogueChips, CatalogueToolbar, SpecList } from './CatalogueUI';
import { MultiLevelDropdown } from '../../components/ui/dropdown';
import { ModelCardTrack } from './FamilyModelSliderRow';
import { ModelCardFrame } from './ModelSliderCard';
import { onToolkitHistory, setToolkitParams, toolkitParam } from './toolkitNavigation';
import { ProviderLogo } from './ProviderLogo';
import { KIND_LABELS, SORTS, bareModel, capabilities, compareModels, dollars, tokens, useCloudFilter, type CloudSort } from './cloudModelView';

/** Listed models as providers.set takes them: id → context */
export const listedModels = (models: ProviderModel[]) =>
    Object.fromEntries(models.map(model => [model.id, model.context ? { context: model.context } : {}]));

/** A provider's model in the catalogue's model card. */
export function CloudModelCard({ providerId, providerName, model, fill, active, listed = false, onSelect, onToggle }: {
    providerId: string; providerName: string; model: CloudModel; fill: boolean; active: boolean; listed?: boolean; onSelect: () => void;
    /** Adds the model to, or removes it from, the model picker (connected providers) */
    onToggle?: () => void;
}) {
    return <ModelCardFrame logo={<ProviderLogo id={providerId} large />} badge={model.context ? `${tokens(model.context)} ctx` : model.id}
        provider={providerName} title={model.name} tags={[...(model.status ? [model.status] : []), ...capabilities(model).slice(0, 2)]}
        description={model.description} footerStart={model.price ? `${dollars(model.price.input)} in · ${dollars(model.price.output)} out / 1M` : 'Price not listed'}
        footerEnd={KIND_LABELS[model.kind]} className={fill ? 'w-full' : undefined} isActive={active} mark={listed ? 'In model picker' : undefined}
        onToggleMark={onToggle} toggleLabel="Add to model picker" onSelect={onSelect} />;
}

const yesNo = (value: boolean) => value ? 'Yes' : 'No';

/** The selected model, laid out as a local model's package panel: name and actions on top, then its specifications. */
function ModelSpecs({ model, providerName, fullName, endpoint, engine, busy, listed, inChat, listedCount, total, onUse, onTest, onToggle }: {
    model: CloudModel; providerName: string; fullName: string; endpoint: string; engine?: ModelProvider; busy: string | null;
    listed: boolean; inChat: boolean; listedCount: number; total: number; onUse: () => void; onTest: () => void; onToggle: () => void;
}) {
    return <section className="space-y-4 border-t border-[var(--border-color)] pt-5" aria-label="Selected model">
        <Card><CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{model.name || model.id}</p>
                    <p className="text-xs font-mono text-[var(--text-secondary)] truncate">{fullName}</p>
                </div>
                {engine ? <div className="flex flex-wrap items-center gap-2">
                    <Button variant={listed ? 'secondary' : 'default'} size="sm" disabled={Boolean(busy)} onClick={onToggle} aria-pressed={listed}
                        title={listed ? 'Click to remove from the model picker' : undefined}>
                        {listed ? <><CheckCircle2 size={14} className="text-emerald-400" /> In model picker</> : <><Plus size={14} /> Add to model picker</>}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={onTest}>
                        {busy === model.id ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Test
                    </Button>
                    {model.kind === 'chat' && (inChat ? <Badge variant="outline"><CheckCircle2 size={14} className="text-emerald-400" /> In chat</Badge>
                        : <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={onUse}><MessageSquare size={14} /> Use in chat</Button>)}
                </div> : <span className="text-xs text-[var(--text-secondary)]">Add your API key above to use this model</span>}
            </div>
            {model.description && <p className="text-xs text-[var(--text-secondary)]">{model.description}</p>}
            {engine && <p className="text-xs text-[var(--text-muted)]">
                {listedCount} of {total} {providerName} models in the model picker · only these can be chosen in chat
            </p>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
            <CardContent>
                <SpecList specs={[
                    ['Model name', fullName],
                    ['Type', KIND_LABELS[model.kind]],
                    ['Endpoint', endpoint || 'Not listed'],
                    ['API format', engine?.type || 'Not connected'],
                    ['API key', engine?.key || 'Not connected'],
                    ['Context window', tokens(model.context)],
                    ['Max output', tokens(model.output)],
                    ['Input price (1M tokens)', dollars(model.price?.input)],
                    ['Output price (1M tokens)', dollars(model.price?.output)],
                    ['Cached input (1M tokens)', dollars(model.price?.cacheRead)],
                    ['Reads', model.inputs.join(', ') || 'Not listed'],
                    ['Tools', yesNo(model.tools)],
                    ['Reasoning', yesNo(model.reasoning)],
                    ['Open weights', yesNo(model.openWeights)],
                    ['Knowledge cutoff', model.knowledge || 'Not listed'],
                    ['Released', model.released || 'Not listed'],
                    ['Updated', model.updated || 'Not listed'],
                    ['Status', model.status || 'Not listed'],
                ]} />
            </CardContent>
        </Card>
    </section>;
}

/**
 * A provider's models as the catalogue shows a family's: search and sort, the card track, and the selected
 * model's pricing and specifications. Models come from the catalogue and the Engine's providers.json.
 */
export function CloudModelGrid({ providerId, preset, engine, onSaved }: {
    providerId: string; preset?: CloudProvider; engine?: ModelProvider; onSaved: (provider: ModelProvider) => void;
}) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<CloudSort>('newest');
    /** The model shown below the cards; kept in the URL as model=<id> */
    const [activeId, setActiveState] = useState(() => toolkitParam('model'));
    const setActiveId = (id: string) => { setToolkitParams({ model: id }); setActiveState(id); };
    const [busy, setBusy] = useState<string | null>(null);
    const chatModel = useProvidersStore(state => state.chatModel);
    useEffect(() => { setActiveState(toolkitParam('model')); setQuery(''); }, [providerId]);
    useEffect(() => onToolkitHistory(() => setActiveState(toolkitParam('model'))), []);

    const listedIds = useMemo(() => new Set(engine?.models.map(model => model.id)), [engine]);
    const models = useMemo(() => {
        const catalogue = preset?.models ?? [];
        const seen = new Set(catalogue.map(model => model.id)), extra: CloudModel[] = [];
        for (const model of engine?.models ?? []) {
            if (!seen.has(model.id)) { seen.add(model.id); extra.push(bareModel(model.id, model.context, model.kind)); }
        }
        return [...catalogue, ...extra];
    }, [preset, engine]);
    const text = query.trim().toLowerCase();
    const filter = useCloudFilter(engine ? listedIds : undefined, models);
    const shown = models.filter(model => filter.matches(model)
        && (!text || [model.id, model.name, model.family, ...capabilities(model)].some(value => value.toLowerCase().includes(text))))
        .sort(compareModels(sort));
    const active = shown.find(model => model.id === activeId) ?? shown[0];
    const fullName = (model: CloudModel) => `${providerId}/${model.id}`;

    const run = async (key: string, action: () => Promise<void>) => {
        setBusy(key);
        try { await action(); } catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(null); }
    };
    const saveListed = async (next: Record<string, { context?: number }>) => {
        if (engine) onSaved(await providersApi.save({ name: engine.name, base_url: engine.base_url, models: next }));
    };
    const withModel = (model: CloudModel) => ({ ...listedModels(engine?.models ?? []), [model.id]: model.context ? { context: model.context } : {} });
    const toggle = (model: CloudModel) => run('save', () => saveListed(listedIds.has(model.id)
        ? Object.fromEntries(Object.entries(listedModels(engine?.models ?? [])).filter(([id]) => id !== model.id))
        : withModel(model)));
    const use = (model: CloudModel) => run('save', async () => {
        if (!listedIds.has(model.id)) await saveListed(withModel(model));
        await useProvidersStore.getState().refresh();
        useProvidersStore.getState().setChatModel(fullName(model));
        useLayoutStore.getState().setActiveView('chat');
        pushViewRoute('chat');
    });
    const test = (model: CloudModel) => run(model.id, async () => {
        if (!engine) return;
        const result = await providersApi.test(engine.name, model.id);
        toast.success(`${result.model} answered in ${result.ms} ms: ${result.answer}`);
    });

    return <div className="space-y-4">
        <CatalogueToolbar query={query} onQuery={setQuery} placeholder={`Search ${preset?.name ?? providerId} models...`}
            sort={sort} sorts={SORTS} onSort={setSort}
            filter={<MultiLevelDropdown categories={filter.categories} activeCount={filter.chips.length} onClearAll={filter.clear} iconOnly />} />
        <CatalogueChips values={filter.chips} clear={filter.clear} />

        {shown.length === 0 ? <div className="py-12 text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-tertiary)]/20">
            <p className="text-xs font-mono text-[var(--text-muted)]">{query ? <>No models matched &ldquo;{query}&rdquo;</> : models.length ? 'No models match the selected filters.' : 'No models listed yet.'}</p>
        </div> : <ModelCardTrack items={shown} keyOf={model => model.id} borderless activeKey={active?.id}
            markOf={model => listedIds.has(model.id) ? 'In model picker' : undefined} renderCard={(model, fill) => (
            <CloudModelCard providerId={providerId} providerName={preset?.name ?? providerId} model={model} fill={fill}
                active={active?.id === model.id} listed={listedIds.has(model.id)} onSelect={() => setActiveId(model.id)}
                onToggle={engine ? () => void toggle(model) : undefined} />
        )} />}

        {active && <ModelSpecs key={active.id} model={active} providerName={preset?.name ?? providerId} fullName={fullName(active)}
            endpoint={engine?.base_url ?? preset?.api ?? ''} listedCount={listedIds.size} total={models.length} engine={engine} busy={busy}
            listed={listedIds.has(active.id)} inChat={chatModel === fullName(active)}
            onUse={() => void use(active)} onTest={() => void test(active)} onToggle={() => void toggle(active)} />}
    </div>;
}

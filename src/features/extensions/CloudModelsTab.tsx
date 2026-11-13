import { useEffect, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { MultiLevelDropdown } from '../../components/ui/dropdown';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { NEW_PROVIDER, useProvidersStore } from '../../store/cloud/useProvidersStore';
import { AccordionGroup, AccordionItem } from '../../components/ui/Accordion';
import { DirectoryMarks, DirectoryRow, useFolds } from './DirectoryRow';
import { tokens } from './cloudModelView';
import { onToolkitHistory, toolkitParam } from './toolkitNavigation';
import { ProviderLogo } from './ProviderLogo';
import { ListingTabs } from './ModelListingTabs';
import { useModelCatalogueStore } from './modelCatalogueStore';
import { useCloudDirectory } from './useCloudDirectory';

/**
 * Sidebar of Toolkit → AI Models → Cloud: Browse (supported providers) or Installed (connected ones),
 * with search and the model filter as in Local → Browse. The selected provider opens in the content pane.
 */
export function CloudModelsTab() {
    const scope = useConnectionStore(state => state.getBaseUrl());
    const { loading, error, selected, refresh, select } = useProvidersStore();
    const setListing = useModelCatalogueStore(state => state.setListing);
    const [query, setQuery] = useState('');
    const { catalogue, known, entries, filter, listing, counts } = useCloudDirectory(query);
    useEffect(() => { void refresh(); }, [scope, refresh]);
    const [openModel, setOpenModel] = useState(() => toolkitParam('model'));
    useEffect(() => onToolkitHistory(() => setOpenModel(toolkitParam('model'))), []);
    const folds = useFolds();
    const status = 'p-4 text-center text-xs text-[var(--text-muted)]';

    return <>
        <ListingTabs value={listing} onChange={setListing} browse={counts.browse} installed={counts.installed} installedLabel="Connected" />
        <div className="p-2.5 flex items-center gap-2 border-b border-[var(--border-color)]">
            <div className="flex-1 min-w-0">
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search providers…"
                    leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />} wrapperClassName="w-full" />
            </div>
            <MultiLevelDropdown categories={filter.categories} activeCount={filter.chips.length} onClearAll={filter.clear} iconOnly />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            <DirectoryRow title="Add custom" subtitle="Your own endpoint or API" icon={<Plus className="w-4 h-4 text-[var(--accent-color)]" />}
                selected={selected === NEW_PROVIDER} onClick={() => select(NEW_PROVIDER)} />
            {entries.map(({ item, engine, models }) => {
                const row = { title: item.name, subtitle: engine?.base_url ?? item.api, tag: item.tested ? 'TESTED' : undefined, done: engine ? 'Connected' : undefined,
                    icon: <ProviderLogo id={item.id} boxed={false} />, onClick: () => select(item.id) };
                if (listing !== 'installed' || !engine) return <DirectoryRow key={item.id} {...row} count={models.length} selected={selected === item.id} />;
                /* Connected: the provider folds out the models in its model picker (providers.json) */
                const current = selected === item.id && !openModel;
                return <AccordionGroup key={item.id} title={item.name} count={engine.models.length} open={folds.open(item.id)}
                    icon={<span className="w-4 h-4 shrink-0 flex items-center justify-center [&>*]:!w-4 [&>*]:!h-4"><ProviderLogo id={item.id} boxed={false} /></span>}
                    marks={<DirectoryMarks selected={current} done="Connected" />} onToggle={() => folds.click(item.id, current, row.onClick)}>
                    {engine.models.map(model => <AccordionItem key={model.id} title={model.context ? `${model.id} · ${tokens(model.context)} context` : model.id}
                        selected={selected === item.id && openModel === model.id} onClick={() => select(item.id, model.id)}>
                        <span className="truncate font-mono text-[11px] leading-tight">{model.id}</span>
                    </AccordionItem>)}
                    {!engine.models.length && <p className="px-2 py-1 text-[10px] text-[var(--text-muted)]">No models in the picker yet</p>}
                </AccordionGroup>;
            })}
            {(catalogue.busy || loading) && !known.length && <div className={`${status} flex items-center justify-center gap-2`}>
                <Loader2 size={13} className="animate-spin" /> Reading providers…
            </div>}
            {catalogue.error && !known.length && <button type="button" onClick={() => void catalogue.refresh()} className={`${status} w-full`} title={catalogue.error}>
                Provider list could not be read. Retry
            </button>}
            {error && <button type="button" onClick={() => void refresh()} className={`${status} w-full`} title={error}>
                Connected providers could not be read. Retry
            </button>}
            {!catalogue.busy && known.length > 0 && !entries.length && <p className={status}>
                {listing === 'installed' && !query && !filter.active ? 'No provider connected yet. Open one in Browse and add its API key.' : 'No providers match.'}
            </p>}
        </div>
    </>;
}

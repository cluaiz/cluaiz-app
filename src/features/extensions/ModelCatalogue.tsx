import { useEffect, useRef, useState } from 'react';
import { modelCatalogue, modelInstallReference, type ModelInstallSource, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import { modelsApi } from '../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { CustomDropdown } from '../../components/ui/dropdown/CustomDropdown';
import { useCatalogue } from './useCatalogue';
import { Tabs } from '../../components/ui/Tabs';
import { ArrowDownWideNarrow, Boxes, Globe, Layers, Sparkles, LayoutGrid } from 'lucide-react';
import { MultiLevelDropdown, type MultiLevelCategory } from '../../components/ui/dropdown';
import { CatalogueCard, CatalogueChips, CatalogueFilter, CatalogueLogo, CatalogueStickyHeader, CatalogueTags } from './CatalogueUI';
import { chooseModelVariant, filterModels, installedModelForVariant, type CatalogueSort } from './catalogueView';
import { resumeModelDownload } from '../../api/engine/models/actions';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';
const resumeDownload: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeModelDownload>>>>[1] =
  (_target, id, signal, observer) => resumeModelDownload(id, signal, observer);

export function ModelCatalogue() {
  const catalogue = useCatalogue(modelCatalogue.list);
  const download = useCatalogueTask('models.download', resumeDownload);
  const [query, setQuery] = useState(''), [task, setTask] = useState(''), [format, setFormat] = useState('');
  const [providers, setProviders] = useState<string[]>([]), [sort, setSort] = useState<CatalogueSort>('popular');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [source, setSource] = useState<ModelInstallSource>('catalogue');
  const [installed, setInstalled] = useState<ModelRegistryEntry[]>([]), [engineError, setEngineError] = useState('');
  const [inventoryReady, setInventoryReady] = useState(false);
  const busy = download.busy || download.cancelling;
  const [limit, setLimit] = useState(24);
  const [view, setView] = useState<'families' | 'models'>('families'), [family, setFamily] = useState('');
  const scope = useRef(0);
  const [connection, setConnection] = useState(0);
  useEffect(() => {
    const unsubscribe = useConnectionStore.subscribe((next, previous) => {
      if (next.host !== previous.host || next.port !== previous.port || next.protocol !== previous.protocol) {
        ++scope.current;
        setInstalled([]); setInventoryReady(false); setEngineError(''); setConnection(value => value + 1);
      }
    });
    return () => { ++scope.current; unsubscribe(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(), version = scope.current;
    setInventoryReady(false);
    void modelsApi.getInstalled(controller.signal).then(value => {
      if (scope.current === version && !controller.signal.aborted) { setInstalled(value.installed); setInventoryReady(true); setEngineError(''); }
    }).catch(error => { if (!controller.signal.aborted && scope.current === version) setEngineError(String(error)); });
    return () => controller.abort();
  }, [connection]);
  useEffect(() => { if (download.result) setConnection(value => value + 1); }, [download.result]);
  const models = catalogue.reply?.data ?? [];
  const tasks = [...new Set(models.flatMap(model => model.tasks))].sort();
  const filtered = filterModels(models, { query, providers, capabilities: task ? [task] : [], format, sort, family });
  const clearFilters = () => { setQuery(''); setTask(''); setFormat(''); setProviders([]); setFamily(''); setLimit(24); };

  async function install(model: PublicModel, variant: PublicVariant) {
    if (!inventoryReady) return;
    const reference = modelInstallReference(model, variant, source);
    await download.start(reference, (signal, observer) => modelsApi.downloadModel({ model_id: reference }, signal, observer));
  }
  const categories: MultiLevelCategory[] = [
    {
      id: 'view',
      label: 'View Mode',
      icon: LayoutGrid,
      options: [
        { value: 'families', label: 'Model Families' },
        { value: 'models', label: 'All Models (Flat Grid)' },
      ],
      selectedValue: view,
      onSelect: (val) => {
        setView(val as 'families' | 'models');
        setFamily('');
        setLimit(24);
      },
    },
    {
      id: 'format',
      label: 'Model Format',
      icon: Layers,
      options: [
        { value: '', label: 'All Formats' },
        { value: 'gguf', label: 'GGUF' },
        { value: 'onnx', label: 'ONNX' },
      ],
      selectedValue: format,
      onSelect: (val) => {
        setFormat(val);
        setLimit(24);
      },
    },
    {
      id: 'task',
      label: 'Capabilities',
      icon: Sparkles,
      options: [
        { value: '', label: 'All Capabilities' },
        ...tasks.map(t => ({ value: t, label: t })),
      ],
      selectedValue: task,
      onSelect: (val) => {
        setTask(val);
        setLimit(24);
      },
    },
    {
      id: 'providers',
      label: 'Providers',
      icon: Globe,
      isMultiSelect: true,
      options: [...new Set(models.map(m => m.provider).filter(Boolean))].sort().map(p => ({
        value: p,
        label: p,
      })),
      selectedValue: providers,
      onSelect: (val) => {
        setProviders(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]);
        setLimit(24);
      },
    },
    {
      id: 'sort',
      label: 'Sort By',
      icon: ArrowDownWideNarrow,
      options: [
        { value: 'popular', label: 'Popular' },
        { value: 'newest', label: 'Newest' },
        { value: 'oldest', label: 'Oldest' },
        { value: 'name', label: 'Name' },
      ],
      selectedValue: sort,
      onSelect: (val) => {
        setSort(val as CatalogueSort);
        setLimit(24);
      },
    },
  ];

  const activeFilterCount = (format ? 1 : 0) + (task ? 1 : 0) + providers.length + (sort !== 'popular' ? 1 : 0) + (view !== 'families' ? 1 : 0);

  return <div className="w-full flex flex-col min-h-full">
    <CatalogueStickyHeader
      title="Models"
      subtitle="Find a model and choose a package for your Engine."
      searchQuery={query}
      onSearchChange={value => { setQuery(value); setLimit(24); }}
      searchPlaceholder="Search models, families, architectures or providers"
      actions={
        <div className="flex items-center gap-2">
          <Tabs items={[{ id: 'families', label: 'Families' }, { id: 'models', label: 'All models' }]} value={view} onChange={value => { setView(value); setFamily(''); setLimit(24); }} />
        </div>
      }
      filterElement={
        <MultiLevelDropdown
          categories={categories}
          activeCount={activeFilterCount}
          onClearAll={clearFilters}
        />
      }
      chips={
        <CatalogueChips clear={clearFilters} values={[
          ...providers.map(provider => ({ key: `provider:${provider}`, label: provider, remove: () => { setProviders(values => values.filter(value => value !== provider)); setLimit(24); } })),
          ...(task ? [{ key: 'task', label: task, remove: () => { setTask(''); setLimit(24); } }] : []),
          ...(format ? [{ key: 'format', label: format.toUpperCase(), remove: () => { setFormat(''); setLimit(24); } }] : []),
        ]} />
      }
    />
    <div className="mx-auto w-full max-w-7xl p-6 space-y-4">
      {family && <Button variant="ghost" onClick={() => { setFamily(''); setLimit(24); }}>All families · {family}</Button>}
    {catalogue.busy && <p role="status">Loading catalogue…</p>}
    {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}
    {engineError && <p role="alert">Installed model status unavailable. {engineError}</p>}
    <CatalogueTaskStatus {...download} />
    {catalogue.reply && <p className="text-xs text-[var(--text-muted)]">{filtered.length} models · Saved {new Date(catalogue.reply.saved).toLocaleString()}</p>}
    {view === 'families' && !family ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...new Set(filtered.map(model => model.family))].map(name => {
      const members = filtered.filter(model => model.family === name);
      return <CatalogueCard key={name} title={name} subtitle={members[0]?.provider} source={members[0]?.logo} icon={Boxes}
        marker={`${members.length} models`} description={members[0]?.familyDescription || members[0]?.description}
        tags={members.flatMap(model => model.tasks)} identity={name}
        onOpen={() => { setFamily(name); setLimit(24); }} />;
    })}</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, limit).map(model => {
      const variants = model.variants.filter(v => !format || v.format === format);
      const variant = chooseModelVariant(model, variants, chosen[model.id]);
      const installedModel = installedModelForVariant(installed, model, variant);
      let reference = '', refusal = '';
      try { if (variant) reference = modelInstallReference(model, variant, source); else refusal = 'No downloadable package is available.'; }
      catch (error) { refusal = String(error); }
      return <Card key={model.id} className="min-w-0" style={{ padding: 16 }}><CardHeader><div className="flex items-center gap-3"><CatalogueLogo source={model.logo} name={model.name || model.id} /><div className="min-w-0"><CardTitle>{model.name || model.id}</CardTitle><p className="mt-1 text-xs text-[var(--text-muted)]">{model.provider}</p></div></div></CardHeader><CardContent className="space-y-3">
        <p className="text-xs leading-5 text-[var(--text-secondary)] line-clamp-2">{model.description || model.familyDescription}</p>
        <CatalogueTags values={model.tasks} /><p className="text-xs">Runtime: {model.support}</p>
        <CustomDropdown disabled={!variants.length || !!busy} value={variant?.id} placeholder="No package available"
          options={variants.map(v => ({ value: v.id, label: `${v.format.toUpperCase()} · ${v.quant} · ${(v.bytes / 1024 ** 3).toFixed(2)} GiB`, description: `${v.file} · ${v.readiness}` }))}
          onChange={value => setChosen(previous => ({ ...previous, [model.id]: value }))} />
        {refusal && <p className="text-xs break-words">{refusal}</p>}
        <details className="text-xs text-[var(--text-secondary)]"><summary className="cursor-pointer">Package details</summary><div className="mt-2 space-y-2 break-words">
          <p>{model.family} · {model.repo}</p>
          <p>{[model.architecture, model.parameters, model.context].filter(Boolean).join(' · ')}</p>
          {model.note && <p>{model.note}</p>}
          {variant && <p className="break-all">{variant.file}</p>}
          {reference && <p className="break-all">Download reference: {reference}</p>}
        </div></details>
        <Button disabled={!reference || !download.canStart || !inventoryReady || !!engineError || !!installedModel} onClick={() => { if (variant) void install(model, variant); }}>
          {installedModel ? 'Installed' : busy && download.receipt?.target === reference ? 'Downloading…' : 'Download selected package'}
        </Button>
      </CardContent></Card>;
    })}</div>}
    {!catalogue.busy && catalogue.reply && !filtered.length && <p>No models match these filters.</p>}
    {(view === 'models' || family) && filtered.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 24)}>Show more models</Button>}
  </div></div>;
}

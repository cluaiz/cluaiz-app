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
import { ArrowDownWideNarrow, Boxes, Globe, Layers, Sparkles } from 'lucide-react';
import { CatalogueCard, CatalogueChips, CatalogueFilter, CatalogueLogo, CatalogueSearch, CatalogueTags } from './CatalogueUI';
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
  return <div className="p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="font-semibold">Models</h2><p className="text-sm text-[var(--text-secondary)]">Browse the Cluaiz website catalogue. Downloads run in your selected Engine.</p></div>
      <Button variant="outline" disabled={catalogue.busy} onClick={() => { void catalogue.refresh(); setConnection(value => value + 1); }}>Refresh</Button>
    </div>
    <Tabs items={[{ id: 'families', label: 'Family cards' }, { id: 'models', label: 'Single models' }]} value={view} onChange={value => { setView(value); setFamily(''); setLimit(24); }} />
    {family && <Button variant="ghost" onClick={() => { setFamily(''); setLimit(24); }}>All families · {family}</Button>}
    <CatalogueSearch value={query} onChange={value => { setQuery(value); setLimit(24); }} placeholder="Search models, families, architectures or providers" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 rounded-xl border border-[var(--border-color)] p-4">
      <CatalogueFilter label="Model format" icon={Layers}><CustomDropdown value={format} options={[{ value: '', label: 'All formats' }, { value: 'gguf', label: 'GGUF' }, { value: 'onnx', label: 'ONNX' }]} onChange={value => { setFormat(value); setLimit(24); }} /></CatalogueFilter>
      <CatalogueFilter label="Capabilities" icon={Sparkles}><CustomDropdown value={task} options={[{ value: '', label: 'All capabilities' }, ...tasks.map(value => ({ value, label: value }))]} onChange={value => { setTask(value); setLimit(24); }} /></CatalogueFilter>
      <CatalogueFilter label="Providers" icon={Globe}><CustomDropdown selectedValues={providers} onValuesChange={values => { setProviders(values); setLimit(24); }} placeholder="All providers" options={[...new Set(models.map(model => model.provider).filter(Boolean))].sort().map(value => ({ value, label: value }))} /></CatalogueFilter>
      <CatalogueFilter label="Sort" icon={ArrowDownWideNarrow}><CustomDropdown value={sort} options={[{ value: 'popular', label: 'Popular' }, { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'name', label: 'Name' }]} onChange={value => { setSort(value as CatalogueSort); setLimit(24); }} /></CatalogueFilter>
    </div>
    <CatalogueChips clear={clearFilters} values={[
      ...providers.map(provider => ({ key: `provider:${provider}`, label: provider, remove: () => { setProviders(values => values.filter(value => value !== provider)); setLimit(24); } })),
      ...(task ? [{ key: 'task', label: task, remove: () => { setTask(''); setLimit(24); } }] : []),
      ...(format ? [{ key: 'format', label: format.toUpperCase(), remove: () => { setFormat(''); setLimit(24); } }] : []),
    ]} />
    {catalogue.busy && <p role="status">Loading catalogue…</p>}
    {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}
    {engineError && <p role="alert">Installed model status unavailable. {engineError}</p>}
    <CatalogueTaskStatus {...download} />
    <div className="space-y-2 sm:max-w-sm">
      <p className="text-xs text-[var(--text-secondary)]">Download source</p>
      <CustomDropdown disabled={busy} value={source} onChange={value => setSource(value as ModelInstallSource)} options={[
        { value: 'catalogue', label: 'Cluaiz catalogue' },
        { value: 'huggingface', label: 'Hugging Face · direct repository' },
      ]} />
    </div>
    <p className="text-xs text-[var(--text-muted)]">If the Cluaiz registry is unavailable, select Hugging Face to use the published repository directly. No automatic retry. Forget any failed task tracking before starting another download.</p>
    {catalogue.reply && <p className="text-xs text-[var(--text-secondary)]">{filtered.length} models · Catalogue saved {new Date(catalogue.reply.saved).toLocaleString()} · Search and filters use the saved list.</p>}
    {view === 'families' && !family ? <div className="grid gap-3 lg:grid-cols-2">{[...new Set(filtered.map(model => model.family))].map(name => {
      const members = filtered.filter(model => model.family === name);
      return <CatalogueCard key={name} title={name} subtitle={members[0]?.provider} source={members[0]?.logo} icon={Boxes}
        marker={`${members.length} models`} description={members[0]?.familyDescription || members[0]?.description}
        tags={members.flatMap(model => model.tasks)} identity={name}
        onOpen={() => { setFamily(name); setLimit(24); }} />;
    })}</div> : <div className="grid gap-3 lg:grid-cols-2">{filtered.slice(0, limit).map(model => {
      const variants = model.variants.filter(v => !format || v.format === format);
      const variant = chooseModelVariant(model, variants, chosen[model.id]);
      const installedModel = installedModelForVariant(installed, model, variant);
      let reference = '', refusal = '';
      try { if (variant) reference = modelInstallReference(model, variant, source); else refusal = 'No downloadable package is available.'; }
      catch (error) { refusal = String(error); }
      return <Card key={model.id}><CardHeader><div className="flex items-center gap-4"><CatalogueLogo source={model.logo} name={model.name || model.id} /><CardTitle>{model.name || model.id}</CardTitle></div></CardHeader><CardContent className="space-y-3">
        <p className="text-xs text-[var(--text-secondary)]">{model.family} · {model.provider} · {model.repo}</p>
        <p className="text-sm">{model.description}</p>
        <CatalogueTags values={model.tasks} /><p className="text-xs">Runtime: {model.support}</p>
        <p className="text-xs text-[var(--text-secondary)]">{[model.architecture, model.parameters, model.context].filter(Boolean).join(' · ')}</p>
        {model.note && <p className="text-xs text-[var(--text-secondary)]">{model.note}</p>}
        <CustomDropdown disabled={!variants.length || !!busy} value={variant?.id} placeholder="No package available"
          options={variants.map(v => ({ value: v.id, label: `${v.format.toUpperCase()} · ${v.quant} · ${(v.bytes / 1024 ** 3).toFixed(2)} GiB`, description: `${v.file} · ${v.readiness}` }))}
          onChange={value => setChosen(previous => ({ ...previous, [model.id]: value }))} />
        {refusal && <p className="text-xs">{refusal}</p>}
        {variant && <p className="text-xs break-all">{variant.file}</p>}
        {reference && <p className="text-xs break-all text-[var(--text-muted)]">Download reference: {reference}</p>}
        <Button disabled={!reference || !download.canStart || !inventoryReady || !!engineError || !!installedModel} onClick={() => { if (variant) void install(model, variant); }}>
          {installedModel ? 'Installed' : busy && download.receipt?.target === reference ? 'Downloading…' : 'Download selected package'}
        </Button>
      </CardContent></Card>;
    })}</div>}
    {!catalogue.busy && catalogue.reply && !filtered.length && <p>No models match these filters.</p>}
    {(view === 'models' || family) && filtered.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 24)}>Show more models</Button>}
  </div>;
}

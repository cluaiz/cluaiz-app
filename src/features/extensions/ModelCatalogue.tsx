import { useEffect, useRef, useState } from 'react';
import { modelCatalogue, modelInstallReference, type ModelInstallSource, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import { modelsApi } from '../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useCatalogue } from './useCatalogue';
import { 
  ArrowDownWideNarrow, ArrowLeft, ArrowUpRight, Boxes, CheckCircle2, 
  Download, Globe, Layers, LayoutGrid, LayoutList, Sparkles 
} from 'lucide-react';
import { MultiLevelDropdown, type MultiLevelCategory } from '../../components/ui/dropdown';
import { CatalogueCard, CatalogueChips, CatalogueLogo, CatalogueStickyHeader, CatalogueTags } from './CatalogueUI';
import { 
  chooseModelVariant, filterModels, installedModelForVariant, cleanModelDescription, 
  extractFamilyCapabilities, type CatalogueSort 
} from './catalogueView';
import { resumeModelDownload } from '../../api/engine/models/actions';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';
import { FamilyModelSliderRow } from './FamilyModelSliderRow';

const resumeDownload: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeModelDownload>>>>[1] =
  (_target, id, signal, observer) => resumeModelDownload(id, signal, observer);

export function ModelCatalogue() {
  const catalogue = useCatalogue(modelCatalogue.list);
  const download = useCatalogueTask('models.download', resumeDownload);
  const [query, setQuery] = useState(''), [task, setTask] = useState(''), [format, setFormat] = useState('');
  const [providers, setProviders] = useState<string[]>([]), [sort, setSort] = useState<CatalogueSort>('popular');
  const [source, setSource] = useState<ModelInstallSource>('catalogue');
  const [installed, setInstalled] = useState<ModelRegistryEntry[]>([]), [engineError, setEngineError] = useState('');
  const [inventoryReady, setInventoryReady] = useState(false);
  const busy = download.busy || download.cancelling;
  const [limit, setLimit] = useState(24);
  const [view, setView] = useState<'families' | 'models'>('families');
  const [family, setFamily] = useState('');
  const [selectedModel, setSelectedModel] = useState<PublicModel | null>(null);
  const [familyViewLayout, setFamilyViewLayout] = useState<'list' | 'grid'>('list');
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

  // Auto-clear stale failed/error receipts so intrusive cards never linger
  useEffect(() => {
    if (download.error || (download.receipt && !download.busy)) {
      download.forget();
    }
  }, [download.error, download.receipt, download.busy]);

  const models = catalogue.reply?.data ?? [];
  const tasks = [...new Set(models.flatMap(model => model.tasks))].sort();
  const filtered = filterModels(models, { query, providers, capabilities: task ? [task] : [], format, sort, family });

  const clearFilters = () => { 
    setQuery(''); setTask(''); setFormat(''); setProviders([]); 
    setFamily(''); setSelectedModel(null); setLimit(24); 
  };

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
        setSelectedModel(null);
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

  // Dynamic header titles based on navigation hierarchy
  const pageTitle = selectedModel
    ? (selectedModel.name || selectedModel.id)
    : family
    ? `${family} Models`
    : 'AI Models';

  const pageSubtitle = selectedModel
    ? `Publisher: ${selectedModel.provider} · Architecture: ${selectedModel.architecture || 'Neural'} · Package Explorer`
    : family
    ? `Available neural packages and quantized variants in the ${family} family.`
    : 'Find a model and choose a package for your Engine.';

  return (
    <div className="w-full flex flex-col min-h-full">
      <CatalogueStickyHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumbs={
          (selectedModel || family) ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] font-mono">
              <button
                type="button"
                onClick={() => { setFamily(''); setSelectedModel(null); }}
                className="hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5 font-medium transition-colors"
              >
                <ArrowLeft size={14} /> All Families
              </button>
              {family && (
                <>
                  <span className="text-[var(--border-color)]">/</span>
                  <button
                    type="button"
                    onClick={() => setSelectedModel(null)}
                    className={`hover:text-[var(--text-primary)] cursor-pointer font-bold tracking-tight transition-colors ${!selectedModel ? 'text-[var(--text-primary)]' : ''}`}
                  >
                    {family}
                  </button>
                </>
              )}
              {selectedModel && (
                <>
                  <span className="text-[var(--border-color)]">/</span>
                  <span className="text-[var(--accent-color)] font-bold truncate max-w-[200px]">
                    {selectedModel.name || selectedModel.id}
                  </span>
                </>
              )}
            </div>
          ) : null
        }
        searchQuery={query}
        onSearchChange={value => { setQuery(value); setLimit(24); }}
        searchPlaceholder="Search models, families, architectures or tasks…"
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

      <div className="mx-auto w-full max-w-7xl p-6 space-y-5">
        {catalogue.busy && <p role="status">Loading catalogue…</p>}
        {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}
        {engineError && <p role="alert">Installed model status unavailable. {engineError}</p>}

        {/* ------------------------------------------------------------------ */}
        {/* LEVEL 3: Dedicated Model Detail & Quantization Download Page      */}
        {/* ------------------------------------------------------------------ */}
        {selectedModel ? (
          <div className="space-y-6">

            {/* Model Hero Info Card */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CatalogueLogo source={selectedModel.logo} name={selectedModel.name || selectedModel.id} large />
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                      {selectedModel.name || selectedModel.id}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Published by <span className="text-[var(--text-secondary)] font-medium">{selectedModel.provider}</span>
                      {selectedModel.architecture ? ` · Architecture: ${selectedModel.architecture}` : ''}
                      {selectedModel.parameters ? ` · ${selectedModel.parameters}` : ''}
                      {selectedModel.context ? ` · ${selectedModel.context} context window` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <CatalogueTags values={selectedModel.tasks} />
                </div>
              </div>

              {/* Clean Sanitized Description */}
              <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)] border-t border-[var(--border-color)]/60 pt-3">
                {cleanModelDescription(selectedModel.description || selectedModel.familyDescription) || 'No detailed overview provided for this package.'}
              </p>
            </Card>

            {/* Active Download Status (ONLY when download is actively in progress) */}
            {download.busy && <CatalogueTaskStatus {...download} />}

            {/* Quantizations & Packages Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Available Packages & Quantizations ({selectedModel.variants.length})
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  Select a quantization to download directly to your local Engine
                </span>
              </div>

              <div className="border border-[var(--border-color)]/80 rounded-2xl overflow-hidden bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-color)]/60">
                {selectedModel.variants.length === 0 ? (
                  <p className="p-5 text-xs text-[var(--text-muted)]">No downloadable packages found for this model.</p>
                ) : (
                  selectedModel.variants.map((v) => {
                    const isInstalled = !!installedModelForVariant(installed, selectedModel, v);
                    let reference = '';
                    try { reference = modelInstallReference(selectedModel, v, source); } catch { /* ignore */ }
                    const isDownloadingThis = busy && download.receipt?.target === reference;

                    return (
                      <div
                        key={v.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-secondary)]/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs font-bold uppercase tracking-wider shrink-0">
                            {v.format}
                          </Badge>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                                {v.quant}
                              </span>
                              <span className="text-xs font-mono text-[var(--text-muted)]">
                                · {(v.bytes / 1024 ** 3).toFixed(2)} GiB
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate max-w-md mt-0.5">
                              {v.file}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isInstalled ? (
                            <Badge variant="outline" className="text-xs text-[var(--status-success)] border-[var(--status-success)]/40 flex items-center gap-1 font-semibold">
                              <CheckCircle2 size={13} /> Installed
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              disabled={!reference || !download.canStart || !inventoryReady || !!engineError || isDownloadingThis}
                              onClick={() => void install(selectedModel, v)}
                              className="text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Download size={13} />
                              {isDownloadingThis ? 'Downloading…' : 'Download package'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Technical Metadata Section */}
            <div className="p-4 rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-tertiary)]/30 space-y-1.5 text-xs text-[var(--text-muted)]">
              <p><span className="text-[var(--text-secondary)] font-semibold">Upstream Repository:</span> {selectedModel.repo}</p>
              <p><span className="text-[var(--text-secondary)] font-semibold">Model ID:</span> {selectedModel.id}</p>
              {selectedModel.note && <p><span className="text-[var(--text-secondary)] font-semibold">Notes:</span> {selectedModel.note}</p>}
            </div>
          </div>
        ) : family ? (
          /* ------------------------------------------------------------------ */
          /* LEVEL 2: Family Overview & Models Explorer                         */
          /* ------------------------------------------------------------------ */
          <div className="space-y-6">
            {/* Family Hero Header with Atmospheric Ambient Smoke Logo Watermark */}
            {(() => {
              const familyModels = filtered.filter(m => m.family === family);
              const first = familyModels[0];
              const capabilities = extractFamilyCapabilities(familyModels);
              const cleanDesc = cleanModelDescription(first?.familyDescription || first?.description);

              return (
                <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:px-10 sm:py-12 min-h-[220px] flex items-center text-left">
                  {/* Right Side: Family Logo Watermark seamlessly dissolved into card background */}
                  {first?.logo && (
                    <div className="absolute right-0 top-0 bottom-0 w-2/5 sm:w-1/3 flex items-center justify-end pointer-events-none select-none overflow-hidden z-0 pr-4 sm:pr-8">
                      <img
                        src={first.logo}
                        alt=""
                        aria-hidden="true"
                        className="w-48 h-48 sm:w-64 sm:h-64 object-contain opacity-25 filter contrast-125"
                        style={{
                          maskImage: 'radial-gradient(ellipse at center right, rgba(0,0,0,0.65) 15%, rgba(0,0,0,0.2) 55%, transparent 95%)',
                          WebkitMaskImage: 'radial-gradient(ellipse at center right, rgba(0,0,0,0.65) 15%, rgba(0,0,0,0.2) 55%, transparent 95%)',
                        }}
                      />
                    </div>
                  )}

                  {/* Left Side: Family Title, Publisher, Tags, Count, Description */}
                  <div className="relative z-10 space-y-3 max-w-2xl text-left">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-2xl sm:text-3xl font-bold font-mono uppercase text-[var(--text-primary)] tracking-tight">
                        {family}
                      </h2>
                      <Badge variant="outline" className="text-xs font-mono font-bold uppercase tracking-wider">
                        {familyModels.length} {familyModels.length === 1 ? 'Model' : 'Models'}
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--text-muted)] font-mono">
                      Published by <span className="text-[var(--text-secondary)] font-bold">{first?.provider || 'Open Source'}</span>
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <CatalogueTags values={capabilities} />
                    </div>

                    {cleanDesc && (
                      <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)] pt-1 max-w-xl">
                        {cleanDesc}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Family Models Explorer Toolbar */}
            {(() => {
              const familyModels = filtered.filter(m => m.family === family);

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                      Models in {family} ({familyModels.length})
                    </h3>

                    {/* List / Grid View Layout Toggle */}
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]/70">
                      <button
                        type="button"
                        onClick={() => setFamilyViewLayout('list')}
                        title="List view"
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          familyViewLayout === 'list'
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        <LayoutList size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFamilyViewLayout('grid')}
                        title="Grid view"
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          familyViewLayout === 'grid'
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                    </div>
                  </div>

                  {familyModels.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">No models match current filters in this family.</p>
                  ) : familyViewLayout === 'list' ? (
                    /* -------------------------------------------------------- */
                    /* LIST VIEW: Detailed rows with specs & direct quants pills*/
                    /* -------------------------------------------------------- */
                    <div className="border border-[var(--border-color)] rounded-2xl overflow-hidden bg-[var(--bg-secondary)]/50 divide-y divide-[var(--border-color)]">
                      {familyModels.map(model => {
                        const distinctQuants = [...new Set(model.variants.map(v => v.quant))];

                        return (
                          <div
                            key={model.id}
                            onClick={() => setSelectedModel(model)}
                            className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[var(--bg-secondary)]/90 transition-colors cursor-pointer group text-left"
                          >
                            {/* Left: Model Logo, Name & Specs */}
                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                              <CatalogueLogo source={model.logo} name={model.name || model.id} />
                              <div className="min-w-0 space-y-1">
                                <h4 className="text-sm sm:text-base font-bold font-mono uppercase text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors truncate">
                                  {model.name || model.id}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono flex-wrap">
                                  {model.parameters && (
                                    <span className="font-bold text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                                      {model.parameters}
                                    </span>
                                  )}
                                  {model.architecture && <span>· {model.architecture}</span>}
                                  {model.context && <span>· {model.context} ctx</span>}
                                </div>
                              </div>
                            </div>

                            {/* Middle: Quantization Variants Pills Preview */}
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-w-md">
                              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)] mr-1">
                                Quants:
                              </span>
                              {distinctQuants.slice(0, 5).map(q => {
                                const v = model.variants.find(item => item.quant === q);
                                return (
                                  <span
                                    key={q}
                                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] font-medium flex items-center gap-1"
                                  >
                                    <span>{q}</span>
                                    {v && <span className="text-[10px] opacity-70">· {(v.bytes / 1024 ** 3).toFixed(1)}G</span>}
                                  </span>
                                );
                              })}
                              {distinctQuants.length > 5 && (
                                <span className="text-[10px] font-mono text-[var(--text-muted)] px-1 font-semibold">
                                  +{distinctQuants.length - 5} more
                                </span>
                              )}
                            </div>

                            {/* Right: Action Button */}
                            <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                              <Button variant="outline" size="sm" className="text-xs font-semibold font-mono gap-1.5 group-hover:border-[var(--accent-color)]/60 cursor-pointer">
                                View Packages <ArrowUpRight size={13} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* -------------------------------------------------------- */
                    /* GRID VIEW: Compact model cards                           */
                    /* -------------------------------------------------------- */
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {familyModels.map(model => (
                        <Card key={model.id} className="min-w-0" style={{ padding: 16 }}>
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <CatalogueLogo source={model.logo} name={model.name || model.id} />
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-sm font-semibold truncate">
                                  {model.name || model.id}
                                </CardTitle>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                                  {[model.parameters, model.architecture, model.context].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-2">
                            <CatalogueTags values={model.tasks} />
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                              {cleanModelDescription(model.description || model.familyDescription)}
                            </p>
                            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/50">
                              <span className="text-xs font-mono text-[var(--text-muted)]">
                                {model.variants.length} packages
                              </span>
                              <Button size="sm" variant="outline" onClick={() => setSelectedModel(model)} className="text-xs gap-1">
                                Select <ArrowUpRight size={12} />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : view === 'models' ? (
          /* ------------------------------------------------------------------ */
          /* FLAT GRID OF ALL MODELS                                            */
          /* ------------------------------------------------------------------ */
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.slice(0, limit).map(model => (
                <Card key={model.id} className="min-w-0" style={{ padding: 16 }}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <CatalogueLogo source={model.logo} name={model.name || model.id} />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-semibold truncate">
                          {model.name || model.id}
                        </CardTitle>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{model.provider}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <CatalogueTags values={model.tasks} />
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {cleanModelDescription(model.description || model.familyDescription)}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/50">
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {model.variants.length} packages
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setSelectedModel(model)} className="text-xs gap-1">
                        View Details <ArrowUpRight size={12} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filtered.length > limit && (
              <Button variant="outline" onClick={() => setLimit(value => value + 24)}>Show more models</Button>
            )}
          </div>
        ) : (
          /* ------------------------------------------------------------------ */
          /* LEVEL 1: Family Master Rows with Models Slider & Wave Scrubber     */
          /* ------------------------------------------------------------------ */
          <div className="space-y-6">
            {[...new Set(filtered.map(model => model.family))].map((name) => {
              const members = filtered.filter(model => model.family === name);

              return (
                <FamilyModelSliderRow
                  key={name}
                  family={name}
                  models={members}
                  installed={installed}
                  isBusy={busy}
                  downloadingTarget={download.receipt?.target}
                  onDownload={(model, variant) => void install(model, variant)}
                  onViewAll={(fam) => {
                    setFamily(fam);
                    setSelectedModel(null);
                    setLimit(24);
                  }}
                  onSelectModel={(model) => {
                    setSelectedModel(model);
                    setFamily(model.family);
                  }}
                />
              );
            })}
          </div>
        )}

        {!catalogue.busy && catalogue.reply && !filtered.length && (
          <p className="text-sm text-[var(--text-secondary)] p-6 text-center border border-dashed border-[var(--border-color)] rounded-2xl">
            No models match the selected filters.
          </p>
        )}
      </div>
    </div>
  );
}

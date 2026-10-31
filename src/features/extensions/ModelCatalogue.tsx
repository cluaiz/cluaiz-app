import { useEffect, useRef, useState } from 'react';
import { modelCatalogue, modelInstallReference, type ModelInstallSource, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import { modelsApi } from '../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useCatalogue } from './useCatalogue';
import { ArrowLeft, ArrowUpDown, Check, CheckCircle2, Download, Search, X } from 'lucide-react';
import { CatalogueChips, CatalogueTags } from './CatalogueUI';
import {
  catalogueImage, filterModels, installedModelForVariant, cleanModelDescription,
  extractFamilyCapabilities
} from './catalogueView';
import { resumeModelDownload } from '../../api/engine/models/actions';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';
import { FamilyModelSliderRow } from './FamilyModelSliderRow';
import { ModelPackagePanel } from './ModelPackagePanel';
import { useModelCatalogueStore } from './modelCatalogueStore';
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer';
import { getSystemHardwareProfile, calculateModelHardwareScore, type CachedHardwareProfile } from './hardwareRecommendation';

const resumeDownload: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeModelDownload>>>>[1] =
  (_target, id, signal, observer) => resumeModelDownload(id, signal, observer);

function parseModelParams(paramStr?: string): number {
  if (!paramStr) return 0;
  const clean = paramStr.replace(/,/g, '').trim();
  const match = clean.match(/([0-9]+(?:\.[0-9]+)?)\s*([BMKTP]?)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  if (unit === 'T') return val * 1e12;
  if (unit === 'B') return val * 1e9;
  if (unit === 'M') return val * 1e6;
  if (unit === 'K') return val * 1e3;
  return val;
}

export function ModelCatalogue() {
  const catalogue = useCatalogue(modelCatalogue.list);
  const download = useCatalogueTask('models.download', resumeDownload);

  const {
    family,
    setFamily,
    selectedModel,
    setSelectedModel,
    query,
    setQuery,
    providers,
    setProviders,
    task,
    setTask,
    format,
    setFormat,
    sort,
    setSort,
    view,
    setView,
    clearFilters,
  } = useModelCatalogueStore();

  const [familyModelQuery, setFamilyModelQuery] = useState('');
  const [familySort, setFamilySort] = useState<'recommended' | 'latest' | 'popular' | 'random' | 'oldest' | 'big' | 'small'>('recommended');
  const [familySortOpen, setFamilySortOpen] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string>('');
  const [selectedVariantByModel, setSelectedVariantByModel] = useState<Record<string, string>>({});
  const [hardwareProfile, setHardwareProfile] = useState<CachedHardwareProfile | null>(null);

  useEffect(() => {
    void getSystemHardwareProfile().then(setHardwareProfile);
  }, []);

  const [source] = useState<ModelInstallSource>('catalogue');
  const [installed, setInstalled] = useState<ModelRegistryEntry[]>([]);
  const [engineError, setEngineError] = useState('');
  const [installError, setInstallError] = useState('');
  const [inventoryReady, setInventoryReady] = useState(false);
  const busy = download.busy || download.cancelling;
  const [limit, setLimit] = useState(24);
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

  const activeFamilyModels = family ? filtered.filter(m => m.family === family) : [];
  const effectiveActiveId = (activeModelId && activeFamilyModels.some(m => m.id === activeModelId))
    ? activeModelId
    : (activeFamilyModels[0]?.id || '');

  async function install(model: PublicModel, variant: PublicVariant) {
    setInstallError('');
    if (!inventoryReady) { setInstallError('Connect to your Engine before downloading a package.'); return; }
    try {
      const reference = modelInstallReference(model, variant, source);
      await download.start(reference, (signal, observer) => modelsApi.downloadModel({ model_id: reference }, signal, observer));
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : String(error));
    }
  }

  // Synchronize URL search params with family and model selection
  const updateUrl = (newFamily: string, newModelId: string) => {
    try {
      const url = new URL(window.location.href);
      if (newFamily) {
        url.searchParams.set('family', newFamily);
      } else {
        url.searchParams.delete('family');
      }

      if (newModelId) {
        url.searchParams.set('model', newModelId);
      } else {
        url.searchParams.delete('model');
      }

      window.history.pushState(window.history.state, '', url);
    } catch { /* ignore in non-browser envs */ }
  };

  // Sync state from URL on initial load and on browser popstate (back/forward)
  useEffect(() => {
    const syncFromUrl = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlFamily = params.get('family');
        const urlModel = params.get('model');

        if (urlModel && models.length > 0) {
          const found = models.find(m => m.id.toLowerCase() === urlModel.toLowerCase());
          if (found) {
            setSelectedModel(found);
            if (found.family) setFamily(found.family);
            return;
          }
        }

        if (urlFamily) {
          setFamily(urlFamily);
          setView('models');
          setSelectedModel(null);
        } else {
          setFamily('');
          setView('families');
          setSelectedModel(null);
        }
      } catch { /* ignore */ }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [models]);

  const activeChips = [
    ...providers.map(provider => ({
      key: `provider:${provider}`,
      label: provider,
      remove: () => setProviders(values => values.filter(value => value !== provider)),
    })),
    ...(task ? [{ key: 'task', label: task, remove: () => setTask('') }] : []),
    ...(format ? [{ key: 'format', label: format.toUpperCase(), remove: () => setFormat('') }] : []),
  ];

  const cleanEngineError = engineError
    ? engineError.replace(/\s*\([^)]*https?:\/\/[^)]*\)/gi, '').replace(/^ApiError:\s*/i, '')
    : '';

  return (
    <div className="w-full flex flex-col min-h-full">
      <div className="mx-auto w-full max-w-7xl p-6 space-y-5">
        {/* Navigation Breadcrumb back to Family when inside a Model Detail page */}
        {selectedModel && (
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
            <button
              type="button"
              onClick={() => {
                setSelectedModel(null);
                updateUrl(family, '');
              }}
              className="hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5 font-medium transition-colors"
            >
              <ArrowLeft size={14} /> Back to {family || 'All Families'}
            </button>
            <span className="text-[var(--border-color)]">/</span>
            <span className="text-[var(--accent-color)] font-bold truncate max-w-[200px]">
              {selectedModel.name || selectedModel.id}
            </span>
          </div>
        )}

        {/* Navigation Breadcrumb back to All Families when inside Family Overview (Level 2) */}
        {!selectedModel && family && (
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
            <button
              type="button"
              onClick={() => {
                setFamily('');
                setView('families');
                updateUrl('', '');
              }}
              className="hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5 font-medium transition-colors"
            >
              <ArrowLeft size={14} /> Back to All Families
            </button>
            <span className="text-[var(--border-color)]">/</span>
            <span className="text-[var(--accent-color)] font-bold">
              {family}
            </span>
          </div>
        )}

        {/* Active Filter Chips (if any are selected in the sidebar) */}
        {activeChips.length > 0 && (
          <CatalogueChips clear={clearFilters} values={activeChips} />
        )}

        {catalogue.busy && <p role="status">Loading catalogue…</p>}
        {(catalogue.error || catalogue.reply?.warning) && <p role="alert">{catalogue.error || catalogue.reply?.warning}</p>}

        {!inventoryReady && <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
          <p role={engineError ? 'alert' : 'status'}>{cleanEngineError || 'Checking installed models…'}</p>
          {engineError && <Button variant="secondary" size="sm" onClick={() => setConnection(value => value + 1)}>Retry Engine connection</Button>}
        </div>}
        {installError && <p role="alert" className="text-sm text-[var(--status-error)]">{installError}</p>}
        <CatalogueTaskStatus {...download} />

        {/* Global GPU SVG Filter to eliminate white box/background from any model logo */}
        <svg className="absolute w-0 h-0 pointer-events-none opacity-0 overflow-hidden" aria-hidden="true">
          <defs>
            <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        -2 -2 -2 0 5.5"
                result="filtered"
              />
              <feComposite in="filtered" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
        </svg>

        {/* ------------------------------------------------------------------ */}
        {/* LEVEL 3: Dedicated Model Detail & Quantization Download Page      */}
        {/* ------------------------------------------------------------------ */}
        {selectedModel ? (
          <div className="space-y-6">

            {/* Model Hero Info Card */}
            {(() => {
              const modelLogoUrl = catalogueImage(selectedModel.logo || '');
              const transparentModelLogoUrl = modelLogoUrl;
              const cleanDesc = cleanModelDescription(selectedModel.description || selectedModel.familyDescription);

              return (
                <div className="relative pt-0 pb-6 min-h-[220px] sm:min-h-[280px] flex items-center text-left">
                  {/* Right Side: Seamless Logo (White Background Removed, Uniformly Dimmed) */}
                  {transparentModelLogoUrl && (
                    <div
                      className="
                        absolute inset-y-0 right-0
                        w-[40%] pointer-events-none
                        select-none z-0
                        flex items-center justify-end
                        overflow-hidden
                      "
                      aria-hidden="true"
                    >
                      <img
                        src={transparentModelLogoUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="
                          absolute right-[8%] top-1/2
                          -translate-y-1/2
                          w-72 h-72
                          object-contain
                          opacity-40
                          transition-opacity duration-300
                        "
                        style={{
                          filter: 'url(#remove-white-bg)',
                        }}
                      />
                    </div>
                  )}

                  {/* Left Side: Model Title, Publisher, Specs, Tags, Description */}
                  <div className="relative z-10 space-y-3 max-w-2xl text-left">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold font-mono uppercase text-[var(--text-primary)] tracking-tight">
                        {selectedModel.name || selectedModel.id}
                      </h2>
                      {selectedModel.parameters && (
                        <Badge variant="outline" className="text-xs font-mono font-bold uppercase tracking-wider">
                          {selectedModel.parameters}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-[var(--text-muted)] font-mono">
                      Published by <span className="text-[var(--text-secondary)] font-bold">{selectedModel.provider}</span>
                      {selectedModel.architecture ? ` · Architecture: ${selectedModel.architecture}` : ''}
                      {selectedModel.context ? ` · ${selectedModel.context} context window` : ''}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <CatalogueTags values={selectedModel.tasks} />
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
            {/* Family Hero Header - Seamless, No Outer Card / Border */}
            {(() => {
              const familyModels = filtered.filter(m => m.family === family);
              const first = familyModels[0];
              const capabilities = extractFamilyCapabilities(familyModels);
              const cleanDesc = cleanModelDescription(first?.familyDescription || first?.description);
              const heroLogoUrl = catalogueImage(first?.logo || '');

              return (
                <div className="relative pt-0 pb-6 min-h-[220px] sm:min-h-[280px] flex items-center text-left">
                  {/* Right Side: Seamless Logo (White Background Removed, Uniformly Dimmed) */}
                  {heroLogoUrl && (
                    <div
                      className="
                        absolute inset-y-0 right-0
                        w-[40%] pointer-events-none
                        select-none z-0
                        flex items-center justify-end
                        overflow-hidden
                      "
                      aria-hidden="true"
                    >
                      <img
                        src={heroLogoUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="
                          absolute right-[8%] top-1/2
                          -translate-y-1/2
                          w-72 h-72
                          object-contain
                          opacity-40
                          transition-opacity duration-300
                        "
                        style={{
                          filter: 'url(#remove-white-bg)',
                        }}
                      />
                    </div>
                  )}

                  {/* Left Side: Family Title, Company Name + Total Models, Description, Tags */}
                  <div className="relative z-10 space-y-3 max-w-2xl text-left">
                    {/* Big Title */}
                    <h1 className="text-3xl sm:text-4xl font-extrabold font-mono uppercase text-[var(--text-primary)] tracking-tight">
                      {family}
                    </h1>

                    {/* Company name in gray + Model count */}
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm font-mono flex-wrap">
                      <span className="text-[var(--text-muted)]">
                        by <span className="text-[var(--text-secondary)] font-semibold">{first?.provider || 'Open Source'}</span>
                      </span>
                      <span className="text-[var(--border-color)]">·</span>
                      <Badge variant="outline" className="text-xs font-mono font-bold uppercase tracking-wider">
                        {familyModels.length} {familyModels.length === 1 ? 'Model' : 'Models'}
                      </Badge>
                    </div>

                    {/* Description */}
                    {cleanDesc && (
                      <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)] pt-0.5 max-w-xl">
                        {cleanDesc}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <CatalogueTags values={capabilities} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Models in Family - Search, Sort & Slider Row */}
            {(() => {
              const baseFamilyModels = filtered.filter(m => m.family === family);

              // 1. Search filter
              const searchedModels = familyModelQuery.trim()
                ? baseFamilyModels.filter(m => {
                    const q = familyModelQuery.toLowerCase().trim();
                    return (
                      m.name?.toLowerCase().includes(q) ||
                      m.id?.toLowerCase().includes(q) ||
                      m.parameters?.toLowerCase().includes(q) ||
                      m.tasks?.some(t => t.toLowerCase().includes(q)) ||
                      m.description?.toLowerCase().includes(q)
                    );
                  })
                : baseFamilyModels;

              // 2. Sort
              const sortedModels = [...searchedModels].sort((a, b) => {
                if (familySort === 'recommended' && hardwareProfile) {
                  const scoreA = calculateModelHardwareScore(a, hardwareProfile).score;
                  const scoreB = calculateModelHardwareScore(b, hardwareProfile).score;
                  if (scoreB !== scoreA) return scoreB - scoreA;
                  return (b.downloads || 0) - (a.downloads || 0);
                }
                if (familySort === 'popular') {
                  return (b.downloads || 0) - (a.downloads || 0);
                }
                if (familySort === 'oldest') {
                  return new Date(a.created || 0).getTime() - new Date(b.created || 0).getTime();
                }
                if (familySort === 'big') {
                  return parseModelParams(b.parameters) - parseModelParams(a.parameters);
                }
                if (familySort === 'small') {
                  return parseModelParams(a.parameters) - parseModelParams(b.parameters);
                }
                if (familySort === 'random') {
                  return a.id.localeCompare(b.id) * -1;
                }
                // 'latest' default
                return new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
              });

              const sortLabels: Record<typeof familySort, string> = {
                recommended: 'Recommended',
                latest: 'Latest / New',
                popular: 'Popular',
                random: 'Random',
                oldest: 'Old Model',
                big: 'Big Model',
                small: 'Small Model',
              };

              return (
                <div className="space-y-4">
                  {/* Toolbar: Reusable Design-System Search (Left) + Sort Filter Button (Right) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 pb-1">
                    {/* Left: Reusable Design-System Search Input */}
                    <div className="relative flex-1 max-w-sm">
                      <Input
                        value={familyModelQuery}
                        onChange={(e) => setFamilyModelQuery(e.target.value)}
                        placeholder={`Search ${family} models...`}
                        sizeVariant="sm"
                        leftIcon={<Search size={14} />}
                        rightElement={
                          familyModelQuery ? (
                            <button
                              type="button"
                              onClick={() => setFamilyModelQuery('')}
                              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer p-0.5"
                              title="Clear search"
                            >
                              <X size={12} />
                            </button>
                          ) : null
                        }
                      />
                    </div>

                    {/* Right: Reusable Design-System Sort Button with Dropdown Menu */}
                    <div className="relative flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setFamilySortOpen(!familySortOpen)}
                        className="flex items-center gap-1.5 font-mono text-xs cursor-pointer shadow-xs"
                      >
                        <ArrowUpDown size={12} className="text-[var(--accent-color)]" />
                        <span className="text-[var(--text-muted)]">Sort:</span>
                        <span className="font-semibold text-[var(--text-primary)]">{sortLabels[familySort]}</span>
                      </Button>

                      {/* Dropdown Menu */}
                      {familySortOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setFamilySortOpen(false)} />
                          <div className="absolute right-0 top-full mt-1.5 w-44 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-xl z-40 py-1 font-mono text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            {(['recommended', 'latest', 'popular', 'random', 'oldest', 'big', 'small'] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setFamilySort(opt);
                                  setFamilySortOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors ${
                                  familySort === opt
                                    ? 'text-[var(--accent-color)] font-bold bg-[var(--bg-tertiary)]/50'
                                    : 'text-[var(--text-secondary)]'
                                }`}
                              >
                                <span>{sortLabels[opt]}</span>
                                {familySort === opt && <Check size={12} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Empty Search State */}
                  {sortedModels.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-tertiary)]/20">
                      <p className="text-xs font-mono text-[var(--text-muted)]">No models matched &ldquo;{familyModelQuery}&rdquo;</p>
                      <button
                        type="button"
                        onClick={() => setFamilyModelQuery('')}
                        className="mt-2 text-xs font-mono text-[var(--accent-color)] hover:underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <FamilyModelSliderRow
                        family={family}
                        models={sortedModels}
                        installed={installed}
                        isBusy={busy}
                        downloadingTarget={download.receipt?.target}
                        borderless={true}
                        hideHeader={true}
                        activeModelId={effectiveActiveId}
                        onDownload={(model, variant) => void install(model, variant)}
                        onViewAll={() => {}}
                        onSelectModel={(model) => {
                          if (effectiveActiveId === model.id) {
                            setSelectedModel(model);
                            setFamily(model.family);
                            updateUrl(model.family, model.id);
                          } else {
                            setActiveModelId(model.id);
                          }
                        }}
                      />

                      {(() => {
                        const model = sortedModels.find(item => item.id === effectiveActiveId) || sortedModels[0];
                        return model ? <ModelPackagePanel key={model.id} model={model} installed={installed}
                          source={source} selectedVariantId={selectedVariantByModel[model.id]}
                          onSelectVariant={id => setSelectedVariantByModel(previous => ({ ...previous, [model.id]: id }))}
                          onInstall={install} canStart={download.canStart} inventoryReady={inventoryReady}
                          hardware={hardwareProfile} /> : null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}
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
                    setLimit(24);
                    updateUrl(fam, '');
                  }}
                  onSelectModel={(model) => {
                    setFamily(model.family);
                    setLimit(24);
                    updateUrl(model.family, '');
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

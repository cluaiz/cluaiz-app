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
  Download, Globe, Layers, Sparkles 
} from 'lucide-react';
import { CatalogueCard, CatalogueChips, CatalogueLogo, CatalogueTags } from './CatalogueUI';
import { 
  catalogueImage, chooseModelVariant, filterModels, installedModelForVariant, cleanModelDescription, 
  extractFamilyCapabilities, type CatalogueSort 
} from './catalogueView';
import { resumeModelDownload } from '../../api/engine/models/actions';
import { useCatalogueTask } from './useCatalogueTask';
import { CatalogueTaskStatus } from './CatalogueTaskStatus';
import { FamilyModelSliderRow } from './FamilyModelSliderRow';
import { useModelCatalogueStore } from './modelCatalogueStore';

const resumeDownload: Parameters<typeof useCatalogueTask<Awaited<ReturnType<typeof resumeModelDownload>>>>[1] =
  (_target, id, signal, observer) => resumeModelDownload(id, signal, observer);

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

  const [source, setSource] = useState<ModelInstallSource>('catalogue');
  const [installed, setInstalled] = useState<ModelRegistryEntry[]>([]);
  const [engineError, setEngineError] = useState('');
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

  // Auto-clear stale failed/error receipts so intrusive cards never linger
  useEffect(() => {
    if (download.error || (download.receipt && !download.busy)) {
      download.forget();
    }
  }, [download.error, download.receipt, download.busy]);

  const models = catalogue.reply?.data ?? [];
  const tasks = [...new Set(models.flatMap(model => model.tasks))].sort();
  const filtered = filterModels(models, { query, providers, capabilities: task ? [task] : [], format, sort, family });

  async function install(model: PublicModel, variant: PublicVariant) {
    if (!inventoryReady) return;
    const reference = modelInstallReference(model, variant, source);
    await download.start(reference, (signal, observer) => modelsApi.downloadModel({ model_id: reference }, signal, observer));
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
        {!selectedModel && family && view === 'models' && (
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
        {cleanEngineError && <p role="alert">Installed model status unavailable: {cleanEngineError}</p>}

        {/* ------------------------------------------------------------------ */}
        {/* LEVEL 3: Dedicated Model Detail & Quantization Download Page      */}
        {/* ------------------------------------------------------------------ */}
        {selectedModel ? (
          <div className="space-y-6">

            {/* Model Hero Info Card */}
            {(() => {
              const modelLogoUrl = catalogueImage(selectedModel.logo || '');
              const cleanDesc = cleanModelDescription(selectedModel.description || selectedModel.familyDescription);

              return (
                <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 sm:px-10 sm:py-10 min-h-[200px] flex items-center text-left">
                  {/* Right Side: Model Logo Watermark seamlessly dissolved into card background on all sides */}
                  {modelLogoUrl && (
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 flex items-center justify-end pointer-events-none select-none overflow-hidden z-0 pr-6 sm:pr-12">
                      <img
                        src={modelLogoUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-56 h-56 sm:w-72 sm:h-72 object-contain opacity-45 filter contrast-125 transition-opacity"
                        style={{
                          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.35) 55%, transparent 92%)',
                          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.35) 55%, transparent 92%)',
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
        ) : family && view === 'models' ? (
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
                <div className="relative overflow-hidden pt-2 pb-6 min-h-[200px] flex items-center text-left">
                  {/* Right Side: Family Logo Watermark with Smooth Radial Fade Mask on all sides (Image 2 style) */}
                  {heroLogoUrl && (
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 flex items-center justify-end pointer-events-none select-none overflow-hidden z-0 pr-2 sm:pr-8">
                      <img
                        src={heroLogoUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-56 h-56 sm:w-72 sm:h-72 object-contain opacity-50 filter contrast-125 transition-opacity"
                        style={{
                          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.35) 55%, transparent 92%)',
                          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.35) 55%, transparent 92%)',
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

            {/* Models in Family - Image 3 Slider Row (No outer card/border) */}
            {(() => {
              const familyModels = filtered.filter(m => m.family === family);
              return (
                <FamilyModelSliderRow
                  family={family}
                  models={familyModels}
                  installed={installed}
                  isBusy={busy}
                  downloadingTarget={download.receipt?.target}
                  borderless={true}
                  hideHeader={true}
                  onDownload={(model, variant) => void install(model, variant)}
                  onViewAll={() => {}}
                  onSelectModel={(model) => {
                    setSelectedModel(model);
                    setFamily(model.family);
                    updateUrl(model.family, model.id);
                  }}
                />
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
                <Card 
                  key={model.id} 
                  onClick={() => {
                    setSelectedModel(model);
                    updateUrl(model.family, model.id);
                  }}
                  className="min-w-0 cursor-pointer hover:border-[var(--accent-color)]/60 transition-colors" 
                  style={{ padding: 16 }}
                >
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
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedModel(model);
                        updateUrl(model.family, model.id);
                      }} className="text-xs gap-1">
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
                    setView('models');
                    setSelectedModel(null);
                    setLimit(24);
                    updateUrl(fam, '');
                  }}
                  onSelectModel={(model) => {
                    setSelectedModel(model);
                    setFamily(model.family);
                    updateUrl(model.family, model.id);
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

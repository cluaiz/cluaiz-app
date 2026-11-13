import { useEffect, useRef, useState } from 'react';
import { modelCatalogue, modelInstallReference, type PublicModel, type PublicVariant } from '../../api/catalogue/models';
import { modelsApi } from '../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../api/engine/models/models.types';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useCatalogue } from './useCatalogue';
import { ArrowLeft } from 'lucide-react';
import { MultiLevelDropdown } from '../../components/ui/dropdown';
import { CatalogueChips, CatalogueHero, CatalogueImageFilters, CatalogueHeroImage, CatalogueTags, CatalogueToolbar } from './CatalogueUI';
import {
  catalogueImage, filterModels, cleanModelDescription,
  extractFamilyCapabilities
} from './catalogueView';
import { resumeModelDownload } from '../../api/engine/models/actions';
import { useCatalogueTask } from './useCatalogueTask';
import { FamilyModelSliderRow } from './FamilyModelSliderRow';
import { ModelPackagePanel } from './ModelPackagePanel';
import { useFamilyFilter } from './familyFilter';
import { downloadPercent, useModelDownloadStore } from './modelDownloadStore';
import { useModelCatalogueStore } from './modelCatalogueStore';
import { onToolkitHistory, setToolkitParams, toolkitParam } from './toolkitNavigation';
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
  /** The card picked on a family page (its packages show below); kept in the URL as pick=<model id> */
  const [activeModelId, setActiveModelState] = useState<string>(() => toolkitParam('pick'));
  const setActiveModelId = (id: string) => { setToolkitParams({ pick: id }); setActiveModelState(id); };
  useEffect(() => onToolkitHistory(() => setActiveModelState(toolkitParam('pick'))), []);
  const [selectedVariantByModel, setSelectedVariantByModel] = useState<Record<string, string>>({});
  const [hardwareProfile, setHardwareProfile] = useState<CachedHardwareProfile | null>(null);

  useEffect(() => {
    void getSystemHardwareProfile().then(setHardwareProfile);
  }, []);

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

  /* The running download, for the sidebar, the model cards and the Download button */
  const downloading = download.busy && !download.result && download.receipt ? download.receipt.target : '';
  const percent = downloadPercent(download.task);
  useEffect(() => { useModelDownloadStore.getState().setDownload(downloading ? { target: downloading, percent } : null); }, [downloading, percent]);
  const installedChanged = () => { setConnection(value => value + 1); useModelDownloadStore.getState().installedChanged(); };
  /* Paused downloads of the connected Engine; downloading the same reference continues from its `.part` */
  const engineScope = useConnectionStore(state => state.getBaseUrl());
  const setPaused = useModelDownloadStore(state => state.setPaused);
  useEffect(() => { useModelDownloadStore.getState().loadPaused(engineScope); }, [engineScope]);
  useEffect(() => { if (download.result && download.receipt) setPaused(download.receipt.target, undefined); }, [download.result, download.receipt, setPaused]);
  /** Stops the running download and keeps what arrived */
  const pause = async () => {
    if (!downloading) return;
    const target = downloading, at = percent ?? null;
    await download.cancel();
    setPaused(target, at);
  };
  /** Deletes what a stopped download of `target` left */
  const discard = async (target: string) => {
    try { await modelsApi.discardDownload(target); setPaused(target, undefined); }
    catch (error) { setInstallError(`The partial download could not be deleted: ${error instanceof Error ? error.message : String(error)}`); }
  };
  /** Stops the running download and deletes what arrived */
  const cancelDownload = async () => {
    if (!downloading) return;
    const target = downloading;
    await download.cancel();
    await discard(target);
  };
  useEffect(() => { if (download.result) installedChanged(); }, [download.result]);
  /* The Download button is the only progress shown: an ended download is forgotten, a failed one says why */
  useEffect(() => {
    if (download.busy || download.cancelling) return;
    const failed = download.error || (download.task?.status === 'failed' ? download.task.status_message || 'the Engine stopped it' : '');
    if (failed) setInstallError(`Download failed: ${failed}`);
    if (download.receipt || download.error) download.forget();
  }, [download.busy, download.cancelling, download.error, download.receipt, download.task?.status]);


  const models = catalogue.reply?.data ?? [];
  const tasks = [...new Set(models.flatMap(model => model.tasks))].sort();
  const filtered = filterModels(models, { query, providers, capabilities: task ? [task] : [], format, sort, family });

  const familyFilter = useFamilyFilter(filtered.filter(model => model.family === family), installed);
  const inFamily = (model: PublicModel) => model.family === family && familyFilter.matches(model);
  const activeFamilyModels = family ? filtered.filter(inFamily) : [];
  const effectiveActiveId = (activeModelId && activeFamilyModels.some(m => m.id === activeModelId))
    ? activeModelId
    : (activeFamilyModels[0]?.id || '');

  async function install(model: PublicModel, variant: PublicVariant) {
    setInstallError('');
    if (!inventoryReady) { setInstallError('Connect to your Engine before downloading a package.'); return; }
    try {
      const reference = modelInstallReference(model, variant);
      setPaused(reference, undefined);
      await download.start(reference, (signal, observer) => modelsApi.downloadModel({ model_id: reference }, signal, observer));
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : String(error));
    }
  }

  async function uninstall(entry: ModelRegistryEntry) {
    setInstallError('');
    try { await modelsApi.deleteModel(entry.id); installedChanged(); }
    catch (error) { setInstallError(error instanceof Error ? error.message : String(error)); }
  }

  // Synchronize URL search params with family and model selection
  const updateUrl = (newFamily: string, newModelId: string) => setToolkitParams({ family: newFamily, model: newModelId });

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
        {catalogue.error && !catalogue.reply && <p role="alert" className="text-sm text-[var(--status-error)]">The model list could not be loaded. Check your internet connection.</p>}

        {!inventoryReady && <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
          <p role={engineError ? 'alert' : 'status'}>{cleanEngineError || 'Checking installed models…'}</p>
          {engineError && <Button variant="secondary" size="sm" onClick={() => setConnection(value => value + 1)}>Retry Engine connection</Button>}
        </div>}
        {installError && <p role="alert" className="text-sm text-[var(--status-error)]">{installError}</p>}

        <CatalogueImageFilters />

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
                    <div className="absolute inset-y-0 right-0 w-[40%] pointer-events-none select-none z-0 flex items-center justify-end overflow-hidden" aria-hidden="true">
                      <CatalogueHeroImage src={transparentModelLogoUrl} />
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


            <ModelPackagePanel key={selectedModel.id} model={selectedModel} installed={installed}
              selectedVariantId={selectedVariantByModel[selectedModel.id]}
              onSelectVariant={id => setSelectedVariantByModel(previous => ({ ...previous, [selectedModel.id]: id }))}
              onInstall={install} onUninstall={uninstall} onPause={() => void pause()} onCancel={() => void cancelDownload()} onDiscard={target => void discard(target)} canStart={download.canStart} inventoryReady={inventoryReady}
              hardware={hardwareProfile} />

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
              const heroLogoUrl = catalogueImage(first?.logo || '');
              return <CatalogueHero title={family} by={first?.provider || 'Open Source'} count={familyModels.length}
                description={cleanModelDescription(first?.familyDescription || first?.description)}
                tags={extractFamilyCapabilities(familyModels)} logo={heroLogoUrl && <CatalogueHeroImage src={heroLogoUrl} />} />;
            })()}

            {/* Models in Family - Search, Sort & Slider Row */}
            {(() => {
              const baseFamilyModels = filtered.filter(inFamily);

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
                  <CatalogueToolbar query={familyModelQuery} onQuery={setFamilyModelQuery} placeholder={`Search ${family} models...`}
                    sort={familySort} sorts={sortLabels} onSort={setFamilySort}
                    filter={<MultiLevelDropdown iconOnly activeCount={familyFilter.chips.length} onClearAll={familyFilter.clear} categories={familyFilter.categories} />} />
                  <CatalogueChips clear={familyFilter.clear} values={familyFilter.chips} />

                  {/* Empty Search State */}
                  {sortedModels.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-tertiary)]/20">
                      <p className="text-xs font-mono text-[var(--text-muted)]">{familyModelQuery ? <>No models matched &ldquo;{familyModelQuery}&rdquo;</> : 'No models match the selected filters.'}</p>
                      <button
                        type="button"
                        onClick={() => { setFamilyModelQuery(''); familyFilter.clear(); }}
                        className="mt-2 text-xs font-mono text-[var(--accent-color)] hover:underline cursor-pointer"
                      >
                        Clear search and filters
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
                          selectedVariantId={selectedVariantByModel[model.id]}
                          onSelectVariant={id => setSelectedVariantByModel(previous => ({ ...previous, [model.id]: id }))}
                          onInstall={install} onUninstall={uninstall} onPause={() => void pause()} onCancel={() => void cancelDownload()} onDiscard={target => void discard(target)} canStart={download.canStart} inventoryReady={inventoryReady}
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

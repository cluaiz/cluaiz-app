import { create } from 'zustand';
import type { PublicModel } from '../../api/catalogue/models';
import type { CatalogueSort } from './catalogueView';
import { onToolkitHistory, setToolkitParams, toolkitParam } from './toolkitNavigation';

/** Where models run (this computer or a provider) and which list the Toolkit sidebar shows; the content pane follows. */
export type ModelPlace = 'local' | 'cloud';
export type ModelListing = 'browse' | 'installed';

/** Place, listing and the installed-only view live in the URL: place=cloud, list=installed, show=installed */
const fromUrl = () => ({
  place: (toolkitParam('place') === 'cloud' ? 'cloud' : 'local') as ModelPlace,
  listing: (toolkitParam('list') === 'installed' ? 'installed' : 'browse') as ModelListing,
  installedOnly: toolkitParam('show') === 'installed',
});

/** A family or provider page's own filters (show=installed is the installed-only view) */
const MODEL_PAGE_FILTERS = { type: null, format: null, traits: null, status: null, picker: null };
const NO_PAGE_FILTER = { ...MODEL_PAGE_FILTERS, show: null };

export interface ModelCatalogueState {
  place: ModelPlace;
  listing: ModelListing;
  /** The family page shows installed models only */
  installedOnly: boolean;
  family: string;
  selectedModel: PublicModel | null;
  query: string;
  providers: string[];
  task: string;
  format: string;
  sort: CatalogueSort;
  view: 'families' | 'models';

  // Actions
  setPlace: (place: ModelPlace) => void;
  setListing: (listing: ModelListing) => void;
  setInstalledOnly: (installedOnly: boolean) => void;
  setFamily: (family: string) => void;
  /** Opens a family page, or one of its models, and records it in the URL */
  openFamily: (family: string, model?: PublicModel | null) => void;
  setSelectedModel: (model: PublicModel | null) => void;
  setQuery: (query: string) => void;
  setProviders: (providers: string[] | ((prev: string[]) => string[])) => void;
  setTask: (task: string) => void;
  setFormat: (format: string) => void;
  setSort: (sort: CatalogueSort) => void;
  setView: (view: 'families' | 'models') => void;
  clearFilters: () => void;
}

export const useModelCatalogueStore = create<ModelCatalogueState>((set) => ({
  ...fromUrl(),
  setPlace: (place) => { setToolkitParams({ place: place === 'cloud' ? place : null, provider: null, model: null, family: null, pick: null, ...NO_PAGE_FILTER }); set({ place, family: '', selectedModel: null, installedOnly: false }); },
  setListing: (listing) => { setToolkitParams({ list: listing === 'installed' ? listing : null }); set({ listing }); },
  setInstalledOnly: (installedOnly) => { setToolkitParams({ show: installedOnly ? 'installed' : null }); set({ installedOnly }); },
  family: '',
  selectedModel: null,
  query: '',
  providers: [],
  task: '',
  format: '',
  sort: 'popular',
  view: 'families',

  openFamily: (family, model = null) => {
    setToolkitParams({ family: family || null, model: model?.id ?? null, pick: null, ...MODEL_PAGE_FILTERS });
    set({ family, view: family ? 'models' : 'families', selectedModel: model });
  },
  setFamily: (family) => set({
    family,
    view: family ? 'models' : 'families',
    selectedModel: null
  }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setQuery: (query) => set({ query }),
  setProviders: (providers) => set((state) => ({
    providers: typeof providers === 'function' ? providers(state.providers) : providers
  })),
  setTask: (task) => set({ task }),
  setFormat: (format) => set({ format }),
  setSort: (sort) => set({ sort }),
  setView: (view) => set((state) => ({
    view,
    family: view === 'families' ? '' : state.family,
    selectedModel: null
  })),
  clearFilters: () => set({ query: '', providers: [], task: '', format: '', sort: 'popular' }),
}));

onToolkitHistory(() => useModelCatalogueStore.setState(fromUrl()));

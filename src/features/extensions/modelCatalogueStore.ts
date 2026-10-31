import { create } from 'zustand';
import type { PublicModel } from '../../api/catalogue/models';
import type { CatalogueSort } from './catalogueView';

export interface ModelCatalogueState {
  family: string;
  selectedModel: PublicModel | null;
  query: string;
  providers: string[];
  task: string;
  format: string;
  sort: CatalogueSort;
  view: 'families' | 'models';

  // Actions
  setFamily: (family: string) => void;
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
  family: '',
  selectedModel: null,
  query: '',
  providers: [],
  task: '',
  format: '',
  sort: 'popular',
  view: 'families',

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

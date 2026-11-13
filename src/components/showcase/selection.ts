import { create } from 'zustand';
import { COMPONENT_GROUPS } from './catalog';
import type { ComponentId } from './types';

/** The open component and the directory search, shared by the directory (a sidebar) and the stage */
export const useShowcaseSelection = create<{
    selectedId: ComponentId; setSelectedId: (id: ComponentId) => void;
    searchQuery: string; setSearchQuery: (query: string) => void;
}>(set => ({
    selectedId: 'typography',
    setSelectedId: selectedId => set({ selectedId }),
    searchQuery: '',
    setSearchQuery: searchQuery => set({ searchQuery }),
}));

/** The component groups with only the items whose label, description or path match `query` */
export function filterGroups(query: string) {
    const text = query.toLowerCase();
    return COMPONENT_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => [item.label, item.description, item.path].some(value => value.toLowerCase().includes(text))),
    })).filter(group => group.items.length > 0);
}

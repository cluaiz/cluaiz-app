import { create } from 'zustand';
import { toolkitSection, type ToolkitSectionId } from './toolkitNavigation';

export interface ToolkitNavState {
  activeSection: ToolkitSectionId;
  showSectionPicker: boolean;
  setActiveSection: (section: ToolkitSectionId) => void;
  setShowSectionPicker: (show: boolean) => void;
  backToHub: () => void;
}

export const useToolkitNavStore = create<ToolkitNavState>((set) => ({
  activeSection: typeof window !== 'undefined' ? toolkitSection(window.location.search) : 'models',
  showSectionPicker: false,
  setActiveSection: (section) => set({ activeSection: section, showSectionPicker: false }),
  setShowSectionPicker: (showSectionPicker) => set({ showSectionPicker }),
  backToHub: () => set({ showSectionPicker: true }),
}));

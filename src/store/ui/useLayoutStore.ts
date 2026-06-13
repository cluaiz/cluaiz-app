import { create } from 'zustand';

export type SidebarPosition = 'left' | 'right';

export interface DateRange {
    from: Date | undefined;
    to?: Date | undefined;
}



export interface ActiveChatData {
    id: string;
    name: string;
    avatar: string;
    status: string;
    totalMessages: number;
}

interface LayoutState {
    sidebarOpen: boolean;
    sidebarWidth: number;
    sidebarPosition: SidebarPosition;
    sidebarCollapsed: boolean;
    sidebarPeeked: boolean;
    rightPanelOpen: boolean;
    rightPanelWidth: number;
    splitPaneWidth: number;
    dateRange: DateRange | undefined;
    toggleSidebar: () => void;
    setSidebarWidth: (width: number) => void;
    setSidebarPosition: (position: SidebarPosition) => void;
    toggleSidebarCollapsed: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setSidebarPeeked: (peeked: boolean) => void;
    toggleRightPanel: () => void;
    setRightPanelWidth: (width: number) => void;
    setSplitPaneWidth: (width: number) => void;
    setDateRange: (range: DateRange | undefined) => void;
    activeChatData: ActiveChatData | null;
    setActiveChatData: (data: ActiveChatData | null) => void;
    activeView: 'chat' | 'notebook' | 'settings';
    setActiveView: (view: 'chat' | 'notebook' | 'settings') => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
    sidebarOpen: true,
    sidebarWidth: 300,
    sidebarPosition: 'left',
    sidebarCollapsed: false,
    sidebarPeeked: false,
    rightPanelOpen: false,
    rightPanelWidth: 320,
    splitPaneWidth: 100, // default 100% (hidden right pane)
    dateRange: undefined,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
    setSidebarPosition: (sidebarPosition) => set({ sidebarPosition }),
    toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    setSidebarPeeked: (sidebarPeeked) => set({ sidebarPeeked }),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
    setRightPanelWidth: (rightPanelWidth) => set({ rightPanelWidth }),
    setSplitPaneWidth: (splitPaneWidth) => set({ splitPaneWidth }),
    setDateRange: (dateRange) => set({ dateRange }),
    activeChatData: null,
    setActiveChatData: (activeChatData) => set({ activeChatData }),
    activeView: 'chat',
    setActiveView: (activeView) => set({ activeView }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExtensionRoute } from '../../extensions/routes';
import { parseCurrentRoute, type MainViewId } from '../../core/router';

function initialRouteView(): { activeView: MainViewId; activeExtension: ExtensionRoute | null } {
    if (typeof window === 'undefined') {
        return { activeView: 'chat', activeExtension: null };
    }
    try {
        const route = parseCurrentRoute();
        return {
            activeView: route.view || 'chat',
            activeExtension: route.view === 'extensions' ? (route.extension || null) : null,
        };
    } catch {
        return { activeView: 'chat', activeExtension: null };
    }
}

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
    splitReversed: boolean;
    workspaceSidebarOpen: boolean;
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
    toggleSplitReversed: () => void;
    setWorkspaceSidebarOpen: (open: boolean) => void;
    setDateRange: (range: DateRange | undefined) => void;
    activeChatData: ActiveChatData | null;
    setActiveChatData: (data: ActiveChatData | null) => void;
    activeView: MainViewId;
    setActiveView: (view: LayoutState['activeView']) => void;
    activeExtension: ExtensionRoute | null;
    setActiveExtension: (route: ExtensionRoute | null) => void;
    previewModalAsset: any | null;
    setPreviewModalAsset: (asset: any | null) => void;
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            sidebarOpen: true,
            sidebarWidth: 300,
            sidebarPosition: 'left',
            sidebarCollapsed: false,
            sidebarPeeked: false,
            rightPanelOpen: false,
            rightPanelWidth: 320,
            splitPaneWidth: 100, // default 100% (hidden right pane)
            splitReversed: false,
            workspaceSidebarOpen: true,
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
            toggleSplitReversed: () => set((state) => ({ splitReversed: !state.splitReversed })),
            setWorkspaceSidebarOpen: (workspaceSidebarOpen) => set({ workspaceSidebarOpen }),
            setDateRange: (dateRange) => set({ dateRange }),
            activeChatData: null,
            setActiveChatData: (activeChatData) => set({ activeChatData }),
            ...initialRouteView(),
            setActiveView: (activeView) => set({ activeView }),
            setActiveExtension: (activeExtension) => set({ activeView: 'extensions', activeExtension }),
            previewModalAsset: null,
            setPreviewModalAsset: (previewModalAsset) => set({ previewModalAsset }),
        }),
        {
            name: 'cluaiz-layout-storage',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                sidebarWidth: state.sidebarWidth,
                sidebarPosition: state.sidebarPosition,
                sidebarCollapsed: state.sidebarCollapsed,
                rightPanelOpen: state.rightPanelOpen,
                rightPanelWidth: state.rightPanelWidth,
                splitPaneWidth: state.splitPaneWidth,
                splitReversed: state.splitReversed,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // Always honor the current browser URL on hydration, never reset to 'chat' or stale storage
                    const routeView = initialRouteView();
                    state.activeView = routeView.activeView;
                    state.activeExtension = routeView.activeExtension;
                    try {
                        const raw = localStorage.getItem('cluaiz-layout-storage');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed.state && 'activeView' in parsed.state) {
                                delete parsed.state.activeView;
                                localStorage.setItem('cluaiz-layout-storage', JSON.stringify(parsed));
                            }
                        }
                    } catch {}
                }
            }
        }
    )
);

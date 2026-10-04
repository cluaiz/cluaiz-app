import { useState, useEffect } from 'react';
import { ThemeProvider } from './core/ThemeProvider';
import { AppShell } from './components/layout/AppShell';
import { ChatWorkspace } from './features/chat/components/ChatWorkspace';
import { SidebarContent } from './components/layout/SidebarContent';
import { BubbleLauncher } from './components/layout/BubbleLauncher';
import { SettingsOverlay } from './features/settings/SettingsOverlay';
import { Cpu, Database, Maximize2 } from 'lucide-react';
import { useThemeStore } from './store/ui/useThemeStore';
import { useLayoutStore } from './store/ui/useLayoutStore';
import { NotebookEditor } from './features/notebook/NotebookEditor';
import { ApiWorkspace } from './features/api/ApiWorkspace';
import { ElasticSlider } from './components/ui/cursor/ElasticSlider';
import ClickSpark from './components/ui/ClickSpark';
import { SmoothFollowCursor } from './components/ui/cursor/SmoothFollowCursor';
import { NeonPulseCursor } from './components/ui/cursor/NeonPulseCursor';
import { CanvasCursor } from './components/ui/cursor/CanvasCursor';
import { AuraCursor } from './components/ui/cursor/AuraCursor';
import { parseCurrentRoute, pushSettingsRoute, pushViewRoute, SettingsTabId } from './core/router';
import { ToastContainer } from './components/ui/toast';

function MainAppContent() {
    const initialRoute = parseCurrentRoute();
    const [isLauncherOpen, setIsLauncherOpen] = useState(false);
    const [launcherCoords, setLauncherCoords] = useState<{x: number, y: number} | null>(null);
    const [settingsState, setSettingsState] = useState<{isOpen: boolean, tab: SettingsTabId}>({
        isOpen: initialRoute.isSettingsOpen,
        tab: initialRoute.settingsTab
    });
    const { textScale, setTextScale, theme, darkAccent, lightAccent, cursorType } = useThemeStore();
    const { activeView } = useLayoutStore();
    const activeAccent = theme !== 'light' ? darkAccent : lightAccent;

    const handleOpenSettings = (tab?: string) => {
        const targetTab = (tab as SettingsTabId) || 'general';
        setSettingsState({ isOpen: true, tab: targetTab });
        pushSettingsRoute(targetTab);
    };

    const handleCloseSettings = () => {
        setSettingsState(prev => ({ ...prev, isOpen: false }));
        pushViewRoute(activeView);
    };

    const handleSettingsTabChange = (newTab: SettingsTabId) => {
        setSettingsState(prev => ({ ...prev, tab: newTab }));
        pushSettingsRoute(newTab);
    };

    // Keep activeView synchronized with browser URL when settings modal is closed
    useEffect(() => {
        if (!settingsState.isOpen) {
            pushViewRoute(activeView);
        }
    }, [activeView, settingsState.isOpen]);

    useEffect(() => {
        // Initial URL route verification & sync
        const currentRoute = parseCurrentRoute();
        if (currentRoute.isSettingsOpen) {
            pushSettingsRoute(currentRoute.settingsTab, true);
        } else {
            pushViewRoute(currentRoute.view, true);
        }
        if (currentRoute.view && currentRoute.view !== activeView) {
            useLayoutStore.getState().setActiveView(currentRoute.view);
        }

        const handleOpenLauncher = (e: any) => {
            if (e.detail && typeof e.detail.x === 'number') {
                setLauncherCoords({ x: e.detail.x, y: e.detail.y });
            } else {
                setLauncherCoords(null);
            }
            setIsLauncherOpen(true);
        };
        document.addEventListener('open-launcher', handleOpenLauncher);

        // Popstate handler for browser back/forward buttons
        const handlePopState = () => {
            const route = parseCurrentRoute();
            setSettingsState({
                isOpen: route.isSettingsOpen,
                tab: route.settingsTab
            });
            if (!route.isSettingsOpen && route.view) {
                useLayoutStore.getState().setActiveView(route.view);
            }
        };
        window.addEventListener('popstate', handlePopState);

        const handleOpenSettingsEvent = (e: any) => {
            const requestedTab = e?.detail?.tab || 'general';
            handleOpenSettings(requestedTab);
        };
        document.addEventListener('open-settings', handleOpenSettingsEvent);

        // Prevent default browser right-click menu
        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Allow right click on input fields, textareas, and contenteditable elements (like the editor)
            if (
                target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.isContentEditable ||
                target.closest('.ProseMirror')
            ) {
                return;
            }
            e.preventDefault();
        };
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('open-launcher', handleOpenLauncher);
            document.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('popstate', handlePopState);
            document.removeEventListener('open-settings', handleOpenSettingsEvent);
        };
    }, []);

    return (
        <ClickSpark 
            active={cursorType === 'splash'} 
            sparkColor={activeAccent} 
            sparkSize={10} 
            sparkRadius={20} 
            sparkCount={10} 
            duration={450}
        >
            <AppShell
                sidebarContent={
                    <SidebarContent 
                        onOpenLauncher={(e) => {
                            if (e) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setLauncherCoords({ x: rect.left, y: rect.bottom + 8 });
                            } else {
                                setLauncherCoords(null);
                            }
                            setIsLauncherOpen(true);
                        }} 
                    />
                }
                mainContent={
                    activeView === 'notebook' ? (
                        <NotebookEditor />
                    ) : activeView === 'apis' ? (
                        <ApiWorkspace />
                    ) : (
                        <ChatWorkspace />
                    )
                }
            />

            {/* Launcher overlay containing the staggered bubbles and aesthetic controls */}
            <BubbleLauncher 
                isOpen={isLauncherOpen} 
                coords={launcherCoords}
                onClose={() => setIsLauncherOpen(false)} 
                onOpenSettings={handleOpenSettings}
            />

            {/* Custom Premium Settings Modal */}
            <SettingsOverlay 
                isOpen={settingsState.isOpen} 
                initialTab={settingsState.tab}
                onClose={handleCloseSettings} 
                onTabChange={handleSettingsTabChange}
            />

            {/* Custom Cursors Render */}
            {cursorType === 'smooth' && <SmoothFollowCursor />}
            {cursorType === 'neon' && <NeonPulseCursor />}
            {cursorType === 'canvas' && <CanvasCursor />}
            {cursorType === 'aura' && <AuraCursor />}

            {/* Global Notification & Toast Portal */}
            <ToastContainer />
        </ClickSpark>
    );
}

import React from 'react';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fff', height: '100vh' }}>
          <h2>React Runtime Crash:</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <MainAppContent />
            </ThemeProvider>
        </ErrorBoundary>
    );
}


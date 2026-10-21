import { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './core/ThemeProvider';
import { AppShell } from './components/layout/AppShell';
import { ChatWorkspace } from './features/chat/components/ChatWorkspace';
import { SidebarContent } from './components/layout/SidebarContent';
import { BubbleLauncher } from './components/layout/BubbleLauncher';
import { SettingsOverlay } from './features/settings/SettingsOverlay';
import { AuthTokenModal } from './features/settings/components/AuthTokenModal';
import { Cpu, Database, Maximize2 } from 'lucide-react';
import { useThemeStore } from './store/ui/useThemeStore';
import { useLayoutStore } from './store/ui/useLayoutStore';
import { NotebookHub } from './features/notebook/NotebookHub';
import { ApiWorkspace } from './features/api/ApiWorkspace';
import { ToolsWorkspace } from './features/tools';
import { LibraryHub, AssetPreviewModal } from './features/library';
import { openAttachmentInWorkspace } from './features/chat/utils/workspaceAttachmentOpener';
import { ElasticSlider } from './components/ui/cursor/ElasticSlider';
import ClickSpark from './components/ui/ClickSpark';
import { SmoothFollowCursor } from './components/ui/cursor/SmoothFollowCursor';
import { NeonPulseCursor } from './components/ui/cursor/NeonPulseCursor';
import { CanvasCursor } from './components/ui/cursor/CanvasCursor';
import { AuraCursor } from './components/ui/cursor/AuraCursor';
import { parseCurrentRoute, pushSettingsRoute, pushViewRoute, pushChatRoute, SettingsTabId } from './core/router';
import { useChatStore } from './store/chat/useChatStore';
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
    const { activeView, previewModalAsset, setPreviewModalAsset } = useLayoutStore();
    const activeAccent = theme !== 'light' ? darkAccent : lightAccent;

    const handleOpenSettings = (tab?: string) => {
        const targetTab = (tab as SettingsTabId) || 'general';
        setSettingsState({ isOpen: true, tab: targetTab });
        pushSettingsRoute(targetTab);
    };

    const handleCloseSettings = () => {
        setSettingsState(prev => ({ ...prev, isOpen: false }));
        const activeChatId = useChatStore.getState().activeSessionId;
        if (activeView === 'chat' && activeChatId) {
            pushChatRoute(activeChatId);
        } else {
            pushViewRoute(activeView);
        }
    };

    const handleSettingsTabChange = (newTab: SettingsTabId) => {
        setSettingsState(prev => ({ ...prev, tab: newTab }));
        pushSettingsRoute(newTab);
    };

    // Synchronize browser URL when activeView changes after user interaction
    const isFirstMountRef = useRef(true);
    useEffect(() => {
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            // On initial load, honor the exact entered browser URL!
            const currentRoute = parseCurrentRoute();
            if (currentRoute.isSettingsOpen) {
                pushSettingsRoute(currentRoute.settingsTab, true);
            } else if (currentRoute.view === 'chat') {
                if (currentRoute.activeChatId) {
                    pushChatRoute(currentRoute.activeChatId, true);
                }
            } else {
                pushViewRoute(currentRoute.view, true);
            }
            if (!currentRoute.isSettingsOpen && currentRoute.view && currentRoute.view !== useLayoutStore.getState().activeView) {
                useLayoutStore.getState().setActiveView(currentRoute.view);
            }
            return;
        }

        if (!settingsState.isOpen) {
            pushViewRoute(activeView);
        }
    }, [activeView, settingsState.isOpen]);

    useEffect(() => {

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
            if (route.activeChatId !== undefined) {
                const currentActive = useChatStore.getState().activeSessionId;
                if (currentActive !== route.activeChatId) {
                    useChatStore.getState().switchSession(route.activeChatId, false);
                }
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
                        <NotebookHub />
                    ) : activeView === 'apis' ? (
                        <ApiWorkspace />
                    ) : activeView === 'tools' ? (
                        <ToolsWorkspace />
                    ) : activeView === 'library' ? (
                        <LibraryHub />
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

            {/* Global Auth Disconnect Recovery Modal */}
            <AuthTokenModal />

            {/* Global Unified Asset & File Preview Modal (Shared across Library and Chat) */}
            <AssetPreviewModal
                asset={previewModalAsset}
                onClose={() => setPreviewModalAsset(null)}
                onOpenInWorkspace={(asset) => {
                    openAttachmentInWorkspace({
                        name: asset.name,
                        size: asset.size,
                        type: asset.type,
                        previewUrl: asset.previewUrl,
                        pastedContent: asset.content
                    });
                }}
                onJumpToChat={async (sessionId) => {
                    useLayoutStore.getState().setActiveView('chat');
                    pushViewRoute('chat');
                    await useChatStore.getState().switchSession(sessionId);
                    pushChatRoute(sessionId);
                }}
            />

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


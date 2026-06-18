import { useState, useEffect } from 'react';
import { ThemeProvider } from './core/ThemeProvider';
import { AppShell } from './components/layout/AppShell';
import { ChatWorkspace } from './features/chat/components/ChatWorkspace';
import { SidebarContent } from './components/layout/SidebarContent';
import { BubbleLauncher } from './components/layout/BubbleLauncher';
import { SettingsOverlay } from './components/ui/settings/SettingsOverlay';
import { Cpu, Database, Maximize2 } from 'lucide-react';
import { useThemeStore } from './store/ui/useThemeStore';
import { useLayoutStore } from './store/ui/useLayoutStore';
import { NotebookEditor } from './components/ui/notebook/NotebookEditor';
import { ElasticSlider } from './components/ui/cursor/ElasticSlider';
import ClickSpark from './components/ui/ClickSpark';
import { SmoothFollowCursor } from './components/ui/cursor/SmoothFollowCursor';
import { NeonPulseCursor } from './components/ui/cursor/NeonPulseCursor';
import { CanvasCursor } from './components/ui/cursor/CanvasCursor';
import { AuraCursor } from './components/ui/cursor/AuraCursor';

function MainAppContent() {
    const [isLauncherOpen, setIsLauncherOpen] = useState(false);
    const [launcherCoords, setLauncherCoords] = useState<{x: number, y: number} | null>(null);
    const [settingsState, setSettingsState] = useState<{isOpen: boolean, tab: string}>({ isOpen: false, tab: 'general' });
    const { textScale, setTextScale, theme, darkAccent, lightAccent, cursorType } = useThemeStore();
    const { activeView } = useLayoutStore();
    const activeAccent = theme !== 'light' ? darkAccent : lightAccent;

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
                    activeView === 'notebook' ? <NotebookEditor /> : <ChatWorkspace />
                }
            />

            {/* Launcher overlay containing the staggered bubbles and aesthetic controls */}
            <BubbleLauncher 
                isOpen={isLauncherOpen} 
                coords={launcherCoords}
                onClose={() => setIsLauncherOpen(false)} 
                onOpenSettings={(tab) => setSettingsState({ isOpen: true, tab: tab || 'general' })}
            />

            {/* Custom Premium Settings Modal */}
            <SettingsOverlay 
                isOpen={settingsState.isOpen} 
                initialTab={settingsState.tab as any}
                onClose={() => setSettingsState(prev => ({ ...prev, isOpen: false }))} 
            />

            {/* Custom Cursors Render */}
            {cursorType === 'smooth' && <SmoothFollowCursor />}
            {cursorType === 'neon' && <NeonPulseCursor />}
            {cursorType === 'canvas' && <CanvasCursor />}
            {cursorType === 'aura' && <AuraCursor />}
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


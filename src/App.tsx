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
    const [settingsState, setSettingsState] = useState<{isOpen: boolean, tab: string}>({ isOpen: false, tab: 'general' });
    const { textScale, setTextScale, theme, darkAccent, lightAccent, cursorType } = useThemeStore();
    const { activeView } = useLayoutStore();
    const activeAccent = theme !== 'light' ? darkAccent : lightAccent;

    useEffect(() => {
        const handleOpenLauncher = () => setIsLauncherOpen(true);
        document.addEventListener('open-launcher', handleOpenLauncher);
        return () => document.removeEventListener('open-launcher', handleOpenLauncher);
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
                        onOpenLauncher={() => setIsLauncherOpen(true)} 
                    />
                }
                mainContent={
                    activeView === 'notebook' ? <NotebookEditor /> : <ChatWorkspace />
                }
                rightPanelContent={
                    <div className="space-y-5 font-mono text-[11px] select-text">
                        
                        {/* Global Scale Control */}
                        <div className="space-y-2.5 p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded" style={{ borderStyle: 'var(--border-style)' }}>
                            <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1.5 text-glow">
                                    <Maximize2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    interface scaling
                                </span>
                                <span className="text-[var(--accent-color)] font-bold">{(textScale * 100).toFixed(0)}%</span>
                            </div>
                            <div className="pt-1">
                                <ElasticSlider
                                    min={0.8}
                                    max={1.2}
                                    step={0.05}
                                    value={textScale}
                                    onChange={setTextScale}
                                />
                            </div>
                        </div>

                        {/* CPU Load Gauge */}
                        <div className="space-y-1.5 p-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded" style={{ borderStyle: 'var(--border-style)' }}>
                            <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)] text-glow">
                                <span className="flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    core-cpu load
                                </span>
                                <span className="text-[var(--accent-color)] font-bold">14.8%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-color)]" style={{ borderStyle: 'var(--border-style)' }}>
                                <div className="h-full bg-[var(--accent-color)] transition-all duration-500 glow-accent" style={{ width: '14.8%' }}></div>
                            </div>
                        </div>

                        {/* Database Memory Allocation Gauge */}
                        <div className="space-y-1.5 p-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded" style={{ borderStyle: 'var(--border-style)' }}>
                            <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 text-[var(--accent-color)] text-glow" />
                                    memory buffer
                                </span>
                                <span className="text-[var(--accent-color)] font-bold">128 MB</span>
                            </div>
                            <div className="h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-color)]" style={{ borderStyle: 'var(--border-style)' }}>
                                <div className="h-full bg-[var(--accent-color)] transition-all duration-500 glow-accent" style={{ width: '25%' }}></div>
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">Available Cache Allocation: 512 MB</p>
                        </div>

                        {/* Telemetry Logs */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">CONNECTION TELEMETRY</span>
                            <div className="space-y-1.5 p-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-[var(--text-secondary)] font-medium" style={{ borderStyle: 'var(--border-style)' }}>
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-1" style={{ borderStyle: 'var(--border-style)' }}>
                                    <span>IPC Pipeline</span>
                                    <span className="text-emerald-500 font-bold">CONNECTED</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-1" style={{ borderStyle: 'var(--border-style)' }}>
                                    <span>Core Server</span>
                                    <span className="text-emerald-500 font-bold">ACTIVE</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Latency</span>
                                    <span className="text-[var(--accent-color)] font-bold">2 ms</span>
                                </div>
                            </div>
                        </div>

                        {/* Agent Stats */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">AGENT STATS</span>
                            <div className="space-y-1.5 p-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-[var(--text-secondary)] font-medium" style={{ borderStyle: 'var(--border-style)' }}>
                                <div className="flex justify-between">
                                    <span>Tokens Remaining</span>
                                    <span className="font-bold">7852 / 8192</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Model Instance</span>
                                    <span className="text-[var(--accent-color)] font-bold">qwen3.5:4b</span>
                                </div>
                            </div>
                        </div>

                    </div>
                }
            />

            {/* Launcher overlay containing the staggered bubbles and aesthetic controls */}
            <BubbleLauncher 
                isOpen={isLauncherOpen} 
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

export default function App() {
    return (
        <ThemeProvider>
            <MainAppContent />
        </ThemeProvider>
    );
}


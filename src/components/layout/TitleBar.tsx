import { useEffect, useState } from 'react';
import { isTauri } from '../../core/tauri-api';
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '../../core/tauri-api';
import { Minus, Square, X, MoreVertical, PanelLeftOpen, Copy } from 'lucide-react';
import { useThemeStore } from '../../store/ui/useThemeStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
    const [inTauri, setInTauri] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const { theme } = useThemeStore();
    const { sidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useLayoutStore();

    useEffect(() => {
        const checkTauri = isTauri();
        setInTauri(checkTauri);
        
        if (checkTauri) {
            const checkMaximized = async () => {
                try {
                    const max = await getCurrentWindow().isMaximized();
                    setIsMaximized(max);
                } catch (e) {}
            };
            
            checkMaximized();
            window.addEventListener('resize', checkMaximized);
            return () => window.removeEventListener('resize', checkMaximized);
        }
    }, []);

    if (!inTauri) return null;

    return (
        <div className="h-8 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex justify-between items-center select-none w-full flex-shrink-0 z-[9999] transition-colors duration-300">
            <div className="flex items-center px-3 h-full">
                <div data-tauri-drag-region className="flex items-center h-full cursor-default pr-3">
                    <img src="/logo.ico" alt="Cluaize Logo" className={`w-4 h-4 object-contain mr-2 drop-shadow-sm pointer-events-none transition-all duration-300 ${theme === 'light' ? 'brightness-0' : 'invert dark:invert-0'}`} />
                    <span className="text-xs font-bold text-[var(--text-primary)] tracking-widest pointer-events-none">
                        Cluaize
                    </span>
                </div>

                {(!sidebarOpen || sidebarCollapsed) && (
                    <div className="flex items-center gap-1 border-l border-[var(--border-color)] pl-2 h-4 z-50">
                        <button 
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                document.dispatchEvent(new CustomEvent('open-launcher', { detail: { x: rect.left, y: rect.bottom + 8 } }));
                            }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            title="Menu"
                        >
                            <MoreVertical size={14} />
                        </button>
                        <button 
                            onClick={() => {
                                if (!sidebarOpen) {
                                    useLayoutStore.getState().toggleSidebar();
                                }
                                setSidebarCollapsed(false);
                            }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            title="Expand Sidebar"
                        >
                            <PanelLeftOpen size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div data-tauri-drag-region className="flex-1 h-full" />

            <div className="flex h-full z-50">
                <button 
                    onClick={minimizeWindow}
                    className="h-full px-4 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors focus:outline-none cursor-pointer z-50"
                    title="Minimize"
                >
                    <Minus size={14} />
                </button>
                <button 
                    onClick={async () => {
                        await toggleMaximizeWindow();
                        setIsMaximized(await getCurrentWindow().isMaximized());
                    }}
                    className="h-full px-4 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors focus:outline-none cursor-pointer z-50"
                    title={isMaximized ? "Restore Down" : "Maximize"}
                >
                    {isMaximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
                </button>
                <button 
                    onClick={closeWindow}
                    className="h-full px-4 text-[var(--text-muted)] hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors focus:outline-none cursor-pointer z-50"
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

import React, { useEffect } from 'react';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { useShortcutStore, bindingsMatch, parseKeyboardEvent } from '../../store/ui/useShortcutStore';
import { ResizableSidebar } from './ResizableSidebar';
import { TitleBar } from './TitleBar';

interface AppShellProps {
    sidebarContent?: React.ReactNode;
    mainContent?: React.ReactNode;
    rightPanelContent?: React.ReactNode;
}

export function AppShell({ sidebarContent, mainContent, rightPanelContent }: AppShellProps) {
    const {
        sidebarOpen,
        sidebarCollapsed,
        sidebarWidth,
        sidebarPeeked,
        sidebarPosition,
        toggleSidebar,
        toggleSidebarCollapsed,
        setSidebarPeeked,
        rightPanelOpen
    } = useLayoutStore();

    // 1. Dynamic Keyboard Shortcut Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const currentBinding = parseKeyboardEvent(e);
            const getBinding = useShortcutStore.getState().getBindingForAction;

            if (bindingsMatch(currentBinding, getBinding('hideSidebar'))) {
                e.preventDefault();
                toggleSidebar();
                setSidebarPeeked(false);
                return;
            }

            if (bindingsMatch(currentBinding, getBinding('toggleSidebar'))) {
                e.preventDefault();
                if (!useLayoutStore.getState().sidebarOpen) {
                    // If it was hidden via Ctrl+B, opening it via Ctrl+Shift+B should show it and toggle collapse
                    useLayoutStore.setState({ sidebarOpen: true });
                }
                toggleSidebarCollapsed();
                return;
            }

            if (bindingsMatch(currentBinding, getBinding('newChat'))) {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('start-new-chat'));
                return;
            }

            if (bindingsMatch(currentBinding, getBinding('privateChat'))) {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('start-new-private-chat'));
                return;
            }

            if (bindingsMatch(currentBinding, getBinding('openLauncher'))) {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('open-launcher'));
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar, toggleSidebarCollapsed, setSidebarPeeked]);

    // 2. Mouse Move Edge Detection (<= 5px to peek, > width + 40px to hide)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const currentWidth = sidebarCollapsed ? 68 : sidebarWidth;

            // If sidebar is fully hidden, check if cursor is near the edge to peek
            if (!sidebarOpen) {
                if (sidebarPosition === 'left') {
                    if (e.clientX <= 5 && !sidebarPeeked) {
                        setSidebarPeeked(true);
                    }
                } else {
                    if (e.clientX >= window.innerWidth - 5 && !sidebarPeeked) {
                        setSidebarPeeked(true);
                    }
                }
            }

            // If sidebar is peeked, check if cursor has left the sidebar boundary
            if (sidebarPeeked) {
                if (sidebarPosition === 'left') {
                    if (e.clientX > currentWidth + 40) {
                        setSidebarPeeked(false);
                    }
                } else {
                    if (e.clientX < window.innerWidth - (currentWidth + 40)) {
                        setSidebarPeeked(false);
                    }
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [sidebarOpen, sidebarPeeked, sidebarCollapsed, sidebarWidth, sidebarPosition, setSidebarPeeked]);

    // Arrange elements depending on left or right position settings
    const renderSidebar = () => (
        <ResizableSidebar>
            {sidebarContent}
        </ResizableSidebar>
    );

    const renderRightPanel = () => {
        if (!rightPanelOpen) return null;
        return (
            <aside
                className="w-80 bg-[var(--bg-secondary)] border-[var(--border-color)] flex-shrink-0 flex flex-col transition-all duration-300"
                style={{
                    borderLeftWidth: sidebarPosition === 'left' ? '1px' : '0px',
                    borderRightWidth: sidebarPosition === 'right' ? '1px' : '0px',
                    borderStyle: 'var(--border-style)'
                }}
            >
                <header
                    className="h-14 border-b border-[var(--border-color)] flex items-center px-4 justify-between bg-[var(--bg-tertiary)]"
                    style={{ borderStyle: 'var(--border-style)' }}
                >
                    <span className="font-bold text-xs tracking-wider text-[var(--accent-color)] uppercase">System Control</span>
                </header>
                <div className="flex-1 overflow-y-auto p-4">
                    {rightPanelContent || <p className="text-[var(--text-muted)] text-sm">No control data available</p>}
                </div>
            </aside>
        );
    };

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-all-theme font-[family-name:var(--font-family)] select-none relative">
            <TitleBar />
            
            <div className="flex flex-1 w-full min-h-0 relative">
                {/* Conditional Layout Arrangement */}
                {sidebarPosition === 'left' && renderSidebar()}
                {sidebarPosition === 'right' && renderRightPanel()}

            {/* Central Workspace Canvas */}
            <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)] relative overflow-hidden">
                {mainContent}
            </main>

                {sidebarPosition === 'left' && renderRightPanel()}
                {sidebarPosition === 'right' && renderSidebar()}

                {/* Ambient Background Glow Tint Overlay */}
                <div
                    className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(circle at 50% 50%, rgba(var(--accent-color-rgb, 99, 102, 241), calc(var(--bg-glow-opacity, 0.15) * 0.12)) 0%, transparent 75%)`
                    }}
                />
            </div>
        </div>
    );
}


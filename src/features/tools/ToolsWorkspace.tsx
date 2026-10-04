import React from 'react';
import { ArrowLeft, Boxes, Settings } from 'lucide-react';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushViewRoute } from '../../core/router';
import { ToolsSettings } from '../settings/ToolsSettings';
import { EngineOfflineGuard } from '../settings/EngineOfflineGuard';

export const ToolsWorkspace: React.FC = () => {
    const handleBackToChat = () => {
        useLayoutStore.getState().setActiveView('chat');
        pushViewRoute('chat');
    };

    return (
        <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-[var(--bg-primary)] font-sans">
            {/* Top Workspace Header Bar */}
            <header className="h-14 border-b border-[var(--border-color)]/80 bg-[var(--bg-secondary)]/60 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleBackToChat}
                        className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                        title="Back to Chat"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-[var(--border-color)]" />
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)]">
                            <Boxes className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                                    Tools & Capabilities
                                </h1>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 uppercase tracking-wider">
                                    Workspace
                                </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                                Audit, configure, and inspect active skills, runtime plugins, and external MCP servers.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            const event = new CustomEvent('open-settings', { detail: { tab: 'general' } });
                            document.dispatchEvent(event);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer shadow-xs"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Settings</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-primary)]">
                <div className="max-w-7xl mx-auto">
                    <EngineOfflineGuard>
                        <ToolsSettings />
                    </EngineOfflineGuard>
                </div>
            </main>
        </div>
    );
};

export default ToolsWorkspace;

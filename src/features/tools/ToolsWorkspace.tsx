import React, { lazy, Suspense, useState } from 'react';
import { Boxes, Settings } from 'lucide-react';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';
import { ToolsSettings } from '../settings/ToolsSettings';
import { EngineOfflineGuard } from '../settings/EngineOfflineGuard';
import { Tabs } from '../../components/ui/Tabs';
const AvailableTools = lazy(() => import('../extensions/ToolCatalogue').then(module => ({ default: module.ToolCatalogue })));

export const ToolsWorkspace: React.FC<{ embedded?: boolean; defaultKind?: string }> = ({ embedded = false, defaultKind }) => {
    const [section, setSection] = useState<'available' | 'installed'>('available');

    if (embedded) {
        return (
            <Suspense fallback={<p className="p-5 text-xs text-[var(--text-secondary)]">Opening tools catalogue…</p>}>
                <AvailableTools initialKind={defaultKind} />
            </Suspense>
        );
    }
    return (
        <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-[var(--bg-primary)] font-sans">
            <WorkspaceHeader
                icon={Boxes}
                title="Tools & Capabilities"
                description="Audit, configure, and inspect active skills, runtime plugins, and external MCP servers."
                actions={
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'general' } }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer shadow-xs"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Settings</span>
                    </button>
                }
            />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--bg-primary)]">
                <div className="max-w-7xl mx-auto">
                    <Tabs items={[{ id: 'available', label: 'Available' }, { id: 'installed', label: 'Installed' }]} value={section} onChange={setSection} />
                    {section === 'available' ? <div className="py-4"><Suspense fallback={<p>Opening tool catalogue…</p>}><AvailableTools initialKind={defaultKind} /></Suspense></div> :
                    <EngineOfflineGuard>
                        <ToolsSettings />
                    </EngineOfflineGuard>}
                </div>
            </main>
        </div>
    );
};

export default ToolsWorkspace;

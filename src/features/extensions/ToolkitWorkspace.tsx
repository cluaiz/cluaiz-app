import { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ComponentShowcase } from '../../components/ComponentShowcase';
import { ToolsWorkspace } from '../tools';
import { workspaceExtensions } from '../../extensions/bundled';
import { openExtensionWorkspace } from '../../extensions/navigation';
import { InstalledExtensions } from './InstalledExtensions';
import { CatalogueStickyHeader } from './CatalogueStickyHeader';

const DeveloperPreview = lazy(() => import('./DeveloperExtensionWorkspace'));
const Models = lazy(() => import('./ModelCatalogue').then(module => ({ default: module.ModelCatalogue })));

import { TOOLKIT_SECTIONS, toolkitSection, type ToolkitSectionId, toolkitSectionUrl } from './toolkitNavigation';
export { TOOLKIT_SECTIONS, toolkitSection, type ToolkitSectionId };

/** Central Toolkit Hub; contextual drill-down without tabs isolation. */
export function ToolkitWorkspace() {
    const [section, setSection] = useState<ToolkitSectionId>(() => toolkitSection(location.search));
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        const restore = () => { setSection(toolkitSection(location.search)); setPreview(false); };
        window.addEventListener('popstate', restore);
        window.addEventListener('toolkit-section-change', restore);
        return () => {
            window.removeEventListener('popstate', restore);
            window.removeEventListener('toolkit-section-change', restore);
        };
    }, []);

    function select(value: ToolkitSectionId) {
        setPreview(false);
        setSection(value);
        const url = new URL(location.href);
        url.pathname = '/toolkit';
        url.hash = '';
        url.searchParams.set('section', value);
        window.history.pushState(window.history.state, '', url);
        window.dispatchEvent(new CustomEvent('toolkit-section-change', { detail: { section: value } }));
    }

    return (
        <section className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)] text-[var(--text-primary)]">
            {/* Main Content Area — No rigid top header; navigation driven by primary Sidebar */}
            <div className="flex-1 min-h-0 overflow-auto">
                {section === 'models' && (
                    <Suspense fallback={<p className="p-5 text-xs text-[var(--text-secondary)]">Opening models catalogue…</p>}>
                        <Models />
                    </Suspense>
                )}
                {section === 'mcp' && (
                    <ToolsWorkspace defaultKind="mcp" embedded />
                )}
                {section === 'skills' && (
                    <ToolsWorkspace defaultKind="skill" embedded />
                )}
                {section === 'plugins' && (
                    <ToolsWorkspace defaultKind="plugin" embedded />
                )}
                {section === 'components' && (
                    <ComponentShowcase />
                )}
                {section === 'extensions' && (
                    preview && import.meta.env.DEV ? (
                        <div className="flex flex-col h-full min-h-0">
                            <div className="shrink-0">
                                <Button variant="ghost" className="m-3 text-xs" onClick={() => setPreview(false)}>
                                    Back to Extensions
                                </Button>
                            </div>
                            <div className="flex-1 min-h-0">
                                <Suspense fallback={<p className="p-5 text-xs text-[var(--text-secondary)]">Opening developer preview…</p>}>
                                    <DeveloperPreview />
                                </Suspense>
                            </div>
                        </div>
                    ) : (
                        <AppExtensionsSection onOpenPreview={() => setPreview(true)} />
                    )
                )}
            </div>
        </section>
    );
}

function AppExtensionsSection({ onOpenPreview }: { onOpenPreview: () => void }) {
    const [searchQuery, setSearchQuery] = useState('');
    const allBundled = workspaceExtensions.list();
    const filteredBundled = allBundled.filter(entry => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return entry.name.toLowerCase().includes(q) || entry.id.toLowerCase().includes(q);
    });

    return (
        <div className="w-full flex flex-col min-h-full">
            <CatalogueStickyHeader
                title="App Extensions"
                subtitle="Native bundled and installed extensions for the Cluaiz workspace."
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search extensions by name or id…"
                actions={
                    import.meta.env.DEV ? (
                        <Button variant="outline" size="sm" onClick={onOpenPreview} className="text-xs">
                            Developer preview
                        </Button>
                    ) : undefined
                }
            />
            <div className="mx-auto w-full max-w-7xl p-6 space-y-6">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                        Bundled Core Extensions ({filteredBundled.length})
                    </h3>
                    {filteredBundled.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">No bundled extensions match &quot;{searchQuery}&quot;.</p>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-3">
                            {filteredBundled.map(entry => (
                                <Card key={entry.id} className="min-w-0" style={{ padding: 16 }}>
                                    <CardHeader>
                                        <CardTitle className="text-sm font-semibold">{entry.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-1">
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            {entry.id} · v{entry.version} · Included with this App
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {entry.contributes.views.map(view => (
                                                <Button
                                                    key={view.id}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openExtensionWorkspace({ extensionId: entry.id, viewId: view.id })}
                                                    className="text-xs"
                                                >
                                                    Open {view.title}
                                                </Button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
                <InstalledExtensions />
            </div>
        </div>
    );
}

import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ComponentShowcase } from '../../components/ComponentShowcase';
import { ToolsWorkspace } from '../tools';
import { workspaceExtensions } from '../../extensions/bundled';
import { openExtensionWorkspace } from '../../extensions/navigation';
import { InstalledExtensions } from './InstalledExtensions';
import { ToolkitLanding } from './ToolkitLanding';

const DeveloperPreview = lazy(() => import('./DeveloperExtensionWorkspace'));
const Models = lazy(() => import('./ModelCatalogue').then(module => ({ default: module.ModelCatalogue })));

import { TOOLKIT_SECTIONS, toolkitSection, type ToolkitSectionId, toolkitSectionUrl } from './toolkitNavigation';
export { TOOLKIT_SECTIONS, toolkitSection, type ToolkitSectionId };

/** Central Toolkit Hub; landing page first, contextual drill-down without tabs isolation. */
export function ToolkitWorkspace() {
    const [section, setSection] = useState<ToolkitSectionId>(() => toolkitSection(location.search));
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        const restore = () => { setSection(toolkitSection(location.search)); setPreview(false); };
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);

    function select(value: ToolkitSectionId) {
        setPreview(false);
        setSection(value);
        const url = new URL(location.href);
        url.pathname = '/toolkit';
        url.hash = '';
        if (value === 'landing') {
            url.searchParams.delete('section');
        } else {
            url.searchParams.set('section', value);
        }
        window.history.pushState(window.history.state, '', url);
    }

    const currentSectionMeta = TOOLKIT_SECTIONS.find(s => s.id === section);

    return (
        <section className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)] text-[var(--text-primary)]">
            {/* Contextual Navigation Bar (Replaces rigid tabs-based isolation) */}
            <header className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/40 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2.5">
                    {section === 'landing' ? (
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)]">
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </div>
                            <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                                Toolkit Hub
                            </h1>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => select('landing')}
                                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] -ml-2"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Toolkit Hub</span>
                            </Button>
                            <span className="text-[var(--text-muted)] text-xs">/</span>
                            <span className="text-xs font-semibold text-[var(--text-primary)]">
                                {currentSectionMeta?.label || section}
                            </span>
                        </div>
                    )}

                    {/* Quick Category Jump Pills */}
                    <nav className="flex items-center gap-1 overflow-x-auto text-xs" aria-label="Toolkit Quick Jump">
                        {section !== 'landing' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => select('landing')}
                                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                Hub Overview
                            </Button>
                        )}
                        <Button
                            variant={section === 'models' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => select('models')}
                            className="text-xs"
                        >
                            Models
                        </Button>
                        <Button
                            variant={section === 'tools' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => select('tools')}
                            className="text-xs"
                        >
                            Tools & MCP
                        </Button>
                        <Button
                            variant={section === 'extensions' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => select('extensions')}
                            className="text-xs"
                        >
                            Extensions
                        </Button>
                        <Button
                            variant={section === 'components' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => select('components')}
                            className="text-xs"
                        >
                            UI SDK
                        </Button>
                    </nav>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-auto">
                {section === 'landing' && (
                    <ToolkitLanding onSelectSection={(target) => select(target)} />
                )}
                {section === 'models' && (
                    <Suspense fallback={<p className="p-5 text-xs text-[var(--text-secondary)]">Opening models catalogue…</p>}>
                        <Models />
                    </Suspense>
                )}
                {section === 'tools' && (
                    <ToolsWorkspace embedded />
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
                        <div className="mx-auto w-full max-w-7xl p-5 space-y-4">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text-primary)]">App extensions</h2>
                                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                    Native bundled and installed extensions for the Cluaiz workspace.
                                </p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                {workspaceExtensions.list().map(entry => (
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
                            {import.meta.env.DEV && (
                                <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
                                    Developer preview
                                </Button>
                            )}
                            <InstalledExtensions />
                        </div>
                    )
                )}
            </div>
        </section>
    );
}

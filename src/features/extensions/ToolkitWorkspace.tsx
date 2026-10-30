import { lazy, Suspense, useEffect, useState } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ComponentShowcase } from '../../components/ComponentShowcase';
import { ToolsWorkspace } from '../tools';
import { workspaceExtensions } from '../../extensions/bundled';
import { openExtensionWorkspace } from '../../extensions/navigation';
import { InstalledExtensions } from './InstalledExtensions';

const DeveloperPreview = lazy(() => import('./DeveloperExtensionWorkspace'));
const Models = lazy(() => import('./ModelCatalogue').then(module => ({ default: module.ModelCatalogue })));
export const TOOLKIT_SECTIONS = [
    { id: 'models', label: 'Models' },
    { id: 'tools', label: 'Tools' },
    { id: 'extensions', label: 'Extensions' },
    { id: 'components', label: 'UI components & SDK' },
] as const;
type Section = typeof TOOLKIT_SECTIONS[number]['id'];
export function toolkitSection(search: string): Section {
    const value = new URLSearchParams(search).get('section');
    return TOOLKIT_SECTIONS.find(item => item.id === value)?.id ?? 'extensions';
}

/** One navigation home; registries, tool management and component owners are reused. */
export function ToolkitWorkspace() {
    const [section, setSection] = useState(() => toolkitSection(location.search));
    const [preview, setPreview] = useState(false);
    useEffect(() => {
        const restore = () => { setSection(toolkitSection(location.search)); setPreview(false); };
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    function select(value: Section) {
        setPreview(false); setSection(value);
        const url = new URL(location.href);
        url.pathname = '/toolkit'; url.hash = ''; url.searchParams.set('section', value);
        window.history.pushState(window.history.state, '', url);
    }
    return <section className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <header className="shrink-0 border-b border-[var(--border-color)]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2">
                <h1 className="text-sm font-semibold">Toolkit</h1>
                <Tabs variant="underline" className="!border-0" items={[...TOOLKIT_SECTIONS]} value={section} onChange={select} />
            </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto">
            {section === 'models' && <Suspense fallback={<p className="p-4">Opening models…</p>}><Models /></Suspense>}
            {section === 'tools' && <ToolsWorkspace embedded />}
            {section === 'components' && <ComponentShowcase />}
            {section === 'extensions' && (preview && import.meta.env.DEV ? <div className="flex flex-col h-full min-h-0">
                <div className="shrink-0"><Button variant="ghost" className="m-3" onClick={() => setPreview(false)}>Back to Extensions</Button></div>
                <div className="flex-1 min-h-0"><Suspense fallback={<p className="p-4">Opening developer preview…</p>}><DeveloperPreview /></Suspense></div>
            </div> : <div className="p-5 space-y-4">
                <h2 className="font-semibold">App extensions</h2>
                <div className="grid md:grid-cols-2 gap-3">{workspaceExtensions.list().map(entry => <Card key={entry.id}>
                    <CardHeader><CardTitle>{entry.name}</CardTitle></CardHeader><CardContent className="space-y-3">
                        <p className="text-xs text-[var(--text-secondary)]">{entry.id} · {entry.version} · Included with this App</p>
                        {entry.contributes.views.map(view => <Button key={view.id} variant="outline" onClick={() => openExtensionWorkspace({ extensionId: entry.id, viewId: view.id })}>Open {view.title}</Button>)}
                    </CardContent>
                </Card>)}</div>
                {import.meta.env.DEV && <Button onClick={() => setPreview(true)}>Developer preview</Button>}
                <InstalledExtensions />
            </div>)}
        </div>
    </section>;
}

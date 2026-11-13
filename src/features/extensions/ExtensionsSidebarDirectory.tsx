import { useEffect, useState } from 'react';
import { Blocks, Search } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { workspaceExtensions } from '../../extensions/bundled';
import { installedExtensions, type InstalledExtensionRecord } from '../../extensions/packages/store';
import { DirectoryRow } from './DirectoryRow';
import { setToolkitParams, toolkitParam } from './toolkitNavigation';
import { useToolkitUrl } from './useToolkitUrl';

/**
 * Sidebar of Toolkit → App Extensions, as the other sections' sidebars: search and the extensions
 * (bundled with the App, then imported); one opens on its own in the content pane (`package` in the URL).
 */
export function ExtensionsSidebarDirectory() {
    useToolkitUrl();
    const open = toolkitParam('package');
    const [query, setQuery] = useState('');
    const [installed, setInstalled] = useState<InstalledExtensionRecord[]>([]);
    useEffect(() => {
        let active = true;
        const read = () => void installedExtensions.list().then(values => { if (active) setInstalled(values); }).catch(() => {});
        read();
        const unsubscribe = installedExtensions.subscribe(read);
        return () => { active = false; unsubscribe(); };
    }, []);
    const rows = [
        ...workspaceExtensions.list().map(entry => ({ id: entry.id, name: entry.name, version: entry.version, tag: 'BUNDLED' })),
        ...installed.map(record => ({ id: record.id, name: record.name, version: record.version, tag: record.enabled ? undefined : 'OFF' })),
    ];
    const text = query.trim().toLowerCase();
    const shown = rows.filter(row => !text || [row.id, row.name].some(value => value.toLowerCase().includes(text)));

    return (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[var(--bg-secondary)] font-sans">
            <div className="p-3.5 pb-2.5 border-b border-[var(--border-color)] space-y-0.5">
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">App Extensions</h2>
                <p className="text-xs text-[var(--text-muted)]">Extensions bundled with the App and the ones you imported.</p>
            </div>
            <div className="p-2.5 border-b border-[var(--border-color)]">
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search extensions…"
                    leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />} wrapperClassName="w-full" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {shown.map(row => <DirectoryRow key={row.id} title={row.name} subtitle={`${row.id} · v${row.version}`} tag={row.tag}
                    icon={<Blocks className="w-4 h-4 text-blue-400" />} selected={open === row.id}
                    onClick={() => setToolkitParams({ package: open === row.id ? null : row.id })} />)}
                {!shown.length && <p className="p-4 text-center text-xs text-[var(--text-muted)]">
                    {text ? <>No extensions match &ldquo;{query}&rdquo;</> : 'No extensions yet.'}
                </p>}
            </div>
            <div className="p-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>{workspaceExtensions.list().length} bundled</span>
                <span className="text-[10px] font-mono">{installed.length} imported</span>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { installedExtensions, type InstalledExtensionRecord } from '../../extensions/packages/store';
import { openInstalledExtensionWorkspace } from '../../extensions/navigation';
import { ExtensionPackageImport } from './ExtensionPackageImport';
import { ExtensionPermissions } from './ExtensionPermissions';
import type { ExtensionCapability } from '../../extensions/manifest';
import { extensionActivities } from '../../extensions/activities';
import { useSyncExternalStore } from 'react';

type Loaded = NonNullable<Awaited<ReturnType<typeof installedExtensions.read>>>;
export function InstalledExtensions() {
    const activities = useSyncExternalStore(extensionActivities.subscribe, extensionActivities.getSnapshot, extensionActivities.getSnapshot);
    const [records, setRecords] = useState<InstalledExtensionRecord[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<Loaded | null>(null);
    const [grants, setGrants] = useState<readonly ExtensionCapability[]>([]);
    const [removing, setRemoving] = useState<InstalledExtensionRecord | null>(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setError('');
        void installedExtensions.list().then(values => { if (active) setRecords(values); })
            .catch(reason => { if (active) { setRecords(null); setError(String(reason)); } });
        const unsubscribe = installedExtensions.subscribe(() => { if (active) { setEditing(null); setRefresh(value => value + 1); } });
        return () => { active = false; unsubscribe(); };
    }, [refresh]);
    async function run(action: () => Promise<unknown>) {
        setBusy(true); setError('');
        try { await action(); } catch (reason) { setError(String(reason)); }
        finally { setBusy(false); }
    }
    async function configure(record: InstalledExtensionRecord, enabled: boolean) {
        await installedExtensions.configure(record.id, record.revision, record.grants, enabled);
    }
    return <section className="space-y-4" aria-label="Installed extensions">
        <ExtensionPackageImport />
        <h3 className="font-semibold">Installed packages</h3>
        {error && <p role="alert">{error} <Button variant="ghost" onClick={() => setRefresh(value => value + 1)}>Refresh</Button></p>}
        {!records && !error && <p role="status">Reading installed extensions…</p>}
        {records?.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No imported extensions yet.</p>}
        {records?.map(record => <Card key={record.id}><CardHeader><CardTitle>{record.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <p className="text-xs">{record.id} · {record.version} · {record.enabled ? 'Enabled' : 'Disabled'}</p>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={busy || !record.enabled} onClick={() => void run(async () => {
                        const value = await installedExtensions.read(record.id);
                        const view = value?.document.contract.contributes.views[0];
                        if (!view) throw Error('Installed extension view is unavailable.');
                        await openInstalledExtensionWorkspace({ extensionId: record.id, viewId: view.id });
                    })}>Open</Button>
                    <Button variant="outline" disabled={busy || !record.enabled} onClick={() => void run(async () => {
                        const value = await installedExtensions.read(record.id);
                        const view = value?.document.contract.contributes.views[0];
                        if (!value?.record.enabled || !view) throw Error('Installed extension view is unavailable.');
                        extensionActivities.open({ extensionId: record.id, viewId: view.id });
                    })}>Open floating</Button>
                    <Button variant="outline" disabled={busy} onClick={() => void run(() => configure(record, !record.enabled))}>{record.enabled ? 'Disable' : 'Enable'}</Button>
                    <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
                        const value = await installedExtensions.read(record.id);
                        if (!value) throw Error('Extension is no longer installed.');
                        setEditing(value); setGrants(value.record.grants);
                    })}>Permissions</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setRemoving(record)}>Uninstall</Button>
                </div>
                {activities.filter(entry => entry.extensionId === record.id).map(entry => <div key={entry.id} className="flex items-center gap-2 text-sm">
                    <span>{entry.status === 'running' ? 'Floating activity running' : `Stopped: ${entry.error}`}</span>
                    <Button size="sm" variant="ghost" onClick={() => extensionActivities.stop(entry.id)}>Stop floating</Button>
                </div>)}
                {editing?.record.id === record.id && <div className="space-y-3">
                    <ExtensionPermissions document={editing.document} grants={grants} onChange={setGrants} disabled={busy} />
                    <Button disabled={busy} onClick={() => void run(async () => {
                        await installedExtensions.configure(record.id, editing.record.revision, grants, editing.record.enabled); setEditing(null);
                    })}>Save permissions</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
                </div>}
            </CardContent>
        </Card>)}
        <ConfirmationModal open={Boolean(removing) && !busy} title="Uninstall extension?" confirmText="Uninstall" isDestructive
            message="The package will stop and be removed. Existing extension preferences and chats will be kept."
            onCancel={() => setRemoving(null)} onConfirm={() => { const selected = removing; setRemoving(null);
                if (selected) void run(() => installedExtensions.uninstall(selected.id, selected.revision)); }} />
    </section>;
}

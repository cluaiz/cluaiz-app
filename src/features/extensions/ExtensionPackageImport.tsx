import { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { inspectExtensionPackage, type PreparedExtensionPackage } from '../../extensions/packages/admission';
import { installedExtensions } from '../../extensions/packages/store';
import type { ExtensionCapability } from '../../extensions/manifest';
import { ExtensionPermissions } from './ExtensionPermissions';

export function ExtensionPackageImport() {
    const input = useRef<HTMLInputElement>(null);
    const [ready, setReady] = useState<{ prepared: PreparedExtensionPackage; expected: string | null } | null>(null);
    const [grants, setGrants] = useState<readonly ExtensionCapability[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    async function inspect(file: File) {
        setReady(null); setBusy(true); setError(''); setStatus('');
        try {
            const prepared = await inspectExtensionPackage(file);
            const current = await installedExtensions.read(prepared.document.contract.id);
            setGrants(prepared.document.contract.capabilities.required as ExtensionCapability[]);
            setReady({ prepared, expected: current?.record.revision ?? null });
        } catch (reason) { setError(String(reason)); }
        finally { setBusy(false); }
    }
    async function install() {
        if (!ready) return;
        setBusy(true); setError('');
        try {
            const record = await installedExtensions.install(ready.prepared, grants, ready.expected);
            setReady(null); setStatus(`${record.name} ${record.version} installed.`);
        } catch (reason) { setError(String(reason)); }
        finally { setBusy(false); }
    }
    return <Card><CardHeader><CardTitle>Install an extension package</CardTitle></CardHeader>
        <CardContent className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">Choose a .tgz built with the Cluaiz extension devkit. Inspecting a package does not run it. This version accepts on-demand workspace UI extensions.</p>
            <input ref={input} type="file" accept=".tgz,application/gzip" hidden aria-label="Extension package" disabled={busy}
                onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void inspect(file); }} />
            <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Choose package'}</Button>
            {ready && <div className="space-y-3" aria-label="Package review">
                <p className="font-medium">{ready.prepared.document.contract.name} · {ready.prepared.document.contract.version}</p>
                <p className="text-xs break-all">{ready.prepared.document.contract.id}<br />SHA-256: {ready.prepared.packageHash}</p>
                <p className="text-sm">Local unsigned package: the hash checks its bytes, not its publisher. Install only a package whose source you trust.</p>
                <ExtensionPermissions document={ready.prepared.document} grants={grants} onChange={setGrants} disabled={busy} />
                <div className="flex gap-2"><Button disabled={busy} onClick={() => void install()}>{ready.expected ? 'Approve update' : 'Approve installation'}</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setReady(null)}>Cancel</Button></div>
            </div>}
            {error && <p role="alert" className="text-sm">{error}</p>}
            {status && <p role="status" className="text-sm">{status}</p>}
        </CardContent>
    </Card>;
}

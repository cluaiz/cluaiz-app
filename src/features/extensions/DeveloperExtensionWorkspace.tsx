import { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { ExtensionPermissions } from './ExtensionPermissions';
import { EXTENSION_DOCUMENT_LIMIT_BYTES } from '../../extensions/contract';
import type { ExtensionCapability } from '../../extensions/manifest';
import { readDeveloperDocument, type DeveloperDocument } from '../../extensions/surfaces/document';
import { GuestWorkspaceHost } from './GuestWorkspaceHost';

export default function DeveloperExtensionWorkspace() {
    const [document, setDocument] = useState<DeveloperDocument | null>(null);
    const [grants, setGrants] = useState<readonly ExtensionCapability[]>([]);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');
    const selection = useRef(0);
    async function select(file?: File) {
        const current = ++selection.current;
        setError(''); setRunning(false); setDocument(null);
        if (!file) return;
        try {
            if (file.size > EXTENSION_DOCUMENT_LIMIT_BYTES) throw new Error('Extension document is too large.');
            const source = readDeveloperDocument(await file.text());
            if (selection.current !== current) return;
            setDocument(source); setGrants([...source.contract.capabilities.required] as ExtensionCapability[]);
        } catch (reason) { if (selection.current === current) setError(reason instanceof Error ? reason.message : String(reason)); }
    }
    return <section className="flex flex-col h-full min-h-0 gap-3 p-4 text-[var(--text-primary)]">
        <div className="flex items-center justify-between gap-3">
            <div><h1 className="font-semibold">Extension developer preview</h1>
                <p className="text-xs text-[var(--text-secondary)]">Open your own devkit-built dist/index.html. This unsigned developer run does not verify a publisher or install a package.</p></div>
            {running && <Button variant="outline" onClick={() => setRunning(false)}>Close extension</Button>}
        </div>
        {!running && <Card><CardHeader><CardTitle>Open built extension</CardTitle></CardHeader><CardContent>
            <Input type="file" accept=".html" aria-label="Built extension HTML" onChange={event => void select(event.target.files?.[0])} />
            {document && <div className="space-y-3 mt-3">
                <p>{document.contract.name} · {document.contract.id} · {document.contract.version}</p>
                <p className="text-sm">Allow these App capabilities for this run:</p>
                <ExtensionPermissions document={document} grants={grants} onChange={setGrants} />
                <Button onClick={() => setRunning(true)}>Run extension</Button>
            </div>}
            {error && <p role="alert" className="mt-3">{error}</p>}
        </CardContent></Card>}
        {running && document && <GuestWorkspaceHost document={document} grants={grants} />}
    </section>;
}

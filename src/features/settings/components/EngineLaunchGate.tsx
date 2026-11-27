import { useEffect, useState, type ReactNode } from 'react';
import { ipc, isTauri } from '../../../api/client/ipc';
import { AppShell } from '../../../components/layout/AppShell';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';

type LauncherStatus = { state: 'ready'; port: number } | { state: 'missing'; command: string };
const desktop = isTauri();
const launchesEngine = import.meta.env.PROD;

async function engineStatus(install = false): Promise<LauncherStatus | null> {
    if (desktop) return ipc.invoke(install ? 'app_install_engine' : 'app_launch_engine');
    const response = await fetch('/__cluaiz/engine', install ? {
        method: 'POST', headers: { 'X-Cluaiz-Install': 'confirmed' },
    } : undefined);
    if (!install && !response.headers.get('content-type')?.includes('application/json')) return null;
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to start the Engine.');
    return body.state === 'ready' || body.state === 'missing' ? body : null;
}

let startup: Promise<LauncherStatus | null> | undefined;

export function EngineLaunchGate({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(!launchesEngine);
    const [command, setCommand] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(launchesEngine);

    function apply(status: LauncherStatus | null) {
        if (status?.state === 'missing') setCommand(status.command);
        else {
            if (status?.state === 'ready') useConnectionStore.getState().useLauncherPort(status.port);
            setReady(true);
        }
    }

    useEffect(() => {
        if (!launchesEngine) return;
        let mounted = true;
        startup ??= engineStatus();
        startup.then(result => { if (mounted) apply(result); })
            .catch(reason => { if (mounted) setError(String(reason)); })
            .finally(() => { if (mounted) setBusy(false); });
        return () => { mounted = false; };
    }, []);

    async function retry(install: boolean) {
        setBusy(true);
        setError('');
        try { apply(await engineStatus(install)); }
        catch (reason) { setError(String(reason)); }
        finally { setBusy(false); }
    }

    if (ready) return children;
    return <AppShell mainContent={
        <main className="flex h-full flex-1 items-center justify-center p-6 text-[var(--text-primary)]">
            <div className="w-full max-w-lg space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
                <h1 className="text-base font-semibold">{command ? 'Install the Cluaiz Engine' : 'Connect to the Cluaiz Engine'}</h1>
                {command && <>
                    <p className="text-sm text-[var(--text-secondary)]">Run the official install command or let the App run it for you.</p>
                    <pre className="select-text whitespace-pre-wrap break-all rounded bg-[var(--bg-primary)] p-3 text-xs">{command}</pre>
                </>}
                {error && <p role="alert" className="text-sm text-[var(--status-error)]">{error}</p>}
                {busy ? <p role="status" className="text-sm text-[var(--text-secondary)]">{command ? 'Waiting for the installer or Engine…' : 'Checking the Engine…'}</p> :
                    <div className="flex flex-wrap gap-2">
                        {command && <button type="button" className="rounded-lg bg-[var(--accent-color)] px-3 py-2 text-sm text-black" onClick={() => void retry(true)}>Install for me</button>}
                        <button type="button" className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm" onClick={() => void retry(false)}>Check again</button>
                    </div>}
            </div>
        </main>
    } />;
}

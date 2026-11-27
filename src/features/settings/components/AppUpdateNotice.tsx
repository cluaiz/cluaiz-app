import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Download } from 'lucide-react';
import { isTauri } from '../../../api/client/ipc';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Tooltip } from '../../../components/ui/tooltip';
import { checkAppRelease, type AppRelease } from '../appReleases';

export function AppUpdateNotice() {
    const [release, setRelease] = useState<AppRelease>();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isTauri()) return;
        const controller = new AbortController();
        void getVersion().then(version => checkAppRelease(version, controller.signal))
            .then(candidate => { if (!controller.signal.aborted) setRelease(candidate); })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    if (!release) return null;
    return <>
        <Tooltip title={`Update available · v${release.version}`} position="right">
            <button type="button" aria-label="View App update" onClick={() => setOpen(true)}
                className="rounded-xl p-2 text-[var(--accent-color)] hover:bg-[var(--bg-tertiary)]">
                <Download className="h-5 w-5" />
            </button>
        </Tooltip>
        {open && createPortal(<Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader><DialogTitle>Cluaiz App v{release.version}</DialogTitle></DialogHeader>
                <div className="max-h-[45vh] overflow-auto whitespace-pre-wrap px-4 text-sm text-[var(--text-secondary)]">
                    {release.notes || 'Release notes are available on GitHub.'}
                </div>
                {error && <p role="alert" className="px-4 text-sm text-[var(--status-error)]">{error}</p>}
                <DialogFooter>
                    <button type="button" onClick={() => setOpen(false)}>Close</button>
                    <button type="button" onClick={() => {
                        void openUrl(release.url).catch(() => setError('Could not open the GitHub release.'));
                    }}>Open GitHub release</button>
                </DialogFooter>
            </DialogContent>
        </Dialog>, document.body)}
    </>;
}

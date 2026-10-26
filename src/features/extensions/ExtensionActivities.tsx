import { useCallback, useRef, useSyncExternalStore } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { extensionActivities, type ExtensionActivitiesStore, type ExtensionActivity } from '../../extensions/activities';
import { isTauri } from '../../api/client/ipc';
import { Button } from '../../components/ui/Button';
import { InstalledExtensionWorkspace } from './InstalledExtensionWorkspace';
import type { ExtensionServices } from '../../extensions/sdk';
import type { StateStorage } from '../../extensions/storage';

interface Props { manager?: ExtensionActivitiesStore; services?: ExtensionServices; stateStorage?: StateStorage; }
/** Mounted once outside route selection: changing the main screen retains activity. */
export function ExtensionActivities({ manager = extensionActivities, services, stateStorage }: Props) {
    const entries = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
    return <>{entries.map(entry => <Activity key={entry.id} entry={entry} manager={manager} services={services} stateStorage={stateStorage} />)}</>;
}
function Activity({ entry, manager, services, stateStorage }: Props & { entry: ExtensionActivity; manager: ExtensionActivitiesStore }) {
    const close = useCallback(() => manager.stop(entry.id), [manager, entry.id]);
    const fail = useCallback((message: string) => manager.fail(entry.id, message), [manager, entry.id]);
    const controls = useDragControls();
    const constraints = useRef<HTMLDivElement>(null);
    const native = isTauri();
    const guest = entry.status === 'running' ? <InstalledExtensionWorkspace extensionId={entry.extensionId} viewId={entry.viewId}
        services={services} stateStorage={stateStorage} floating onClosed={close} onError={fail} /> : null;
    if (native && entry.status === 'running') return <div className="sr-only" aria-label="Native floating extension host">{guest}</div>;
    return <div ref={constraints} className="fixed inset-4 z-40 pointer-events-none"><motion.section role="region" aria-label={`Floating extension ${entry.extensionId}`} drag dragConstraints={constraints} dragControls={controls} dragListener={false} dragMomentum={false}
        className="absolute right-0 bottom-0 pointer-events-auto flex flex-col min-h-40 min-w-60 max-w-full max-h-full w-[480px] h-[640px] resize overflow-hidden border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-2 p-2 border-b border-[var(--border-color)] cursor-move touch-none" onPointerDown={event => {
            if (!(event.target as HTMLElement).closest('button')) controls.start(event);
        }}>
            <span className="text-sm truncate">{entry.extensionId}</span>
            <Button size="sm" variant="ghost" onClick={close}>Close extension</Button>
        </header>
        {entry.status === 'failed' ? <p role="alert" className="p-3 text-sm">Extension stopped: {entry.error}</p> : guest}
    </motion.section></div>;
}

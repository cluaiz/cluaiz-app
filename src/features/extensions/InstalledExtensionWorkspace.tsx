import { useEffect, useState } from 'react';
import { installedExtensions, type InstalledExtensionStore } from '../../extensions/packages/store';
import type { ExtensionRoute } from '../../extensions/routes';
import type { ExtensionServices } from '../../extensions/sdk';
import type { StateStorage } from '../../extensions/storage';
import { GuestWorkspaceHost } from './GuestWorkspaceHost';

type Loaded = NonNullable<Awaited<ReturnType<InstalledExtensionStore['read']>>>;
/** Every receipt change removes the old session before reading its replacement. */
export function InstalledExtensionWorkspace({ extensionId, viewId, services, stateStorage, store = installedExtensions, floating = false, onClosed, onError }: ExtensionRoute & {
    services?: ExtensionServices; stateStorage?: StateStorage; store?: InstalledExtensionStore;
    floating?: boolean; onClosed?: () => void; onError?: (message: string) => void;
}) {
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let generation = 0;
        const refresh = () => {
            const current = ++generation;
            setLoaded(null); setError('');
            void store.read(extensionId).then(value => {
                if (generation !== current) return;
                if (!value || !value.record.enabled) throw Error('Extension is not installed or is disabled.');
                if (!value.document.contract.contributes.views.some(view => view.id === viewId)) throw Error('Installed extension view is unavailable.');
                setLoaded(value);
            }).catch(reason => { if (generation === current) setError(String(reason)); });
        };
        const unsubscribe = store.subscribe(id => { if (!id || id === extensionId) refresh(); }); refresh();
        return () => { generation++; unsubscribe(); };
    }, [extensionId, viewId, store]);
    useEffect(() => { if (error) onError?.(error); }, [error, onError]);
    if (error) return <p role="alert" className="p-5">{error}</p>;
    if (!loaded) return <p role="status" className="p-5">Opening installed extension…</p>;
    return <GuestWorkspaceHost key={loaded.record.revision} document={loaded.document} grants={loaded.record.grants} services={services} stateStorage={stateStorage}
        floating={floating} onClosed={onClosed} onError={onError} />;
}

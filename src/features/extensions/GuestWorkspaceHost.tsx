import { useEffect, useRef, useState } from 'react';
import { createExtensionSession, type ExtensionServices } from '../../extensions/sdk';
import { extensionServices } from '../../extensions/services';
import { documentStateStorage, type StateStorage } from '../../extensions/storage';
import { EXTENSION_HOST_API, type ExtensionCapability } from '../../extensions/manifest';
import type { DeveloperDocument } from '../../extensions/surfaces/document';
import { isTauri } from '../../api/client/ipc';

interface Props {
    document: DeveloperDocument;
    grants: readonly ExtensionCapability[];
    services?: ExtensionServices;
    stateStorage?: StateStorage;
    floating?: boolean;
    onClosed?: () => void;
    onError?: (message: string) => void;
}

/** Host-admitted immutable document; all services stay behind this owned session. */
export function GuestWorkspaceHost({ document: source, grants, services = extensionServices, stateStorage, floating = false, onClosed, onError }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const view = element.ownerDocument.defaultView;
        if (!view) { setError('Extension host window is unavailable.'); return; }
        let active = true;
        let stopped = false;
        let closeSurface: (() => void) | undefined;
        const { contract } = source;
        if (contract.capabilities.required.some(cap => !grants.includes(cap as ExtensionCapability))) {
            setError('A required extension capability was not granted.'); return;
        }
        const session = createExtensionSession({ hub_type: 'extension', id: contract.id, name: contract.name,
            version: contract.version, host_api: EXTENSION_HOST_API, capabilities: source.requested,
            contributes: { views: contract.contributes.views.map(({ id, title }) => ({ id, title, slot: 'workspace' })) } },
        grants, services, stateStorage ?? documentStateStorage(view));
        const failed = (reason: Error) => {
            stopped = true;
            session.dispose(); closeSurface?.();
            if (active) { setError(reason.message); onError?.(reason.message); }
        };
        setError(null);
        const open = isTauri()
            ? import('../../extensions/surfaces/native').then(({ openNativeSurface }) => openNativeSurface(element, source, session, failed, { floating,
                onClosed: onClosed ? () => { session.dispose(); if (active) onClosed(); } : undefined }))
            : import('../../extensions/surfaces/web').then(({ openBrowserSurface }) => openBrowserSurface(element, source, session, failed));
        void open.then(surface => {
            closeSurface = surface.close;
            if (!active || stopped) surface.close();
        }).catch(reason => failed(reason instanceof Error ? reason : new Error(String(reason))));
        return () => { active = false; closeSurface?.(); session.dispose(); };
    }, [source, grants, services, stateStorage, floating, onClosed, onError]);
    return <div className="relative flex-1 min-h-0 h-full" ref={container} aria-label="Extension workspace">
        {error && <div role="alert" className="p-4 text-[var(--text-primary)]">Extension stopped: {error}</div>}
    </div>;
}

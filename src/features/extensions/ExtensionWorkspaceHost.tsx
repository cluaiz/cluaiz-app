import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ExtensionChatWorkspace } from './ExtensionChatWorkspace';
import { workspaceExtensions } from '../../extensions/bundled';
import { createExtensionSession } from '../../extensions/sdk';
import { extensionServices } from '../../extensions/services';
import type { ExtensionModule, ExtensionViewProps, WorkspaceExtensionRegistry } from '../../extensions/registry';
import type { ExtensionSDK, ExtensionServices } from '../../extensions/sdk';
import type { StateStorage } from '../../extensions/storage';
import { documentStateStorage } from '../../extensions/storage';
import type { ExtensionRoute } from '../../extensions/routes';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { Button } from '../../components/ui/Button';
import { InstalledExtensionWorkspace } from './InstalledExtensionWorkspace';

interface Props extends ExtensionRoute {
    registry?: WorkspaceExtensionRegistry;
    services?: ExtensionServices;
    stateStorage?: StateStorage;
}
interface Ready { View: React.ComponentType<ExtensionViewProps>; sdk: ExtensionSDK; withChat: boolean; }
const DeveloperExtensionWorkspace = lazy(() => import('./DeveloperExtensionWorkspace'));

export function ExtensionWorkspaceHost({ extensionId, viewId, registry = workspaceExtensions, services, stateStorage }: Props) {
    if (extensionId === 'developer.preview' && viewId === 'main' && import.meta.env.DEV) {
        return <Suspense fallback={<p role="status">Opening extension developer preview…</p>}><DeveloperExtensionWorkspace /></Suspense>;
    }
    return <ViewFailureBoundary key={`${extensionId}/${viewId}`}>
        {registry === workspaceExtensions && !registry.get(extensionId)
            ? <InstalledExtensionWorkspace extensionId={extensionId} viewId={viewId} services={services} stateStorage={stateStorage} />
            : <MountedWorkspace extensionId={extensionId} viewId={viewId} registry={registry} services={services} stateStorage={stateStorage} />}
    </ViewFailureBoundary>;
}

function MountedWorkspace({ extensionId, viewId, registry = workspaceExtensions, services = extensionServices, stateStorage }: Props) {
    const [ready, setReady] = useState<Ready | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        let disposeSession: (() => void) | undefined;
        let disposeModule: (() => void) | undefined;
        setReady(null);
        setError(null);
        registry.loadView(extensionId, viewId).then(async ({ entry, module, View }) => {
            if (!active) return;
            // Lazy storage access: unavailable storage becomes a real SDK operation error, not a render crash.
            const storage = stateStorage || documentStateStorage(window);
            const session = createExtensionSession(entry.manifest, entry.grants, services, storage);
            disposeSession = session.dispose;
            const cleanup: Awaited<ReturnType<NonNullable<ExtensionModule['activate']>>> = await module.activate?.(session.sdk);
            if (!active) {
                if (typeof cleanup === 'function') cleanup();
                session.dispose();
                return;
            }
            disposeModule = typeof cleanup === 'function' ? cleanup : undefined;
            setReady({ View, sdk: session.sdk, withChat: entry.manifest.contributes.views.find(view => view.id === viewId)?.layout === 'with-chat' });
        }).catch(reason => {
            disposeSession?.();
            if (active) setError(reason instanceof Error ? reason.message : 'Workspace activation failed.');
        });
        return () => {
            active = false;
            disposeSession?.();
            try { disposeModule?.(); } catch (reason) { console.error('Workspace cleanup failed', reason); }
        };
    }, [extensionId, viewId, registry, services, stateStorage]);
    if (error) return <WorkspaceFailure message={error} />;
    if (!ready) return <div className="flex h-full items-center justify-center text-[var(--text-secondary)]" role="status">Opening workspace…</div>;
    const workspace = <ready.View sdk={ready.sdk} />;
    return ready.withChat ? <ExtensionChatWorkspace View={ready.View} sdk={ready.sdk} /> : workspace;
}

function WorkspaceFailure({ message }: { message: string }) {
    return <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-[var(--text-primary)]" role="alert">
        <p>Workspace could not open.</p>
        <p className="max-w-lg text-sm text-[var(--text-secondary)]">{message}</p>
        <Button onClick={() => useLayoutStore.getState().setActiveView('chat')}>Back to chat</Button>
    </div>;
}

class ViewFailureBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
    state: { error: string | null } = { error: null };
    static getDerivedStateFromError(error: unknown) { return { error: error instanceof Error ? error.message : 'Workspace failed.' }; }
    render() { return this.state.error ? <WorkspaceFailure message={this.state.error} /> : this.props.children; }
}

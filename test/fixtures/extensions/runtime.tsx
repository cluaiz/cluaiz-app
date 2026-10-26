import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../../src/core/ThemeProvider';
import { useThemeStore } from '../../../src/store/ui/useThemeStore';
import { Button } from '../../../src/components/ui/Button';
import { GuestWorkspaceHost } from '../../../src/features/extensions/GuestWorkspaceHost';
import { readDeveloperDocument, type DeveloperDocument } from '../../../src/extensions/surfaces/document';
import { ExtensionState, documentStateStorage } from '../../../src/extensions/storage';
import type { ExtensionServices } from '../../../src/extensions/sdk';
import type { ExtensionCapability } from '../../../src/extensions/manifest';
import { isTauri } from '../../../src/api/client/ipc';
import { invoke } from '@tauri-apps/api/core';
import { inspectExtensionPackage } from '../../../src/extensions/packages/admission';
import { readPackageArchive } from '../../../src/extensions/packages/archive';
import { installedExtensions } from '../../../src/extensions/packages/store';
import { BrowserPackageStorage } from '../../../src/extensions/packages/browser';
import { InstalledExtensionWorkspace } from '../../../src/features/extensions/InstalledExtensionWorkspace';
import { InstalledExtensions } from '../../../src/features/extensions/InstalledExtensions';
import { packageFixture } from './package-fixture';
import { createExtensionSession } from '../../../src/extensions/sdk';
import { openBrowserSurface } from '../../../src/extensions/surfaces/web';
import { ExtensionActivities } from '../../../src/features/extensions/ExtensionActivities';
import { extensionActivities } from '../../../src/extensions/activities';
import { desktopLifecycle, desktopLifecycleAPI, BACKGROUND_PREFERENCE } from '../../../src/core/desktopLifecycle';
import { DesktopBackgroundSetting } from '../../../src/features/settings/DesktopBackgroundSetting';
import '../../../src/styles/index.css';

const report = new URLSearchParams(location.search).get('report');
const installed = new URLSearchParams(location.search).has('installed');
const floating = new URLSearchParams(location.search).has('floating');
const background = new URLSearchParams(location.search).has('background');
const DESKTOP_STAGE = 'cluaiz-owned-background-acceptance-stage';
if (!report || !/^http:\/\/127\.0\.0\.1:\d+$/.test(report)) throw new Error('Owned loopback report URL required.');
const grants: readonly ExtensionCapability[] = ['storage.read', 'storage.write', 'models.list', 'audio.speech', 'ai.stream'];
let providerCalls = 0;
let binaryCalls = 0;
const unavailable = async (): Promise<never> => { throw new Error('Test-owned model provider unavailable.'); };
const services: ExtensionServices = { listModels: async () => { providerCalls++; return unavailable(); },
    generate: unavailable, stream: async (request, onEvent, signal) => {
        onEvent({ type: 'text', text: 'transport:' + request.input });
        await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(new DOMException('Controlled stream cancelled.', 'AbortError')); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1500);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
        });
        onEvent({ type: 'text', text: 'transport:end' });
    }, speak: async () => { binaryCalls++; return new Blob([Uint8Array.of(1, 2, 3, 255)], { type: 'application/octet-stream' }); }, transcribe: unavailable };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until<T>(read: () => T | null | undefined, name: string): Promise<T> {
    for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await pause(100); }
    throw new Error('Timed out: ' + name + '; alerts=' + [...window.document.querySelectorAll('[role="alert"]')].map(node => node.textContent).join(' | '));
}
function requireCheck(value: unknown, name: string) { if (!value) throw new Error(name); }

function Runtime() {
    const [source, setSource] = useState<DeveloperDocument | null>(null);
    const [mounted, setMounted] = useState(false);
    const [packagePanel, setPackagePanel] = useState(installed);
    const [status, setStatus] = useState('Preparing actual runtime acceptance…');
    useEffect(() => {
        let active = true;
        void (async () => {
            const html = await (await fetch(report + '/document')).text();
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html))))
                .map(byte => byte.toString(16).padStart(2, '0')).join('');
            if (background) {
                await desktopLifecycle.initialize();
                const status = await desktopLifecycleAPI.status();
                requireCheck(status.trayReady, 'Native tray did not initialize');
                if (localStorage.getItem(DESKTOP_STAGE) === 'close-off') {
                    requireCheck(!status.backgroundEnabled && status.mainVisible && !status.quitting, 'Persisted false did not restore ordinary close policy after full restart');
                    const id = readDeveloperDocument(html).contract.id;
                    const leftover = await installedExtensions.read(id);
                    requireCheck(leftover, 'Quit test did not leave its controlled installed package');
                    await installedExtensions.uninstall(id, leftover!.record.revision);
                    localStorage.removeItem(DESKTOP_STAGE);
                    await fetch(report + '/result', { method: 'POST', body: JSON.stringify({ passed: true, kind: 'desktop', phase: 2, digest,
                        checks: ['same-profile restart reads persisted false', 'ordinary close requested'], scope: 'Native close/off process exit observed by runner' }) });
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    void getCurrentWindow().close(); return;
                }
                requireCheck(status.backgroundEnabled, 'Existing default preference did not synchronize');
            }
            const document = readDeveloperDocument(html);
            const mount = () => {
                if (floating) extensionActivities.open({ extensionId: document.contract.id, viewId: document.contract.contributes.views[0].id });
                else setMounted(true);
            };
            const unmount = () => {
                if (floating) for (const entry of extensionActivities.getSnapshot()) extensionActivities.stop(entry.id);
                else setMounted(false);
            };
            let archive: Blob | undefined;
            let installedVersion: string | undefined;
            if (installed) {
                archive = await (await fetch(report + '/package')).blob();
                await until(() => window.document.querySelector<HTMLInputElement>('input[aria-label="Extension package"]'), 'package chooser');
                const picker = window.document.querySelector<HTMLInputElement>('input[aria-label="Extension package"]')!;
                const transfer = new DataTransfer(); transfer.items.add(new File([archive], 'fixture.tgz', { type: 'application/gzip' }));
                picker.files = transfer.files; picker.dispatchEvent(new Event('change', { bubbles: true }));
                const approve = await until(() => [...window.document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Approve installation'), 'inert package review');
                requireCheck(!(await installedExtensions.read(document.contract.id)), 'Review executed installation without approval');
                approve.click();
                await until(() => window.document.querySelector('[role="status"]')?.textContent?.includes('installed.'), 'explicit package install');
                // Optional permissions begin off and are edited through the same store.
                const current = await installedExtensions.read(document.contract.id);
                requireCheck(current && current.record.grants.length === 2, 'Import auto-granted optional permissions');
                const permissions = [...window.document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Permissions');
                requireCheck(permissions, 'Installed card lacks permission editing'); permissions!.click();
                await until(() => window.document.querySelector('[role="switch"][aria-label="models.list"]'), 'permission editor');
                for (const cap of grants.filter(cap => !current!.record.grants.includes(cap))) {
                    (window.document.querySelector(`[role="switch"][aria-label="${cap}"]`) as HTMLElement).click();
                    await pause(30);
                }
                [...window.document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Save permissions')!.click();
                await until(() => ![...window.document.querySelectorAll('button')].some(button => button.textContent === 'Save permissions'), 'save permissions');
                installedVersion = current!.record.version;
                setPackagePanel(false);
            }
            let rejectedDocuments = 0;
            for (const change of ['missing', 'runtime', 'permission', 'layout']) {
                const invalid = new DOMParser().parseFromString(html, 'text/html');
                const metadata = invalid.querySelector('#cluaiz-extension-manifest')!;
                if (change === 'missing') metadata.remove();
                else {
                    const value = JSON.parse(metadata.textContent!);
                    if (change === 'runtime') value.app.runtime.kind = 'native-worker';
                    else if (change === 'permission') value.app.capabilities.required = ['network.fetch'];
                    else value.app.contributes.views[0].layout = 'with-chat';
                    metadata.textContent = JSON.stringify(value);
                }
                try { readDeveloperDocument(invalid.documentElement.outerHTML); }
                catch { rejectedDocuments++; }
            }
            requireCheck(rejectedDocuments === 4 && providerCalls === 0, 'Invalid developer metadata executed');
            localStorage.setItem('cluaiz-runtime-host-only', 'Owned host marker, not extension state');
            const state = new ExtensionState(document.contract.id, documentStateStorage(window));
            for (const key of ['probe.ready', 'probe.command', 'probe.result', 'probe.literal', 'draft']) state.remove(key);
            useThemeStore.setState({ theme: 'light', lightAccent: '#2563eb', darkAccent: '#4f46e5', fontFamily: 'mono' });
            setSource(document);
            if (floating) {
                setPackagePanel(true);
                const open = await until(() => [...window.document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Open floating'), 'Toolkit floating action');
                open.click();
                await until(() => extensionActivities.getSnapshot().length === 1, 'Toolkit opens floating activity');
                setPackagePanel(false);
            } else mount();
            type Ready = { kind: string; instance: string; saved: string | null; hostDomBlocked: boolean; hostStorageBlocked: boolean;
                denied: Record<string, string>; unavailable: string; bytes: number[]; mime: string; scopedStop: boolean; literalRoundtrip: boolean };
            const first = await until(() => state.get('probe.ready') as Ready | null, 'extension handshake/storage');
            requireCheck(first.kind === (isTauri() ? 'desktop' : 'web'), 'Actual host kind mismatch');
            requireCheck(first.hostDomBlocked, 'Guest accessed host DOM');
            requireCheck(first.hostStorageBlocked, 'Guest accessed raw host browser storage');
            requireCheck(first.scopedStop, 'Stopping one stream affected its sibling or delivered stopped events');
            requireCheck(first.literalRoundtrip, 'Valid JSON keys changed type across the native wire');
            if (floating) {
                history.pushState(null, '', '/toolkit?section=components');
                window.dispatchEvent(new PopStateEvent('popstate'));
                await pause(250);
                requireCheck(extensionActivities.getSnapshot().length === 1 && (state.get('probe.ready') as Ready)?.instance === first.instance, 'Route change replaced floating activity');
            }
            requireCheck(JSON.stringify(first.bytes) === '[1,2,3,255]' && first.mime === 'application/octet-stream', 'Binary bytes changed across the real bridge');
            requireCheck(first.unavailable.includes('SERVICE_FAILED'), 'Unavailable provider did not fail through bridge');
            if (isTauri()) requireCheck(Object.keys(first.denied).length === 13 && Object.values(first.denied)
                .every(value => value.includes('not allowed')), 'Guest raw native operation escaped ACL');
            const snapshots: unknown[] = [];
            for (const [id, theme] of [[1, 'light'], [2, 'pixel']] as const) {
                useThemeStore.getState().setTheme(theme);
                await pause(200);
                state.set('probe.command', { id, action: id === 1 ? 'edit' : 'measure', draft: 'Retained extension draft', escape: report + '/escape' });
                type Snapshot = { id: number; draft: string; count: string; background: string; radius: string; font: string; networkBlocked: boolean };
                const snapshot = await until(() => { const value = state.get('probe.result') as Snapshot | null; return value?.id === id ? value : null; }, 'rendered theme ' + theme);
                // The App button transitions its CSS; a background browser tab can
                // defer that transition until its first style read. Require actual
                // convergence instead of assuming a fixed wall-clock delay painted it.
                await until(() => {
                    const host = getComputedStyle(window.document.querySelector('[data-testid="host-primary"]')!);
                    return snapshot.background === host.backgroundColor && snapshot.radius === host.borderRadius
                        && snapshot.font === host.fontFamily ? true : null;
                }, 'host/guest computed theme convergence: ' + JSON.stringify({ theme, guest: snapshot }));
                requireCheck(snapshot.draft === 'Retained extension draft' && snapshot.count === 'Count 1', 'Local UI state reset during theme change');
                requireCheck(snapshot.networkBlocked, 'Guest fetch escaped resource policy');
                snapshots.push(snapshot);
            }
            const backgroundChecks: string[] = [];
            if (background) {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().close();
                let hidden = false;
                for (let attempt = 0; attempt < 100; attempt++) {
                    hidden = !(await desktopLifecycleAPI.status()).mainVisible;
                    if (hidden) break; await pause(100);
                }
                requireCheck(hidden, 'Main close destroyed or failed to hide the window');
                state.set('probe.command', { id: 100, action: 'measure' });
                await until(() => (state.get('probe.result') as { id?: number } | null)?.id === 100, 'guest SDK operation while main is hidden');
                requireCheck((state.get('probe.ready') as Ready)?.instance === first.instance, 'Hide replaced the running guest');
                backgroundChecks.push('main close hides', 'guest SDK remains usable while main hidden', 'same guest instance survives hide');
                await desktopLifecycleAPI.show();
                requireCheck((await desktopLifecycleAPI.status()).mainVisible, 'Show did not restore the same main window');
                const toggle = window.document.querySelector<HTMLElement>('[aria-label="Desktop background settings"] [role="switch"]');
                requireCheck(toggle, 'Actual background setting UI is missing'); toggle!.click();
                await until(() => desktopLifecycle.getSnapshot().ready && !desktopLifecycle.getSnapshot().busy && !desktopLifecycle.getSnapshot().enabled, 'background toggle acknowledgement');
                requireCheck(localStorage.getItem(BACKGROUND_PREFERENCE) === 'false', 'Background UI did not persist false');
                backgroundChecks.push('Show restores main', 'existing setting UI persists acknowledged false');
            }
            if (floating) {
                if (isTauri()) {
                    const label = first.denied.get_session_token.match(/webview "(extension-[a-f0-9]+)"/)?.[1];
                    requireCheck(label, 'Missing floating WebView caller');
                    const { Window } = await import('@tauri-apps/api/window');
                    const native = await Window.getByLabel(label!);
                    requireCheck(native, 'Floating WebView has no separate native window');
                    // Same native close-request path as the OS X button; this is
                    // main's existing core window permission, not guest authority.
                    await native!.close();
                    await until(() => extensionActivities.getSnapshot().length === 0, 'native window close revokes activity');
                } else {
                    [...window.document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Close extension')!.click();
                }
            }
            unmount(); await pause(250);
            let closedSurfaceRevoked = !window.document.querySelector('iframe');
            if (isTauri()) {
                const label = first.denied.get_session_token.match(/webview "(extension-[a-f0-9]+)"/)?.[1];
                requireCheck(label, 'Missing native caller label in actual ACL denial');
                closedSurfaceRevoked = false;
                try { await invoke('extension_surface_resize', { label, bounds: { x: 0, y: 0, width: 100, height: 100 } }); }
                catch (error) { closedSurfaceRevoked = String(error).includes('surface is closed'); }
            }
            requireCheck(closedSurfaceRevoked, 'Old native surface identity remained usable after close');
            state.remove('probe.ready'); state.remove('probe.command'); state.remove('probe.result');
            mount();
            const second = await until(() => state.get('probe.ready') as Ready | null, 'reopen');
            requireCheck(first.instance !== second.instance, 'Reopen reused an old instance identity');
            requireCheck(second.saved === 'Retained extension draft', 'Reopen did not use the existing saved-state owner');
            requireCheck(second.scopedStop, 'Reopened stream ownership failed');
            requireCheck(second.literalRoundtrip, 'Reopened JSON roundtrip failed');
            requireCheck(providerCalls === 2, 'Unexpected provider execution count');
            requireCheck(binaryCalls === 2, 'Unexpected binary provider execution count');
            const packageChecks: string[] = [];
            if (installed && archive) {
                const id = document.contract.id;
                const requirePackage = (value: unknown, name: string) => { requireCheck(value, name); packageChecks.push(name); };
                const current = (await installedExtensions.read(id))!;
                requirePackage(current.record.version === installedVersion, 'installed bytes survive reopen');
                if (!isTauri()) {
                    const reopened = new BrowserPackageStorage();
                    requirePackage((await reopened.read(id))?.record.revision === current.record.revision, 'new IndexedDB connection reads installed receipt');
                    await reopened.close();
                }
                const files = await readPackageArchive(archive);
                if (floating) {
                    const siblingId = 'fixture.sibling';
                    const siblingPackage = await inspectExtensionPackage(await packageFixture(files, '0.1.0', false, siblingId));
                    const siblingRecord = await installedExtensions.install(siblingPackage, grants, null);
                    const siblingState = new ExtensionState(siblingId, documentStateStorage(window));
                    const siblingActivity = extensionActivities.open({ extensionId: siblingId, viewId: 'main' });
                    await until(() => siblingState.get('probe.ready'), 'second floating activity');
                    requirePackage((state.get('probe.ready') as Ready)?.instance === second.instance, 'installing a sibling preserves original instance');
                    await installedExtensions.configure(siblingId, siblingRecord.revision, grants, false);
                    await until(() => extensionActivities.getSnapshot().find(entry => entry.id === siblingActivity)?.status === 'failed', 'sibling disable revocation');
                    requirePackage((state.get('probe.ready') as Ready)?.instance === second.instance, 'disabling a sibling leaves original running');
                    extensionActivities.stop(siblingActivity);
                    const stoppedSibling = (await installedExtensions.read(siblingId))!;
                    await installedExtensions.uninstall(siblingId, stoppedSibling.record.revision);
                    requirePackage((state.get('probe.ready') as Ready)?.instance === second.instance, 'sibling uninstall preserves original session');
                }
                let rejected = false;
                try { await inspectExtensionPackage(await packageFixture(files, '0.2.0', true)); } catch { rejected = true; }
                requirePackage(rejected && (await installedExtensions.read(id))?.record.revision === current.record.revision, 'bad update preserves installed release');
                await installedExtensions.configure(id, current.record.revision, grants, false);
                await until(() => window.document.querySelector('[role="alert"]')?.textContent?.includes('disabled'), 'disable revokes mounted workspace');
                requirePackage(!window.document.querySelector('iframe'), 'disabled browser document removed');
                const disabled = (await installedExtensions.read(id))!;
                state.remove('probe.ready');
                await installedExtensions.configure(id, disabled.record.revision, grants, true);
                if (floating) { unmount(); mount(); }
                const third = await until(() => state.get('probe.ready') as Ready | null, 'enabled installed workspace');
                requirePackage(third.instance !== second.instance, 'enable creates a fresh SDK session');
                const before = (await installedExtensions.read(id))!;
                state.remove('probe.ready');
                const update = await inspectExtensionPackage(await packageFixture(files, '0.2.0'));
                const updated = await installedExtensions.install(update, grants, before.record.revision);
                const fourth = await until(() => state.get('probe.ready') as Ready | null, 'updated installed workspace');
                requirePackage(fourth.instance !== third.instance && updated.version === '0.2.0', 'approved update replaces instance and version');
                rejected = false;
                try { await installedExtensions.configure(id, before.record.revision, grants, true); } catch { rejected = true; }
                requirePackage(rejected, 'stale mutation is rejected');
                setPackagePanel(true);
                const remove = await until(() => [...window.document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Uninstall'), 'installed uninstall action');
                remove.click();
                await until(() => window.document.querySelector('.ui-modal'), 'uninstall confirmation');
                requirePackage(Boolean(await installedExtensions.read(id)), 'uninstall requires explicit confirmation');
                [...window.document.querySelectorAll<HTMLButtonElement>('.ui-modal button')].find(button => button.textContent === 'Uninstall')!.click();
                await until(() => window.document.querySelector('[role="alert"]')?.textContent?.includes('not installed'), 'uninstall revokes mounted workspace');
                requirePackage((await installedExtensions.read(id)) === null && !window.document.querySelector('iframe'), 'uninstall removes receipt and active document');
                requirePackage(state.get('draft') === 'Retained extension draft', 'uninstall preserves existing preference owner');
                setPackagePanel(false);
            }
            unmount(); await pause(150);
            if (installed && !isTauri()) {
                // Attempt actual self-navigation, not fetch; only this owned local
                // report listener can receive it. The runner counts escaped requests.
                const parsed = new DOMParser().parseFromString(document.html, 'text/html');
                const script = parsed.createElement('script');
                script.src = 'data:text/javascript;base64,' + btoa('setTimeout(()=>location.replace(' + JSON.stringify(report + '/escape') + '),200)');
                parsed.head.append(script);
                const container = window.document.createElement('div'); window.document.body.append(container);
                const session = createExtensionSession({ hub_type: 'extension', id: document.contract.id,
                    name: document.contract.name, version: document.contract.version, host_api: 1,
                    capabilities: [], contributes: { views: [{ id: 'main', title: 'Probe', slot: 'workspace' }] } }, [], services, documentStateStorage(window));
                const surface = openBrowserSurface(container, readDeveloperDocument(parsed.documentElement.outerHTML), session, () => {});
                await pause(1500); surface.close(); session.dispose(); container.remove();
            }
            if (background && archive) {
                await installedExtensions.install(await inspectExtensionPackage(archive), grants, null);
                state.remove('probe.ready'); mount();
                await until(() => state.get('probe.ready'), 'active floating guest before explicit Quit');
                backgroundChecks.push('floating guest remains open when full Quit is requested');
            }
            const result = { passed: true, kind: second.kind, digest, snapshots, first, reopened: second,
                providerCalls, binaryCalls, closedSurfaceRevoked, rejectedDocuments, packageChecks, floating, backgroundChecks, phase: 1,
                scope: 'Real browser/native host, same built author HTML, actual SDK/storage/theme/native ACL; unavailable model and binary sentinel boundaries, no inference' };
            setStatus(JSON.stringify(result));
            if (background) localStorage.setItem(DESKTOP_STAGE, 'close-off');
            await fetch(report + '/result', { method: 'POST', body: JSON.stringify(result) });
            if (background) void desktopLifecycleAPI.quit().catch(error => console.error('Native Quit did not complete', error));
        })().catch(async error => {
            setMounted(false);
            if (floating) for (const entry of extensionActivities.getSnapshot()) extensionActivities.stop(entry.id);
            const result = { passed: false, error: String(error), kind: isTauri() ? 'desktop' : 'web' };
            if (active) setStatus(JSON.stringify(result));
            await fetch(report + '/result', { method: 'POST', body: JSON.stringify(result) }).catch(() => {});
        });
        return () => { active = false; };
    }, []);
    return <ThemeProvider><main style={{ padding: 16, height: '100vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1>Actual extension runtime acceptance</h1><Button data-testid="host-primary">Host shared button</Button>
        <output aria-label="Runtime result" style={{ fontSize: 11, overflowWrap: 'anywhere' }}>{status}</output>
        {packagePanel && <InstalledExtensions />}
        {background && <DesktopBackgroundSetting />}
        {floating && <ExtensionActivities services={services} />}
        {mounted && source && (installed ? <InstalledExtensionWorkspace extensionId={source.contract.id} viewId={source.contract.contributes.views[0].id} services={services} />
            : <GuestWorkspaceHost document={source} grants={grants} services={services} />)}
    </main></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Runtime />);

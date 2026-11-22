import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bell, Camera, CheckCircle2, Clipboard, Cpu, Download, FileText, FolderOpen, Globe, MapPin, Monitor, Package,
    KeyRound, Settings2, ShieldAlert, ShieldCheck, Terminal, type LucideIcon,
} from 'lucide-react';
import { toolCatalogue, type RegistryKind } from '../../api/catalogue/tools';
import { setToolSettings } from '../../api/engine/tools/settings';
import { decideApproval } from '../../api/engine/permission/approvals';
import { errorMessage } from '../../api/client/errors';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { MarkdownRenderer, parseMarkdownWithFrontmatter } from '../../components/ui/MarkdownRenderer';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { toast } from '../../components/ui/toast';
import type { PackageFiles, ToolComponent } from '../settings/ToolInspectorModal';
import { useToolSettingsSummary } from '../settings/ToolPermissionsPanel';
import type { ToolPermission, ToolUserSetting } from '../../api/engine/tools/settings';
import { notifyWaiting } from '../chat/approvals';
import { ToolManageDialog, type ManageTab } from './ToolManageDialog';
import { CatalogueHero } from './CatalogueUI';
import { ToolPackageDetails } from './ToolPackageDetails';
import { catalogueImage } from './catalogueView';
import { DownloadingButton } from './ModelPackagePanel';
import { HeroLogo } from './ProviderLogo';
import { INSTALL_STEPS, useToolInventory, type ToolPackage } from './toolPackages';
import { useCatalogue } from './useCatalogue';

function PackageReadme({ item }: { item: ToolPackage }) {
    const tool = item.tool;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one read per package, not per render of its object
    const load = useCallback((refresh?: boolean) => tool ? toolCatalogue.readme(tool, refresh) : Promise.resolve({ data: '', saved: 0 }), [tool?.manifest]);
    const readme = useCatalogue(load);
    const body = parseMarkdownWithFrontmatter(readme.reply?.data ?? '').cleanBody.trim();
    if (readme.busy) return <p role="status" className="text-xs text-[var(--text-secondary)]">Loading README…</p>;
    if (!body) return null;
    return <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText size={15} /> README</CardTitle></CardHeader>
        <CardContent><MarkdownRenderer content={body} /></CardContent>
    </Card>;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const words = (value: unknown) => typeof value === 'string' ? value : '';

/** The Engine's permission types (`agents/src/permissions.rs`) and their icons */
const PERMISSION_ICONS: Record<string, LucideIcon> = {
    network: Globe, files: FolderOpen, programs: Terminal, system: Monitor, location: MapPin,
    media: Camera, clipboard: Clipboard, notifications: Bell, native: Cpu, engine: Settings2,
};

function ApprovalLine({ icon: Icon, title, info }: { icon: LucideIcon; title: string; info: string }) {
    return <li className="flex items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/60 px-3 py-2">
        <Icon size={16} className="mt-0.5 shrink-0 text-[var(--accent-color)]" />
        <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{title}</p>
            {info && <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{info}</p>}
        </div>
    </li>;
}

const chip = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-tertiary)] cursor-pointer';

/**
 * What an installed tool uses, in plain words under its name: each permission with its icon (or "blocked"),
 * and whether it has the keys it reads. A click opens that tab of the settings.
 */
function ToolAccessLine({ permissions, settings, open }: {
    permissions: ToolPermission[]; settings: ToolUserSetting[]; open: (tab: ManageTab) => void;
}) {
    const set = settings.filter(setting => setting.set).length;
    const missing = settings.some(setting => setting.required && !setting.set);
    const keys = !settings.length ? null : missing ? 'API key needed' : set ? `${set} API ${set === 1 ? 'key' : 'keys'} added` : 'No API key yet';
    return <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-[var(--border-color)] pt-3 text-[var(--text-secondary)]">
        {permissions.length ? permissions.map(permission => {
            const Icon = PERMISSION_ICONS[permission.kind] ?? ShieldCheck;
            return <button key={permission.kind} type="button" className={chip} onClick={() => open('access')}
                title={permission.info}>
                <Icon size={13} className={permission.on ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'} />
                <span className={permission.on ? '' : 'line-through text-[var(--text-muted)]'}>{permission.title}</span>
                {!permission.on && <span className="text-[var(--text-muted)]">blocked</span>}
            </button>;
        }) : <span className={`${chip} cursor-default hover:bg-transparent`}><ShieldCheck size={13} /> Uses nothing on this computer</span>}
        {keys && <button type="button" className={chip} onClick={() => open('keys')}
            title={missing ? 'This tool needs a key to work' : 'Optional keys for outside services, for better results'}>
            <KeyRound size={13} className={missing ? 'text-amber-400' : 'text-[var(--text-muted)]'} />{keys}
            {!set && <span className="font-semibold text-[var(--accent-color)]">Add key</span>}
        </button>}
    </div>;
}

/**
 * The question an install waits on (dependencies and permissions the user's mode leaves open), from the Engine's
 * `approval` stage: Allow answers yes to all of them, Deny no; without an answer the Engine waits, then installs with no.
 * Out of sight, the App also shows a desktop notification, so the wait is not missed.
 */
function InstallApproval({ event, toolName }: { event: Record<string, unknown>; toolName: string }) {
    const [busy, setBusy] = useState(false), [answered, setAnswered] = useState('');
    const id = words(event.approval_id), plan = object(event.plan) ? event.plan : {};
    const asked = (list: unknown) => Array.isArray(list) ? list.filter(entry => object(entry) && entry.choice === 'ask') as Record<string, unknown>[] : [];
    const tools = asked(plan.tools), permissions = asked(plan.permissions);
    useEffect(() => {
        if (id) void notifyWaiting({ tag: id, title: 'Install waiting for approval', body: `${toolName} asks for permissions before it installs.` });
    }, [id, toolName]);
    const answer = async (approved: boolean) => {
        setBusy(true);
        try { await decideApproval(approved, id); setAnswered(approved ? 'Allowed' : 'Denied'); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    if (!id) return null;
    return <div role="alert" className="space-y-3 rounded-2xl border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/5 p-4">
        <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[var(--accent-color)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">{toolName} asks before it installs</p>
        </div>
        <ul className="space-y-1.5">
            {tools.map(tool => <ApprovalLine key={`${words(tool.kind)}:${words(tool.id)}`} icon={Package}
                title={`Install ${words(tool.kind)} ${words(tool.id)}`} info={words(tool.info)} />)}
            {permissions.map(entry => <ApprovalLine key={`${words(entry.tool)}:${words(entry.kind)}`}
                icon={PERMISSION_ICONS[words(entry.kind)] ?? ShieldCheck}
                title={words(entry.title) || words(entry.kind)} info={words(entry.info)} />)}
        </ul>
        {answered ? <p className="text-xs text-[var(--text-muted)]">{answered}. The install continues.</p> : <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void answer(true)}><CheckCircle2 size={14} /> Allow</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void answer(false)}>Deny</Button>
            <span className="text-[11px] text-[var(--text-muted)]">Without an answer the Engine installs it with these refused.</span>
        </div>}
    </div>;
}

/**
 * A package's page, laid out as a model's: name, maker, description and logo on top; install or manage
 * (enable, uninstall); what its package.json says; its files (from the Engine once installed, else as published);
 * then its README. The same page whether the package is installed or not.
 */
export function ToolPackagePanel({ item, installing, canInstall, onInstall }: {
    item: ToolPackage; canInstall: boolean; onInstall: () => void;
    /** This package's install, while it runs: its step, a cancel, and the question the Engine waits on */
    installing?: { step: number; label: string; cancel: () => void; approval?: Record<string, unknown> };
}) {
    const changed = useToolInventory(state => state.changed);
    const revision = useToolInventory(state => state.revision);
    const [busy, setBusy] = useState(false);
    const [managing, setManaging] = useState<ManageTab | null>(null);
    const { details, installed, tool } = item;
    const summary = useToolSettingsSummary(installed?.category ?? '', installed?.id ?? '', `${revision}:${installed?.id}`);
    // Just installed: say which permissions the security mode allowed without asking, so none is hidden
    const wasInstalling = useRef(false);
    useEffect(() => {
        if (installing) wasInstalling.current = true;
        else if (wasInstalling.current && installed && summary) {
            wasInstalling.current = false;
            const byMode = summary.permissions.filter(permission => permission.on && !permission.chosen).map(permission => permission.title);
            if (byMode.length) toast.info(`${item.name} installed. ${byMode.join(', ')} allowed by your security mode; change it in Manage.`);
        }
    }, [installing, installed, summary, item.name]);
    const kind = (tool?.kind ?? installed?.category) as RegistryKind;
    const logo = tool && catalogueImage(details?.icon ?? '', tool.manifest);
    const version = details?.version || installed?.version || '';
    /* Not installed: the files as published in the package's repository folder */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one source per package, not per render of its object
    const published = useMemo<PackageFiles | undefined>(() => tool && {
        list: () => toolCatalogue.files(tool), read: path => toolCatalogue.file(tool, path),
    }, [tool?.manifest]);
    const inspected: ToolComponent = installed as unknown as ToolComponent
        ?? { id: item.id, name: item.name, category: kind, description: details?.description ?? '', version, enabled: false };

    const act = async (label: string, action: () => Promise<unknown>) => {
        setBusy(true);
        try { await action(); toast.success(label); changed(); } catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    const toggle = () => installed && act(`${item.name} ${installed.enabled ? 'disabled' : 'enabled'}`, () =>
        setToolSettings({ component_type: installed.category, component_id: installed.id, settings: { enabled: !installed.enabled } }));

    return <div className="space-y-5">
        <CatalogueHero title={item.name} by={details?.author || 'Local'}
            description={details?.description || installed?.description} tags={details?.tags ?? []}
            logo={logo && <HeroLogo url={logo} />} />

        <Card><CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                    <p className="text-xs font-mono text-[var(--text-secondary)] truncate">{[kind, item.id, version && `v${version}`].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {installed ? <>
                        <Badge variant="outline"><CheckCircle2 size={14} className="text-emerald-400" /> Installed</Badge>
                        <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                            {installed.enabled ? 'On' : 'Off'}
                            <ToggleSwitch active={installed.enabled} onToggle={toggle} loading={busy} disabled={busy} aria-label={`Turn ${item.name} on or off`} />
                        </span>
                        <Button size="sm" variant="secondary" onClick={() => setManaging('access')} title="Access, API keys, saved files and uninstall">
                            <Settings2 size={14} /> Manage
                        </Button>
                    </> : installing ? <DownloadingButton label={installing.label} percent={Math.round(installing.step / INSTALL_STEPS * 100)}
                        progressText={`${installing.step}/${INSTALL_STEPS}`} onCancel={installing.cancel} />
                        : <Button size="sm" disabled={!canInstall} onClick={onInstall}><Download size={14} /> Install</Button>}
                </div>
            </div>
            {installed && summary && <ToolAccessLine permissions={summary.permissions} settings={summary.settings} open={setManaging} />}
            {installing?.approval && <InstallApproval event={installing.approval} toolName={item.name} />}
            {!installed && kind === 'extension' && <p className="text-xs text-[var(--text-secondary)]">
                App extensions are imported from the Extensions section; they are not installed into the Engine.
            </p>}
            {!installed && kind !== 'extension' && <p className="text-xs text-[var(--text-muted)]">
                Install asks your connected Engine for this release. It may download what the package needs; the Engine's permissions still apply.
            </p>}
        </CardContent></Card>

        <ToolPackageDetails item={item} kind={kind} version={version} inspected={inspected} published={published} />

        {installed && <ToolManageDialog tool={installed} title={item.name} hasKeys={Boolean(summary?.settings.length)}
            tab={managing} onTab={setManaging} onClose={() => setManaging(null)} onChanged={changed} />}

        <PackageReadme item={item} />
    </div>;
}

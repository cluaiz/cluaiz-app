import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, FolderOpen, Trash2 } from 'lucide-react';
import { toolCatalogue, type RegistryKind } from '../../api/catalogue/tools';
import { isToolKind } from '../../api/engine/tools/catalog';
import { removeTool } from '../../api/engine/tools/lifecycle';
import { setToolSettings } from '../../api/engine/tools/settings';
import { decideApproval } from '../../api/engine/permission/approvals';
import { errorMessage } from '../../api/client/errors';
import { HoldButton } from '../../components/HoldButton/HoldButton';
import { DANGER_HOLD } from '../../components/HoldButton/dangerHold';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { MarkdownRenderer, parseMarkdownWithFrontmatter } from '../../components/ui/MarkdownRenderer';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { toast } from '../../components/ui/toast';
import { ToolInspectorModal, type PackageFiles, type ToolComponent } from '../settings/ToolInspectorModal';
import { CatalogueHero, SpecList } from './CatalogueUI';
import { catalogueImage } from './catalogueView';
import { DownloadingButton } from './ModelPackagePanel';
import { HeroLogo } from './ProviderLogo';
import { INSTALL_STEPS, useToolInventory, type ToolPackage } from './toolPackages';
import { useCatalogue } from './useCatalogue';

const list = (values: string[] | undefined) => values?.length ? values.join(', ') : 'None';

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

/**
 * The question an install waits on (dependencies and permissions the user's mode leaves open), from the Engine's
 * `approval` stage: Allow answers yes to all of them, Deny no; without an answer the Engine waits, then installs with no.
 */
function InstallApproval({ event }: { event: Record<string, unknown> }) {
    const [busy, setBusy] = useState(false), [answered, setAnswered] = useState('');
    const id = words(event.approval_id), plan = object(event.plan) ? event.plan : {};
    const asked = (list: unknown) => Array.isArray(list) ? list.filter(entry => object(entry) && entry.choice === 'ask') as Record<string, unknown>[] : [];
    const tools = asked(plan.tools), permissions = asked(plan.permissions);
    const answer = async (approved: boolean) => {
        setBusy(true);
        try { await decideApproval(approved, id); setAnswered(approved ? 'Allowed' : 'Denied'); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    if (!id) return null;
    return <div role="alert" className="space-y-2 rounded-xl border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/5 p-3">
        <p className="text-xs font-semibold text-[var(--text-primary)]">The Engine asks before it continues</p>
        <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
            {tools.map(tool => <li key={`${words(tool.kind)}:${words(tool.id)}`}>Install {words(tool.kind)} <span className="font-mono">{words(tool.id)}</span>{words(tool.info) && ` — ${words(tool.info)}`}</li>)}
            {permissions.map(entry => <li key={`${words(entry.tool)}:${words(entry.kind)}`}>Allow <span className="font-mono">{words(entry.tool)}</span> {words(entry.title) || words(entry.kind)}{words(entry.info) && ` — ${words(entry.info)}`}</li>)}
        </ul>
        {answered ? <p className="text-xs text-[var(--text-muted)]">{answered}. The install continues.</p> : <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void answer(true)}>Allow</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void answer(false)}>Deny</Button>
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
    const [busy, setBusy] = useState(false);
    const { details, installed, tool } = item;
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
    const uninstall = () => installed && isToolKind(kind) && act(`${item.name} uninstalled`, () => removeTool(kind, installed.id));

    const specs: [string, string][] = [
        ['Package id', item.id],
        ['Version', version || 'Not listed'],
        ['Author', details?.author || 'Not listed'],
        ['License', details?.license || 'Not listed'],
        ['Type', kind?.toUpperCase() ?? 'Not listed'],
        ['Build', details?.build || 'Not listed'],
        ['Runs', details?.command || 'Not listed'],
        ['Network', details?.network ? `${list(details.network.hosts)}${details.network.info ? ` · ${details.network.info}` : ''}` : 'None'],
        ['Settings it reads', details?.env.length ? details.env.map(env => `${env.name} (${env.need || 'optional'})`).join(', ') : 'None'],
        ['Functions', list(details?.functions ?? installed?.functions.map(fn => fn.name))],
        ['Triggers', list(details?.triggers)],
        ['Systems', list(details?.os)],
        ['Updated', details?.updated ? details.updated.slice(0, 10) : 'Not listed'],
        ...(installed ? [['Security', installed.security_mode || 'inherit'], ['Run mode', installed.execution_mode || 'auto']] as [string, string][] : []),
    ];

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
                            {installed.enabled ? 'Enabled' : 'Disabled'}
                            <ToggleSwitch active={installed.enabled} onToggle={toggle} loading={busy} disabled={busy} aria-label={`Enable ${item.name}`} />
                        </span>
                        {isToolKind(kind) && <HoldButton {...DANGER_HOLD} size="sm" radius={8} glow={false} icon={<Trash2 size={14} />} doneLabel="Uninstalling…"
                            onHold={() => void uninstall()}>Hold to uninstall</HoldButton>}
                    </> : installing ? <DownloadingButton label={installing.label} percent={Math.round(installing.step / INSTALL_STEPS * 100)}
                        progressText={`${installing.step}/${INSTALL_STEPS}`} onCancel={installing.cancel} />
                        : <Button size="sm" disabled={!canInstall} onClick={onInstall}><Download size={14} /> Install</Button>}
                </div>
            </div>
            {installing?.approval && <InstallApproval event={installing.approval} />}
            {!installed && kind === 'extension' && <p className="text-xs text-[var(--text-secondary)]">
                App extensions are imported from the Extensions section; they are not installed into the Engine.
            </p>}
            {!installed && kind !== 'extension' && <p className="text-xs text-[var(--text-muted)]">
                Install asks your connected Engine for this release. It may download what the package needs; the Engine's permissions still apply.
            </p>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
            <CardContent><SpecList specs={specs} /></CardContent>
        </Card>

        {(installed || published) && <section className="space-y-2" aria-label="Package files">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><FolderOpen size={15} /> Files</h3>
            <ToolInspectorModal embedded tool={inspected} source={installed ? undefined : published} onClose={() => {}} />
        </section>}

        <PackageReadme item={item} />
    </div>;
}

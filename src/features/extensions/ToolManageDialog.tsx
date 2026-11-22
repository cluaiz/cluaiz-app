import { useCallback, useEffect, useState } from 'react';
import { Bot, HardDrive, KeyRound, Loader2, Settings2, ShieldCheck, SlidersHorizontal, Trash2, UserCheck, X } from 'lucide-react';
import type { ToolCatalogEntry } from '../../api/engine/tools/catalog';
import { clearToolCache, listToolCache } from '../../api/engine/tools/cache';
import { removeTool } from '../../api/engine/tools/lifecycle';
import { setToolSettings } from '../../api/engine/tools/settings';
import { errorMessage } from '../../api/client/errors';
import { HoldButton } from '../../components/HoldButton/HoldButton';
import { DANGER_HOLD } from '../../components/HoldButton/dangerHold';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { CustomDropdown } from '../../components/ui/dropdown';
import { toast } from '../../components/ui/toast';
import { ToolPermissionsPanel } from '../settings/ToolPermissionsPanel';
import { SECURITY_POLICY_OPTIONS } from '../settings/toolModes';
import { formatBytes } from '../../utils/formatBytes';

export type ManageTab = 'access' | 'keys' | 'advanced';

const RUN_MODES = [
    { id: 'auto', label: 'On its own', icon: Bot },
    { id: 'manual', label: 'Only when I ask', icon: UserCheck },
];

/** One question of the Advanced tab: the question, a line on what it means, and its control */
function Row({ title, info, children }: { title: string; info: string; children: React.ReactNode }) {
    return <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{info}</p>
        </div>
        <div className="shrink-0">{children}</div>
    </div>;
}

/**
 * One installed tool's settings in three tabs, so a new user sees one thing at a time: Access (what it
 * may touch), API keys (only when it reads any) and Advanced (when the AI uses it, approvals, saved files
 * and uninstall). Every value comes from the Engine and every change is sent to it; `onChanged` refreshes
 * the App's list after a change.
 */
export function ToolManageDialog({ tool, title, hasKeys, tab, onTab, onClose, onChanged }: {
    tool: ToolCatalogEntry; /** The package's display name */ title: string; hasKeys: boolean;
    /** The open tab, or none while the dialog is closed */ tab: ManageTab | null;
    onTab: (tab: ManageTab) => void; onClose: () => void; onChanged: () => void;
}) {
    const [pending, setPending] = useState<string | null>(null);
    const [cache, setCache] = useState<number | null>(null);

    const readCache = useCallback(async () => {
        try { setCache((await listToolCache(tool.category, tool.id)).reports[0]?.all_bytes ?? 0); }
        catch { setCache(null); }
    }, [tool.category, tool.id]);
    useEffect(() => { if (tab === 'advanced') void readCache(); }, [tab, readCache]);

    const run = async (key: string, label: string, action: () => Promise<unknown>) => {
        setPending(key);
        try { await action(); toast.success(label); onChanged(); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setPending(null); }
    };
    const setMode = (settings: { execution_mode?: string; security_mode?: string }) => run(
        Object.keys(settings)[0], `${title} updated`,
        () => setToolSettings({ component_type: tool.category, component_id: tool.id, settings }));

    const tabs: TabItem<ManageTab>[] = [
        { id: 'access', label: 'Access', icon: ShieldCheck },
        ...(hasKeys ? [{ id: 'keys' as const, label: 'API keys', icon: KeyRound }] : []),
        { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
    ];

    return <Dialog open={tab !== null} onOpenChange={value => { if (!value) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label={`Manage ${title}`}>
            <DialogContent className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)]">
                <DialogHeader className="!mb-0 shrink-0 gap-3 border-b border-[var(--border-color)] !px-4 !pt-3 !pb-0 !text-left">
                    <div className="flex items-center justify-between gap-2">
                        <DialogTitle><span className="flex items-center gap-2 text-base"><Settings2 size={16} /> Manage {title}</span></DialogTitle>
                        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Button>
                    </div>
                    <Tabs items={tabs} value={tab ?? 'access'} onChange={onTab} variant="underline" bordered={false} />
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4">
                    {tab === 'access' && <div className="space-y-3">
                        <p className="text-xs text-[var(--text-secondary)]">What {title} may use on this computer. A switch that is off is blocked by the Engine.</p>
                        <ToolPermissionsPanel kind={tool.category} name={tool.id} onChange={onChanged} part="permissions" />
                    </div>}

                    {tab === 'keys' && <div className="space-y-3">
                        <p className="text-xs text-[var(--text-secondary)]">Keys for outside services. A saved key is never shown again; the Engine only says whether one is set.</p>
                        <ToolPermissionsPanel kind={tool.category} name={tool.id} onChange={onChanged} part="settings" />
                    </div>}

                    {tab === 'advanced' && <div className="divide-y divide-[var(--border-color)]">
                        <Row title="When can the AI use it?" info="On its own: when a request matches. Only when I ask: when you name it.">
                            <Tabs items={RUN_MODES} value={tool.execution_mode === 'manual' ? 'manual' : 'auto'}
                                onChange={mode => void setMode({ execution_mode: mode })} />
                        </Row>
                        <Row title="Ask me before each use?" info="Inherit follows the security mode in Settings > Permissions.">
                            <CustomDropdown value={tool.security_mode || 'inherit'} options={SECURITY_POLICY_OPTIONS} className="w-52"
                                onChange={mode => void setMode({ security_mode: mode })}
                                loading={pending === 'security_mode'} disabled={pending !== null} />
                        </Row>
                        <Row title="Saved files" info={`Files ${title} keeps between uses: ${cache === null ? 'the size could not be read' : formatBytes(cache)}.`}>
                            <Button type="button" variant="secondary" size="sm" disabled={!cache || pending !== null}
                                onClick={() => void run('cache', `Saved files of ${title} cleared`, async () => {
                                    await clearToolCache(tool.category, tool.id);
                                    await readCache();
                                })}>
                                {pending === 'cache' ? <Loader2 size={12} className="animate-spin" /> : <HardDrive size={12} />} Clear
                            </Button>
                        </Row>
                        <Row title="Uninstall" info={`Removes ${title} from the Engine.`}>
                            <HoldButton {...DANGER_HOLD} size="sm" radius={8} glow={false} icon={<Trash2 size={14} />} doneLabel="Uninstalling…"
                                onHold={() => void run('remove', `${title} uninstalled`, async () => { await removeTool(tool.category, tool.id); onClose(); })}>
                                Hold to uninstall
                            </HoldButton>
                        </Row>
                    </div>}
                </div>
            </DialogContent>
        </div>
    </Dialog>;
}

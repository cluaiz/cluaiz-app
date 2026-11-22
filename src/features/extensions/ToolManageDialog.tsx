import { useCallback, useEffect, useState } from 'react';
import { Bot, HardDrive, Loader2, Settings2, Trash2, UserCheck, X } from 'lucide-react';
import type { ToolCatalogEntry } from '../../api/engine/tools/catalog';
import { clearToolCache, listToolCache } from '../../api/engine/tools/cache';
import { removeTool } from '../../api/engine/tools/lifecycle';
import { setToolSettings } from '../../api/engine/tools/settings';
import { errorMessage } from '../../api/client/errors';
import { HoldButton } from '../../components/HoldButton/HoldButton';
import { DANGER_HOLD } from '../../components/HoldButton/dangerHold';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Tabs } from '../../components/ui/Tabs';
import { CustomDropdown } from '../../components/ui/dropdown';
import { toast } from '../../components/ui/toast';
import { ToolPermissionsPanel } from '../settings/ToolPermissionsPanel';
import { SECURITY_POLICY_OPTIONS } from '../settings/toolModes';
import { formatBytes } from '../../utils/formatBytes';

const RUN_MODES = [
    { id: 'auto', label: 'Auto', icon: Bot },
    { id: 'manual', label: 'Manual', icon: UserCheck },
];

const section = 'space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 p-3';
const heading = 'text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]';

/**
 * Everything the user can change on one installed tool, in one place: how it runs, its permissions and
 * the keys it reads, its cache, and uninstall. Every value comes from the Engine and every change is sent
 * to it; `onChanged` refreshes the App's list after a change.
 */
export function ToolManageDialog({ tool, title, open, onClose, onChanged }: {
    tool: ToolCatalogEntry; /** The package's display name */ title: string; open: boolean; onClose: () => void; onChanged: () => void;
}) {
    const [pending, setPending] = useState<string | null>(null);
    const [cache, setCache] = useState<number | null>(null);

    const readCache = useCallback(async () => {
        try { setCache((await listToolCache(tool.category, tool.id)).reports[0]?.all_bytes ?? 0); }
        catch { setCache(null); }
    }, [tool.category, tool.id]);
    useEffect(() => { if (open) void readCache(); }, [open, readCache]);

    const run = async (key: string, label: string, action: () => Promise<unknown>) => {
        setPending(key);
        try { await action(); toast.success(label); onChanged(); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setPending(null); }
    };
    const setMode = (settings: { execution_mode?: string; security_mode?: string }) => run(
        Object.keys(settings)[0], `${title} updated`,
        () => setToolSettings({ component_type: tool.category, component_id: tool.id, settings }));

    return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label={`${title} settings`}>
            <DialogContent className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)]">
                <DialogHeader className="!mb-0 !flex-row shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] !px-4 !py-3 !text-left">
                    <DialogTitle><span className="flex items-center gap-2 text-base"><Settings2 size={16} /> {title} settings</span></DialogTitle>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={16} /></Button>
                </DialogHeader>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    <div className={section}>
                        <p className={heading}>How it runs</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <Tabs items={RUN_MODES} value={tool.execution_mode === 'manual' ? 'manual' : 'auto'}
                                onChange={mode => void setMode({ execution_mode: mode })} />
                            <CustomDropdown value={tool.security_mode || 'inherit'} options={SECURITY_POLICY_OPTIONS} className="w-52"
                                onChange={mode => void setMode({ security_mode: mode })}
                                loading={pending === 'security_mode'} disabled={pending !== null} />
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">Auto: the model may call it when a request matches. Manual: only when asked by name. The approval rule decides when the Engine asks you first.</p>
                    </div>

                    <ToolPermissionsPanel kind={tool.category} name={tool.id} onChange={onChanged} />

                    <div className={section}>
                        <p className={heading}>Storage</p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <HardDrive size={14} /> Cache: {cache === null ? 'could not be read' : formatBytes(cache)}
                            </span>
                            <Button type="button" variant="secondary" size="sm" disabled={!cache || pending !== null}
                                onClick={() => void run('cache', `Cache cleared for ${title}`, async () => {
                                    await clearToolCache(tool.category, tool.id);
                                    await readCache();
                                })}>
                                {pending === 'cache' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Clear cache
                            </Button>
                        </div>
                    </div>

                    <div className={`${section} flex flex-wrap items-center justify-between gap-2`}>
                        <span className="text-xs text-[var(--text-secondary)]">Uninstall removes the tool from the Engine.</span>
                        <HoldButton {...DANGER_HOLD} size="sm" radius={8} glow={false} icon={<Trash2 size={14} />} doneLabel="Uninstalling…"
                            onHold={() => void run('remove', `${title} uninstalled`, async () => { await removeTool(tool.category, tool.id); onClose(); })}>
                            Hold to uninstall
                        </HoldButton>
                    </div>
                </div>
            </DialogContent>
        </div>
    </Dialog>;
}

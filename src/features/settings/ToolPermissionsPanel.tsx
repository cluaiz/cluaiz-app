import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { AccordionGroup } from '../../components/ui/Accordion';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';
import {
    getToolSettings, setToolPermission, setToolUserSetting,
    type ToolPermission, type ToolUserSetting,
} from '../../api/engine/tools/settings';

/** A permission's fixed options as the Engine sends them, such as `access: strict · hosts: api.github.com` */
function optionsText(options: Record<string, unknown>): string {
    return Object.entries(options)
        .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
        .join(' · ');
}

/**
 * The permissions a tool asks for and the values it reads (its `env`), from the Engine's
 * `tools.get_settings`. The Engine owns every rule: the App shows its answer and sends the user's
 * choice. A value is typed hidden and never read back; the Engine only says whether one is set.
 */
export function ToolPermissionsPanel({ kind, name }: { kind: string; name: string }) {
    const [permissions, setPermissions] = useState<ToolPermission[] | null>(null);
    const [userSettings, setUserSettings] = useState<ToolUserSetting[]>([]);
    const [failure, setFailure] = useState<string | null>(null);
    const [pending, setPending] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [open, setOpen] = useState({ permissions: true, settings: true });

    const apply = (saved: { permissions: ToolPermission[]; user_settings: ToolUserSetting[] }) => {
        setPermissions(saved.permissions);
        setUserSettings(saved.user_settings);
    };

    const load = useCallback(async () => {
        setFailure(null);
        try {
            apply(await getToolSettings(kind, name));
        } catch (error) {
            setFailure(errorMessage(error));
        }
    }, [kind, name]);

    useEffect(() => { load(); }, [load]);

    const toggle = async (permission: ToolPermission) => {
        setPending(`permission:${permission.kind}`);
        try {
            apply(await setToolPermission(kind, name, permission.kind, !permission.on));
            toast.success(`${permission.title} ${permission.on ? 'refused' : 'allowed'} for ${name}`);
        } catch (error) {
            toast.error(`Could not change ${permission.title}: ${errorMessage(error)}`);
        } finally {
            setPending(null);
        }
    };

    const save = async (setting: ToolUserSetting, value: string) => {
        setPending(`setting:${setting.name}`);
        try {
            apply(await setToolUserSetting(kind, name, setting.name, value));
            setDrafts(prev => ({ ...prev, [setting.name]: '' }));
            toast.success(value ? `${setting.name} saved` : `${setting.name} removed`);
        } catch (error) {
            toast.error(`Could not save ${setting.name}: ${errorMessage(error)}`);
        } finally {
            setPending(null);
        }
    };

    if (failure) {
        return (
            <div className="flex items-center justify-between gap-3 p-3 text-[11px] text-[var(--text-secondary)]">
                <span>Permissions could not be read: {failure}</span>
                <Button type="button" variant="secondary" size="sm" onClick={load}>Try again</Button>
            </div>
        );
    }
    if (!permissions) {
        return (
            <div className="flex items-center gap-2 p-3 text-[11px] text-[var(--text-muted)]">
                <Loader2 size={13} className="animate-spin text-[var(--accent-color)]" /> Reading permissions...
            </div>
        );
    }

    const allowed = permissions.filter(p => p.on).length;
    const set = userSettings.filter(s => s.set).length;
    return (
        <div className="space-y-2">
            <AccordionGroup
                icon={<ShieldCheck size={13} className="text-[var(--accent-color)]" />}
                title="Permissions"
                count={permissions.length ? `${allowed} of ${permissions.length} allowed` : 'none'}
                open={open.permissions}
                onToggle={() => setOpen(prev => ({ ...prev, permissions: !prev.permissions }))}
            >
                {permissions.length === 0 ? (
                    <p className="px-2 py-1.5 text-[11px] text-[var(--text-muted)]">This tool asks for no permissions.</p>
                ) : permissions.map(permission => (
                    <div key={permission.kind} className="flex items-start justify-between gap-3 px-2 py-1.5">
                        <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-[var(--text-primary)]">{permission.title}</span>
                                <span className="text-[9px] font-mono text-[var(--text-muted)]">{permission.kind}</span>
                                {permission.sensitive && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/30">
                                        sensitive
                                    </span>
                                )}
                                {!permission.chosen && (
                                    <span className="text-[9px] font-mono text-[var(--text-muted)]">not chosen yet</span>
                                )}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{permission.info}</p>
                            {Object.keys(permission.options).length > 0 && (
                                <p className="text-[10px] font-mono text-[var(--text-muted)] break-words">{optionsText(permission.options)}</p>
                            )}
                        </div>
                        <ToggleSwitch
                            size="sm"
                            active={permission.on}
                            onToggle={() => toggle(permission)}
                            loading={pending === `permission:${permission.kind}`}
                            disabled={pending !== null}
                            aria-label={`${permission.title} for ${name}`}
                        />
                    </div>
                ))}
                {permissions.length > 0 && (
                    <p className="px-2 pt-1 text-[10px] text-[var(--text-muted)] leading-relaxed">
                        {kind === 'plugin'
                            ? 'A refused permission is blocked by the Engine itself.'
                            : 'This tool runs as a normal program: while a permission is refused, the Engine asks you before each call.'}
                    </p>
                )}
            </AccordionGroup>

            {userSettings.length > 0 && (
                <AccordionGroup
                    icon={<KeyRound size={13} className="text-[var(--accent-color)]" />}
                    title="Settings it reads"
                    count={`${set} of ${userSettings.length} set`}
                    open={open.settings}
                    onToggle={() => setOpen(prev => ({ ...prev, settings: !prev.settings }))}
                >
                    {userSettings.map(setting => {
                        const busy = pending === `setting:${setting.name}`;
                        const draft = drafts[setting.name] ?? '';
                        return (
                            <div key={setting.name} className="px-2 py-1.5 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{setting.name}</span>
                                    <span className="text-[9px] font-mono text-[var(--text-muted)]">{setting.required ? 'required' : 'optional'}</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                        setting.set
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-[var(--accent-color)]/30'
                                            : 'bg-white/[0.04] text-[var(--text-muted)] border-[var(--border-color)]/50'
                                    }`}>
                                        {setting.in_system ? 'from system environment' : setting.set ? 'saved' : 'not set'}
                                    </span>
                                </div>
                                {setting.info && <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{setting.info}</p>}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Input
                                            type="password"
                                            autoComplete="off"
                                            value={draft}
                                            onChange={e => setDrafts(prev => ({ ...prev, [setting.name]: e.target.value }))}
                                            placeholder={setting.set ? 'Type a new value to replace it' : 'Type the value'}
                                            aria-label={`${setting.name} for ${name}`}
                                        />
                                    </div>
                                    <Button type="button" variant="secondary" size="sm" disabled={!draft || pending !== null}
                                        onClick={() => save(setting, draft)}>
                                        {busy ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                                    </Button>
                                    {setting.set && !setting.in_system && (
                                        <Button type="button" variant="ghost" size="sm" disabled={pending !== null}
                                            onClick={() => save(setting, '')}>
                                            Remove
                                        </Button>
                                    )}
                                </div>
                                {setting.in_system && (
                                    <p className="text-[10px] text-[var(--text-muted)]">The system environment variable comes first; a saved value is used only without it.</p>
                                )}
                            </div>
                        );
                    })}
                </AccordionGroup>
            )}
        </div>
    );
}

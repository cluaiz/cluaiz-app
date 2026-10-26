import type { DeveloperDocument } from '../../extensions/surfaces/document';
import type { ExtensionCapability } from '../../extensions/manifest';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';

export function ExtensionPermissions({ document: source, grants, onChange, disabled }: {
    document: DeveloperDocument; grants: readonly ExtensionCapability[];
    onChange: (grants: readonly ExtensionCapability[]) => void; disabled?: boolean;
}) {
    return <fieldset disabled={disabled} className="space-y-2">
        <legend className="text-sm font-medium mb-2">Permissions</legend>
        {source.requested.length === 0 && <p className="text-sm">No host permissions requested.</p>}
        {source.requested.map(cap => {
            const required = source.contract.capabilities.required.includes(cap);
            return <div key={cap} className="flex items-center justify-between gap-4 text-sm">
                <span>{cap}{required ? ' (required)' : ' (optional)'}</span>
                <ToggleSwitch aria-label={cap} active={grants.includes(cap)} disabled={disabled || required}
                    onToggle={() => onChange(grants.includes(cap) ? grants.filter(value => value !== cap) : [...grants, cap])} />
            </div>;
        })}
    </fieldset>;
}

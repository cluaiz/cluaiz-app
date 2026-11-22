import type { DropdownOption } from '../../components/ui/dropdown';

/** A tool's own approval rule over the Engine's mode (`security_mode` in `tools.set_settings`) */
export const SECURITY_POLICY_OPTIONS: DropdownOption[] = [
    { value: 'inherit', label: 'Inherit Global', description: 'Follows system security mode defined in Permissions' },
    { value: 'require_approval', label: 'Require Approval', description: 'Always prompt for user confirmation before execution' },
    { value: 'always_allow', label: 'Always Allow', description: 'Bypass confirmation prompts and execute directly' },
];

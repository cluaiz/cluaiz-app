import { EXTENSION_CAPABILITIES, EXTENSION_HOST_API } from './manifest';
import { validateExtensionContract } from './contract';
import { MAX_EXTENSION_ACTIVE_JOBS, MAX_EXTENSION_JOB_HISTORY } from './jobs';
import { EXTENSION_STATE_LIMIT_BYTES } from './storage';

/** Only implemented private bundled-host operations. This does not certify model capabilities. */
export const EXTENSION_HOST = Object.freeze({
    hostApi: EXTENSION_HOST_API,
    runtimes: Object.freeze(['bundled'] as const),
    surfaces: Object.freeze(['workspace'] as const),
    layouts: Object.freeze(['full', 'with-chat'] as const),
    activation: Object.freeze(['on-demand'] as const),
    capabilities: Object.freeze([...EXTENSION_CAPABILITIES]),
    limits: Object.freeze({ activeJobsPerSession: MAX_EXTENSION_ACTIVE_JOBS,
        jobHistoryPerSession: MAX_EXTENSION_JOB_HISTORY, stateValueBytes: EXTENSION_STATE_LIMIT_BYTES }),
});

export function inspectExtensionContract(input: unknown) {
    const contract = validateExtensionContract(input);
    const reasons: string[] = [];
    if (EXTENSION_HOST.hostApi < contract.host_api.min || EXTENSION_HOST.hostApi > contract.host_api.max) reasons.push('host_api');
    if (!(EXTENSION_HOST.runtimes as readonly string[]).includes(contract.runtime.kind)) reasons.push('runtime');
    if (!(EXTENSION_HOST.activation as readonly string[]).includes(contract.activation)) reasons.push('activation');
    for (const view of contract.contributes.views) {
        if (!(EXTENSION_HOST.surfaces as readonly string[]).includes(view.surface)) reasons.push(`surface:${view.id}`);
        if (view.layout && !(EXTENSION_HOST.layouts as readonly string[]).includes(view.layout)) reasons.push(`layout:${view.id}`);
    }
    // The only running profile currently needs a workspace contribution.
    if (contract.runtime.kind === 'bundled' && !contract.contributes.views.length) reasons.push('workspace_required');
    const available = EXTENSION_HOST.capabilities as readonly string[];
    const missingRequired = contract.capabilities.required.filter(cap => !available.includes(cap));
    reasons.push(...missingRequired.map(cap => `capability:${cap}`));
    return Object.freeze({ compatible: reasons.length === 0, reasons: Object.freeze(reasons),
        missingRequired: Object.freeze(missingRequired),
        availableOptional: Object.freeze(contract.capabilities.optional.filter(cap => available.includes(cap))),
        unavailableOptional: Object.freeze(contract.capabilities.optional.filter(cap => !available.includes(cap))) });
}

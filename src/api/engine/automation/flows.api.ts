import { callCep, CepError } from '../../client/cep';
import { ApiError } from '../../client/errors';
import type { FlowFile, FlowRef, FlowRun, FlowSave, FlowSource, FlowSummary, FlowValidation, MissingPermissions, RunDetail, RunStatus } from './flows.types';

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const scopes = new Set(['project', 'user']);
const formats = new Set(['yaml', 'json']);
const runStatuses = new Set<RunStatus>(['queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled']);
const invalid = (method: string) => new ApiError('Automation returned an invalid response', 200, 'INVALID_FLOWS_RESPONSE', method);

function flow(value: unknown, method: string): FlowSummary {
    if (!object(value) || !text(value.name) || !scopes.has(value.scope as string) || typeof value.enabled !== 'boolean'
        || (value.triggers !== undefined && !Array.isArray(value.triggers))
        || (value.problems !== undefined && !Array.isArray(value.problems))) throw invalid(method);
    return value as unknown as FlowSummary;
}

function run(value: unknown, method: string): FlowRun {
    if (!object(value) || !text(value.run_id) || !text(value.flow) || !runStatuses.has(value.status as RunStatus)
        || !text(value.created_at)) throw invalid(method);
    return value as unknown as FlowRun;
}

function runId(result: unknown, method: string): string {
    if (!object(result) || !text(result.run_id)) throw invalid(method);
    return result.run_id;
}

/** Changes must answer for the flow that was asked for. */
function changed(result: unknown, ref: FlowRef, method: string): FlowSummary {
    if (!object(result)) throw invalid(method);
    const value = flow(result.flow, method);
    if (value.name !== ref.name || value.scope !== ref.scope) throw invalid(method);
    return value;
}

/** The permissions a flow still needs the owner to confirm, when that is why a call was refused. */
export function missingPermissions(error: unknown): MissingPermissions | null {
    if (!(error instanceof CepError) || !object(error.data) || error.data.type !== 'permissions_unconfirmed') return null;
    const missing = error.data.permissions_missing ?? error.data.permissions_needed;
    if (!object(missing)) return {};
    return Object.fromEntries(Object.entries(missing).filter(([, names]) => Array.isArray(names) && names.length)
        .map(([kind, names]) => [kind, (names as unknown[]).map(String)]));
}

/** Automation's `flows.*` methods; served at /v1/cep beside the Engine's own methods. */
export const flowsApi = {
    list: async (signal?: AbortSignal): Promise<FlowSummary[]> => {
        const result = await callCep<unknown>('flows.list', { scope: 'all' }, { signal });
        if (!object(result) || !Array.isArray(result.flows)) throw invalid('flows.list');
        return result.flows.map(value => flow(value, 'flows.list'));
    },
    enable: async (ref: FlowRef, permissionsConfirmed = false, signal?: AbortSignal): Promise<FlowSummary> =>
        changed(await callCep('flows.enable', { ...ref, ...(permissionsConfirmed && { permissions_confirmed: true }) }, { signal }),
            ref, 'flows.enable'),
    disable: async (ref: FlowRef, signal?: AbortSignal): Promise<FlowSummary> =>
        changed(await callCep('flows.disable', ref, { signal }), ref, 'flows.disable'),
    get: async (ref: FlowRef, signal?: AbortSignal): Promise<FlowFile> => {
        const result = await callCep<unknown>('flows.get', { ...ref, as: 'text' }, { signal });
        if (!object(result) || typeof result.text !== 'string' || !formats.has(result.format as string)) throw invalid('flows.get');
        return { flow: changed(result, ref, 'flows.get'), format: result.format as FlowFile['format'], text: result.text };
    },
    /** The flow-file version this Automation writes, e.g. for a new file. */
    schemaVersion: async (signal?: AbortSignal): Promise<string> => {
        const result = await callCep<unknown>('flows.schema', {}, { signal });
        if (!object(result) || !text(result.version)) throw invalid('flows.schema');
        return result.version;
    },
    validate: async (source: FlowSource, signal?: AbortSignal): Promise<FlowValidation> => {
        const result = await callCep<unknown>('flows.validate', source, { signal });
        if (!object(result) || typeof result.valid !== 'boolean' || !Array.isArray(result.problems)) throw invalid('flows.validate');
        return result as unknown as FlowValidation;
    },
    save: async (params: FlowSave, signal?: AbortSignal): Promise<FlowSummary> => {
        const result = await callCep<unknown>('flows.save', params, { signal });
        if (!object(result)) throw invalid('flows.save');
        const value = flow(result.flow, 'flows.save');
        if (value.scope !== params.scope) throw invalid('flows.save');
        return value;
    },
    remove: async (ref: FlowRef, signal?: AbortSignal): Promise<void> => {
        const result = await callCep<unknown>('flows.remove', ref, { signal });
        if (!object(result) || result.removed !== ref.name || result.scope !== ref.scope) throw invalid('flows.remove');
    },
    /** Starts a run and returns its id; the run itself goes on as an Engine task. */
    run: async (ref: FlowRef, signal?: AbortSignal): Promise<string> =>
        runId(await callCep<unknown>('flows.run', ref, { signal }), 'flows.run'),
    /** A new run that reuses the earlier run's outputs before `from` and runs from that step. */
    rerunFrom: async (run: string, from: string, signal?: AbortSignal): Promise<string> =>
        runId(await callCep<unknown>('flows.rerun_from', { run_id: run, from }, { signal }), 'flows.rerun_from'),
    runs: async (ref?: FlowRef, signal?: AbortSignal): Promise<FlowRun[]> => {
        const result = await callCep<unknown>('flows.runs', ref ?? {}, { signal });
        if (!object(result) || !Array.isArray(result.runs)) throw invalid('flows.runs');
        return result.runs.map(value => run(value, 'flows.runs'));
    },
    runGet: async (runId: string, signal?: AbortSignal): Promise<RunDetail> => {
        const result = await callCep<unknown>('flows.run_get', { run_id: runId }, { signal });
        if (!object(result) || !Array.isArray(result.steps)) throw invalid('flows.run_get');
        const value = run(result.run, 'flows.run_get');
        if (value.run_id !== runId || !result.steps.every(step => object(step) && text(step.id) && text(step.status))) {
            throw invalid('flows.run_get');
        }
        return { run: value, steps: result.steps as RunDetail['steps'] };
    },
};

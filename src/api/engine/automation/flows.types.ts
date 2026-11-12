export type FlowScope = 'project' | 'user';
export type RunStatus = 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled';

export interface FlowTrigger { id: string; kind: string; status: string; next_at?: string | null }
export interface FlowProblem { severity: string; code: string; path: string; message: string; line?: number; column?: number }

export interface FlowSummary {
    name: string; scope: FlowScope; path: string; format: string; enabled: boolean;
    description?: string; triggers?: FlowTrigger[]; problems?: FlowProblem[]; tags?: string[];
    warnings?: number; updated_at?: string;
    last_run?: { run_id: string; status: RunStatus; finished_at?: string | null } | null;
}

export interface FlowRun {
    run_id: string; flow: string; scope: FlowScope; status: RunStatus;
    trigger?: { id?: string; kind: string; at?: string } | null;
    error?: { message?: string; type?: string } | null;
    waiting_for?: { kind: string; step?: string; until?: string } | null;
    created_at: string; started_at?: string | null; finished_at?: string | null;
    running_ms?: number; steps_done?: number; dry_run?: boolean;
}

export interface RunStep {
    id: string; kind: string; status: string; place?: string;
    attempts?: { started_at?: string; ms?: number; error?: { message?: string } | null }[];
}

export interface RunDetail { run: FlowRun; steps: RunStep[] }

export interface FlowRef { name: string; scope: FlowScope }

export type FlowFormat = 'yaml' | 'json';
export interface FlowFile { flow: FlowSummary; format: FlowFormat; text: string }
export interface FlowSource { text: string; format: FlowFormat }
export interface FlowValidation { valid: boolean; problems: FlowProblem[]; permissions_needed?: MissingPermissions }
export interface FlowSave extends FlowSource { scope: FlowScope; overwrite?: boolean; permissions_confirmed?: boolean }

/** `data.permissions_missing` of a `permissions_unconfirmed` error: kind → names */
export type MissingPermissions = Record<string, string[]>;

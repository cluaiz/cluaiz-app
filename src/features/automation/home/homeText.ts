import type { FlowRun, FlowSummary } from '../../../api/engine/automation';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]];
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "2 hours ago", "in 5 minutes", "just now"; empty for no time */
export function ago(value?: string | null, now = Date.now()): string {
    if (!value) return '';
    const diff = new Date(value).getTime() - now;
    if (Number.isNaN(diff)) return '';
    for (const [unit, ms] of UNITS) if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
    return 'just now';
}

export const errorsOf = (flow: FlowSummary) => flow.problems?.filter(problem => problem.severity === 'error') ?? [];

export type HomeFilter = 'all' | 'on' | 'off' | 'problems';

export function matchesFilter(flow: FlowSummary, filter: HomeFilter) {
    if (filter === 'on') return flow.enabled;
    if (filter === 'off') return !flow.enabled;
    if (filter === 'problems') return errorsOf(flow).length > 0 || flow.last_run?.status === 'failed';
    return true;
}

/** Numbers for the strip at the top, all read from the Engine's lists */
export function summary(flows: FlowSummary[], runs: FlowRun[], now = Date.now()) {
    const day = now - 86_400_000;
    const recent = runs.filter(run => new Date(run.created_at).getTime() >= day);
    return {
        on: flows.filter(flow => flow.enabled).length,
        off: flows.filter(flow => !flow.enabled).length,
        runsToday: recent.length,
        failedToday: recent.filter(run => run.status === 'failed').length,
        running: runs.filter(run => run.status === 'running' || run.status === 'queued').length,
    };
}

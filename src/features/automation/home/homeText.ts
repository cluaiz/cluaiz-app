import type { FlowRun, FlowSummary } from '../../../api/engine/automation';

const DAY = 86_400_000;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['day', DAY], ['hour', 3_600_000], ['minute', 60_000]];
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

export type StatusFilter = 'all' | 'on' | 'off' | 'problems';
export type SortBy = 'updated' | 'last_run' | 'name';

export function matchesStatus(flow: FlowSummary, filter: StatusFilter) {
    if (filter === 'on') return flow.enabled;
    if (filter === 'off') return !flow.enabled;
    if (filter === 'problems') return errorsOf(flow).length > 0 || flow.last_run?.status === 'failed';
    return true;
}

const time = (value?: string | null) => (value ? new Date(value).getTime() : 0) || 0;

export function sortFlows(flows: FlowSummary[], by: SortBy) {
    const list = [...flows];
    if (by === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
    if (by === 'last_run') return list.sort((a, b) => time(b.last_run?.finished_at) - time(a.last_run?.finished_at));
    return list.sort((a, b) => time(b.updated_at) - time(a.updated_at));
}

const finished = (run: FlowRun) => run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled';

/** Runs per day for the last `days` days, oldest first: the small bars on the cards */
export function perDay(runs: FlowRun[], days = 7, now = Date.now(), keep: (run: FlowRun) => boolean = () => true) {
    const out = new Array<number>(days).fill(0);
    for (const run of runs) {
        if (!keep(run)) continue;
        const back = Math.floor((now - time(run.created_at)) / DAY);
        if (back >= 0 && back < days) out[days - 1 - back]++;
    }
    return out;
}

/** Numbers for the cards at the top, all read from the Engine's lists */
export function summary(flows: FlowSummary[], runs: FlowRun[], now = Date.now()) {
    const recent = runs.filter(run => time(run.created_at) >= now - DAY);
    const done = runs.filter(finished);
    const ok = done.filter(run => run.status === 'succeeded').length;
    return {
        total: flows.length,
        on: flows.filter(flow => flow.enabled).length,
        runsToday: recent.length,
        failedToday: recent.filter(run => run.status === 'failed').length,
        running: runs.filter(run => run.status === 'running' || run.status === 'queued').length,
        waiting: runs.filter(run => run.status === 'waiting').length,
        problems: flows.filter(flow => errorsOf(flow).length > 0).length,
        /** Share of finished runs that worked, or null before any run finished */
        successRate: done.length ? Math.round((ok / done.length) * 100) : null,
        finishedCount: done.length,
    };
}

/** How many times each workflow ran in the last 24 hours, by `scope:name` */
export function runsToday(runs: FlowRun[], now = Date.now()) {
    const out = new Map<string, number>();
    for (const run of runs) if (time(run.created_at) >= now - DAY) out.set(`${run.scope}:${run.flow}`, (out.get(`${run.scope}:${run.flow}`) ?? 0) + 1);
    return out;
}

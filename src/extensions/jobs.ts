/** Client request ownership, not a persistent Engine scheduler or a global model cancel. */
export type ExtensionJobStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface ExtensionJobSnapshot {
    id: string;
    operation: string;
    status: ExtensionJobStatus;
    error?: string;
}
export interface ExtensionJob<T> {
    id: string;
    result: Promise<T>;
    cancel(): void;
}
export const MAX_EXTENSION_ACTIVE_JOBS = 4;
export const MAX_EXTENSION_JOB_HISTORY = 32;
const cancelled = () => new DOMException('Extension request cancelled.', 'AbortError');

export class ExtensionJobs {
    private readonly jobs = new Map<string, { snapshot: ExtensionJobSnapshot; controller: AbortController }>();
    private readonly listeners = new Set<() => void>();
    private closed = false;
    private sequence = 0;
    constructor(private readonly owner: string) {}
    private notify() {
        // A broken progress subscriber must not turn a successful service call into a failure.
        for (const listener of this.listeners) { try { listener(); } catch { /* observer only */ } }
    }
    list(): readonly ExtensionJobSnapshot[] {
        return [...this.jobs.values()].map(({ snapshot }) => ({ ...snapshot }));
    }
    subscribe(listener: () => void): () => void {
        if (this.closed) throw new Error('Extension session is disposed.');
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    run<T>(operation: string, action: (signal: AbortSignal) => Promise<T>): ExtensionJob<T> {
        if (this.closed) throw new Error('Extension session is disposed.');
        if (this.list().filter(job => job.status === 'running').length >= MAX_EXTENSION_ACTIVE_JOBS) {
            throw new Error('Extension concurrent request limit reached.');
        }
        while (this.jobs.size >= MAX_EXTENSION_JOB_HISTORY) {
            const old = [...this.jobs].find(([, job]) => job.snapshot.status !== 'running');
            if (!old) throw new Error('Extension request history is full.');
            this.jobs.delete(old[0]);
        }
        const id = `${this.owner}:${++this.sequence}`;
        const controller = new AbortController();
        const snapshot: ExtensionJobSnapshot = { id, operation, status: 'running' };
        this.jobs.set(id, { snapshot, controller });
        this.notify();
        const result = Promise.resolve().then(async () => {
            if (controller.signal.aborted) throw cancelled();
            const value = await new Promise<T>((resolve, reject) => {
                const onAbort = () => reject(cancelled());
                controller.signal.addEventListener('abort', onAbort, { once: true });
                // Observe both outcomes even when a provider ignores cancellation and settles late.
                Promise.resolve().then(() => {
                    if (controller.signal.aborted) throw cancelled();
                    return action(controller.signal);
                }).then(result => {
                    controller.signal.removeEventListener('abort', onAbort);
                    resolve(result);
                }, error => {
                    controller.signal.removeEventListener('abort', onAbort);
                    reject(error);
                });
            });
            if (controller.signal.aborted || this.closed) throw cancelled();
            snapshot.status = 'completed';
            return value;
        }).catch(error => {
            snapshot.status = controller.signal.aborted || this.closed ? 'cancelled' : 'failed';
            snapshot.error = snapshot.status === 'failed' ? (error instanceof Error ? error.message : String(error)) : undefined;
            if (snapshot.status === 'cancelled') throw cancelled();
            throw error;
        }).finally(() => { this.notify(); });
        // Ownership cleanup is safe even if a view closes before attaching a result handler.
        void result.catch(() => undefined);
        return Object.freeze({ id, result, cancel: () => { this.cancel(id); } });
    }
    cancel(id: string): boolean {
        const job = this.jobs.get(id);
        if (!job || job.snapshot.status !== 'running') return false;
        job.snapshot.status = 'cancelled';
        job.controller.abort();
        this.notify();
        return true;
    }
    dispose(): void {
        if (this.closed) return;
        this.closed = true;
        for (const [id] of this.jobs) this.cancel(id);
        this.listeners.clear();
    }
}

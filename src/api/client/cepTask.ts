import { callCep, CepError } from './cep';
import { ApiError } from './errors';

// Engine tasks.result caps one wait at 30 seconds. Leave transport time for its reply.
const TASK_WAIT_MS = 30_000;
const TASK_REQUEST_MS = TASK_WAIT_MS + 5_000;
const statuses = new Set(['working', 'input_required', 'completed', 'failed', 'cancelled']);
export interface TaskView {
  task_id: string; method: string;
  status: 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled';
  poll_ms?: number;
  status_message?: string;
  progress?: { done: number; total?: number; unit?: string; message?: string };
}
export type TaskObserver = (task: TaskView) => void;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function taskView(value: unknown, method: string, id?: string): TaskView {
  if (!object(value) || typeof value.task_id !== 'string' || !value.task_id
    || value.method !== method || typeof value.status !== 'string' || !statuses.has(value.status)
    || (id !== undefined && value.task_id !== id)) {
    throw new ApiError('Engine returned an invalid CEP task', 200, 'INVALID_CEP_TASK', method);
  }
  const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
  if ((value.poll_ms !== undefined && !count(value.poll_ms))
    || (value.status_message !== undefined && typeof value.status_message !== 'string')) {
    throw new ApiError('Engine returned invalid task metadata', 200, 'INVALID_CEP_TASK', method);
  }
  if (value.progress !== undefined && (!object(value.progress) || !count(value.progress.done)
    || (value.progress.total !== undefined && !count(value.progress.total))
    || (value.progress.unit !== undefined && typeof value.progress.unit !== 'string')
    || (value.progress.message !== undefined && typeof value.progress.message !== 'string'))) {
    throw new ApiError('Engine returned invalid task progress', 200, 'INVALID_CEP_TASK', method);
  }
  return value as unknown as TaskView;
}

function notify(observer: TaskObserver | undefined, task: TaskView) {
  try { observer?.(task); } catch (error) { console.warn('Task observer failed', error); }
}

/** Read only this id; do not redispatch its originating method or copy task event logs. */
export async function getCepTask(method: string, id: string, signal?: AbortSignal): Promise<TaskView> {
  if (!id.trim()) throw new ApiError('A task id is required', 400, 'INVALID_TASK_ID', method);
  return taskView(await callCep<unknown>('tasks.get', { task_id: id, after: Number.MAX_SAFE_INTEGER }, { signal }), method, id);
}

/** The caller's tasks that have not expired, newest first. */
export async function listCepTasks(signal?: AbortSignal): Promise<TaskView[]> {
  const result = await callCep<unknown>('tasks.list', {}, { signal });
  if (!object(result) || !Array.isArray(result.tasks)) {
    throw new ApiError('Engine returned an invalid task list', 200, 'INVALID_CEP_TASK', 'tasks.list');
  }
  return result.tasks.map(task => taskView(task, object(task) ? String(task.method) : ''));
}

/** Engine cancellation is cooperative and is not an uninstall or filesystem rollback. */
export async function cancelCepTask(method: string, id: string, signal?: AbortSignal): Promise<TaskView> {
  if (!id.trim()) throw new ApiError('A task id is required', 400, 'INVALID_TASK_ID', method);
  const current = await getCepTask(method, id, signal);
  if (!['working', 'input_required'].includes(current.status)) {
    throw new ApiError('The Engine task has already ended; recheck its result', 409, 'TASK_ALREADY_ENDED', method);
  }
  const task = taskView(await callCep<unknown>('tasks.cancel', { task_id: id }, { signal }), method, id);
  if (task.status !== 'cancelled') throw new ApiError('Cancellation was not acknowledged', 200, 'INVALID_CEP_TASK', method);
  return task;
}

function waitForPoll(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason ?? new Error('Task observation aborted')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Start once; resolve only the task's actual result. Abort stops waiting, not server work. */
export async function callCepTask<T>(method: string, params: object, signal?: AbortSignal, observer?: TaskObserver): Promise<T> {
  signal?.throwIfAborted();
  const started = await callCep<unknown>(method, params, { signal });
  const task = taskView(object(started) ? started.task : undefined, method);
  notify(observer, task);
  return resumeCepTask<T>(method, task.task_id, signal, observer);
}

/** Reattach to a known caller-owned task; never repeat its start request. */
export async function resumeCepTask<T>(method: string, id: string, signal?: AbortSignal, observer?: TaskObserver): Promise<T> {
  if (!id.trim()) throw new ApiError('A task id is required', 400, 'INVALID_TASK_ID', method);
  const target = { task_id: id };
  for (;;) {
    signal?.throwIfAborted();
    if (observer) {
      const current = await getCepTask(method, id, signal);
      notify(observer, current);
      if (current.status === 'working' || current.status === 'input_required') {
        await waitForPoll(Math.max(500, Math.min(5_000, current.poll_ms ?? 1_000)), signal);
        continue;
      }
      return callCep<T>('tasks.result', { ...target, wait_ms: 0 }, { signal });
    }
    try {
      return await callCep<T>('tasks.result', { ...target, wait_ms: TASK_WAIT_MS },
        { signal, timeoutMs: TASK_REQUEST_MS });
    } catch (error) {
      if (!(error instanceof CepError) || error.code !== -32009
        || !object(error.data) || error.data.type !== 'timeout') throw error;
      const current = taskView(await callCep<unknown>('tasks.get', target, { signal }), method, id);
      if (current.status !== 'working' && current.status !== 'input_required') {
        // A finished operation may itself have failed with timeout. Do not poll it forever.
        return callCep<T>('tasks.result', { ...target, wait_ms: 0 }, { signal });
      }
    }
  }
}

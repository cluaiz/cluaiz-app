import { callCep, CepError } from './cep';
import { ApiError } from './errors';

// Engine tasks.result caps one wait at 30 seconds. Leave transport time for its reply.
const TASK_WAIT_MS = 30_000;
const TASK_REQUEST_MS = TASK_WAIT_MS + 5_000;
const statuses = new Set(['working', 'input_required', 'completed', 'failed', 'cancelled']);
interface TaskView { task_id: string; method: string; status: string }
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function taskView(value: unknown, method: string, id?: string): TaskView {
  if (!object(value) || typeof value.task_id !== 'string' || !value.task_id
    || value.method !== method || typeof value.status !== 'string' || !statuses.has(value.status)
    || (id !== undefined && value.task_id !== id)) {
    throw new ApiError('Engine returned an invalid CEP task', 200, 'INVALID_CEP_TASK', method);
  }
  return value as unknown as TaskView;
}

/** Start once; resolve only the task's actual result. Abort stops waiting, not server work. */
export async function callCepTask<T>(method: string, params: object, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const started = await callCep<unknown>(method, params, { signal });
  const task = taskView(object(started) ? started.task : undefined, method);
  const target = { task_id: task.task_id };
  for (;;) {
    signal?.throwIfAborted();
    try {
      return await callCep<T>('tasks.result', { ...target, wait_ms: TASK_WAIT_MS },
        { signal, timeoutMs: TASK_REQUEST_MS });
    } catch (error) {
      if (!(error instanceof CepError) || error.code !== -32009
        || !object(error.data) || error.data.type !== 'timeout') throw error;
      const current = taskView(await callCep<unknown>('tasks.get', target, { signal }), method, task.task_id);
      if (current.status !== 'working' && current.status !== 'input_required') {
        // A finished operation may itself have failed with timeout. Do not poll it forever.
        return callCep<T>('tasks.result', { ...target, wait_ms: 0 }, { signal });
      }
    }
  }
}

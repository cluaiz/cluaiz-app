import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelCepTask, type TaskObserver, type TaskView } from '../../api/client/cepTask';
import { errorMessage } from '../../api/client/errors';
import { useConnectionStore } from '../../store/engine/useConnectionStore';
import { forgetTaskReceipt, readTaskReceipt, saveTaskReceipt, type CatalogueTaskMethod, type TaskReceipt } from './catalogueTaskReceipt';

type Operation<T> = (signal: AbortSignal, observe: TaskObserver) => Promise<T>;
type Resume<T> = (target: string, id: string, signal: AbortSignal, observe: TaskObserver) => Promise<T>;
interface State<T> {
  scope: string; receipt: TaskReceipt | null; task?: TaskView; result?: T;
  busy: boolean; cancelling: boolean; error?: string; warning?: string;
}
const terminal = (task?: TaskView) => task && !['working', 'input_required'].includes(task.status);

/** View-owned observation of an Engine-owned operation; remount resumes the saved id, never its start. */
export function useCatalogueTask<T>(method: CatalogueTaskMethod, resume: Resume<T>) {
  const scope = useConnectionStore(s => JSON.stringify([s.protocol, s.host, s.port]));
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [state, setState] = useState<State<T>>(() => ({ scope, ...readTaskReceipt(scope, method), busy: false, cancelling: false }));
  const live = useRef(scope); live.current = scope;
  const job = useRef<{ controller: AbortController; scope: string } | null>(null);
  const cancelJob = useRef<AbortController | null>(null);
  const snapshot = useRef(state); snapshot.current = state;
  const validScope = () => JSON.stringify((() => {
    const s = useConnectionStore.getState(); return [s.protocol, s.host, s.port];
  })()) === scope;

  const run = useCallback(async (target: string, operation?: Operation<T>) => {
    if (job.current || cancelJob.current || live.current !== scope || !validScope()) return;
    const saved = readTaskReceipt(scope, method);
    if (saved.error) { setState({ scope, ...saved, busy: false, cancelling: false }); return; }
    let receipt = saved.receipt;
    if (operation) {
      if (receipt && !(snapshot.current.scope === scope && snapshot.current.receipt === receipt && terminal(snapshot.current.task))) {
        setState({ scope, ...saved, busy: false, cancelling: false,
          error: 'An operation is already tracked for this Engine. Recheck that task instead of starting it again.' });
        return;
      }
      const claimed = saveTaskReceipt(scope, method, receipt, { target });
      if (!claimed) return;
      receipt = claimed.receipt;
    }
    if (!receipt) return;
    if (!operation && !receipt.taskId) {
      setState({ scope, receipt, busy: false, cancelling: false, warning: saved.warning,
        error: 'The start request has no saved task id. It may have been accepted. Do not retry automatically; check the Engine before forgetting this reference.' });
      return;
    }
    const active = { controller: new AbortController(), scope };
    job.current = active;
    const valid = () => job.current === active && !active.controller.signal.aborted && live.current === scope && validScope();
    setState({ scope, receipt, busy: true, cancelling: false, warning: readTaskReceipt(scope, method).warning });
    const observe: TaskObserver = task => {
      if (!valid()) return;
      if (!receipt?.taskId) {
        const accepted = saveTaskReceipt(scope, method, receipt, { target, taskId: task.task_id });
        if (!accepted) {
          active.controller.abort();
          setState({ scope, ...readTaskReceipt(scope, method), busy: false, cancelling: false,
            error: 'Task tracking changed in another view. Recheck the current reference; the old start may still be running.' });
          return;
        }
        receipt = accepted.receipt;
      }
      setState(previous => ({ ...previous, receipt, task, warning: readTaskReceipt(scope, method).warning }));
    };
    try {
      const result = operation
        ? await operation(active.controller.signal, observe)
        : await resume(receipt.target, receipt.taskId!, active.controller.signal, observe);
      if (valid()) setState(previous => ({ ...previous, result, busy: false, error: undefined }));
    } catch (failure) {
      if (valid()) setState(previous => ({ ...previous, busy: false,
        error: previous.task?.status === 'cancelled' ? undefined : errorMessage(failure) }));
    } finally {
      if (job.current === active) job.current = null;
    }
  }, [scope, method, resume]);

  useEffect(() => {
    const saved = readTaskReceipt(scope, method);
    setState({ scope, ...saved, busy: Boolean(saved.receipt?.taskId), cancelling: false });
    if (saved.receipt) void run(saved.receipt.target);
    const unsubscribe = useConnectionStore.subscribe((next, before) => {
      if (next.protocol !== before.protocol || next.host !== before.host || next.port !== before.port) {
        job.current?.controller.abort(); job.current = null;
        cancelJob.current?.abort(); cancelJob.current = null;
        setConnectionEpoch(value => value + 1);
      }
    });
    return () => {
      unsubscribe(); job.current?.controller.abort(); job.current = null;
      cancelJob.current?.abort(); cancelJob.current = null;
    };
  }, [scope, method, run, connectionEpoch]);

  const cancel = async () => {
    const current = snapshot.current;
    if (current.scope !== scope || !validScope() || !current.receipt?.taskId || terminal(current.task) || cancelJob.current) return;
    const controller = new AbortController(); cancelJob.current = controller;
    setState(previous => ({ ...previous, cancelling: true, error: undefined }));
    try {
      const task = await cancelCepTask(method, current.receipt.taskId, controller.signal);
      if (cancelJob.current === controller && !controller.signal.aborted && live.current === scope && validScope()) {
        job.current?.controller.abort(); job.current = null;
        setState(previous => ({ ...previous, task, busy: false, cancelling: false, result: undefined }));
      }
    } catch (failure) {
      if (!controller.signal.aborted && live.current === scope && validScope()) {
        setState(previous => ({ ...previous, cancelling: false, error: errorMessage(failure) }));
      }
    } finally { if (cancelJob.current === controller) cancelJob.current = null; }
  };

  const forget = () => {
    if (live.current !== scope || !validScope()) return;
    job.current?.controller.abort(); job.current = null;
    cancelJob.current?.abort(); cancelJob.current = null;
    setState({ scope, ...forgetTaskReceipt(scope, method), busy: false, cancelling: false });
  };
  const current: State<T> = state.scope === scope ? state : { scope, receipt: null, busy: true, cancelling: false };
  return { ...current, start: (target: string, operation: Operation<T>) => run(target, operation),
    refresh: () => { const saved = readTaskReceipt(scope, method); if (saved.receipt) void run(saved.receipt.target); },
    cancel, forget, canStart: !current.busy && !current.cancelling && !current.error && (!current.receipt || Boolean(terminal(current.task))) };
}

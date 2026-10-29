import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import type { TaskView } from '../../api/client/cepTask';
import type { TaskReceipt } from './catalogueTaskReceipt';

interface Props {
  scope: string; receipt: TaskReceipt | null; task?: TaskView; result?: unknown;
  busy: boolean; cancelling: boolean; error?: string; warning?: string;
  refresh(): void; cancel(): Promise<void>; forget(): void;
}

/** Actual Engine state, current-transfer counters, and separate observation/cancel controls. */
export function CatalogueTaskStatus(view: Props) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setConfirm(false); }, [view.scope, view.receipt]);
  if (!view.receipt && !view.error && !view.warning) return null;
  const progress = view.task?.progress;
  const measured = progress && progress.total !== undefined && progress.total > 0 && progress.done <= progress.total;
  const terminal = view.task && !['working', 'input_required'].includes(view.task.status);
  const status = view.result ? 'Engine confirmed completion'
    : view.task?.status === 'cancelled' ? 'Cancellation acknowledged'
    : view.error ? 'Task needs attention'
    : view.task?.status === 'completed' ? 'Checking final installation result'
    : view.task?.status === 'failed' ? 'Failed'
    : view.task?.status === 'input_required' ? 'Waiting for input / approval'
    : view.busy ? 'Working' : 'Task observation paused';
  return <Card><CardContent className="space-y-3 p-4" data-testid="catalogue-task-status">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p role="status" className="text-sm font-semibold">{status}</p>
        {view.receipt && <p className="text-xs break-all text-[var(--text-secondary)]">{view.receipt.target}</p>}
        {view.receipt?.taskId && <p className="text-[10px] break-all font-mono text-[var(--text-muted)]">{view.receipt.taskId}</p>}</div>
      <div className="flex flex-wrap gap-2">
        {view.receipt?.taskId && <Button variant="outline" size="sm" disabled={view.busy || view.cancelling} onClick={view.refresh}>Recheck task</Button>}
        {view.receipt?.taskId && !terminal && <Button variant="outline" size="sm" disabled={view.cancelling} onClick={() => void view.cancel()}>{view.cancelling ? 'Requesting cancellation…' : 'Cancel task'}</Button>}
        <Button variant="ghost" size="sm" disabled={view.cancelling} onClick={() => setConfirm(true)}>Forget tracking</Button>
      </div>
    </div>
    {view.busy && <progress aria-label="Current transfer progress" className="w-full h-2 accent-[var(--accent-color)]" {...(measured ? { value: progress.done, max: progress.total } : {})} />}
    {progress && <p className="text-xs break-words">{view.busy ? 'Current transfer' : 'Last reported transfer'}: {progress.done.toLocaleString()}{progress.total !== undefined ? ` / ${progress.total.toLocaleString()}` : ''} {progress.unit || 'units'}{progress.message ? ` · ${progress.message}` : ''}</p>}
    {view.task?.status_message && <p className="text-xs break-words text-[var(--text-secondary)]">{view.task.status_message}</p>}
    {view.error && <p role="alert" className="text-sm break-words text-[var(--status-error)]">{view.error}</p>}
    {view.warning && <p role="alert" className="text-xs text-[var(--text-secondary)]">{view.warning}</p>}
    <p className="text-xs text-[var(--text-muted)]">Work continues when you leave this page. Return here to check the same task. Tracking may be unavailable after an Engine restart or task expiry.</p>
    {view.task?.status === 'cancelled' && <p className="text-xs text-[var(--text-secondary)]">Cancellation is cooperative; worker cleanup may continue. Partial or installed files are not rolled back.</p>}
    {confirm && <ConfirmationModal open title="Forget local task tracking?" message="This only removes the App reference. It does not cancel the Engine task or delete files. Starting the operation again could duplicate work if the old task is still running." confirmText="Forget reference" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); view.forget(); }} />}
  </CardContent></Card>;
}

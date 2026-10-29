export type CatalogueTaskMethod = 'models.download' | 'tools.install';
export interface TaskReceipt { target: string; taskId?: string }
interface Saved { receipt: TaskReceipt | null; error?: string; warning?: string }
const PREFIX = 'cluaiz_catalogue_task_v1:';
const MAX_SCOPE_SNAPSHOTS = 32;
const snapshots = new Map<string, Saved>();
const sessionOnly = 'Task tracking is available in this App session only; browser storage is unavailable.';
const keyOf = (scope: string, method: CatalogueTaskMethod) => PREFIX + JSON.stringify([scope, method]);
function remember(key: string, value: Saved) {
  if (!snapshots.has(key) && snapshots.size >= MAX_SCOPE_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value!);
  snapshots.set(key, value);
}

/** One small reference per Engine/domain; credentials, results and progress events are never saved. */
export function readTaskReceipt(scope: string, method: CatalogueTaskMethod): Saved {
  const key = keyOf(scope, method);
  const cached = snapshots.get(key);
  if (cached) return cached;
  let value: Saved;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) value = { receipt: null };
    else {
      if (raw.length > 2048) throw new Error('Oversized receipt');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.target !== 'string' || !parsed.target.trim() || parsed.target.length > 512
        || /[\x00-\x1f\x7f]/.test(parsed.target)
        || (parsed.taskId !== undefined && (typeof parsed.taskId !== 'string' || !parsed.taskId.trim() || parsed.taskId.length > 256))) {
        throw new Error('Invalid receipt');
      }
      value = { receipt: Object.freeze({ target: parsed.target, ...(parsed.taskId && { taskId: parsed.taskId }) }) };
    }
  } catch (error) {
    value = error instanceof SyntaxError || (error instanceof Error && ['Oversized receipt', 'Invalid receipt'].includes(error.message))
      ? { receipt: null, error: 'Saved task tracking is invalid. Forget this local reference before starting another operation.' }
      : { receipt: null, warning: sessionOnly };
  }
  remember(key, value);
  return value;
}

/** Compare before replacing so two mounted views cannot both claim the same local slot. */
export function saveTaskReceipt(scope: string, method: CatalogueTaskMethod, expected: TaskReceipt | null, next: TaskReceipt): Saved | null {
  const current = readTaskReceipt(scope, method);
  if (current.error || current.receipt !== expected) return null;
  const saved: Saved = { receipt: Object.freeze({ ...next }) };
  try { localStorage.setItem(keyOf(scope, method), JSON.stringify(saved.receipt)); }
  catch { saved.warning = sessionOnly; }
  remember(keyOf(scope, method), saved);
  return saved;
}

/** This forgets a local reference only. It never stops an Engine task or deletes installed files. */
export function forgetTaskReceipt(scope: string, method: CatalogueTaskMethod): Saved {
  const saved: Saved = { receipt: null };
  try { localStorage.removeItem(keyOf(scope, method)); }
  catch { saved.warning = sessionOnly; }
  remember(keyOf(scope, method), saved);
  return saved;
}

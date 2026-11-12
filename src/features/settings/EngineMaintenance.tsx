import { useCallback, useEffect, useState } from 'react';
import { SettingItem, SettingSection } from './SharedComponents';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';
import { cancelCepTask, listCepTasks, type TaskView } from '../../api/client/cepTask';
import { checkForUpdate, readAuditLog, type AuditLog, type UpdateCheck } from '../../api/engine/system/maintenance';
import { readEmbeddingRoom, type EmbeddingRoom } from '../../api/engine/models/embeddingRoom';
import { importAppChats, type AppChatImport } from '../../api/engine/chat/importApp';

const muted = 'text-xs text-[var(--text-secondary)]';
const open = (task: TaskView) => task.status === 'working' || task.status === 'input_required';

/** Reads once on mount and on demand; keeps the error next to the data it failed to read. */
function useRead<T>(read: (signal: AbortSignal) => Promise<T>) {
    const [value, setValue] = useState<T | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const reload = useCallback((signal = new AbortController().signal) => {
        setLoading(true); setError('');
        return read(signal).then(next => { if (!signal.aborted) setValue(next); })
            .catch(reason => { if (!signal.aborted) setError(errorMessage(reason)); })
            .finally(() => { if (!signal.aborted) setLoading(false); });
    }, [read]);
    return { value, error, loading, reload };
}

export function UpdateCheckSection() {
    const { value, error, loading, reload } = useRead<UpdateCheck>(checkForUpdate);
    const latest = value?.latest;
    const description = error || (!value ? 'Asks GitHub for the newest release. Nothing is installed.'
        : value.update_available && latest ? `Version ${latest.version} is out${latest.prerelease ? ' (pre-release)' : ''}. This Engine is ${value.current}. Install it with cluaiz self update.`
        : `This Engine (${value.current}) is the newest release.`);
    return <SettingSection title="Updates">
        <SettingItem label="Check for a newer Cluaiz release" description={description} loading={loading}>
            <div className="flex items-center gap-2">
                {value?.update_available && latest && <a href={latest.url} target="_blank" rel="noreferrer" className="text-xs underline text-[var(--accent-color)]">Release notes</a>}
                <Button size="sm" variant="outline" disabled={loading} onClick={() => void reload()}>Check now</Button>
            </div>
        </SettingItem>
    </SettingSection>;
}

export function TasksSection() {
    const { value: tasks, error, loading, reload } = useRead<TaskView[]>(listCepTasks);
    const [cancelling, setCancelling] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void reload(controller.signal);
        return () => controller.abort();
    }, [reload]);
    const cancel = async (task: TaskView) => {
        setCancelling(task.task_id);
        try { await cancelCepTask(task.method, task.task_id); toast.success(`${task.method} cancelled`); await reload(); }
        catch (reason) { toast.error(errorMessage(reason)); }
        finally { setCancelling(null); }
    };
    return <SettingSection title="Background Tasks">
        <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
                <p className={muted}>Downloads, installs, flow runs and other long jobs you started that have not expired.</p>
                <Button size="sm" variant="ghost" disabled={loading} onClick={() => void reload()}>Refresh</Button>
            </div>
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            {tasks?.length === 0 && <p className={muted}>No tasks.</p>}
            {tasks?.map(task => <div key={task.task_id} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={task.status === 'failed' ? 'destructive' : open(task) ? 'secondary' : 'outline'}>{task.status}</Badge>
                <span className="font-mono text-[var(--text-primary)]">{task.method}</span>
                {task.progress && <span className="text-[var(--text-muted)]">{task.progress.done}{task.progress.total ? ` / ${task.progress.total}` : ''} {task.progress.unit ?? ''}</span>}
                {task.status_message && <span className="text-[var(--text-muted)]">{task.status_message}</span>}
                {open(task) && <Button size="sm" variant="ghost" className="ml-auto" disabled={cancelling === task.task_id}
                    onClick={() => void cancel(task)}>Cancel</Button>}
            </div>)}
        </div>
    </SettingSection>;
}

export function AuditLogSection() {
    const { value: log, error, loading, reload } = useRead<AuditLog>(signal => readAuditLog(100, signal));
    return <SettingSection title="Audit Log">
        <div className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className={muted}>{log ? `Newest ${log.lines.length} calls, from ${log.path}` : 'Every Engine method call: who called it, when, and whether it worked.'}</p>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => void reload()}>{log ? 'Refresh' : 'Show'}</Button>
            </div>
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            {log && <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1 font-mono text-[11px]">
                {log.lines.map((line, index) => <div key={index} className="flex flex-wrap gap-x-3 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">{new Date(line.ts).toLocaleString()}</span>
                    <span className="text-[var(--text-primary)]">{line.method}</span>
                    <span>{line.principal}</span>
                    {line.code != null && <span className="text-red-400">error {line.code}</span>}
                    {line.ms !== undefined && <span>{line.ms} ms</span>}
                </div>)}
            </div>}
        </div>
    </SettingSection>;
}

export function EmbeddingRoomSection() {
    const { value: room, error, loading, reload } = useRead<EmbeddingRoom>(readEmbeddingRoom);
    const gb = (value?: number) => value === undefined ? '—' : `${value.toFixed(2)} GB`;
    return <SettingSection title="Where Embedding Models Fit">
        <div className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className={muted}>{room ? `Beside ${room.chat_model ? `${room.chat_model.id}${room.chat_model.loaded ? ' (loaded)' : ''}` : 'no chat model'} · GPU left ${gb(room.gpu_left_gb)} · RAM left ${gb(room.ram_left_gb)}`
                    : 'Checks today\'s free memory: which embedding model runs on the GPU, on the CPU, or has no room.'}</p>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => void reload()}>{room ? 'Check again' : 'Check'}</Button>
            </div>
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            {room?.candidates.length === 0 && <p className={muted}>No embedding models are installed.</p>}
            {room?.candidates.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-[var(--text-primary)]">{item.id}</span>
                <Badge variant={item.runs_on === 'none' ? 'destructive' : 'secondary'}>{item.runs_on}</Badge>
                {item.recommended && <Badge>recommended</Badge>}
                {!item.installed && <Badge variant="outline">not installed</Badge>}
                {item.needs_gb !== undefined && <span className="text-[var(--text-muted)]">needs {gb(item.needs_gb)}</span>}
            </div>)}
        </div>
    </SettingSection>;
}

export function AppChatImportSection() {
    const [result, setResult] = useState<{ dryRun: boolean; value: AppChatImport } | null>(null);
    const [busy, setBusy] = useState(false);
    const run = async (dryRun: boolean) => {
        setBusy(true);
        try {
            const value = await importAppChats(dryRun);
            setResult({ dryRun, value });
            if (!dryRun) toast.success('Import finished');
        } catch (reason) { toast.error(errorMessage(reason)); }
        finally { setBusy(false); }
    };
    const rows = result?.value.chats ?? [];
    const count = (status: string) => rows.filter(row => row.status === status).length;
    const statuses = [...new Set(rows.map(row => row.status))];
    return <SettingSection title="Old App Chats">
        <div className="p-4 space-y-2">
            <p className={muted}>Chats saved by older App versions can be copied into the Engine's conversation records, so the model can search and recall them. Chats the Engine already has are skipped.</p>
            <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(true)}>Count</Button>
                <Button size="sm" disabled={busy || !result?.dryRun || !rows.length} onClick={() => void run(false)}>Import</Button>
            </div>
            {result && <p className={muted}>
                {!rows.length ? 'No old chats found.' : result.dryRun
                    ? `${rows.length} chats to import, ${rows.reduce((sum, row) => sum + (row.messages ?? 0), 0)} messages.`
                    : `Done: ${statuses.map(status => `${count(status)} ${status}`).join(', ')}.`}
            </p>}
            {rows.filter(row => row.error).map(row => <p key={row.chat_id} className="text-xs text-red-400">{row.chat_id}: {row.error}</p>)}
        </div>
    </SettingSection>;
}

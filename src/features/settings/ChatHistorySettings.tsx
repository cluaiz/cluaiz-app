import { useEffect, useMemo, useState } from 'react';
import { Archive, BrainCircuit, CalendarX, Clock, HardDrive, History, Pin, RotateCcw, Trash2, Layers } from 'lucide-react';
import { SettingSection, SettingItem, SelectOption } from './SharedComponents';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { useChatStore } from '../../store/chat/useChatStore';
import { ArchivedActivity, ChatPrefs, currentChatPrefs, useChatPrefsStore } from '../../store/chat/useChatPrefsStore';
import { planRetention } from '../../services/storage/chatRetention';
import { applyChatRetention } from '../../services/storage/chatRetentionRunner';
import type { ChatMemorySettings } from '../../api/engine/chat-memory';
import { useSavedChatMemory } from './useSavedChatMemory';
import { deleteSessionBatch } from '../../store/chat/deletion';
import { toast } from '../../components/ui/toast';
import { errorMessage } from '../../api/client/errors';

const PERIOD_LABELS: Record<number, string> = { 7: '7 days', 30: '30 days', 90: '3 months', 180: '6 months', 365: '1 year' };
const days = (values: number[], never: string): SelectOption[] =>
    values.map(v => ({ value: String(v), label: v === 0 ? never : PERIOD_LABELS[v] }));

const ARCHIVE_DELETE = days([0, 7, 30, 90], 'Never');
const AUTO_ARCHIVE = days([0, 30, 90, 180], 'Never');
const DELETE_INACTIVE = days([0, 90, 180, 365], 'Never');
const MAX_CHATS: SelectOption[] = [0, 100, 250, 500, 1000].map(v => ({ value: String(v), label: v === 0 ? 'Unlimited' : `${v} chats` }));
const MEMORY_DISK: SelectOption[] = [1, 2, 5, 10, 20].map(v => ({ value: String(v), label: `${v} GB` }));
const MEMORY_AGE = days([7, 30, 90, 0], 'Only the disk limit');
const formatBytes = (n: number) => n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

const ARCHIVED_ACTIVITY: SelectOption[] = [
    { value: 'unarchive', label: 'Move back to chats', description: 'The chat leaves the archive and its delete timer stops' },
    { value: 'reset', label: 'Stay archived, restart timer', description: 'The delete countdown starts again from the new message' },
    { value: 'keep', label: 'Stay archived, keep timer', description: 'The chat is deleted on its original date' },
];

export function ChatHistorySettings() {
    const prefs = useChatPrefsStore();
    const sessions = useChatStore(s => s.sessions);
    const activeSessionId = useChatStore(s => s.activeSessionId);
    const deleteSession = useChatStore(s => s.deleteSession);

    const saved = useMemo(() => Object.values(sessions).filter(s => !s.isIncognito), [sessions]);

    // Reusable Confirmation Modal state
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        confirmText?: string;
        isDestructive?: boolean;
        onConfirm: () => void;
    } | null>(null);

    // Model memory lives in the engine (its KV cache per chat), so it is read and changed over the API
    const modelMemory = useSavedChatMemory();
    const { memory, error: memoryError, busy: memoryBusy } = modelMemory;
    useEffect(() => { setConfirmModal(null); }, [modelMemory.scope]);

    const changeMemory = async (patch: Partial<ChatMemorySettings>) => {
        const executeChange = async () => {
            await modelMemory.update(patch);
        };

        if (patch.max_disk_gb !== undefined && memory && patch.max_disk_gb * 1024 ** 3 < memory.bytes) {
            setConfirmModal({
                title: 'Lower Memory Limit',
                message: `Saved model memory uses ${formatBytes(memory.bytes)}. Lowering the limit deletes the least recently used chats now. Continue?`,
                confirmText: 'Continue',
                isDestructive: true,
                onConfirm: () => {
                    setConfirmModal(null);
                    executeChange();
                }
            });
            return;
        }
        executeChange();
    };

    const clearMemory = async () => {
        if (!memory || memory.chats.length === 0) return;
        setConfirmModal({
            title: 'Clear Saved Model Memory',
            message: `Delete the saved model memory of ${memory.chats.length} chats (${formatBytes(memory.bytes)})? The chats themselves stay; their history is processed again when continued.`,
            confirmText: 'Clear Memory',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(null);
                await modelMemory.clear();
            }
        });
    };

    const deleteSingleCache = (chatId: string, model: string, bytes: number) => {
        const title = sessions[chatId]?.title || chatId;
        setConfirmModal({
            title: 'Delete Saved Chat KV Cache',
            message: `Remove the saved disk KV cache (${formatBytes(bytes)}, model ${model}) for "${title}"? Conversation messages, notes, and models loaded in RAM/VRAM are not deleted.`,
            confirmText: 'Remove Cache',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(null);
                await modelMemory.deleteChat(chatId);
            }
        });
    };
    const archived = saved.filter(s => s.archived);

    /** Changes one preference; asks first when it would delete chats right away. */
    const change = <K extends keyof ChatPrefs>(key: K, value: ChatPrefs[K]) => {
        const next = { ...currentChatPrefs(), [key]: value };
        const plan = planRetention(Object.values(useChatStore.getState().sessions), next, Date.now(), activeSessionId);
        if (plan.remove.length > 0) {
            setConfirmModal({
                title: 'Update Retention Setting',
                message: `This setting deletes ${plan.remove.length} chat${plan.remove.length === 1 ? '' : 's'} now. Continue?`,
                confirmText: 'Continue',
                isDestructive: true,
                onConfirm: () => {
                    setConfirmModal(null);
                    prefs.setPref(key, value);
                }
            });
            return;
        }
        prefs.setPref(key, value);
    };

    const nextArchiveDeletion = useMemo(() => {
        if (prefs.archiveDeleteAfterDays === 0) return null;
        const times = archived.filter(s => s.archivedAt !== undefined).map(s => s.archivedAt! + prefs.archiveDeleteAfterDays * 86_400_000);
        return times.length ? new Date(Math.min(...times)) : null;
    }, [archived, prefs.archiveDeleteAfterDays]);

    const deleteAllArchived = () => {
        const targets = archived.filter(s => s.id !== activeSessionId);
        if (targets.length === 0) return;
        setConfirmModal({
            title: 'Delete All Archived Chats',
            message: `Delete all ${targets.length} archived chat${targets.length === 1 ? '' : 's'}? This cannot be undone.`,
            confirmText: 'Delete All',
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(null);
                await deleteSessionBatch(targets.map(s => s.id), id => {
                    const eligible = () => {
                        const current = useChatStore.getState();
                        return current.activeSessionId !== id && Boolean(current.sessions[id]?.archived);
                    };
                    return eligible() ? deleteSession(id, eligible) : Promise.resolve(false);
                });
            }
        });
    };

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Chat History">
                <SettingItem
                    icon={History}
                    label="Save chat history"
                    description="Keep chats on this device so they appear in the sidebar after a restart."
                    dynamicDescription={prefs.saveHistory
                        ? `${saved.length} saved chats · ${archived.length} archived`
                        : 'New chats start in Private Mode and are never saved'}
                    toggle
                    active={prefs.saveHistory}
                    onToggle={() => change('saveHistory', !prefs.saveHistory)}
                />
                <SettingItem
                    icon={Layers}
                    label="Keep at most"
                    description="When there are more saved chats, the oldest ones are deleted first."
                    select={MAX_CHATS}
                    value={String(prefs.maxChats)}
                    onChange={v => change('maxChats', Number(v))}
                />
                <SettingItem
                    icon={Pin}
                    label="Protect pinned and favourite chats"
                    description="Pinned and favourite chats are never archived or deleted automatically."
                    toggle
                    active={prefs.protectPinned}
                    onToggle={() => change('protectPinned', !prefs.protectPinned)}
                />
            </SettingSection>

            <SettingSection title="Model Memory (Engine)">
                <SettingItem
                    icon={BrainCircuit}
                    label="Keep model memory on disk"
                    description="The Engine can save processed context for compatible models and settings. Reusing that cache can reduce the history it needs to process when a chat continues."
                    dynamicDescription={memoryError ?? (memory ? `${formatBytes(memory.bytes)} used by ${memory.chats.length} chats · ${memory.directory}` : 'Loading…')}
                    toggle
                    active={Boolean(memory?.settings.enabled)}
                    loading={memoryBusy}
                    disabled={!memory || memoryBusy || Boolean(memoryError)}
                    onToggle={() => memory && changeMemory({ enabled: !memory.settings.enabled })}
                />
                <SettingItem
                    icon={HardDrive}
                    label="Disk limit"
                    description="When saved memory grows past this, the least recently used chats are removed first. Size depends on the model: a few MB to about 1 GB per long chat."
                    select={MEMORY_DISK}
                    value={memory ? String(memory.settings.max_disk_gb) : undefined}
                    loading={memoryBusy}
                    disabled={!memory || memoryBusy || Boolean(memoryError)}
                    onChange={v => changeMemory({ max_disk_gb: Number(v) })}
                />
                <SettingItem
                    icon={CalendarX}
                    label="Remove unused memory after"
                    description="A chat's saved memory not used for this long is deleted. The chat itself stays."
                    select={MEMORY_AGE}
                    value={memory ? String(memory.settings.max_age_days) : undefined}
                    loading={memoryBusy}
                    disabled={!memory || memoryBusy || Boolean(memoryError)}
                    onChange={v => changeMemory({ max_age_days: Number(v) })}
                />
                <SettingItem
                    icon={Trash2}
                    label="Clear model memory"
                    description="Deletes every saved chat memory now. No chat or message is deleted."
                    action="Clear"
                    disabled={!memory || memory.chats.length === 0 || memoryBusy || Boolean(memoryError)}
                    onClick={clearMemory}
                />
                <SettingItem
                    icon={RotateCcw}
                    label="Refresh model memory"
                    description="Read the selected Engine's saved settings and current cache usage."
                    action="Refresh"
                    disabled={memoryBusy}
                    onClick={() => void modelMemory.refresh()}
                />
                <div className="px-4 py-3 border-t border-border/50 bg-muted/15 space-y-2.5" data-testid="saved-kv-details">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">Saved KV Caches by Chat</span>
                        <span className="text-[11px] text-muted-foreground">
                            {memory ? `${memory.chats.length} saved record${memory.chats.length === 1 ? '' : 's'}` : 'Unavailable'}
                        </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Saved disk KV caches are separate from chat transcripts, durable notes, and models currently loaded in RAM/VRAM. Not every ONNX model supports disk KV caching.
                    </p>
                    {memory && memory.chats.length > 0 ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1" data-testid="saved-kv-record-list">
                            {memory.chats.map(record => {
                                const title = sessions[record.chat_id]?.title;
                                const lastUsedDate = new Date(record.last_used * 1000).toLocaleString();
                                return (
                                    <div
                                        key={record.chat_id}
                                        data-testid={`saved-kv-row-${record.chat_id}`}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs"
                                    >
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center gap-2 truncate font-medium text-foreground">
                                                <span className="truncate">{title ? `${title} (${record.chat_id})` : record.chat_id}</span>
                                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                                    {record.model}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {formatBytes(record.bytes)} · {record.tokens.toLocaleString()} tokens · {record.positions.toLocaleString()} positions · Last used {lastUsedDate}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            data-testid={`saved-kv-delete-${record.chat_id}`}
                                            disabled={memoryBusy || Boolean(memoryError)}
                                            onClick={() => deleteSingleCache(record.chat_id, record.model, record.bytes)}
                                            className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                                        >
                                            Remove Cache
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-[11px] text-muted-foreground italic" data-testid="saved-kv-empty">
                            {memory ? 'No saved chat KV caches are stored on disk.' : 'Saved KV cache details are unavailable until status loads.'}
                        </div>
                    )}
                </div>
            </SettingSection>

            <SettingSection title="Archive">
                <SettingItem
                    icon={Trash2}
                    label="Delete archived chats after"
                    description="Counted from the day a chat was archived."
                    dynamicDescription={nextArchiveDeletion ? `Next deletion: ${nextArchiveDeletion.toLocaleDateString()}` : undefined}
                    select={ARCHIVE_DELETE}
                    value={String(prefs.archiveDeleteAfterDays)}
                    onChange={v => change('archiveDeleteAfterDays', Number(v))}
                />
                <SettingItem
                    icon={RotateCcw}
                    label="New message in an archived chat"
                    description="What happens when you continue a chat that is in the archive."
                    select={ARCHIVED_ACTIVITY}
                    value={prefs.archivedActivity}
                    onChange={v => change('archivedActivity', v as ArchivedActivity)}
                />
                <SettingItem
                    icon={Archive}
                    label="Delete all archived chats"
                    description={`Removes ${archived.length} archived chat${archived.length === 1 ? '' : 's'} and their attachments now.`}
                    action="Delete"
                    disabled={archived.length === 0}
                    onClick={deleteAllArchived}
                />
            </SettingSection>

            <SettingSection title="Automatic Cleanup">
                <SettingItem
                    icon={Clock}
                    label="Archive inactive chats after"
                    description="Chats with no new message for this long move to the archive."
                    select={AUTO_ARCHIVE}
                    value={String(prefs.autoArchiveAfterDays)}
                    onChange={v => change('autoArchiveAfterDays', Number(v))}
                />
                <SettingItem
                    icon={CalendarX}
                    label="Delete inactive chats after"
                    description="Chats with no new message for this long are deleted, archived or not."
                    select={DELETE_INACTIVE}
                    value={String(prefs.deleteInactiveAfterDays)}
                    onChange={v => change('deleteInactiveAfterDays', Number(v))}
                />
                <SettingItem
                    icon={RotateCcw}
                    label="Run cleanup now"
                    description="Cleanup also runs at startup and every hour. The open chat and private chats are never touched."
                    action="Run"
                    onClick={() => { void applyChatRetention().catch(error => toast.error(errorMessage(error))); }}
                />
            </SettingSection>

            {confirmModal && (
                <ConfirmationModal
                    open={Boolean(confirmModal)}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText}
                    isDestructive={confirmModal.isDestructive}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
        </div>
    );
}

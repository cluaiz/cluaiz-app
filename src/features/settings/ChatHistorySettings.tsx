import { useEffect, useMemo, useState } from 'react';
import { Archive, BrainCircuit, CalendarX, Clock, HardDrive, History, Pin, RotateCcw, Trash2, Layers } from 'lucide-react';
import { SettingSection, SettingItem, SelectOption } from './SharedComponents';
import { ConfirmationModal } from '../../components/ui/modal/ConfirmationModal';
import { useChatStore } from '../../store/chat/useChatStore';
import { ArchivedActivity, ChatPrefs, currentChatPrefs, useChatPrefsStore } from '../../store/chat/useChatPrefsStore';
import { planRetention } from '../../services/storage/chatRetention';
import { applyChatRetention } from '../../services/storage/chatRetentionRunner';
import { chatMemoryApi, ChatMemoryStatus, ChatMemorySettings } from '../../api/engine/chat-memory';

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
    const [memory, setMemory] = useState<ChatMemoryStatus | null>(null);
    const [memoryError, setMemoryError] = useState<string | null>(null);
    const [memoryBusy, setMemoryBusy] = useState(false);
    const refreshMemory = () => chatMemoryApi.getStatus()
        .then(status => { setMemory(status); setMemoryError(null); })
        .catch(() => setMemoryError('Engine is offline: model memory settings are unavailable'));
    useEffect(() => { refreshMemory(); }, []);

    const changeMemory = async (patch: Partial<ChatMemorySettings>) => {
        const executeChange = async () => {
            setMemoryBusy(true);
            try {
                await chatMemoryApi.updateSettings(patch);
                await refreshMemory();
            } catch {
                setMemoryError('The engine did not accept the change');
            } finally {
                setMemoryBusy(false);
            }
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
                setMemoryBusy(true);
                try {
                    await chatMemoryApi.clear();
                    await refreshMemory();
                } finally {
                    setMemoryBusy(false);
                }
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
            onConfirm: () => {
                targets.forEach(s => deleteSession(s.id));
                setConfirmModal(null);
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
                    description="After each answer the engine saves the chat's processed context, so continuing it later (after other chats, a model reload or a restart) starts at once instead of reading the whole history again."
                    dynamicDescription={memoryError ?? (memory ? `${formatBytes(memory.bytes)} used by ${memory.chats.length} chats · ${memory.directory}` : 'Loading…')}
                    toggle
                    active={Boolean(memory?.settings.enabled)}
                    loading={memoryBusy}
                    disabled={!memory}
                    onToggle={() => memory && changeMemory({ enabled: !memory.settings.enabled })}
                />
                <SettingItem
                    icon={HardDrive}
                    label="Disk limit"
                    description="When saved memory grows past this, the least recently used chats are removed first. Size depends on the model: a few MB to about 1 GB per long chat."
                    select={MEMORY_DISK}
                    value={memory ? String(memory.settings.max_disk_gb) : undefined}
                    loading={memoryBusy}
                    disabled={!memory}
                    onChange={v => changeMemory({ max_disk_gb: Number(v) })}
                />
                <SettingItem
                    icon={CalendarX}
                    label="Remove unused memory after"
                    description="A chat's saved memory not used for this long is deleted. The chat itself stays."
                    select={MEMORY_AGE}
                    value={memory ? String(memory.settings.max_age_days) : undefined}
                    loading={memoryBusy}
                    disabled={!memory}
                    onChange={v => changeMemory({ max_age_days: Number(v) })}
                />
                <SettingItem
                    icon={Trash2}
                    label="Clear model memory"
                    description="Deletes every saved chat memory now. No chat or message is deleted."
                    action="Clear"
                    disabled={!memory || memory.chats.length === 0 || memoryBusy}
                    onClick={clearMemory}
                />
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
                    onClick={() => applyChatRetention()}
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

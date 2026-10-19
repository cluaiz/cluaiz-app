import { useState, useEffect } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';
import { Bell, Volume2, VolumeX, MessageSquare, ShieldAlert, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { ElasticSlider } from '../../components/ui/cursor/ElasticSlider';
import { CustomDropdown, DropdownOption } from '../../components/ui/dropdown/CustomDropdown';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import {
    useNotificationStore,
    TRANSMISSION_SOUNDS,
    COMPLETION_SOUNDS,
    ALERT_SOUNDS,
} from '../../store/ui/useNotificationStore';
import { soundManager } from '../../services/sound/soundManager';

const transmissionOptions: DropdownOption[] = TRANSMISSION_SOUNDS.map(s => ({
    value: s.id,
    label: s.label,
    description: s.description,
}));

const completionOptions: DropdownOption[] = COMPLETION_SOUNDS.map(s => ({
    value: s.id,
    label: s.label,
    description: s.description,
}));

const alertOptions: DropdownOption[] = ALERT_SOUNDS.map(s => ({
    value: s.id,
    label: s.label,
    description: s.description,
}));

export function NotificationsSettings() {
    const store = useNotificationStore();
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
    const [securityAlerts, setSecurityAlerts] = useState(true);
    const [chatMentions, setChatMentions] = useState(true);

    useEffect(() => {
        setPermissionStatus(soundManager.getPermissionStatus());
    }, []);

    const handleRequestPermission = async () => {
        const res = await soundManager.requestPermission();
        setPermissionStatus(res);
        if (res === 'granted') {
            store.setDesktopPush(true);
        }
    };

    const handlePreview = (soundId: string) => {
        setPlayingSoundId(soundId);
        soundManager.playPreview(soundId);
        setTimeout(() => {
            setPlayingSoundId(curr => (curr === soundId ? null : curr));
        }, 900);
    };

    return (
        <div className="space-y-8 select-none">
            {/* Alert Channels & Push Notifications */}
            <SettingSection title="Alert Channels">
                <SettingItem
                    label="Desktop Push Notifications"
                    description="Receive real-time notifications on your desktop when assistant answers in background."
                    toggle
                    active={store.desktopPush}
                    onToggle={() => store.setDesktopPush(!store.desktopPush)}
                    icon={Bell}
                />

                {store.desktopPush && (
                    <div className="px-6 py-3.5 bg-black/20 border-b border-[var(--border-color)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            {permissionStatus === 'granted' ? (
                                <>
                                    <CheckCircle2 size={15} className="text-emerald-400" />
                                    <span className="text-xs font-semibold text-emerald-400">
                                        System Notifications Active
                                    </span>
                                </>
                            ) : permissionStatus === 'denied' ? (
                                <>
                                    <AlertCircle size={15} className="text-rose-400" />
                                    <span className="text-xs font-semibold text-rose-400">
                                        Notifications Blocked in Browser Settings
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={15} className="text-amber-400" />
                                    <span className="text-xs font-semibold text-amber-300">
                                        Browser Permission Required
                                    </span>
                                </>
                            )}
                        </div>

                        {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                            <button
                                onClick={handleRequestPermission}
                                className="px-3 py-1.5 rounded-xl bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/30 text-[var(--accent-color)] text-xs font-bold transition-all cursor-pointer"
                            >
                                Grant Permission
                            </button>
                        )}
                    </div>
                )}

                <SettingItem
                    label="Chat Mentions & Activity"
                    description="Notify when your name is mentioned or when a thread updates."
                    toggle
                    active={chatMentions}
                    onToggle={() => setChatMentions(!chatMentions)}
                    icon={MessageSquare}
                />
                <SettingItem
                    label="Security Alerts"
                    description="Get notified about session changes, authentication updates, or security flags."
                    toggle
                    active={securityAlerts}
                    onToggle={() => setSecurityAlerts(!securityAlerts)}
                    icon={ShieldAlert}
                />
            </SettingSection>

            {/* Sound & Audio Effects */}
            <SettingSection title="Sound & Chimes">
                <SettingItem
                    label="Enable Sound Effects"
                    description="Play audio cues for sending messages, receiving responses, and alert events."
                    toggle
                    active={store.soundEnabled}
                    onToggle={() => store.setSoundEnabled(!store.soundEnabled)}
                    icon={store.soundEnabled ? Volume2 : VolumeX}
                />

                {store.soundEnabled && (
                    <div className="p-6 space-y-6 animate-fade-in border-t border-[var(--border-color)]">
                        {/* Master Chime Volume */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-zinc-300">Master Sound Volume</span>
                                <span className="text-xs font-mono text-[var(--accent-color)] font-semibold">
                                    {Math.round(store.volume * 100)}%
                                </span>
                            </div>
                            <ElasticSlider
                                min={0}
                                max={1}
                                step={0.05}
                                value={store.volume}
                                onChange={store.setVolume}
                            />
                        </div>

                        {/* Sound Event Triggers */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                                Audio Cue Triggers
                            </h4>

                            {/* Message Sent Sound */}
                            <div className="p-4 rounded-2xl bg-black/25 border border-white/5 flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-xs font-bold text-white">Message Transmission</div>
                                    <div className="text-[10px] text-zinc-400">Instant audio feedback on message submit.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-[185px]">
                                        <CustomDropdown
                                            options={transmissionOptions}
                                            value={store.selectedSendSound}
                                            onChange={store.setSelectedSendSound}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handlePreview(store.selectedSendSound)}
                                        title="Preview Sound"
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                                            playingSoundId === store.selectedSendSound
                                                ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)] scale-105'
                                                : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                                        }`}
                                    >
                                        <Play size={13} className="fill-current ml-0.5" />
                                    </button>
                                    <ToggleSwitch
                                        active={store.soundOnSend}
                                        onToggle={() => store.setSoundOnSend(!store.soundOnSend)}
                                    />
                                </div>
                            </div>

                            {/* Response Complete Sound */}
                            <div className="p-4 rounded-2xl bg-black/25 border border-white/5 flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-xs font-bold text-white">Response Completion</div>
                                    <div className="text-[10px] text-zinc-400">Chime played when assistant completes replying.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-[185px]">
                                        <CustomDropdown
                                            options={completionOptions}
                                            value={store.selectedCompleteSound}
                                            onChange={store.setSelectedCompleteSound}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handlePreview(store.selectedCompleteSound)}
                                        title="Preview Sound"
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                                            playingSoundId === store.selectedCompleteSound
                                                ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)] scale-105'
                                                : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                                        }`}
                                    >
                                        <Play size={13} className="fill-current ml-0.5" />
                                    </button>
                                    <ToggleSwitch
                                        active={store.soundOnComplete}
                                        onToggle={() => store.setSoundOnComplete(!store.soundOnComplete)}
                                    />
                                </div>
                            </div>

                            {/* Error & Warning Alert */}
                            <div className="p-4 rounded-2xl bg-black/25 border border-white/5 flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-xs font-bold text-white">Errors & Diagnostics</div>
                                    <div className="text-[10px] text-zinc-400">Tone played when an engine error or network halt occurs.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-[185px]">
                                        <CustomDropdown
                                            options={alertOptions}
                                            value={store.selectedErrorSound}
                                            onChange={store.setSelectedErrorSound}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handlePreview(store.selectedErrorSound)}
                                        title="Preview Sound"
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                                            playingSoundId === store.selectedErrorSound
                                                ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)] scale-105'
                                                : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                                        }`}
                                    >
                                        <Play size={13} className="fill-current ml-0.5" />
                                    </button>
                                    <ToggleSwitch
                                        active={store.soundOnError}
                                        onToggle={() => store.setSoundOnError(!store.soundOnError)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </SettingSection>
        </div>
    );
}

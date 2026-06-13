import { useState } from 'react';
import { SettingSection, SettingItem } from './SharedComponents';
import { Bell, Volume2, Mail, MessageSquare, ShieldAlert } from 'lucide-react';
import { ElasticSlider } from '../cursor/ElasticSlider';

export function NotificationsSettings() {
    const [desktopPush, setDesktopPush] = useState(true);
    const [soundAlerts, setSoundAlerts] = useState(true);
    const [volume, setVolume] = useState(0.8);
    const [emailDigest, setEmailDigest] = useState('daily');
    const [securityAlerts, setSecurityAlerts] = useState(true);
    const [chatMentions, setChatMentions] = useState(true);

    return (
        <div className="space-y-8 select-none">
            <SettingSection title="Alert Channels">
                <SettingItem
                    label="Desktop Push Notifications"
                    description="Receive real-time notifications on your desktop even when Cluaiz is in background."
                    toggle
                    active={desktopPush}
                    onToggle={() => setDesktopPush(!desktopPush)}
                    icon={Bell}
                />
                <SettingItem
                    label="Chat Mentions & Activity"
                    description="Notify when your name is mentioned or when someone drops a direct message."
                    toggle
                    active={chatMentions}
                    onToggle={() => setChatMentions(!chatMentions)}
                    icon={MessageSquare}
                />
                <SettingItem
                    label="Security Alerts"
                    description="Get notified immediately about new logins, password updates, or API token generation."
                    toggle
                    active={securityAlerts}
                    onToggle={() => setSecurityAlerts(!securityAlerts)}
                    icon={ShieldAlert}
                />
            </SettingSection>

            <SettingSection title="Sound & Chimes">
                <div className="p-4 space-y-6">
                    <SettingItem
                        label="Enable Sound Effects"
                        description="Play sound chimes for incoming messages and system updates."
                        toggle
                        active={soundAlerts}
                        onToggle={() => setSoundAlerts(!soundAlerts)}
                        icon={Volume2}
                    />

                    {soundAlerts && (
                        <div className="space-y-2 px-2 animate-fade-in">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-zinc-400">Chime Volume</span>
                                <span className="text-xs font-mono text-[var(--accent-color)]">{Math.round(volume * 100)}%</span>
                            </div>
                            <ElasticSlider
                                min={0}
                                max={1}
                                step={0.05}
                                value={volume}
                                onChange={setVolume}
                            />
                        </div>
                    )}
                </div>
            </SettingSection>

            <SettingSection title="Email Digests">
                <div className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Mail size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">Inbox Digests</div>
                            <div className="text-[10px] text-zinc-500">Choose how often you want to receive recap emails.</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                        {[
                            { value: 'instant', label: 'Instant' },
                            { value: 'daily', label: 'Daily Digest' },
                            { value: 'weekly', label: 'Weekly Recap' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setEmailDigest(option.value)}
                                className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${emailDigest === option.value
                                        ? "bg-[var(--accent-color)]/10 border-[var(--accent-color)]/50 text-[var(--accent-color)] font-extrabold"
                                        : "bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </SettingSection>
        </div>
    );
}

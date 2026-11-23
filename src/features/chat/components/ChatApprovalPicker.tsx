import { useEffect, useRef, useState } from 'react';
import { Check, Lock, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { useChatStore } from '../../../store/chat/useChatStore';
import { controlsFor, useChatControlsStore, type ApprovalMode } from '../../../store/chat/useChatControlsStore';

/** The modes the Engine takes as `approval_mode` (its `chat_security_mode`), in plain words */
const MODES: { id: ApprovalMode | ''; label: string; help: string; icon: typeof Lock }[] = [
    { id: '', label: 'As in Settings', help: 'Follow the approval mode set in Settings', icon: Lock },
    { id: 'strict', label: 'Ask every time', help: 'Every tool asks before it runs', icon: ShieldAlert },
    { id: 'sandboxed', label: 'Auto', help: 'Safe tools run, risky ones ask', icon: Shield },
    { id: 'full_access', label: 'Full access', help: 'Tools run without asking', icon: ShieldCheck },
];

/** This chat's approval mode, in the input. Only this chat changes; Settings stay as they are. */
export function ChatApprovalPicker() {
    const chatId = useChatStore(s => s.activeSessionId);
    const byChat = useChatControlsStore(s => s.byChat), update = useChatControlsStore(s => s.update);
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const away = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, [open]);
    const current = MODES.find(mode => mode.id === (controlsFor(byChat, chatId).approvalMode ?? '')) ?? MODES[0];
    const Icon = current.icon;

    return <div ref={box} className="relative">
        <button type="button" onClick={() => setOpen(value => !value)} title={`Approvals for this chat: ${current.help}`}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[0.7rem] sm:text-xs font-medium transition-colors cursor-pointer ${open ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{current.label}</span>
        </button>
        {open && <div className="absolute bottom-full left-0 mb-2 w-64 z-50 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1.5 shadow-2xl">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Approvals for this chat</div>
            {MODES.map(mode => {
                const ModeIcon = mode.icon, chosen = mode.id === current.id;
                return <button key={mode.id || 'settings'} type="button"
                    onClick={() => { update(chatId, { approvalMode: mode.id || undefined }); setOpen(false); }}
                    className={`w-full flex items-start gap-2.5 rounded-md px-2 py-1.5 text-left cursor-pointer transition-colors ${chosen ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}>
                    <ModeIcon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="flex-1">
                        <span className="block text-xs font-semibold text-[var(--text-primary)]">{mode.label}</span>
                        <span className="block text-[11px] text-[var(--text-muted)]">{mode.help}</span>
                    </span>
                    {chosen && <Check className="w-3.5 h-3.5 mt-0.5 text-[var(--accent-color)]" />}
                </button>;
            })}
            <p className="px-2 pt-1 text-[10px] text-[var(--text-muted)]">A chat is never looser than Settings: the Engine keeps the stricter one.</p>
        </div>}
    </div>;
}

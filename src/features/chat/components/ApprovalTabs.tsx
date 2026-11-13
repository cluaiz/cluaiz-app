import React, { useMemo, useState } from 'react';
import { ShieldAlert, Check, X, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useChatStore } from '../../../store/chat/useChatStore';
import { errorMessage } from '../../../api/client/errors';
import { AttachedTab, attachedTabAction, attachedTabIcon } from '../../../components/ui/AttachedTab';
import { decideChatApproval, type ChatApproval } from '../approvals';

/** The calls of the open chat that wait for the user's yes or no. */
export function usePendingApprovals(): ChatApproval[] {
    const sessionId = useChatStore(s => s.activeSessionId);
    const messages = useChatStore(s => (s.activeSessionId ? s.sessions[s.activeSessionId]?.messages : undefined));
    return useMemo(() => !sessionId || !messages ? [] : messages.flatMap(message => {
        const request = message.permissionRequest;
        return request?.status === 'pending'
            ? [{ sessionId, requestId: request.requestId, toolName: request.toolName, category: request.category, parameters: request.parameters }]
            : [];
    }), [sessionId, messages]);
}

/** One waiting call as a card on the input: Approve, Reject (with an optional reason) and the call's arguments. */
function ApprovalTab({ approval }: { approval: ChatApproval }) {
    const [showDetails, setShowDetails] = useState(false);
    const [showReason, setShowReason] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const decide = async (approved: boolean) => {
        setBusy(true);
        setError(null);
        try {
            await decideChatApproval(approval, approved, approved ? undefined : reason.trim() || undefined);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const args = typeof approval.parameters === 'object' && approval.parameters !== null
        ? JSON.stringify(approval.parameters, null, 2) : String(approval.parameters ?? '{}');
    const oneLine = args.replace(/\s+/g, ' ');

    return (
        <AttachedTab
            onClick={() => setShowDetails(open => !open)}
            title={showDetails ? 'Hide the arguments' : 'Show the arguments'}
            actions={<>
                <button type="button" className={attachedTabIcon} disabled={busy} onClick={() => setShowReason(open => !open)} title="Reason for the model">
                    <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button type="button" className={attachedTabAction} disabled={busy} onClick={() => void decide(false)} title="Reject this call">
                    <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button type="button" className={`${attachedTabAction} !text-[var(--accent-color)] hover:opacity-80`} disabled={busy} onClick={() => void decide(true)} title="Approve this call">
                    <Check className="w-3.5 h-3.5" /> Approve
                </button>
            </>}
            below={(showDetails || showReason || error) && (
                <div className="space-y-1.5 pt-0.5">
                    {showDetails && (
                        <pre className="p-2 bg-[var(--bg-primary)]/60 border border-[var(--border-color)] rounded-lg font-mono text-[10px] text-[var(--text-primary)] overflow-x-auto max-h-40 select-text">
                            {args}
                        </pre>
                    )}
                    {showReason && (
                        <input
                            type="text"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') void decide(false); }}
                            placeholder="Why not? The model reads this (Enter rejects)"
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
                        />
                    )}
                    {error && <p role="alert" className="text-[11px] text-[var(--text-primary)]">Could not answer: {error}</p>}
                </div>
            )}
        >
            <ShieldAlert className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
            <span className="text-[10px] uppercase font-bold text-[var(--accent-color)] tracking-wider shrink-0">Approve?</span>
            <span className="text-[var(--text-muted)] shrink-0">|</span>
            <span className="text-[12px] font-medium text-[var(--text-primary)] shrink-0">{approval.toolName}</span>
            <span className="truncate font-mono text-[10px] text-[var(--text-muted)]">{oneLine}</span>
            {showDetails ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)] shrink-0" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />}
        </AttachedTab>
    );
}

/** Every waiting call of the open chat, stacked on the input like queued prompts. */
export function ApprovalTabs({ approvals }: { approvals: ChatApproval[] }) {
    return <>{approvals.map(approval => <ApprovalTab key={approval.requestId} approval={approval} />)}</>;
}

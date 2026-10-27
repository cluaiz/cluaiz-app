import React, { useState, useEffect, useRef } from 'react';
import { Shield, Check, X, MessageSquare, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { useChatStore } from '../../../store/chat/useChatStore';

import { usePermissionStore } from '../../../api/engine/permission/permission.store';
import { errorMessage } from '../../../api/client/errors';

interface PermissionApprovalCardProps {
    sessionId: string;
    permissionRequest: {
        requestId: string;
        toolName: string;
        category?: string;
        parameters?: any;
        status: 'pending' | 'approved' | 'rejected' | 'timeout';
        feedback?: string;
    };
}

export const PermissionApprovalCard: React.FC<PermissionApprovalCardProps> = ({ sessionId, permissionRequest }) => {
    const resolvePermissionRequest = useChatStore(s => s.resolvePermissionRequest);
    const connection = useConnectionStore(s => `${s.protocol}:${s.host}:${s.port}`);
    const scope = JSON.stringify([connection, sessionId, permissionRequest.requestId, permissionRequest.status]);
    const current = useRef<string | null>(scope);
    current.current = scope;
    const submitting = useRef<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFeedbackInput, setShowFeedbackInput] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [showParams, setShowParams] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // SSE does not provide a deadline. Engine decides expiry; mounting this card must not restart a timer.
    useEffect(() => {
        current.current = scope;
        submitting.current = null;
        setIsSubmitting(false);
        setError(null);
        setFeedbackText('');
        setShowFeedbackInput(false);
        return () => { current.current = null; };
    }, [scope]);

    const submit = async (approved: boolean) => {
        if (submitting.current === scope || permissionRequest.status !== 'pending') return;
        submitting.current = scope;
        setIsSubmitting(true);
        setError(null);
        const feedback = feedbackText.trim() || undefined;
        try {
            const store = usePermissionStore.getState();
            if (approved) await store.approvePermission(permissionRequest.requestId);
            else await store.rejectPermission(permissionRequest.requestId, feedback);
            if (current.current === scope) resolvePermissionRequest(sessionId, permissionRequest.requestId,
                approved ? 'approved' : 'rejected', approved ? undefined : feedback);
        } catch (err) {
            if (current.current === scope) setError(errorMessage(err));
        } finally {
            if (current.current === scope) {
                submitting.current = null;
                setIsSubmitting(false);
            }
        }
    };

    if (permissionRequest.status === 'approved') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold my-1.5 w-fit">
                <Check size={14} />
                <span>Action approved for <b>{permissionRequest.toolName}</b></span>
            </div>
        );
    }

    if (permissionRequest.status === 'rejected') {
        return (
            <div className="flex flex-col gap-1 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold my-1.5 w-fit">
                <div className="flex items-center gap-2">
                    <X size={14} />
                    <span>Action rejected for <b>{permissionRequest.toolName}</b></span>
                </div>
                {permissionRequest.feedback && (
                    <span className="text-[11px] text-[var(--text-secondary)] font-normal italic pl-5">
                        Feedback: &quot;{permissionRequest.feedback}&quot;
                    </span>
                )}
            </div>
        );
    }

    if (permissionRequest.status === 'timeout') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-semibold my-1.5 w-fit">
                <Clock size={14} />
                <span>Action approval expired</span>
            </div>
        );
    }

    const paramsStr = typeof permissionRequest.parameters === 'object'
        ? JSON.stringify(permissionRequest.parameters, null, 2)
        : String(permissionRequest.parameters || '{}');

    return (
        <div className="my-2 p-4 rounded-2xl bg-[var(--bg-secondary)]/90 border border-[var(--accent-color)]/40 shadow-lg space-y-3 w-full max-w-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold shrink-0">
                        <Shield size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-primary)]">Agent Action Approval</span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Paused
                            </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                            Tool: <code className="text-[var(--accent-color)] font-mono font-bold">{permissionRequest.toolName}</code>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                    <Clock size={12} />
                    <span>Awaiting decision</span>
                </div>
            </div>

            {/* Parameter Inspector Toggle */}
            <div className="border-t border-[var(--border-color)]/60 pt-2">
                <button
                    type="button"
                    onClick={() => setShowParams(!showParams)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                    {showParams ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>{showParams ? 'Hide Action Parameters' : 'View Action Parameters'}</span>
                </button>

                {showParams && (
                    <pre className="mt-2 p-2.5 bg-[var(--bg-primary)]/60 border border-[var(--border-color)] rounded-xl font-mono text-[10px] text-[var(--text-primary)] overflow-x-auto max-h-40">
                        {paramsStr}
                    </pre>
                )}
            </div>

            {/* Rejection Feedback Note Input (Revealed when rejecting or clicking Feedback) */}
            {showFeedbackInput && (
                <div className="space-y-1.5 pt-1 animate-in fade-in">
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1">
                        <MessageSquare size={11} /> Note for AI (SMS feedback):
                    </label>
                    <input
                        type="text"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="e.g. Do not touch this file, try alternative method..."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
                    />
                </div>
            )}

            {/* Decision Buttons */}
            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
            <div className="flex items-center justify-between pt-1 gap-2">
                {!showFeedbackInput ? (
                    <button
                        type="button"
                        onClick={() => setShowFeedbackInput(true)}
                        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium underline underline-offset-4 cursor-pointer"
                    >
                        Add denial reason...
                    </button>
                ) : <div />}

                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void submit(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                        <X size={14} /> Reject
                    </button>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void submit(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 text-[var(--bg-primary)] hover:opacity-90 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Check size={14} /> Approve Action
                    </button>
                </div>
            </div>
        </div>
    );
};

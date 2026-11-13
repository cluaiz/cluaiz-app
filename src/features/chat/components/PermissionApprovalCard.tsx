import React from 'react';
import { Check, X, Clock, ShieldAlert } from 'lucide-react';

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

const line = 'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium my-1.5 w-fit bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]';

/**
 * Where a tool call waited for approval in the chat. The question itself is the card on top of
 * the input (`ApprovalTabs`); here the chat only notes it and, later, the decision.
 */
export const PermissionApprovalCard: React.FC<PermissionApprovalCardProps> = ({ permissionRequest }) => {
    const tool = <b className="text-[var(--text-primary)]">{permissionRequest.toolName}</b>;
    switch (permissionRequest.status) {
        case 'approved':
            return <div className={line}><Check size={14} className="text-[var(--accent-color)]" /><span>Approved: {tool}</span></div>;
        case 'rejected':
            return (
                <div className={`${line} flex-col items-start`}>
                    <span className="flex items-center gap-2"><X size={14} /><span>Rejected: {tool}</span></span>
                    {permissionRequest.feedback && (
                        <span className="text-[11px] text-[var(--text-muted)] italic pl-5">Reason: &quot;{permissionRequest.feedback}&quot;</span>
                    )}
                </div>
            );
        case 'timeout':
            return <div className={line}><Clock size={14} /><span>Approval expired: {tool}</span></div>;
        default:
            return (
                <div className={line}>
                    <ShieldAlert size={14} className="text-[var(--accent-color)]" />
                    <span>{tool} waits for your approval: answer on the card above the input</span>
                </div>
            );
    }
};

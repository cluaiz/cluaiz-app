import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Layers, Loader2, AlertCircle } from 'lucide-react';
import type { ChatMessage } from '../../../store/chat/types';

interface CompactionCardProps {
    compaction: NonNullable<ChatMessage['compaction']>;
}

/** The chat was compacted here: what happened, and the summary the model now works from. */
export const CompactionCard: React.FC<CompactionCardProps> = ({ compaction }) => {
    const [open, setOpen] = useState(false);
    const { status, replacedMessages, auto, summary, error } = compaction;
    const title = status === 'running'
        ? `Compacting ${replacedMessages} messages…`
        : status === 'failed'
            ? 'Compaction failed'
            : `${auto ? 'Context was nearly full: ' : ''}${replacedMessages} messages compacted into a summary`;
    const Icon = status === 'running' ? Loader2 : status === 'failed' ? AlertCircle : Layers;
    return (
        <div className="w-full flex flex-col items-center my-1 select-text">
            <button
                type="button"
                disabled={status !== 'done'}
                onClick={() => setOpen(value => !value)}
                className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:cursor-default"
            >
                <Icon className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-spin' : ''} ${status === 'failed' ? 'text-red-400' : ''}`} />
                <span>{title}</span>
                {status === 'done' && (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
            </button>
            {status === 'failed' && error && (
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">{error}. The full conversation is still sent.</p>
            )}
            {open && status === 'done' && (
                <div className="mt-2 w-full max-w-2xl rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        The model continues from this summary; the messages above stay visible but are no longer sent
                    </p>
                    {summary}
                </div>
            )}
        </div>
    );
};

import React from 'react';

/** Small text button inside an `AttachedTab`, such as Steer, Approve or Reject. */
export const attachedTabAction =
    'flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50 disabled:cursor-default';

/** Icon-only button inside an `AttachedTab`, such as edit or remove. */
export const attachedTabIcon =
    'text-[var(--text-muted)] hover:text-[var(--accent-color)] transition-colors cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center disabled:opacity-50';

/**
 * The card that sits on top of the chat input: a queued prompt, a reply target, a call waiting for
 * approval. Its content on the left, its actions on the right after a divider, and an optional
 * part below (details, a reason field).
 */
export function AttachedTab({ children, actions, below, onClick, title }: {
    children: React.ReactNode;
    actions?: React.ReactNode;
    below?: React.ReactNode;
    onClick?: () => void;
    title?: string;
}) {
    return (
        <div className="w-full rounded-t-[14px] bg-[var(--bg-secondary)] border border-b-0 border-[var(--border-color)] text-xs text-[var(--text-secondary)] shadow-sm select-none">
            <div className="flex items-center justify-between px-3.5 py-1.5">
                <div
                    onClick={onClick}
                    title={title}
                    className={`flex items-center gap-2 min-w-0 flex-1 mr-3 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                >
                    {children}
                </div>
                {actions && (
                    <div className="flex items-center gap-3 shrink-0 border-l border-[var(--border-color)] pl-3">{actions}</div>
                )}
            </div>
            {below && <div className="px-3.5 pb-2">{below}</div>}
        </div>
    );
}

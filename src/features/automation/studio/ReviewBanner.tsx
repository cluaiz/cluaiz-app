import { Check, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { Review } from '../model/flowGraph';

/** A change applied from the chat: what it added, changed and removed, kept or undone with one click */
export function ReviewBanner({ review, onKeep, onUndo }: { review: Review; onKeep: () => void; onUndo: () => void }) {
    const marks = Object.values(review.marks);
    const added = marks.filter(mark => mark === 'added').length, changed = marks.length - added;
    const parts = [added && `${added} added`, changed && `${changed} changed`, review.removed.length && `${review.removed.length} removed`].filter(Boolean);
    return <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-[var(--accent-color)]/40 bg-[var(--bg-secondary)]/95 backdrop-blur-md shadow-2xl px-3 py-2 max-w-[calc(100%-24px)]">
        <Sparkles className="w-4 h-4 shrink-0 text-[var(--accent-color)]" />
        <div className="min-w-0">
            <div className="text-xs font-semibold text-[var(--text-primary)]">Applied from the chat</div>
            <div className="text-[11px] text-[var(--text-muted)] truncate" title={review.removed.length ? `Removed: ${review.removed.join(', ')}` : undefined}>
                {parts.length ? parts.join(' · ') : 'No step changed'}{review.removed.length ? ` (${review.removed.join(', ')})` : ''}
            </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onUndo}><Undo2 className="w-3.5 h-3.5 mr-1" /> Undo</Button>
        <Button size="sm" onClick={onKeep}><Check className="w-3.5 h-3.5 mr-1" /> Keep</Button>
    </div>;
}

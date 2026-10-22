import React from 'react';
import { Dialog, DialogContent } from '../Dialog';
import { Button } from '../Button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface PortConfirmModalProps {
    open: boolean;
    pendingPort: number | null;
    currentPort: string;
    isUpdating: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const PortConfirmModal: React.FC<PortConfirmModalProps> = ({
    open,
    pendingPort,
    currentPort,
    isUpdating,
    onConfirm,
    onCancel,
}) => {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && !isUpdating && onCancel()}>
            <DialogContent className="p-6 max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-modal)] shadow-2xl overflow-hidden">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-[var(--radius-btn)] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                            Restart Required for Port Change
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                            Engine Gateway Socket Update
                        </p>
                    </div>
                </div>

                <div className="space-y-3 mt-4">
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Changing the gateway port to <span className="font-bold text-[var(--text-primary)]">{pendingPort}</span> will update <code className="px-1.5 py-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] font-mono text-[11px]">permission.json</code>.
                    </p>
                    <div className="text-xs text-amber-300/90 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-3 rounded-[var(--radius-btn)] font-medium">
                        The running engine daemon will continue on port <span className="font-mono font-bold text-amber-200">{currentPort}</span> until you restart it (`cargo run -- serve`).
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]/60">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onCancel}
                        disabled={isUpdating}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={onConfirm}
                        disabled={isUpdating}
                    >
                        {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isUpdating ? 'Saving to Engine...' : 'Confirm & Update Port'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

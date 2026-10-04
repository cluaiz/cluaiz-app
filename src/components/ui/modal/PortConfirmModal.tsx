import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../Dialog';
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
            <DialogContent className="p-6 max-w-md space-y-4">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-bold">Restart Required for Port Change</DialogTitle>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Engine Gateway Socket Update</p>
                        </div>
                    </div>
                </DialogHeader>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Changing the gateway port to <span className="font-semibold text-[var(--text-primary)]">{pendingPort}</span> will update <code className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--accent-color)] font-mono text-[11px]">permission.json</code>.
                </p>
                <p className="text-xs text-amber-300/90 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                    The running engine daemon will continue on port <span className="font-mono font-bold">{currentPort}</span> until you restart it (`cargo run -- serve`).
                </p>

                <DialogFooter className="pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isUpdating}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isUpdating}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-color)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isUpdating ? 'Saving to Engine...' : 'Confirm & Update Port'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

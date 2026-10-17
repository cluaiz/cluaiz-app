import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../Dialog';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmationModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    open,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm,
    onCancel,
}) => {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
            <DialogContent className="p-6 max-w-md space-y-4 bg-[var(--bg-secondary)] border-[var(--border-color)]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        {isDestructive && (
                            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <DialogTitle className="text-sm font-bold text-[var(--text-primary)]">{title}</DialogTitle>
                        </div>
                    </div>
                </DialogHeader>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {message}
                </p>

                <DialogFooter className="pt-2 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                            isDestructive
                                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                                : 'bg-[var(--accent-color)] hover:opacity-90 text-[var(--accent-contrast,#ffffff)]'
                        }`}
                    >
                        {confirmText}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

import React from 'react';
import { Dialog, DialogContent } from '../Dialog';
import { Button } from '../Button';
import { AlertTriangle, Info } from 'lucide-react';

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
            <DialogContent className="p-6 max-w-md bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-modal)] shadow-2xl overflow-hidden">
                <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-[var(--radius-btn)] flex items-center justify-center shrink-0 ${
                        isDestructive 
                            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500' 
                            : 'bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 text-[var(--accent-color)]'
                    }`}>
                        {isDestructive ? <AlertTriangle size={20} /> : <Info size={20} />}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                            {title}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2 font-medium">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]/60">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        variant={isDestructive ? 'destructive' : 'default'}
                        size="sm"
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

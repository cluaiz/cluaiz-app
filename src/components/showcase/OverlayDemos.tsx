import { Smile } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../ui/modal/ConfirmationModal';
import { PortConfirmModal } from '../ui/modal/PortConfirmModal';

import { LabelModal } from '../ui/LabelModal';
import { EmojiPicker } from '../ui/context-menu/EmojiPicker';
import { toast } from '../ui/toast';
import type { ShowcaseDemoState } from './state';
export function OverlayDemos(state: ShowcaseDemoState){
const {selectedId, isConfirmOpen, setIsConfirmOpen, isPortModalOpen, setIsPortModalOpen, isLabelModalOpen, setIsLabelModalOpen, isEmojiPickerOpen, setIsEmojiPickerOpen, selectedEmoji, setSelectedEmoji, emojiTriggerRef}=state;
return <>
{selectedId === 'emojipicker' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">EmojiPicker</h4>
                                    <p className="text-[11px] text-[var(--text-muted)]">Selected: <span className="text-lg">{selectedEmoji}</span></p>
                                </div>
                                <div className="relative">
                                    <Button
                                        ref={emojiTriggerRef}
                                        variant="cyber"
                                        size="sm"
                                        onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                    >
                                        <Smile className="w-3.5 h-3.5 mr-1.5" />
                                        Open Reaction Picker
                                    </Button>
                                    {isEmojiPickerOpen && (
                                        <div className="absolute bottom-full mb-2 right-0 z-50">
                                            <EmojiPicker
                                                onSelect={(e) => {
                                                    setSelectedEmoji(e);
                                                    setIsEmojiPickerOpen(false);
                                                }}
                                                onClose={() => setIsEmojiPickerOpen(false)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
{selectedId === 'confirmationmodal' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">ConfirmationModal (Destructive)</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Triggers a dialog with backdrop dimming and confirmation button.</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => setIsConfirmOpen(true)}>
                                Trigger Confirmation Dialog
                            </Button>
                            <ConfirmationModal
                                open={isConfirmOpen}
                                onCancel={() => setIsConfirmOpen(false)}
                                onConfirm={() => {
                                    setIsConfirmOpen(false);
                                    toast.success('Action successfully confirmed.');
                                }}
                                title="Purge Active Inference Context?"
                                message="This will reset the current KV cache in VRAM. All unsaved tokens will be discarded."
                                confirmText="Purge VRAM"
                                isDestructive={true}
                            />
                        </div>
                    )}
{selectedId === 'portmodal' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">PortConfirmModal</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Server daemon port reconfiguration restart warning.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsPortModalOpen(true)}>
                                Open Port Modal
                            </Button>
                            <PortConfirmModal
                                open={isPortModalOpen}
                                pendingPort={8088}
                                currentPort="8080"
                                isUpdating={false}
                                onConfirm={() => setIsPortModalOpen(false)}
                                onCancel={() => setIsPortModalOpen(false)}
                            />
                        </div>
                    )}
{selectedId === 'labelmodal' && (
                        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] space-y-4 max-w-md">
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-primary)]">LabelModal</h4>
                                <p className="text-[11px] text-[var(--text-muted)]">Interactive tag ribbons pool manager.</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setIsLabelModalOpen(true)}>
                                Open Ribbon Manager
                            </Button>
                            <LabelModal
                                isOpen={isLabelModalOpen}
                                onClose={() => setIsLabelModalOpen(false)}
                                onApply={(n) => {
                                    setIsLabelModalOpen(false);
                                    toast.success(`Applied tag: ${n}`);
                                }}
                                onCreate={(n) => {
                                    setIsLabelModalOpen(false);
                                    toast.success(`Created tag: ${n}`);
                                }}
                                existingTags={['urgent:urgent', 'core-engine:info', 'memory-leak:warning']}
                            />
                        </div>
                    )}
</>;
}

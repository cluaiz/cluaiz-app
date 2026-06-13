import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './Dialog';
import { Button } from './Button';
import { EmojiPicker } from './context-menu/EmojiPicker';
import { Input } from './Input';
import { AnimatePresence } from 'framer-motion';

export interface EditChatModalProps {
    isOpen: boolean;
    chatId: string | null;
    initialName: string;
    initialEmoji: string;
    onClose: () => void;
    onSave: (id: string, name: string, emoji: string) => void;
}

export const EditChatModal: React.FC<EditChatModalProps> = ({ isOpen, chatId, initialName, initialEmoji, onClose, onSave }) => {
    const [name, setName] = useState(initialName);
    const [emoji, setEmoji] = useState(initialEmoji);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setEmoji(initialEmoji);
            setShowEmojiPicker(false);
        }
    }, [isOpen, initialName, initialEmoji]);

    if (!isOpen || !chatId) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="p-6 max-w-sm overflow-visible bg-[var(--bg-primary)]">
                <DialogHeader className="mb-6">
                    <DialogTitle>Edit Chat</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 relative">
                        <label className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider">Chat Icon</label>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="w-16 h-16 shrink-0 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center text-3xl transition-colors cursor-pointer select-none"
                                style={{ borderStyle: 'var(--border-style)' }}
                            >
                                {emoji.startsWith('http') || emoji.startsWith('/') ? (
                                    <img src={emoji} alt="" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    emoji
                                )}
                            </button>
                            <span className="text-[11px] font-medium text-[var(--text-muted)]">Click the icon to choose a new emoji</span>
                        </div>
                        
                        <AnimatePresence>
                            {showEmojiPicker && (
                                <div className="absolute top-0 left-[72px] z-50">
                                    <EmojiPicker onSelect={(e) => { setEmoji(e); setShowEmojiPicker(false); }} />
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider">Chat Name</label>
                        <Input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="Enter chat name..." 
                        />
                    </div>
                </div>

                <DialogFooter className="mt-8">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="default" onClick={() => { onSave(chatId, name, emoji); onClose(); }}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

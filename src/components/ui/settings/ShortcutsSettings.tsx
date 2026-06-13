import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, RotateCcw } from 'lucide-react';
import { useShortcutStore, formatBinding, ActionId, ShortcutBinding, parseKeyboardEvent } from '../../../store/ui/useShortcutStore';
import { Button } from '../Button';

export function ShortcutsSettings() {
    const { shortcuts, updateShortcut, resetAllShortcuts, resetShortcut } = useShortcutStore();
    const [listeningId, setListeningId] = useState<ActionId | null>(null);

    useEffect(() => {
        if (!listeningId) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            
            // Ignore standalone modifier key presses
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                return;
            }

            // Also ignore Escape if used to cancel listening
            if (e.key === 'Escape') {
                setListeningId(null);
                return;
            }

            const newBinding = parseKeyboardEvent(e);
            updateShortcut(listeningId, newBinding);
            setListeningId(null);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [listeningId, updateShortcut]);

    return (
        <div className="space-y-8 select-none">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-[var(--accent-color)]" />
                        Keyboard Shortcuts
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        Customize global hotkeys for quick actions. Click a shortcut to edit it. Press <kbd className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[10px]">Esc</kbd> to cancel editing.
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetAllShortcuts}
                    className="flex items-center gap-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 border-red-500/20"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All
                </Button>
            </div>

            <div className="bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-2xl overflow-hidden">
                <div className="divide-y divide-[var(--border-color)]">
                    {shortcuts.map((item) => {
                        const isListening = listeningId === item.id;
                        
                        return (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
                                    <span className="text-[11px] text-[var(--text-muted)]">{item.description}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {formatBinding(item.binding) !== formatBinding(item.defaultBinding) && !isListening && (
                                        <button 
                                            onClick={() => resetShortcut(item.id)}
                                            className="text-[10px] text-[var(--text-muted)] hover:text-red-400 underline-offset-2 hover:underline transition-colors cursor-pointer"
                                            title="Reset to default"
                                        >
                                            Reset
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setListeningId(isListening ? null : item.id)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-wide transition-all cursor-pointer shadow-sm ${
                                            isListening 
                                                ? 'bg-[var(--accent-color)] text-[var(--bg-primary)] border-[var(--accent-color)] shadow-[0_0_10px_var(--accent-glow)] animate-pulse' 
                                                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                        }`}
                                    >
                                        {isListening ? 'Listening...' : formatBinding(item.binding)}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

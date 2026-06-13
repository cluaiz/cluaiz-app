import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShortcutBinding {
    key: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
}

export type ActionId = 'newChat' | 'privateChat' | 'toggleSidebar' | 'hideSidebar' | 'openLauncher' | 'settingsMenu' | 'closeOverlay';

export interface ShortcutItem {
    id: ActionId;
    label: string;
    description: string;
    defaultBinding: ShortcutBinding;
    binding: ShortcutBinding;
}

export const formatBinding = (binding: ShortcutBinding): string => {
    const parts = [];
    if (binding.ctrlKey) parts.push('Ctrl');
    if (binding.metaKey && !binding.ctrlKey) parts.push('Win/Cmd');
    if (binding.altKey) parts.push('Alt');
    if (binding.shiftKey) parts.push('Shift');
    
    // Capitalize key
    const k = binding.key === ' ' ? 'Space' : binding.key.charAt(0).toUpperCase() + binding.key.slice(1);
    parts.push(k);
    
    return parts.join(' + ');
};

export const parseKeyboardEvent = (e: KeyboardEvent | React.KeyboardEvent): ShortcutBinding => {
    return {
        key: e.key.toLowerCase(),
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey
    };
};

export const bindingsMatch = (b1: ShortcutBinding, b2: ShortcutBinding): boolean => {
    return b1.key === b2.key &&
           b1.ctrlKey === b2.ctrlKey &&
           b1.altKey === b2.altKey &&
           b1.shiftKey === b2.shiftKey &&
           b1.metaKey === b2.metaKey;
};

const defaultShortcuts: ShortcutItem[] = [
    {
        id: 'newChat',
        label: 'New Chat',
        description: 'Start a new standard chat session.',
        defaultBinding: { key: 'n', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false },
        binding: { key: 'n', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false }
    },
    {
        id: 'privateChat',
        label: 'New Private Chat',
        description: 'Start a new incognito chat session.',
        defaultBinding: { key: 'n', ctrlKey: false, altKey: true, shiftKey: true, metaKey: false },
        binding: { key: 'n', ctrlKey: false, altKey: true, shiftKey: true, metaKey: false }
    },
    {
        id: 'toggleSidebar',
        label: 'Toggle Sidebar',
        description: 'Collapse or expand the left sidebar.',
        defaultBinding: { key: 'b', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false },
        binding: { key: 'b', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }
    },
    {
        id: 'hideSidebar',
        label: 'Hide Sidebar',
        description: 'Completely hide the left sidebar.',
        defaultBinding: { key: 'b', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false },
        binding: { key: 'b', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false }
    },
    {
        id: 'openLauncher',
        label: 'Open Launcher',
        description: 'Open the global search and command launcher.',
        defaultBinding: { key: 'm', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false },
        binding: { key: 'm', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }
    },
    {
        id: 'settingsMenu',
        label: 'Settings Menu',
        description: 'Open the application settings.',
        defaultBinding: { key: ',', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false },
        binding: { key: ',', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }
    },
    {
        id: 'closeOverlay',
        label: 'Close Overlay / Back',
        description: 'Close modals, settings, or go back.',
        defaultBinding: { key: 'escape', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false },
        binding: { key: 'escape', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }
    }
];

interface ShortcutStore {
    shortcuts: ShortcutItem[];
    updateShortcut: (id: ActionId, newBinding: ShortcutBinding) => void;
    resetShortcut: (id: ActionId) => void;
    resetAllShortcuts: () => void;
    getBindingForAction: (id: ActionId) => ShortcutBinding;
}

export const useShortcutStore = create<ShortcutStore>()(
    persist(
        (set, get) => ({
            shortcuts: defaultShortcuts,
            
            updateShortcut: (id, newBinding) => set((state) => ({
                shortcuts: state.shortcuts.map(s => 
                    s.id === id ? { ...s, binding: newBinding } : s
                )
            })),
            
            resetShortcut: (id) => set((state) => ({
                shortcuts: state.shortcuts.map(s => 
                    s.id === id ? { ...s, binding: s.defaultBinding } : s
                )
            })),
            
            resetAllShortcuts: () => set(() => ({
                shortcuts: defaultShortcuts
            })),
            
            getBindingForAction: (id) => {
                const shortcut = get().shortcuts.find(s => s.id === id);
                return shortcut ? shortcut.binding : defaultShortcuts.find(s => s.id === id)!.defaultBinding;
            }
        }),
        {
            name: 'cluaiz-shortcuts-v2',
            version: 1,
        }
    )
);

import React from 'react';
import {
    Archive,
    Brain,
    Cpu,
    History,
    Volume2,
    VolumeX,
    Sun,
    Moon,
    Home
} from 'lucide-react';
import { X as AnimatedX } from '../../animate-ui/icons/x';
import { ActionListMenu } from './ActionListMenu';

interface GlobalChatContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: string) => void;
    viewMode?: 'widget' | 'dashboard';
    isMuted?: boolean;
    isDark?: boolean;
    isArchived?: boolean;
    isPrivateChat?: boolean;
}

export const GlobalChatContextMenu: React.FC<GlobalChatContextMenuProps> = ({
    x,
    y,
    isOpen,
    onClose,
    onAction,
    viewMode = 'dashboard',
    isMuted = false,
    isDark = false,
    isArchived = false,
    isPrivateChat = false
}) => {
    if (!isOpen) return null;

    const dashboardActions = [
        { id: 'ai_memory', label: 'AI Memory', icon: Brain },
        { id: 'conversation_memory', label: 'Conversation Memory', icon: History },
        { id: 'context_diagnostics', label: 'Context Diagnostics', icon: Cpu },
        ...(!isPrivateChat ? [{ id: 'archive', label: isArchived ? 'Unarchive' : 'Archive', icon: Archive }] : []),
        { id: 'close', label: 'Close chat', icon: AnimatedX, color: 'text-red-500' },
    ];

    const widgetActions = [
        { id: 'back_home', label: 'Back to Home', icon: Home, color: 'text-zinc-400' },
        { id: 'toggle_mute', label: isMuted ? 'Unmute Sounds' : 'Mute Sounds', icon: isMuted ? Volume2 : VolumeX, color: 'text-red-500' },
        { id: 'toggle_theme', label: isDark ? 'Light Mode' : 'Dark Mode', icon: isDark ? Sun : Moon, color: 'text-amber-500' },
        { id: 'close_widget', label: 'Close Chat', icon: AnimatedX, color: 'text-rose-600' },
    ];

    const actions = viewMode === 'widget' ? widgetActions : dashboardActions;

    return <ActionListMenu x={x} y={y} isOpen={isOpen} onClose={onClose} onAction={onAction}
        title={viewMode === 'widget' ? 'Cluaiz Menu' : 'Chat Options'}
        actions={actions.map((act, index) => ({ ...act,
            divider: (viewMode === 'dashboard' && act.id === 'close') || (viewMode === 'widget' && index === 3) }))} />;
};

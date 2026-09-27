import { Settings, LayoutDashboard, Wrench, Code2, Boxes, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLayoutStore } from '../../store/ui/useLayoutStore';

interface BubbleLauncherProps {
    isOpen: boolean;
    coords?: {x: number, y: number} | null;
    onClose: () => void;
    onOpenSettings?: (tab?: string) => void;
}

export function BubbleLauncher({ isOpen, coords, onClose, onOpenSettings }: BubbleLauncherProps) {
    const handleSelect = (action: string) => {
        onClose();
        if (action === 'settings') {
            onOpenSettings?.('general');
        } else if (action === 'dashboard') {
            useLayoutStore.getState().setActiveView('dashboard');
            document.dispatchEvent(new CustomEvent('open-dashboard'));
        } else if (action === 'new_chat') {
            useLayoutStore.getState().setActiveView('chat');
            document.dispatchEvent(new CustomEvent('start-new-chat'));
        } else if (action === 'tools') {
            useLayoutStore.getState().setActiveView('tools');
            document.dispatchEvent(new CustomEvent('open-tools'));
        } else if (action === 'apis') {
            useLayoutStore.getState().setActiveView('apis');
            document.dispatchEvent(new CustomEvent('open-apis'));
        } else if (action === 'toolkit') {
            useLayoutStore.getState().setActiveView('toolkit');
            document.dispatchEvent(new CustomEvent('open-toolkit'));
        }
    };

    // Safely clamp the X coordinate so the menu doesn't overflow the right edge of the screen
    // Menu width is approx 224px (w-56)
    const getLeftPos = () => {
        if (!coords) return 0;
        const menuWidth = 224;
        if (coords.x + menuWidth > window.innerWidth) {
            return window.innerWidth - menuWidth - 16;
        }
        return coords.x;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={`fixed inset-0 z-[200] ${!coords ? 'flex items-center justify-center' : ''} font-sans`}>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute inset-0 ${!coords ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent'}`}
                        onClick={onClose}
                    />
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: coords ? -5 : 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: coords ? -5 : 10 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`relative z-10 w-56 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 overflow-hidden flex flex-col gap-0.5 ${coords ? 'absolute' : ''}`}
                        style={coords ? { left: getLeftPos(), top: coords.y } : undefined}
                    >
                        <MenuItem icon={MessageSquare} label="New Chat" onClick={() => handleSelect('new_chat')} />
                        <MenuItem icon={LayoutDashboard} label="Dashboard" onClick={() => handleSelect('dashboard')} />
                        <MenuItem icon={Wrench} label="Tools" onClick={() => handleSelect('tools')} />
                        <MenuItem icon={Code2} label="APIs" onClick={() => handleSelect('apis')} />
                        <MenuItem icon={Boxes} label="Toolkit" onClick={() => handleSelect('toolkit')} />
                        
                        <div className="h-[1px] bg-[var(--border-color)] mx-2 my-1" />
                        
                        <MenuItem icon={Settings} label="Settings" onClick={() => handleSelect('settings')} />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function MenuItem({ icon: Icon, label, onClick }: any) {
    return (
        <button 
            onClick={onClick}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--border-color)] rounded-lg transition-colors text-left focus:outline-none"
        >
            <Icon size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            {label}
        </button>
    );
}

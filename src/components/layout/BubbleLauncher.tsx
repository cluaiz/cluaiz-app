import { Settings, LayoutDashboard, Zap, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BubbleLauncherProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: (tab?: string) => void;
}

export function BubbleLauncher({ isOpen, onClose, onOpenSettings }: BubbleLauncherProps) {
    const handleSelect = (action: string) => {
        onClose();
        if (action === 'settings') {
            onOpenSettings?.('general');
        } else if (action === 'dashboard') {
            document.dispatchEvent(new CustomEvent('open-dashboard'));
        } else if (action === 'new_chat') {
            document.dispatchEvent(new CustomEvent('start-new-chat'));
        } else if (action === 'skills') {
            console.log('Open skills');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center font-sans">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="relative z-10 w-64 bg-[#111111] border border-white/10 rounded-xl shadow-2xl p-1.5 overflow-hidden flex flex-col gap-0.5"
                    >
                        <MenuItem icon={MessageSquare} label="New Chat" onClick={() => handleSelect('new_chat')} />
                        <MenuItem icon={LayoutDashboard} label="Dashboard" onClick={() => handleSelect('dashboard')} />
                        <MenuItem icon={Zap} label="Skills" onClick={() => handleSelect('skills')} />
                        
                        <div className="h-[1px] bg-white/10 mx-2 my-1" />
                        
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
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 active:bg-white/5 rounded-lg transition-colors text-left focus:outline-none"
        >
            <Icon size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
            {label}
        </button>
    );
}

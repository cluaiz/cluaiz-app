import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Shield, Palette, Bell, HelpCircle, User, ExternalLink, Keyboard } from 'lucide-react';
import { GeneralSettings } from './GeneralSettings';
import { SecuritySettings } from './SecuritySettings';
import { ChatsSettings } from './ChatsSettings';
import { NotificationsSettings } from './NotificationsSettings';
import { ShortcutsSettings } from './ShortcutsSettings';

interface SettingsOverlayProps {
    isOpen: boolean;
    initialTab?: TabId;
    onClose: () => void;
}

type TabId = 'general' | 'security' | 'theme' | 'notifications' | 'shortcuts' | 'help';

export function SettingsOverlay({ isOpen, initialTab = 'general', onClose }: SettingsOverlayProps) {
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    if (!isOpen) return null;

    const navItems = [
        { id: 'general' as const, label: 'General', icon: Settings, desc: 'Startup options, language & timezone' },
        { id: 'security' as const, label: 'Security & Access', icon: Shield, desc: 'SSO, credentials & permissions' },
        { id: 'theme' as const, label: 'Theme', icon: Palette, desc: 'Themes, scaling, bubbles & fonts' },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell, desc: 'Chimes, volume & email digests' },
        { id: 'shortcuts' as const, label: 'Keyboard Shortcuts', icon: Keyboard, desc: 'Global hotkeys and bindings' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return <GeneralSettings />;
            case 'security':
                return <SecuritySettings />;
            case 'theme':
                return <ChatsSettings />;
            case 'notifications':
                return <NotificationsSettings />;
            case 'shortcuts':
                return <ShortcutsSettings />;
            case 'help':
                return (
                    <div className="space-y-8 select-none">
                        <div className="bg-gradient-to-br from-[var(--accent-color)]/10 to-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl p-8 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Cluaiz Intelligence Hub</h3>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-lg">
                                    You are running Cluaiz Desktop v0.1.0 (Developer Beta). Get help, submit feedback, or request features directly from our system logs terminal.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <a 
                                    href="https://github.com" 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="flex items-center gap-2 bg-[var(--accent-color)] hover:opacity-95 text-[var(--bg-primary)] text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer shadow-md"
                                >
                                    Documentation <ExternalLink size={14} />
                                </a>
                                <a 
                                    href="https://github.com" 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="flex items-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-black uppercase tracking-wider px-5 py-3 border border-[var(--border-color)] rounded-xl transition-all cursor-pointer"
                                >
                                    Report Bug
                                </a>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-2xl flex flex-col justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Developer Links</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-4">
                                        Check out the official documentation or view the roadmap.
                                    </p>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <a href="#" className="flex justify-between text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors">
                                        <span>Release Notes</span>
                                        <span>v0.1.0</span>
                                    </a>
                                </div>
                            </div>

                            <div className="p-6 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-2xl flex flex-col justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">About the Developer</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                        Cluaiz is built with care, blending modern aesthetics, high-performance rust backends, and futuristic AI tools.
                                    </p>
                                </div>
                                <div className="text-[10px] text-[var(--text-muted)] font-mono mt-4">
                                    © 2026 Cluaiz Technologies. All rights reserved.
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden font-[family-name:var(--font-family)]">
                {/* Backdrop Blur overlay with Framer Motion */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Main Modal Window */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[2rem] w-full max-w-5xl h-[85vh] flex overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10 text-[var(--text-primary)]"
                >
                    {/* Left Sidebar Panel */}
                    <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/30 p-6 flex flex-col justify-between shrink-0 select-none">
                        <div className="space-y-6">
                            {/* Profile Info Header */}
                            <div className="flex items-center gap-4 p-2 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border-color)]">
                                <div className="w-12 h-12 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] shadow-lg shrink-0">
                                    <User size={24} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-black text-[var(--text-primary)] truncate">Aryan</span>
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest truncate">Administrator</span>
                                    <span className="text-[8px] font-black text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded mt-1 self-start uppercase tracking-wider">SYS-ADMIN</span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-[1px] bg-[var(--border-color)]" />

                            {/* Tabs Navigation */}
                            <nav className="space-y-1">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-left cursor-pointer group ${
                                                isActive 
                                                    ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20' 
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 border border-transparent'
                                            }`}
                                        >
                                            <Icon size={18} className={isActive ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'} />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-extrabold">{item.label}</span>
                                                <span className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5 font-medium">{item.desc}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Bottom Help Trigger / Footer */}
                        <div className="space-y-4">
                            <div className="h-[1px] bg-[var(--border-color)]" />
                            <button
                                onClick={() => setActiveTab('help')}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-left cursor-pointer group ${
                                    activeTab === 'help' 
                                        ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20' 
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 border border-transparent'
                                }`}
                            >
                                <HelpCircle size={18} className={activeTab === 'help' ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'} />
                                <div className="flex flex-col">
                                    <span className="text-xs font-extrabold">Help & Feedback</span>
                                    <span className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5 font-medium">Docs, shortcuts & support</span>
                                </div>
                            </button>
                            <div className="text-[10px] text-[var(--text-muted)] opacity-60 text-center font-mono tracking-wider">
                                CLUAIZ v0.1.0
                            </div>
                        </div>
                    </div>

                    {/* Right Settings Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-secondary)]/10">
                        {/* Header bar */}
                        <div className="px-8 py-6 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 select-none">
                            <div>
                                <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wider">
                                    {activeTab === 'help' ? 'Help & Support' : activeTab === 'security' ? 'Security & Access' : activeTab === 'shortcuts' ? 'Keyboard Shortcuts' : activeTab}
                                </h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    {activeTab === 'general' && 'Configure Cluaiz startup options, system languages, and timezone settings.'}
                                    {activeTab === 'security' && 'Manage user access, biometric integrations, active SSO options, and credentials.'}
                                    {activeTab === 'theme' && 'Personalize visual theme colors, interface scaling, and chat fonts.'}
                                    {activeTab === 'notifications' && 'Tailor sound effects volume, desktop push updates, and inbox digest frequencies.'}
                                    {activeTab === 'shortcuts' && 'Customize global keyboard shortcuts and bindings for quick actions.'}
                                    {activeTab === 'help' && 'Review documentation, get support, or raise bug issues.'}
                                </p>
                            </div>
                        </div>

                        {/* Scrollable Viewport */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                transition={{ duration: 0.15 }}
                                className="max-w-3xl"
                            >
                                {renderTabContent()}
                            </motion.div>
                        </div>
                    </div>

                    {/* Close Button with spring rotation */}
                    <motion.button
                        onClick={onClose}
                        whileHover={{ rotate: 90, scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors cursor-pointer z-20 shadow-lg"
                    >
                        <X size={16} />
                    </motion.button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

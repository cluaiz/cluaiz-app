import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Shield, Palette, Bell, HelpCircle, ExternalLink, Keyboard, Cpu, Zap, Layers, Boxes, Heart, SlidersHorizontal } from 'lucide-react';
import pkg from '../../../../package.json';
import { GeneralSettings } from './GeneralSettings';
import { SecuritySettings } from './SecuritySettings';
import { ChatsSettings } from './ChatsSettings';
import { NotificationsSettings } from './NotificationsSettings';
import { ShortcutsSettings } from './ShortcutsSettings';
import { EngineSettings } from './EngineSettings';
import { InferenceSettings } from './InferenceSettings';
import { VectorSettings } from './VectorSettings';
import { ToolsSettings } from './ToolsSettings';
import { isTauri } from '../../../core/tauri-api';

interface SettingsOverlayProps {
    isOpen: boolean;
    initialTab?: TabId;
    onClose: () => void;
    onTabChange?: (tab: TabId) => void;
}

type TabId = 'general' | 'engine' | 'inference' | 'vector' | 'security' | 'tools' | 'theme' | 'notifications' | 'shortcuts' | 'help';

export function SettingsOverlay({ isOpen, initialTab = 'general', onClose, onTabChange }: SettingsOverlayProps) {
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);
    const [inTauri, setInTauri] = useState(false);

    useEffect(() => {
        setInTauri(isTauri());
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const handleSelectTab = (tab: TabId) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    };

    if (!isOpen) return null;

    const navItems = [
        { id: 'general' as const, label: 'General', icon: SlidersHorizontal, desc: 'Startup options, network & storage' },
        { id: 'engine' as const, label: 'Engine & Models', icon: Cpu, desc: 'Engine lifecycle & execution' },
        { id: 'inference' as const, label: 'LLM Inference Configuration', icon: Zap, desc: 'GGUF & ONNX parameters' },
        { id: 'vector' as const, label: 'Vector Generation', icon: Layers, desc: 'Embedding engine settings' },
        { id: 'security' as const, label: 'Security & Access', icon: Shield, desc: 'SSO, credentials & permissions' },
        { id: 'tools' as const, label: 'Tools & Plugins', icon: Boxes, desc: 'Manage installed plugins & tools' },
        { id: 'theme' as const, label: 'Theme', icon: Palette, desc: 'Themes, scaling, bubbles & fonts' },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell, desc: 'Chimes, volume & email digests' },
        { id: 'shortcuts' as const, label: 'Keyboard Shortcuts', icon: Keyboard, desc: 'Global hotkeys and bindings' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return <GeneralSettings />;
            case 'engine':
                return <EngineSettings />;
            case 'inference':
                return <InferenceSettings />;
            case 'vector':
                return <VectorSettings />;
            case 'security':
                return <SecuritySettings />;
            case 'tools':
                return <ToolsSettings />;
            case 'theme':
                return <ChatsSettings />;
            case 'notifications':
                return <NotificationsSettings />;
            case 'shortcuts':
                return <ShortcutsSettings />;
            case 'help':
                return (
                    <div className="space-y-8 select-none">
                        {/* Hero Help Card */}
                        <div className="bg-gradient-to-br from-[var(--accent-color)]/10 via-[var(--bg-secondary)]/60 to-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl p-8 space-y-6 shadow-sm">
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Cluaiz Intelligence Hub</h3>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xl">
                                    You are running Cluaiz Desktop v{pkg.version} (Developer Beta). Access official guides, submit bugs or feature requests, and support our development.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-1">
                                <a
                                    href="https://cluaiz.com/docs/cluaiz-app"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 bg-[var(--accent-color)] hover:opacity-95 text-[var(--bg-primary)] text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer shadow-md"
                                >
                                    Documentation <ExternalLink size={14} />
                                </a>
                                <a
                                    href="https://cluaiz.com/feedback"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-black uppercase tracking-wider px-5 py-3 border border-[var(--border-color)] rounded-xl transition-all cursor-pointer"
                                >
                                    Feedback & Bug Report <ExternalLink size={14} />
                                </a>
                                <a
                                    href="https://github.com/sponsors/Cluaiz-Technologies"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 text-xs font-black uppercase tracking-wider px-5 py-3 border border-pink-500/30 rounded-xl transition-all cursor-pointer"
                                >
                                    Sponsor <Heart size={14} className="fill-pink-400" />
                                </a>
                            </div>
                        </div>

                        {/* Two Columns Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-2xl flex flex-col justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Developer Links</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-4">
                                        Explore official repositories, documentation, and releases.
                                    </p>
                                </div>
                                <div className="space-y-3 text-xs">
                                    <a
                                        href="https://github.com/cluaiz/cluaiz-app"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors group"
                                    >
                                        <span className="flex items-center gap-2">GitHub Repository <ExternalLink size={12} className="opacity-70 group-hover:opacity-100" /></span>
                                        <span className="font-mono text-[10px] bg-[var(--text-primary)]/5 px-2 py-0.5 rounded">cluaiz/cluaiz-app</span>
                                    </a>
                                    <a
                                        href="https://cluaiz.com/docs/cluaiz-app"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors group"
                                    >
                                        <span className="flex items-center gap-2">App Documentation <ExternalLink size={12} className="opacity-70 group-hover:opacity-100" /></span>
                                        <span className="font-mono text-[10px] bg-[var(--text-primary)]/5 px-2 py-0.5 rounded">docs/cluaiz-app</span>
                                    </a>
                                    <div className="flex justify-between items-center text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]/60">
                                        <span>Release Notes</span>
                                        <a
                                            href="https://github.com/cluaiz/cluaiz-app/releases"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--accent-color)] hover:underline font-bold bg-[var(--accent-color)]/10 px-2 py-0.5 rounded border border-[var(--accent-color)]/20 transition-all cursor-pointer"
                                            title="View Releases on GitHub"
                                        >
                                            <span>v{pkg.version}</span>
                                            <ExternalLink size={10} />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-[var(--bg-secondary)]/40 border border-[var(--border-color)] rounded-2xl flex flex-col justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">About Cluaiz</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                                        Cluaiz is built with care, blending rich design, high-performance rust backends, and local AI tools.
                                    </p>
                                </div>
                                <div className="space-y-3 mt-4">
                                    <a
                                        href="https://cluaiz.com/about"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between text-xs text-[var(--accent-color)] hover:underline font-semibold"
                                    >
                                        <span>Learn about our mission</span>
                                        <ExternalLink size={13} />
                                    </a>
                                    <div className="text-[10px] text-[var(--text-muted)] font-mono pt-2 border-t border-[var(--border-color)]/60">
                                        © 2026 Cluaiz Technologies. All rights reserved.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <AnimatePresence>
            <div className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden font-[family-name:var(--font-family)] ${inTauri ? 'pt-[32px]' : ''}`}>
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
                    className="relative bg-[var(--bg-primary)] w-full h-full flex overflow-hidden z-10 text-[var(--text-primary)]"
                >
                    {/* Left Sidebar Panel */}
                    <div className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/30 flex flex-col h-full shrink-0 select-none overflow-hidden">
                        {/* Settings Header */}
                        <div className="h-[84px] px-6 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 flex items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)] shrink-0 shadow-sm">
                                    <Settings size={18} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-black text-[var(--text-primary)] tracking-wide uppercase">Settings</span>
                                    <span className="text-[10px] text-[var(--text-muted)] font-medium truncate">Preferences & Configuration</span>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation (Scrollable to prevent zoom overflow / clipping) */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                            <nav className="space-y-1">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectTab(item.id)}
                                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer group ${isActive
                                                    ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm'
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 border border-transparent'
                                                }`}
                                        >
                                            <Icon size={17} className={isActive ? 'text-[var(--accent-color)] shrink-0' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] shrink-0'} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-extrabold truncate">{item.label}</span>
                                                <span className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5 font-medium truncate">{item.desc}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Bottom Help Trigger / Footer */}
                        <div className="p-4 pt-3 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-secondary)]/30 space-y-2">
                            <button
                                onClick={() => handleSelectTab('help')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer group ${activeTab === 'help'
                                        ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 border border-transparent'
                                    }`}
                            >
                                <HelpCircle size={17} className={activeTab === 'help' ? 'text-[var(--accent-color)] shrink-0' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] shrink-0'} />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-extrabold">Help & Feedback</span>
                                    <span className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5 font-medium truncate">Docs, shortcuts & support</span>
                                </div>
                            </button>

                        </div>
                    </div>

                    {/* Right Settings Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-secondary)]/10">
                        {/* Header bar */}
                        <div className="h-[84px] px-8 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 select-none">
                           <div>
                                <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wider">
                                    {activeTab === 'help' ? 'Help & Support' : activeTab === 'engine' ? 'Engine & Models' : activeTab === 'security' ? 'Security & Access' : activeTab === 'shortcuts' ? 'Keyboard Shortcuts' : activeTab === 'inference' ? 'LLM Inference Configuration' : activeTab === 'vector' ? 'Vector Generation' : activeTab === 'tools' ? 'Tools & Plugins' : activeTab}
                                </h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    {activeTab === 'general' && 'Configure startup behavior, engine communication protocols, and temporary storage.'}
                                    {activeTab === 'engine' && 'Control engine background lifecycle, model loading strategies, and memory limits.'}
                                    {activeTab === 'inference' && 'Configure deep GGUF and ONNX hardware acceleration, context buffers, and sampling.'}
                                    {activeTab === 'vector' && 'Adjust embedding model execution providers, normalization, and RAG chunk parameters.'}
                                    {activeTab === 'tools' && 'Audit and manage active skills, runtime plugins, and external MCP servers.'}
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
                                className="w-full max-w-5xl mx-auto"
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

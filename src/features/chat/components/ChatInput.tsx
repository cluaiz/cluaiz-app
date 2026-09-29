import React, { useState, useRef, useEffect } from 'react';
import { Send, FileCode, FileText, Plus, ChevronDown, Mic, Zap, Sparkles, Globe, Brain, Image as ImageIcon, Video, File, X, Clock, ChevronRight, UploadCloud, Link as LinkIcon, Layers, FolderUp, Database, BookOpen, ZapOff, Telescope, CornerDownRight, Check, AlignLeft, AlignJustify, Box, Server, Info, SlidersHorizontal } from 'lucide-react';
import BorderGlow from '../../../components/ui/BorderGlow';
import { Backlight } from '../../../components/ui/Backlight';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { navigateTo } from '../../../core/router';

const DynamicToolIcon: React.FC<{ iconSvg?: string | null; fallback: React.ReactNode; className?: string }> = ({ iconSvg, fallback, className = "w-3.5 h-3.5" }) => {
    if (iconSvg) {
        return (
            <span
                className={`inline-flex items-center justify-center shrink-0 ${className} [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full`}
                dangerouslySetInnerHTML={{ __html: iconSvg }}
            />
        );
    }
    return <>{fallback}</>;
};

function formatBytes(bytes?: number | null) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}


const formatModelName = (rawFilename: string) => {
    if (!rawFilename) return { fullName: 'Unknown Model', shortName: 'Unknown' };

    // Split by colon (Format: name:parameters:architecture:quantization)
    const parts = rawFilename.split(':');

    const formatString = (str: string) => {
        let name = str.replace(/[-_]/g, ' ');
        return name.split(' ').map(word => {
            if (!word) return '';
            if (word.toLowerCase() === 'r1') return 'R1';
            if (word.match(/^[e]?\d+(\.\d+)?b$/i)) return word.toUpperCase();
            if (word.match(/^v\d+$/i)) return word.toUpperCase(); // V2, V3
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
    };

    const shortName = formatString(parts[0] || 'Unknown');
    let fullName = shortName;

    if (parts.length > 1) {
        const paramStr = parts[1].toLowerCase();
        if (paramStr !== 'unknown' && paramStr !== 'gguf' && paramStr !== 'onnx' && !paramStr.match(/^[qf]\d+/)) {
            fullName = `${shortName} ${formatString(parts[1])}`;
        }
    }

    return { fullName, shortName: fullName }; // Return fullName for both as requested
};

const getSkillIcon = (skill: string) => {
    switch (skill) {
        case 'Think Deep': return <Brain className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
        case 'Think Lite': return <Zap className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
        case 'Long Answer': return <AlignJustify className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
        case 'Short Answer': return <AlignLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
        case 'Web Search': return <Globe className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
        case 'Deep Research': return <Telescope className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
        default: return <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
    }
};

interface ChatInputProps {
    inputValue: string;
    setInputValue: (val: string) => void;
    handleSendMessage: (customText?: string, options?: import('../../../core/engine').SendChatOptions) => void;
    replyingTo?: { text: string; messageIndex: number; type?: 'message' | 'selection' } | null;
    setReplyingTo?: (val: { text: string; messageIndex: number; type?: 'message' | 'selection' } | null) => void;
    isFloating?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputValue,
    setInputValue,
    handleSendMessage,
    replyingTo,
    setReplyingTo,
    isFloating = false
}) => {
    const [isAttachOpen, setIsAttachOpen] = useState(false);
    const [isModelOpen, setIsModelOpen] = useState(false);
    const [modelTextWidth, setModelTextWidth] = useState(200);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [isEffortMenuOpen, setIsEffortMenuOpen] = useState(false);
    const [isThinkModeMenuOpen, setIsThinkModeMenuOpen] = useState(false);
    const [thinkMode, setThinkMode] = useState<'auto' | 'on' | 'off'>('auto');
    const [effort, setEffort] = useState<'auto' | 'low' | 'medium' | 'high' | 'max'>('auto');
    const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);
    const [isSkillsMenuOpen, setIsSkillsMenuOpen] = useState(false);
    const [isPluginsMenuOpen, setIsPluginsMenuOpen] = useState(false);
    const [isMcpMenuOpen, setIsMcpMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [wrapThreshold, setWrapThreshold] = useState<number>(Number.MAX_SAFE_INTEGER);

    // Real File Attachments State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: number; type: string }[]>([]);
    const [recentFiles, setRecentFiles] = useState<{ name: string; size: number; timestamp: number }[]>([]);

    // Real Dynamic Tools from Engine backend (/api/components/list)
    const { getBaseUrl } = useConnectionStore();
    const [backendTools, setBackendTools] = useState<{
        skills: { id: string; name: string; icon_svg?: string | null }[];
        plugins: { id: string; name: string; icon_svg?: string | null }[];
        mcp: { id: string; name: string; icon_svg?: string | null }[];
    }>({
        skills: [],
        plugins: [],
        mcp: []
    });

    useEffect(() => {
        try {
            const stored = localStorage.getItem('cluaiz_recent_attached_files');
            if (stored) setRecentFiles(JSON.parse(stored));
        } catch (e) {}

        const fetchTools = async () => {
            try {
                const res = await fetch(`${getBaseUrl()}/api/components/list`);
                if (res.ok) {
                    const data = await res.json();
                    const rich = data.rich || {};
                    const parseItems = (cat: string) => {
                        const richItems = rich[cat] || [];
                        if (richItems.length > 0) {
                            return richItems.map((item: any) => ({
                                id: item.id || item.name,
                                name: item.name || item.id,
                                icon_svg: item.icon_svg
                            }));
                        }
                        const raw = data[cat] || [];
                        return raw.map((id: string) => ({
                            id,
                            name: id.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                            icon_svg: null
                        }));
                    };

                    setBackendTools({
                        skills: parseItems('skill'),
                        plugins: parseItems('plugin'),
                        mcp: parseItems('mcp')
                    });
                }
            } catch (err) {
                // Silently fallback if engine is still booting
            }
        };
        fetchTools();
    }, [getBaseUrl]);

    const isWebSearchInstalled = backendTools.plugins.some(p => p.id === 'web-search' || p.name.toLowerCase().includes('search')) || backendTools.skills.some(s => s.id === 'web-search');
    const isDeepResearchInstalled = backendTools.plugins.some(p => p.id === 'deep-research' || p.name.toLowerCase().includes('deep')) || backendTools.skills.some(s => s.id === 'deep-research');

    const getSelectedToolIcon = (name: string) => {
        const allTools = [...backendTools.skills, ...backendTools.plugins, ...backendTools.mcp];
        const found = allTools.find(t => t.name === name || t.id === name);
        if (found?.icon_svg) {
            return <DynamicToolIcon iconSvg={found.icon_svg} fallback={<Layers className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />} />;
        }
        return getSkillIcon(name);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files).map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type
        }));

        setAttachedFiles(prev => [...prev, ...newFiles]);

        try {
            const stored = localStorage.getItem('cluaiz_recent_attached_files');
            const existing: { name: string; size: number; timestamp: number }[] = stored ? JSON.parse(stored) : [];
            const updated = [
                ...newFiles.map(f => ({ name: f.name, size: f.size, timestamp: Date.now() })),
                ...existing.filter(e => !newFiles.some(n => n.name === e.name))
            ].slice(0, 10);
            localStorage.setItem('cluaiz_recent_attached_files', JSON.stringify(updated));
            setRecentFiles(updated);
        } catch (err) {}

        e.target.value = '';
        setIsAttachOpen(false);
    };

    const removeFile = (id: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id));
    };

    // Engine State for Think Mode
    const booster = useEngineStore(s => s.booster);
    const updateBooster = useEngineStore(s => s.updateBooster);
    const permissions = useEngineStore(s => s.permissions);
    const updatePermission = useEngineStore(s => s.updatePermission);
    const fetchStatus = useEngineStore(s => s.fetchStatus);
    const initEngineSettings = useEngineStore(s => s.initEngineSettings);

    const handleSendWithAttachments = () => {
        if (!inputValue.trim() && attachedFiles.length === 0) return;

        let finalMsg = inputValue.trim();
        if (attachedFiles.length > 0) {
            const filesSummary = `[Attached Files: ${attachedFiles.map(f => `${f.name} (${formatBytes(f.size)})`).join(', ')}]`;
            finalMsg = finalMsg ? `${finalMsg}\n\n${filesSummary}` : filesSummary;
        }

        const activeTools = selectedSkills
            .filter(s => !['Think Deep', 'Think Lite', 'Long Answer', 'Short Answer'].includes(s))
            .map(s => ({ name: s, id: s }));

        const options: import('../../../core/engine').SendChatOptions = {
            think_mode: thinkMode,
            reasoning_effort: effort,
            model: permissions?.chat_models?.text || undefined,
            tools: activeTools.length > 0 ? activeTools : undefined,
        };

        handleSendMessage(finalMsg, options);
        setInputValue('');
        setAttachedFiles([]);
    };


    // Auto-fetch settings if not already fetched
    useEffect(() => {
        if (fetchStatus === 'idle') {
            initEngineSettings();
        }
    }, [fetchStatus, initEngineSettings]);

    // Dynamic Model Processing (From Engine /v1/models/installed with permissions fallback)
    const [installedModels, setInstalledModels] = useState<Array<{ id: string; fullName: string; shortName: string }>>([]);

    useEffect(() => {
        const fetchInstalledModels = async () => {
            try {
                const res = await fetch(`${getBaseUrl()}/v1/models/installed`);
                if (res.ok) {
                    const data = await res.json();
                    const raw = data.installed || data.installed_models || data.models || [];
                    const list = Array.isArray(raw) ? raw : Object.values(raw);
                    const chatModels = list.filter((m: any) => !m.category || m.category === 'chat');
                    if (chatModels.length > 0) {
                        setInstalledModels(chatModels.map((m: any) => {
                            const formatted = formatModelName(m.id || m.name);
                            return {
                                id: m.id || m.name,
                                fullName: formatted.fullName,
                                shortName: formatted.shortName
                            };
                        }));
                    }
                }
            } catch (e) {
                // Silently fallback to permissions
            }
        };
        fetchInstalledModels();
    }, [getBaseUrl]);

    const availableModels = permissions?.available_chat_models?.length
        ? permissions.available_chat_models
        : permissions?.available_models ?? [];

    const activeModelId = permissions?.chat_models?.text || 'Unknown Model';
    const displayModels = availableModels.length > 0 ? availableModels : [activeModelId];

    const modelOptions = installedModels.length > 0
        ? installedModels
        : displayModels.map(id => {
            const formatted = formatModelName(id);
            return {
                id,
                fullName: formatted.fullName,
                shortName: formatted.shortName
            };
        });

    // Calculate model text width based on real-time screen width and selected chips
    useEffect(() => {
        const calculateWidth = () => {
            const screenWidth = window.innerWidth;
            // Reserve enough width for UI elements (Plus, Mic, Send, Gaps, and Container Padding)
            // Increased to 260 to guarantee items never wrap to the next line.
            const fixedUiWidth = 260;
            // Approximate width per selected chip
            const widthPerChip = 65;

            let calculatedWidth = screenWidth - fixedUiWidth - (selectedSkills.length * widthPerChip);

            if (calculatedWidth < 40) calculatedWidth = 40;
            if (calculatedWidth > 200) calculatedWidth = 200;

            setModelTextWidth(calculatedWidth);
        };

        calculateWidth();
        window.addEventListener('resize', calculateWidth);
        return () => window.removeEventListener('resize', calculateWidth);
    }, [selectedSkills.length]);

    const currentModel = modelOptions.find(m => m.id === activeModelId) || modelOptions[0];

    const attachRef = useRef<HTMLDivElement>(null);
    const modelRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const thinkingRef = useRef<HTMLDivElement>(null);
    const recentRef = useRef<HTMLDivElement>(null);

    // Close attachment, model, and thinking dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (attachRef.current && !attachRef.current.contains(target)) {
                setIsAttachOpen(false);
                setIsEffortMenuOpen(false);
                setIsThinkModeMenuOpen(false);
                setIsRecentMenuOpen(false);
                setIsSkillsMenuOpen(false);
                setIsPluginsMenuOpen(false);
                setIsMcpMenuOpen(false);
            }
            if (modelRef.current && !modelRef.current.contains(target)) {
                setIsModelOpen(false);
            }
        };
        if (isAttachOpen || isModelOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAttachOpen, isModelOpen]);

    // Auto-expand exactly when the scrollbar triggers (scrollHeight > clientHeight)
    useEffect(() => {
        if (!textareaRef.current || isExpanded) return;

        const checkScrollbar = () => {
            const el = textareaRef.current;
            if (el && el.scrollHeight > el.clientHeight && el.clientHeight > 0) {
                setIsExpanded(true);
            }
        };

        // Check immediately
        checkScrollbar();

        // Observe for dimensions change (e.g. window resize causing squish)
        const observer = new ResizeObserver(() => {
            checkScrollbar();
        });

        observer.observe(textareaRef.current);

        return () => observer.disconnect();
    }, [isExpanded]);

    const toggleSkill = (skill: string) => {
        setSelectedSkills(prev => {
            if (prev.includes(skill)) return prev.filter(s => s !== skill);
            return [...prev, skill];
        });
        setIsAttachOpen(false);
    };


    const removeSkill = (skill: string) => {
        setSelectedSkills(prev => prev.filter(s => s !== skill));
    };

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openSubmenu = (menu: 'recent' | 'skills' | 'plugins' | 'mcp' | 'effort' | 'think_mode') => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsRecentMenuOpen(menu === 'recent');
            setIsSkillsMenuOpen(menu === 'skills');
            setIsPluginsMenuOpen(menu === 'plugins');
            setIsMcpMenuOpen(menu === 'mcp');
            setIsEffortMenuOpen(menu === 'effort');
            setIsThinkModeMenuOpen(menu === 'think_mode');
        }, 120);
    };

    const closeAllSubmenus = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsRecentMenuOpen(false);
            setIsSkillsMenuOpen(false);
            setIsPluginsMenuOpen(false);
            setIsMcpMenuOpen(false);
            setIsEffortMenuOpen(false);
            setIsThinkModeMenuOpen(false);
        }, 120);
    };

    const attachmentMenu = (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5" onMouseLeave={closeAllSubmenus}>
            {/* Real File Upload */}
            <button
                onClick={() => {
                    fileInputRef.current?.click();
                    setIsAttachOpen(false);
                }}
                className="w-full flex items-center gap-3 px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
            >
                <UploadCloud className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                Upload File
            </button>

            {/* Real Recent Files Submenu */}
            <div className={`relative ${isRecentMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('recent')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Recent Files
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isRecentMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] top-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 max-h-56 overflow-y-auto custom-scrollbar">
                            {recentFiles.length === 0 ? (
                                <div className="p-2.5 text-[11px] text-[var(--text-muted)] text-center italic">No recent files</div>
                            ) : (
                                recentFiles.map((rf, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setAttachedFiles(prev => [...prev, { id: `${rf.name}-${Date.now()}`, name: rf.name, size: rf.size, type: '' }]);
                                            setIsAttachOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--accent-color)]" />
                                            <span className="truncate">{rf.name}</span>
                                        </div>
                                        <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">{formatBytes(rf.size)}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-px bg-[var(--border-color)] my-1 mx-2" />

            {/* Real Dynamic Skills Submenu */}
            <div className={`relative ${isSkillsMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('skills')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Skills
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isSkillsMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                            {backendTools.skills.length === 0 ? (
                                <div className="p-2.5 text-[11px] text-[var(--text-muted)] text-center italic">No skills installed</div>
                            ) : (
                                backendTools.skills.map(sk => (
                                    <button
                                        key={sk.id}
                                        onClick={() => toggleSkill(sk.name)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 truncate">
                                            <DynamicToolIcon iconSvg={sk.icon_svg} fallback={<Layers className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />} />
                                            <span className="truncate">{sk.name}</span>
                                        </div>
                                        {selectedSkills.includes(sk.name) && <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                    </button>
                                ))
                            )}

                            <div className="h-px bg-[var(--border-color)] my-1 mx-1" />
                            <button
                                onClick={() => {
                                    setIsAttachOpen(false);
                                    navigateTo({ isSettingsOpen: true, settingsTab: 'tools' });
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors rounded-md text-left cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <Plus className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    <span>Browse Skills</span>
                                </div>
                                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Real Dynamic Plugins Submenu */}
            <div className={`relative ${isPluginsMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('plugins')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Box className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Plugins
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isPluginsMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                            {/* Web Search */}
                            {isWebSearchInstalled ? (
                                <button
                                    onClick={() => toggleSkill('Web Search')}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <Globe className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                        <span>Web Search</span>
                                    </div>
                                    {selectedSkills.includes('Web Search') && <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                </button>
                            ) : (
                                <button
                                    disabled
                                    title="Plugin not installed in engine"
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] opacity-40 cursor-not-allowed text-left rounded-md select-none"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <Globe className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                        <span>Web Search</span>
                                    </div>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)]">Not Installed</span>
                                </button>
                            )}

                            {/* Deep Research */}
                            {isDeepResearchInstalled ? (
                                <button
                                    onClick={() => toggleSkill('Deep Research')}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <Telescope className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                        <span>Deep Research</span>
                                    </div>
                                    {selectedSkills.includes('Deep Research') && <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                </button>
                            ) : (
                                <button
                                    disabled
                                    title="Plugin not installed in engine"
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] opacity-40 cursor-not-allowed text-left rounded-md select-none"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <Telescope className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                        <span>Deep Research</span>
                                    </div>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)]">Not Installed</span>
                                </button>
                            )}

                            {/* Dynamic Installed Plugins */}
                            {backendTools.plugins.filter(pl => pl.id !== 'web-search' && pl.id !== 'deep-research').map(pl => (
                                <button
                                    key={pl.id}
                                    onClick={() => toggleSkill(pl.name)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <DynamicToolIcon iconSvg={pl.icon_svg} fallback={<Box className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />} />
                                        <span className="truncate">{pl.name}</span>
                                    </div>
                                    {selectedSkills.includes(pl.name) && <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                </button>
                            ))}

                            <div className="h-px bg-[var(--border-color)] my-1 mx-1" />
                            <button
                                onClick={() => {
                                    setIsAttachOpen(false);
                                    navigateTo({ isSettingsOpen: true, settingsTab: 'tools' });
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors rounded-md text-left cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <Plus className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    <span>Browse Plugins</span>
                                </div>
                                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Real Dynamic MCP Submenu */}
            <div className={`relative ${isMcpMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('mcp')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Server className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        MCP
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isMcpMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 max-h-56 overflow-y-auto custom-scrollbar">
                            {backendTools.mcp.length === 0 ? (
                                <div className="p-2.5 text-[11px] text-[var(--text-muted)] text-center italic">No MCP servers active</div>
                            ) : (
                                backendTools.mcp.map(mc => (
                                    <button
                                        key={mc.id}
                                        onClick={() => toggleSkill(mc.name)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 truncate">
                                            <DynamicToolIcon iconSvg={mc.icon_svg} fallback={<Server className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />} />
                                            <span className="truncate">{mc.name}</span>
                                        </div>
                                        {selectedSkills.includes(mc.name) && <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                    </button>
                                ))
                            )}

                            <div className="h-px bg-[var(--border-color)] my-1 mx-1" />
                            <button
                                onClick={() => {
                                    setIsAttachOpen(false);
                                    navigateTo({ isSettingsOpen: true, settingsTab: 'tools' });
                                }}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors rounded-md text-left cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <Plus className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    <span>Browse MCP</span>
                                </div>
                                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Thinking Mode Submenu (Auto / On / Off) */}
            <div className={`relative ${isThinkModeMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('think_mode')}>
                <button
                    type="button"
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Brain className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        <span>Thinking Mode</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--accent-color)] uppercase font-mono font-bold">
                            {thinkMode}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </div>
                </button>

                {isThinkModeMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5">
                            <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] leading-tight">
                                Control model reasoning & thought tags.
                            </div>

                            <div className="flex flex-col gap-0.5">
                                {[
                                    { id: 'auto', label: 'Auto', badge: 'Default' },
                                    { id: 'on', label: 'On' },
                                    { id: 'off', label: 'Off' },
                                ].map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setThinkMode(item.id as any);
                                            if (updateBooster) updateBooster('think_mode', item.id);
                                        }}
                                        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                            thinkMode === item.id
                                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] font-semibold shadow-sm'
                                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="capitalize">{item.label}</span>
                                            {item.badge && (
                                                <span className="text-[8px] px-1 py-0.2 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 font-mono">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                        {thinkMode === item.id && (
                                            <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Effort & Reasoning Submenu (Auto / Low / Medium / High / Max) */}
            <div className={`relative ${isEffortMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('effort')}>
                <button
                    type="button"
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        <span>Effort</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--accent-color)] capitalize font-mono">
                            {effort}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </div>
                </button>

                {isEffortMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5">
                            <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] leading-tight">
                                Thinking token budget for reasoning.
                            </div>

                            <div className="flex flex-col gap-0.5">
                                {[
                                    { id: 'auto', label: 'Auto', badge: 'Default' },
                                    { id: 'low', label: 'Low' },
                                    { id: 'medium', label: 'Medium' },
                                    { id: 'high', label: 'High' },
                                    { id: 'max', label: 'Max', info: true },
                                ].map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setEffort(item.id as any);
                                        }}
                                        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                            effort === item.id
                                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] font-semibold shadow-sm'
                                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{item.label}</span>
                                            {item.badge && (
                                                <span className="text-[8px] px-1 py-0.2 rounded bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 font-mono">
                                                    {item.badge}
                                                </span>
                                            )}
                                            {item.info && (
                                                <Info className="w-3 h-3 text-[var(--text-muted)] opacity-70" />
                                            )}
                                        </div>
                                        {effort === item.id && (
                                            <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderModelSelector = () => (
        <div className="relative" ref={modelRef}>
            <button
                type="button"
                onClick={() => setIsModelOpen(!isModelOpen)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg transition-colors text-[0.7rem] sm:text-xs font-medium shrink min-w-0 max-w-[130px] sm:max-w-[160px] md:max-w-[200px] border border-transparent cursor-pointer ${isModelOpen ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                title={currentModel.fullName}
            >
                <span className="truncate min-w-0 block">{currentModel.shortName}</span>
                <ChevronDown className="w-3.5 h-3.5 ml-0.5 flex-shrink-0 opacity-70" />
            </button>

            {isModelOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden p-1.5 z-50 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] select-none border-b border-[var(--border-color)]/40 pb-1.5 mb-0.5">
                        Select Model
                    </div>
                    {modelOptions.map(model => {
                        const isSelected = currentModel.id === model.id;
                        return (
                            <button
                                type="button"
                                key={model.id}
                                onClick={async () => {
                                    if (updatePermission) {
                                        updatePermission('chat_models', { ...permissions?.chat_models, text: model.id });
                                    }
                                    try {
                                        const permRes = await fetch(`${getBaseUrl()}/v1/system/permission`);
                                        if (permRes.ok) {
                                            const permData = await permRes.json();
                                            const newPerm = permData.permission || permData;
                                            if (!newPerm.active_slots) newPerm.active_slots = {};
                                            if (!newPerm.active_slots.chat_slot) newPerm.active_slots.chat_slot = {};
                                            newPerm.active_slots.chat_slot.model_id = model.id;
                                            if (!newPerm.chat_models) newPerm.chat_models = {};
                                            newPerm.chat_models.text = model.id;
                                            await fetch(`${getBaseUrl()}/v1/system/permission`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(newPerm)
                                            });
                                        }
                                        fetch(`${getBaseUrl()}/v1/chat/context_telemetry?model=${encodeURIComponent(model.id)}`).catch(() => null);
                                    } catch (e) {
                                        console.error('Failed to sync model switch:', e);
                                    }
                                    setIsModelOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-[var(--bg-tertiary)] text-[var(--accent-color)] font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="truncate">{model.fullName}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent-color)]" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderInputContent = () => (
        <>
            <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* ---------------- SINGLE LINE LAYOUT (Left Buttons) ---------------- */}
            {!isExpanded && (
                <div className="flex-shrink-0 relative" ref={attachRef}>
                    <button
                        onClick={() => setIsAttachOpen(!isAttachOpen)}
                        className={`transition-colors p-2 rounded-full mb-[2px] ${isAttachOpen ? 'text-[var(--accent-color)] bg-[var(--bg-secondary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'}`}
                    >
                        <Plus className={`w-5 h-5 transition-transform duration-300 ${isAttachOpen ? 'rotate-45' : 'rotate-0'}`} />
                    </button>

                    {isAttachOpen && attachmentMenu}
                </div>
            )}

            {/* ---------------- MIDDLE TEXTAREA (Shared) ---------------- */}
            <textarea
                ref={textareaRef}
                autoFocus
                placeholder="Ask AI..."
                className={`${isExpanded ? 'self-stretch' : 'flex-1 min-w-0'} bg-transparent border-0 outline-none text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none overflow-y-auto custom-scrollbar`}
                style={{ minHeight: '20px', maxHeight: '144px', lineHeight: '20px' }}
                value={inputValue}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendWithAttachments();
                    }
                }}
                rows={1}
            />

            {/* ---------------- SINGLE LINE LAYOUT (Right Buttons) ---------------- */}
            {!isExpanded && (
                <div className="flex-shrink-0 flex items-center gap-1 mb-[2px]">
                    {/* ---------------- RENDER ATTACHED FILE CHIPS ---------------- */}
                    {attachedFiles.map(file => (
                        <div
                            key={file.id}
                            title={`${file.name} (${formatBytes(file.size)})`}
                            className="group relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-color)] transition-colors"
                        >
                            <FileText className="w-3.5 h-3.5 text-[var(--accent-color)] flex-shrink-0" />
                            <span className="truncate max-w-[100px] sm:max-w-[140px]">{file.name}</span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono hidden sm:inline">({formatBytes(file.size)})</span>
                            <button
                                type="button"
                                onClick={() => removeFile(file.id)}
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* ---------------- RENDER CHIPS ---------------- */}
                    {selectedSkills.map(skill => (
                        <div key={skill} title={skill} onClick={() => removeSkill(skill)} className="group relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 bg-transparent rounded-lg border border-[var(--border-color)] text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] whitespace-nowrap overflow-hidden cursor-pointer sm:cursor-default hover:border-[var(--text-muted)] transition-colors">
                            {getSelectedToolIcon(skill)}
                            <span className="hidden sm:inline">{skill}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                                className="hidden sm:flex absolute right-0 top-0 bottom-0 px-1.5 items-center justify-center bg-[var(--bg-primary)]/90 backdrop-blur-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}

                    {renderModelSelector()}

                    <button className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <Mic className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>

                    <div className={`transition-all duration-100 ease-out overflow-hidden flex items-center ${(inputValue.trim() || attachedFiles.length > 0) ? 'w-[2rem] sm:w-[2.25rem] opacity-100 scale-100' : 'w-0 opacity-0 scale-0'}`}>
                        <button
                            onClick={handleSendWithAttachments}
                            className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95 cursor-pointer"
                        >
                            <Send className="w-3.5 sm:w-4 h-3.5 sm:h-4 -ml-0.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------- MULTI LINE LAYOUT (Bottom Toolbar) ---------------- */}
            {isExpanded && (
                <div className="flex items-center justify-between ">
                    <div className="flex items-center gap-2">
                        <div className="relative" ref={attachRef}>
                            <button
                                onClick={() => setIsAttachOpen(!isAttachOpen)}
                                className={`transition-colors p-1.5 pl-0 rounded-full ${isAttachOpen ? 'text-[var(--accent-color)] bg-[var(--bg-secondary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'}`}
                            >
                                <Plus className={`w-5 h-5 transition-transform duration-300 ${isAttachOpen ? 'rotate-45' : 'rotate-0'}`} />
                            </button>

                            {isAttachOpen && attachmentMenu}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap max-w-full">
                        {/* ---------------- RENDER ATTACHED FILE CHIPS ---------------- */}
                        {attachedFiles.map(file => (
                            <div
                                key={file.id}
                                title={`${file.name} (${formatBytes(file.size)})`}
                                className="group relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-color)] transition-colors"
                            >
                                <FileText className="w-3.5 h-3.5 text-[var(--accent-color)] flex-shrink-0" />
                                <span className="truncate max-w-[100px] sm:max-w-[140px]">{file.name}</span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono hidden sm:inline">({formatBytes(file.size)})</span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(file.id)}
                                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* ---------------- RENDER CHIPS ---------------- */}
                        {selectedSkills.map(skill => (
                            <div key={skill} title={skill} onClick={() => removeSkill(skill)} className="group relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 bg-transparent rounded-lg border border-[var(--border-color)] text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] whitespace-nowrap overflow-hidden cursor-pointer sm:cursor-default hover:border-[var(--text-muted)] transition-colors">
                                {getSelectedToolIcon(skill)}
                                <span className="hidden sm:inline">{skill}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                                    className="hidden sm:flex absolute right-0 top-0 bottom-0 px-1.5 items-center justify-center bg-[var(--bg-primary)]/90 backdrop-blur-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}

                        {renderModelSelector()}

                        <button className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            <Mic className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>

                        <div className={`transition-all duration-200 ease-out overflow-hidden flex items-center ${(inputValue.trim() || attachedFiles.length > 0) ? 'w-[2rem] sm:w-[2.25rem] opacity-100 scale-100' : 'w-0 opacity-0 scale-0'}`}>
                            <button
                                onClick={handleSendWithAttachments}
                                className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95 cursor-pointer"
                            >
                                <Send className="w-3.5 sm:w-4 h-3.5 sm:h-4 -ml-0.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // Auto-resize textarea and handle layout toggle intelligently 
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 144)}px`;

            const hasNewline = val.includes('\n');

            // Dynamic Layout Toggle Logic based on actual space constraints
            if (!isExpanded) {
                if (scrollHeight > 24 || hasNewline) {
                    setIsExpanded(true);
                    if (hasNewline) {
                        setWrapThreshold(Number.MAX_SAFE_INTEGER);
                    } else {
                        // Record the exact length that caused it to wrap, minus a small buffer
                        setWrapThreshold(val.length - 2);
                    }
                }
            } else {
                // Shrink back if no newlines and we've deleted past the threshold that caused the wrap
                if (!hasNewline && val.length < wrapThreshold && wrapThreshold !== Number.MAX_SAFE_INTEGER) {
                    setIsExpanded(false);
                    setWrapThreshold(Number.MAX_SAFE_INTEGER);
                }
            }
        }
    };

    // Reset textarea state when cleared
    useEffect(() => {
        if (!inputValue && textareaRef.current) {
            textareaRef.current.style.height = 'auto';

            // Only shrink back if the right side isn't taking too much space
            const chipsWidth = selectedSkills.length * 110;
            const modelWidth = currentModel.shortName.length * 7.5;
            const totalRightWidth = chipsWidth + modelWidth;

            if (totalRightWidth <= 180) {
                setIsExpanded(false);
            }

            setWrapThreshold(Number.MAX_SAFE_INTEGER);
        }
    }, [inputValue, selectedSkills.length, currentModel.shortName]);

    return (
        <div className={`max-[300px]:p-0.5 p-1 pb-0 flex-shrink-0 z-10 relative ${isFloating ? 'bg-transparent' : 'bg-[var(--bg-primary)]'}`}>
            {/* Top Fade-Out Shadow Effect */}


            {/* Replying Card */}
            {replyingTo && (
                <div className="mb-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 flex flex-col gap-1 relative overflow-hidden group shadow-sm mx-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[0.65rem] font-medium uppercase tracking-wider">
                            <CornerDownRight className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            {replyingTo.type === 'selection' ? 'Replying to selection' : 'Replying to message'}
                        </div>
                        <button
                            onClick={() => setReplyingTo?.(null)}
                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5 rounded-md hover:bg-[var(--bg-tertiary)]"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate pr-4 pl-2.5 border-l-2 border-[var(--accent-color)] ml-1">
                        {replyingTo.text}
                    </div>
                </div>
            )}

            {/* Input Container Wrapper */}
            {isFloating ? (
                <BorderGlow
                    className="w-full z-10"
                    edgeSensitivity={0}
                    glowColor="var(--accent-color-rgb)"
                    backgroundColor="var(--bg-primary)"
                    borderRadius={20}
                    glowRadius={80}
                    glowIntensity={1}
                    coneSpread={20}
                    animated={true}
                    colors={['#c084fc', '#f472b6', '#38bdf8']}
                >
                    <div
                        className={`relative z-10 flex flex-wrap gap-2 bg-[var(--bg-primary)] rounded-[20px] border border-[var(--border-color)] focus-within:border-[rgba(var(--accent-color-rgb),0.1)] focus-within:shadow-[0_0_0_1px_rgba(var(--accent-color-rgb),0.4)] transition-all duration-200 ${isExpanded ? 'flex-col p-3.5 max-[300px]:p-2' : 'items-center p-3.5 max-[300px]:p-2'}`}
                        style={{ borderStyle: 'var(--border-style)' }}

                    >
                        {renderInputContent()}
                    </div>
                </BorderGlow>
            ) : (
                <div className="relative w-full z-10">
                    <div
                        className={`relative z-10 flex w-full flex-wrap min-w-0 gap-2 bg-[var(--bg-primary)] rounded-[20px] border border-[var(--border-color)] focus-within:border-[rgba(var(--accent-color-rgb),0.1)] focus-within:shadow-[0_0_0_1px_rgba(var(--accent-color-rgb),0.4)] transition-all duration-200 ${isExpanded ? 'flex-col p-3.5 max-[300px]:p-2' : 'items-center p-3.5 max-[300px]:p-2'}`}
                        style={{ borderStyle: 'var(--border-style)' }}
                    >
                        {renderInputContent()}
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { Send, FileCode, FileText, Plus, ChevronDown, Mic, Zap, Sparkles, Globe, Brain, Image as ImageIcon, Video, File, X, Clock, ChevronRight, UploadCloud, Link as LinkIcon, Layers, FolderUp, Database, BookOpen, ZapOff, Telescope, CornerDownRight, Check, AlignLeft, AlignJustify } from 'lucide-react';
import BorderGlow from '../../../components/ui/BorderGlow';
import { Backlight } from '../../../components/ui/Backlight';
import { useEngineStore } from '../../../store/engine/useEngineStore';


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
        case 'Web Search': return <Globe className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#3b82f6]" />;
        case 'Deep Research': return <Telescope className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#f59e0b]" />;
        default: return <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent-color)]" />;
    }
};

interface ChatInputProps {
    inputValue: string;
    setInputValue: (val: string) => void;
    handleSendMessage: () => void;
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
    const [isThinkingMenuOpen, setIsThinkingMenuOpen] = useState(false);
    const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);
    const [isMoreUploadsOpen, setIsMoreUploadsOpen] = useState(false);
    const [isSkillsMenuOpen, setIsSkillsMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [wrapThreshold, setWrapThreshold] = useState<number>(Number.MAX_SAFE_INTEGER);

    // Engine State for Think Mode
    const booster = useEngineStore(s => s.booster);
    const updateBooster = useEngineStore(s => s.updateBooster);
    const permissions = useEngineStore(s => s.permissions);
    const updatePermission = useEngineStore(s => s.updatePermission);
    const fetchStatus = useEngineStore(s => s.fetchStatus);
    const initEngineSettings = useEngineStore(s => s.initEngineSettings);

    const isThinkModeOn = booster?.think_mode === 'On' || booster?.think_mode === 'Auto';

    // Auto-fetch settings if not already fetched
    useEffect(() => {
        if (fetchStatus === 'idle') {
            initEngineSettings();
        }
    }, [fetchStatus, initEngineSettings]);

    // Dynamic Model Processing
    const availableModels = permissions?.available_chat_models?.length
        ? permissions.available_chat_models
        : permissions?.available_models ?? [];

    const activeModelId = permissions?.chat_models?.text || 'Unknown Model';

    // Ensure active model is in the list if availableModels is empty
    const displayModels = availableModels.length > 0 ? availableModels : [activeModelId];

    const modelOptions = displayModels.map(id => {
        const formatted = formatModelName(id);
        return {
            id,
            fullName: formatted.fullName,
            shortName: formatted.shortName,
            icon: Sparkles
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
                setIsThinkingMenuOpen(false);
                setIsRecentMenuOpen(false);
                setIsMoreUploadsOpen(false);
                setIsSkillsMenuOpen(false);
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

    const handleThinkingSelect = (mode: string) => {
        setSelectedSkills(prev => {
            // Remove any existing generation/thinking modes
            const filtered = prev.filter(s => !['Think Deep', 'Think Lite', 'Long Answer', 'Short Answer'].includes(s));
            // Add new mode if it's not unselecting
            if (!prev.includes(mode)) {
                filtered.push(mode);
            }
            return filtered;
        });
    };

    const removeSkill = (skill: string) => {
        setSelectedSkills(prev => prev.filter(s => s !== skill));
    };

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openSubmenu = (menu: 'recent' | 'more' | 'skills' | 'thinking') => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsRecentMenuOpen(menu === 'recent');
            setIsMoreUploadsOpen(menu === 'more');
            setIsSkillsMenuOpen(menu === 'skills');
            setIsThinkingMenuOpen(menu === 'thinking');
        }, 150);
    };

    const closeAllSubmenus = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsRecentMenuOpen(false);
            setIsMoreUploadsOpen(false);
            setIsSkillsMenuOpen(false);
            setIsThinkingMenuOpen(false);
        }, 150);
    };

    const attachmentMenu = (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5" onMouseLeave={closeAllSubmenus}>
            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md">
                <UploadCloud className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                Upload File
            </button>
            <div className={`relative ${isRecentMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('recent')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Recent Files
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isRecentMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] top-0 pl-1 z-50">
                        <div className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <FileCode className="w-3.5 h-3.5" />
                                <span className="truncate">main.ts</span>
                            </button>
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate">engine_spec.pdf</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`relative ${isMoreUploadsOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('more')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <FolderUp className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        More Uploads
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isMoreUploadsOpen && (
                    <div className="absolute left-8 sm:left-[97%] top-0 pl-1 z-50">
                        <div className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <ImageIcon className="w-4 h-4" />
                                Gallery
                            </button>
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <Database className="w-4 h-4" />
                                Database
                            </button>
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <BookOpen className="w-4 h-4" />
                                Notebooks
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="h-px bg-[var(--border-color)] my-1 mx-2" />

            <div className={`relative ${isSkillsMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('skills')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Skills
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isSkillsMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button
                                onClick={() => toggleSkill('Web Search')}
                                className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                            >
                                <Globe className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#3b82f6] transition-colors" />
                                Web Search
                                {selectedSkills.includes('Web Search') && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />}
                            </button>
                            <button
                                onClick={() => toggleSkill('Deep Research')}
                                className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                            >
                                <Telescope className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#f59e0b] transition-colors" />
                                Deep Research
                                {selectedSkills.includes('Deep Research') && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />}
                            </button>
                            <div className="h-px bg-[var(--border-color)] my-1 mx-2" />
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <Plus className="w-4 h-4" />
                                Install/Link Skills
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`relative ${isThinkingMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('thinking')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Thinking
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isThinkingMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-2.5 flex flex-col gap-2.5">
                            {/* Toggle Header */}
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                    Thinking Mode
                                </span>
                                <button
                                    onClick={() => {
                                        const newMode = isThinkModeOn ? 'Off' : 'On';
                                        if (updateBooster) updateBooster('think_mode', newMode);
                                        // Clear conflicting skills on toggle
                                        setSelectedSkills(prev => prev.filter(s => !['Think Deep', 'Think Lite', 'Long Answer', 'Short Answer'].includes(s)));
                                    }}
                                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${isThinkModeOn ? 'bg-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] border border-[var(--border-color)]'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isThinkModeOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            <div className="h-px bg-[var(--border-color)] w-full" />

                            {/* Dynamic Options */}
                            <div className="flex flex-col gap-1.5">
                                {isThinkModeOn ? (
                                    <>
                                        <button
                                            onClick={() => handleThinkingSelect('Think Deep')}
                                            className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all ${selectedSkills.includes('Think Deep')
                                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)] shadow-sm'
                                                : 'bg-transparent text-[var(--text-primary)] border border-transparent hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Brain className={`w-3.5 h-3.5 transition-colors ${selectedSkills.includes('Think Deep') ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                <span>Think Deep</span>
                                            </div>
                                            {selectedSkills.includes('Think Deep') && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                            onClick={() => handleThinkingSelect('Think Lite')}
                                            className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all ${selectedSkills.includes('Think Lite')
                                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)] shadow-sm'
                                                : 'bg-transparent text-[var(--text-primary)] border border-transparent hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Zap className={`w-3.5 h-3.5 transition-colors ${selectedSkills.includes('Think Lite') ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                <span>Think Lite</span>
                                            </div>
                                            {selectedSkills.includes('Think Lite') && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleThinkingSelect('Long Answer')}
                                            className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all ${selectedSkills.includes('Long Answer')
                                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)] shadow-sm'
                                                : 'bg-transparent text-[var(--text-primary)] border border-transparent hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <AlignJustify className={`w-3.5 h-3.5 transition-colors ${selectedSkills.includes('Long Answer') ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                <span>Long Answer</span>
                                            </div>
                                            {selectedSkills.includes('Long Answer') && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                            onClick={() => handleThinkingSelect('Short Answer')}
                                            className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all ${selectedSkills.includes('Short Answer')
                                                ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] border border-[var(--border-color)] shadow-sm'
                                                : 'bg-transparent text-[var(--text-primary)] border border-transparent hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <AlignLeft className={`w-3.5 h-3.5 transition-colors ${selectedSkills.includes('Short Answer') ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent-color)]'}`} />
                                                <span>Short Answer</span>
                                            </div>
                                            {selectedSkills.includes('Short Answer') && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                    </>
                                )}
                            </div>

                        </div>
                    </div>
                )}
            </div>

        </div>
    );

    const renderInputContent = () => (
        <>
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
                        handleSendMessage();
                    }
                }}
                rows={1}
            />

            {/* ---------------- SINGLE LINE LAYOUT (Right Buttons) ---------------- */}
            {!isExpanded && (
                <div className="flex-shrink-0 flex items-center gap-1 mb-[2px]">
                    {/* ---------------- RENDER CHIPS ---------------- */}
                    {selectedSkills.map(skill => (
                        <div key={skill} title={skill} onClick={() => removeSkill(skill)} className="group relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 bg-transparent rounded-lg border border-[var(--border-color)] text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] whitespace-nowrap overflow-hidden cursor-pointer sm:cursor-default hover:border-[var(--text-muted)] transition-colors">
                            {getSkillIcon(skill)}
                            <span className="hidden sm:inline">{skill}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                                className="hidden sm:flex absolute right-0 top-0 bottom-0 px-1.5 items-center justify-center bg-[var(--bg-primary)]/90 backdrop-blur-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}

                    <div className="relative" ref={modelRef}>
                        <button
                            onClick={() => setIsModelOpen(!isModelOpen)}
                            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-full transition-colors text-[0.7rem] sm:text-xs font-medium shrink min-w-0 max-w-[130px] sm:max-w-[160px] md:max-w-[200px] ${isModelOpen ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            <span className="truncate min-w-0 block">{currentModel.shortName}</span> <ChevronDown className="w-3.5 h-3.5 ml-0.5 flex-shrink-0" />
                        </button>

                        {isModelOpen && (
                            <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden p-1.5 z-50 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {modelOptions.map(model => {
                                    const isSelected = currentModel.id === model.id;
                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                if (updatePermission) {
                                                    updatePermission('chat_models', { ...permissions?.chat_models, text: model.id });
                                                }
                                                setIsModelOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 text-[0.7rem] sm:text-xs font-medium rounded-lg transition-colors ${isSelected ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <model.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span className="truncate">{model.fullName}</span>
                                            </div>
                                            {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <Mic className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>

                    <div className={`transition-all duration-100 ease-out overflow-hidden flex items-center ${inputValue.trim() ? 'w-[2rem] sm:w-[2.25rem] opacity-100 scale-100' : 'w-0 opacity-0 scale-0'}`}>
                        <button
                            onClick={handleSendMessage}
                            className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95"
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
                        {/* ---------------- RENDER CHIPS ---------------- */}
                        {selectedSkills.map(skill => (
                            <div key={skill} title={skill} onClick={() => removeSkill(skill)} className="group relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-1 bg-transparent rounded-lg border border-[var(--border-color)] text-[0.7rem] sm:text-xs font-medium text-[var(--text-primary)] whitespace-nowrap overflow-hidden cursor-pointer sm:cursor-default hover:border-[var(--text-muted)] transition-colors">
                                {getSkillIcon(skill)}
                                <span className="hidden sm:inline">{skill}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                                    className="hidden sm:flex absolute right-0 top-0 bottom-0 px-1.5 items-center justify-center bg-[var(--bg-primary)]/90 backdrop-blur-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}

                        <div className="relative" ref={modelRef}>
                            <button
                                onClick={() => setIsModelOpen(!isModelOpen)}
                                className={`flex items-center border  border-[var(--border-color)] hover:border-[var(--text-muted)] px-2 py-1.5 rounded-lg transition-colors text-[0.7rem] sm:text-xs font-medium shrink min-w-0 max-w-[130px] sm:max-w-[160px] md:max-w-[200px] ${isModelOpen ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                            >
                                <span className="truncate min-w-0 block">{currentModel.shortName}</span> <ChevronDown className="w-3.5 h-3.5 ml-0.5 flex-shrink-0" />
                            </button>

                            {isModelOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden p-1.5 z-50 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                    {modelOptions.map(model => {
                                        const isSelected = currentModel.id === model.id;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => {
                                                    if (updatePermission) {
                                                        updatePermission('chat_models', { ...permissions?.chat_models, text: model.id });
                                                    }
                                                    setIsModelOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 text-[0.7rem] sm:text-xs font-medium rounded-lg transition-colors ${isSelected ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <model.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                                    <span className="truncate">{model.fullName}</span>
                                                </div>
                                                {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            <Mic className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>

                        <div className={`transition-all duration-200 ease-out overflow-hidden flex items-center ${inputValue.trim() ? 'w-[2rem] sm:w-[2.25rem] opacity-100 scale-100' : 'w-0 opacity-0 scale-0'}`}>
                            <button
                                onClick={handleSendMessage}
                                className="w-[2rem] sm:w-[2.25rem] h-[2rem] sm:h-[2.25rem] flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95"
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
        <div className={`max-[300px]:p-0.5 p-2 flex-shrink-0 z-10 relative ${isFloating ? 'bg-transparent' : 'bg-[var(--bg-primary)]'}`}>
            {/* Top Fade-Out Shadow Effect */}
            {!isFloating && (
                <div className="absolute left-0 right-0 h-8 -top-8 bg-gradient-to-b from-transparent to-[var(--bg-primary)] pointer-events-none z-10" />
            )}

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

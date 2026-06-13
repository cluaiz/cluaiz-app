import React, { useState, useRef, useEffect } from 'react';
import { Send, FileCode, FileText, Plus, ChevronDown, Mic, Zap, Sparkles, Globe, Brain, Image as ImageIcon, Video, File, X, Clock, ChevronRight, UploadCloud, Link as LinkIcon, Layers, FolderUp, Database, BookOpen, ZapOff, Telescope, CornerDownRight } from 'lucide-react';
import BorderGlow from '../../../components/ui/BorderGlow';
import { Backlight } from '../../../components/ui/Backlight';

const MODELS = [
    { id: 'flash', name: 'Flash', icon: Zap },
    { id: 'pro', name: 'Pro', icon: Sparkles }
];

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
    const [selectedModel, setSelectedModel] = useState(MODELS[0]);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [isThinkingMenuOpen, setIsThinkingMenuOpen] = useState(false);
    const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);
    const [isMoreUploadsOpen, setIsMoreUploadsOpen] = useState(false);
    const [isSkillsMenuOpen, setIsSkillsMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [wrapThreshold, setWrapThreshold] = useState<number>(Number.MAX_SAFE_INTEGER);
    const attachRef = useRef<HTMLDivElement>(null);
    const modelRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    // Force expand if 2 or more skills selected
    useEffect(() => {
        if (selectedSkills.length >= 2 && !isExpanded) {
            setIsExpanded(true);
            setWrapThreshold(0);
        }
    }, [selectedSkills.length, isExpanded]);

    const toggleSkill = (skill: string) => {
        setSelectedSkills(prev => {
            if (prev.includes(skill)) return prev.filter(s => s !== skill);
            return [...prev, skill];
        });
        setIsAttachOpen(false);
    };

    const handleThinkingSelect = (mode: string) => {
        setSelectedSkills(prev => {
            const filtered = prev.filter(s => !s.startsWith('Think') && s !== 'No Thinking');
            if (mode !== 'No Thinking') {
                filtered.push(mode);
            }
            return filtered;
        });
        setIsThinkingMenuOpen(false);
        setIsAttachOpen(false);
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
            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md">
                <UploadCloud className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                Upload File
            </button>
            <div className={`relative ${isRecentMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('recent')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Recent Files
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isRecentMenuOpen && (
                    <div className="absolute left-[97%] top-0 pl-1 z-50">
                        <div className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <FileCode className="w-3.5 h-3.5" />
                                <span className="truncate">main.ts</span>
                            </button>
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate">engine_spec.pdf</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`relative ${isMoreUploadsOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('more')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <FolderUp className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        More Uploads
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isMoreUploadsOpen && (
                    <div className="absolute left-[97%] top-0 pl-1 z-50">
                        <div className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <ImageIcon className="w-4 h-4" />
                                Gallery
                            </button>
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <Database className="w-4 h-4" />
                                Database
                            </button>
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
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
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Skills
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isSkillsMenuOpen && (
                    <div className="absolute left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            <button
                                onClick={() => toggleSkill('Web Search')}
                                className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                            >
                                <Globe className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#3b82f6] transition-colors" />
                                Web Search
                                {selectedSkills.includes('Web Search') && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />}
                            </button>
                            <button
                                onClick={() => toggleSkill('Deep Research')}
                                className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                            >
                                <Telescope className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#f59e0b] transition-colors" />
                                Deep Research
                                {selectedSkills.includes('Deep Research') && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />}
                            </button>
                            <div className="h-px bg-[var(--border-color)] my-1 mx-2" />
                            <button className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-left group rounded-md">
                                <Plus className="w-4 h-4" />
                                Install/Link Skills
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`relative ${isThinkingMenuOpen ? 'z-50' : ''}`} onMouseEnter={() => openSubmenu('thinking')}>
                <button
                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md"
                >
                    <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                        Thinking
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isThinkingMenuOpen && (
                    <div className="absolute left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-40 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 flex flex-col gap-0.5">
                            {[
                                { mode: 'Think Lite', Icon: Zap },
                                { mode: 'Think Deep', Icon: Brain },
                                { mode: 'No Thinking', Icon: ZapOff }
                            ].map(({ mode, Icon }) => (
                                <button
                                    key={mode}
                                    onClick={() => handleThinkingSelect(mode)}
                                    className="w-full flex items-center gap-3 px-2.5 py-2 text-xs font-bold hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left rounded-md group"
                                >
                                    <Icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                                    {mode}
                                    {selectedSkills.includes(mode) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />}
                                </button>
                            ))}
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
                placeholder="Ask anything, @ to mention, / for actions"
                className={`${isExpanded ? 'w-full pt-2 pb-0 px-1' : 'flex-1 py-2.5'} bg-transparent border-0 outline-none text-[15px] font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none overflow-y-auto`}
                style={{ minHeight: '40px', maxHeight: '144px', lineHeight: '20px' }}
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
                        <div key={skill} className="group relative flex items-center gap-2 pl-3 pr-7 py-1.5 bg-transparent rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-primary)] whitespace-nowrap hidden sm:flex cursor-default hover:border-[var(--text-muted)] transition-colors">
                            {skill.startsWith('Think') ? <Zap className="w-4 h-4 text-[var(--accent-color)]" /> : skill === 'Web Search' ? <Globe className="w-4 h-4 text-[#3b82f6]" /> : <Brain className="w-4 h-4 text-[#f59e0b]" />}
                            <span>{skill}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-transparent rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    <div className="relative" ref={modelRef}>
                        <button
                            onClick={() => setIsModelOpen(!isModelOpen)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors text-sm font-medium ${isModelOpen ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                            {selectedModel.name} <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {isModelOpen && (
                            <div className="absolute bottom-full right-0 mb-2 w-32 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden p-1 z-50 flex flex-col gap-0.5">
                                {MODELS.map(model => {
                                    const isSelected = selectedModel.id === model.id;
                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => { setSelectedModel(model); setIsModelOpen(false); }}
                                            className={`w-full text-left px-2.5 py-1.5 text-[13px] font-semibold rounded-lg transition-colors ${isSelected ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}
                                        >
                                            {model.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <Mic className="w-5 h-5" />
                    </button>

                    <div className={`transition-all duration-100 ease-out overflow-hidden flex items-center ${inputValue.trim() ? 'w-9 opacity-100 scale-100 ml-1' : 'w-0 opacity-0 scale-0 ml-0'}`}>
                        <button
                            onClick={handleSendMessage}
                            className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95"
                        >
                            <Send className="w-4 h-4 -ml-0.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------- MULTI LINE LAYOUT (Bottom Toolbar) ---------------- */}
            {isExpanded && (
                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2">
                        <div className="relative" ref={attachRef}>
                            <button
                                onClick={() => setIsAttachOpen(!isAttachOpen)}
                                className={`transition-colors p-1.5 rounded-full ${isAttachOpen ? 'text-[var(--accent-color)] bg-[var(--bg-secondary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'}`}
                            >
                                <Plus className={`w-5 h-5 transition-transform duration-300 ${isAttachOpen ? 'rotate-45' : 'rotate-0'}`} />
                            </button>

                            {isAttachOpen && attachmentMenu}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
                        {/* ---------------- RENDER CHIPS ---------------- */}
                        {selectedSkills.map(skill => (
                            <div key={skill} className="group relative flex items-center gap-2 pl-3 pr-7 py-1.5 bg-transparent rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-primary)] whitespace-nowrap cursor-default hover:border-[var(--text-muted)] transition-colors">
                                {skill.startsWith('Think') ? <Zap className="w-4 h-4 text-[var(--accent-color)]" /> : skill === 'Web Search' ? <Globe className="w-4 h-4 text-[#3b82f6]" /> : <Brain className="w-4 h-4 text-[#f59e0b]" />}
                                <span>{skill}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-transparent rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        <div className="relative" ref={modelRef}>
                            <button
                                onClick={() => setIsModelOpen(!isModelOpen)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors text-sm font-medium ${isModelOpen ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                            >
                                {selectedModel.name} <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {isModelOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-32 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden p-1 z-50 flex flex-col gap-0.5">
                                    {MODELS.map(model => {
                                        const isSelected = selectedModel.id === model.id;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => { setSelectedModel(model); setIsModelOpen(false); }}
                                                className={`w-full text-left px-2.5 py-1.5 text-[13px] font-semibold rounded-lg transition-colors ${isSelected ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}
                                            >
                                                {model.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            <Mic className="w-5 h-5" />
                        </button>

                        <div className={`transition-all duration-200 ease-out overflow-hidden flex items-center ${inputValue.trim() ? 'w-9 opacity-100 scale-100 ml-1' : 'w-0 opacity-0 scale-0 ml-0'}`}>
                            <button
                                onClick={handleSendMessage}
                                className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95"
                            >
                                <Send className="w-4 h-4 -ml-0.5" />
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
                if (scrollHeight > 44 || hasNewline) {
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
                if (!hasNewline && val.length < wrapThreshold) {
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
            setIsExpanded(false);
            setWrapThreshold(Number.MAX_SAFE_INTEGER);
        }
    }, [inputValue]);

    return (
        <div className={`p-3 pb-4 flex-shrink-0 z-10 relative ${isFloating ? 'bg-transparent' : 'bg-[var(--bg-primary)]'}`}>
            {/* Top Fade-Out Shadow Effect */}
            {!isFloating && (
                <div className="absolute left-0 right-0 h-8 -top-8 bg-gradient-to-b from-transparent to-[var(--bg-primary)] pointer-events-none z-10" />
            )}

            {/* Replying Card */}
            {replyingTo && (
                <div className="mb-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 flex flex-col gap-1 relative overflow-hidden group shadow-sm mx-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">
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
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate pr-4 pl-2.5 border-l-2 border-[var(--accent-color)] ml-1">
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
                    borderRadius={24}
                    glowRadius={80}
                    glowIntensity={1}
                    coneSpread={20}
                    animated={true}
                    colors={['#c084fc', '#f472b6', '#38bdf8']}
                >
                    <div
                        className={`relative z-10 flex gap-2 bg-[var(--bg-primary)] rounded-[24px] border border-[var(--border-color)] focus-within:border-[rgba(var(--accent-color-rgb),0.1)] focus-within:shadow-[0_0_0_1px_rgba(var(--accent-color-rgb),0.4)] transition-all duration-200 ${isExpanded ? 'flex-col px-3 py-2' : 'items-end px-2 py-2'}`}
                        style={{ borderStyle: 'var(--border-style)' }}

                    >
                        {renderInputContent()}
                    </div>
                </BorderGlow>
            ) : (
                <div className="relative w-full z-10">
                    <div
                        className={`relative z-10 flex gap-2 bg-[var(--bg-primary)] rounded-[24px] border border-[var(--border-color)] focus-within:border-[rgba(var(--accent-color-rgb),0.1)] focus-within:shadow-[0_0_0_1px_rgba(var(--accent-color-rgb),0.4)] transition-all duration-200 ${isExpanded ? 'flex-col px-3 py-2' : 'items-end px-2 py-2'}`}
                        style={{ borderStyle: 'var(--border-style)' }}
                    >
                        {renderInputContent()}
                    </div>
                </div>
            )}
        </div>
    );
};

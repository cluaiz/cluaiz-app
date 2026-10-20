import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, FileCode, FileText, Plus, ChevronDown, Mic, Zap, Sparkles, Globe, Brain, Image as ImageIcon, Video, X, Clock, ChevronRight, UploadCloud, Link as LinkIcon, Layers, FolderUp, Database, BookOpen, ZapOff, Telescope, CornerDownRight, Check, AlignLeft, AlignJustify, Box, Server, Info, SlidersHorizontal, Trash2, Pencil } from 'lucide-react';
import BorderGlow from '../../../components/ui/BorderGlow';
import { Backlight } from '../../../components/ui/Backlight';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { navigateTo } from '../../../core/router';
import { client } from '../../../api/client';
import { modelsApi } from '../../../api/engine/models/models.api';
import { permissionApi } from '../../../api/engine/permission/permission.api';
import { systemApi } from '../../../api/engine/system/system.api';
import { toast } from '../../../components/ui/toast';
import { audioApi } from '../../../api/engine/audio/audio.api';
import { InlinePromptInput, InlinePromptInputHandle } from '../../../components/ui/InlinePromptInput';
import { VoiceInputControl, VoiceInputHandle, VoiceMode } from '../../../components/ui/VoiceInputControl';
import { extractBaseName } from '../../../utils/filePath';
import { AttachmentStagingDeck, StagedAttachment } from './AttachmentStagingDeck';
import { serializeStagedAttachments } from '../utils/attachmentSerializer';

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

const checkModelVisionSupport = (modelId: string, map?: Record<string, any>): boolean => {
    if (!modelId) return false;
    if (map && map[modelId]) {
        const detail = map[modelId];
        if (detail.metadata?.capabilities?.vision === true) return true;
        if (detail.extra_files?.some((f: string) => f.toLowerCase().includes('mmproj'))) return true;
        if (detail.supported_tasks?.includes('vision')) return true;
        if (detail.metadata?.inputs?.some((i: any) => (i.type === 'image' || i.type === 'vision') && i.available === true)) return true;
    }
    const lower = modelId.toLowerCase();
    if (lower.includes('-vl') || lower.includes('-vision') || lower.includes('llava') || lower.includes('qwen2-vl') || lower.includes('minicpm-v')) {
        return true;
    }
    return false;
};

interface ChatInputProps {
    inputValue: string;
    setInputValue: (val: string) => void;
    handleSendMessage: (customText?: string, options?: import('../../../core/engine').SendChatOptions) => void;
    replyingTo?: { text: string; messageIndex: number; type?: 'message' | 'selection' } | null;
    setReplyingTo?: (val: { text: string; messageIndex: number; type?: 'message' | 'selection' } | null) => void;
    isFloating?: boolean;
    isStreaming?: boolean;
    onStopStreaming?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputValue,
    setInputValue,
    handleSendMessage,
    replyingTo,
    setReplyingTo,
    isFloating = false,
    isStreaming = false,
    onStopStreaming
}) => {
    const [isAttachOpen, setIsAttachOpen] = useState(false);
    const [isModelOpen, setIsModelOpen] = useState(false);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
        try {
            const saved = localStorage.getItem('cluaiz_voice_mode');
            if (saved === 'record_send' || saved === 'live_interaction') return saved;
        } catch { }
        return 'record_send';
    });
    const [voiceFrequency, setVoiceFrequency] = useState(0);
    // Microphone text: what was in the box when the microphone started + what has been heard
    const dictationBaseRef = useRef('');
    const voiceInputRef = useRef<VoiceInputHandle>(null);
    // Voice mode turn spoken while an answer was being written: sent once that answer has stopped
    const pendingTurnRef = useRef<string | null>(null);

    const replaceInputText = (text: string) => {
        inlineInputRef.current?.clear();
        if (text) inlineInputRef.current?.insertText(text);
        setInputValue(text);
    };
    const withBase = (heard: string) => [dictationBaseRef.current.trim(), heard.trim()].filter(Boolean).join(' ');

    const sendVoiceTurn = (text: string) => {
        replaceInputText(text);
        dictationBaseRef.current = '';
        // Let the input box take the text before it is read for sending
        setTimeout(() => handleSendWithAttachments(), 0);
    };

    const handleVoiceTurn = (heard: string) => {
        const text = withBase(heard);
        if (!text) return;
        if (isStreaming) {
            // A new turn replaces the answer still being written
            pendingTurnRef.current = text;
            onStopStreaming?.();
            return;
        }
        sendVoiceTurn(text);
    };

    useEffect(() => {
        if (!isStreaming && pendingTurnRef.current) {
            const text = pendingTurnRef.current;
            pendingTurnRef.current = null;
            sendVoiceTurn(text);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStreaming]);

    const [modelTextWidth, setModelTextWidth] = useState(200);
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [isEffortMenuOpen, setIsEffortMenuOpen] = useState(false);
    const [isThinkModeMenuOpen, setIsThinkModeMenuOpen] = useState(false);
    const [thinkMode, setThinkMode] = useState<'auto' | 'on' | 'off'>('auto');
    const [effort, setEffort] = useState<string | number>('auto');
    const [customEffort, setCustomEffort] = useState('');
    const [budgetMessage, setBudgetMessage] = useState('');
    const [isEffortSettingsOpen, setIsEffortSettingsOpen] = useState(false);
    const [isSkillsMenuOpen, setIsSkillsMenuOpen] = useState(false);
    const [isPluginsMenuOpen, setIsPluginsMenuOpen] = useState(false);
    const [isMcpMenuOpen, setIsMcpMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [wrapThreshold, setWrapThreshold] = useState<number>(Number.MAX_SAFE_INTEGER);

    // Inline Prompt Input Ref (Text + Embedded Context Chips)
    const inlineInputRef = useRef<InlinePromptInputHandle>(null);

    // Real Staged File Attachments & Pasted Snippets State (Above Input Deck)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

    // Dynamic Local Path Chips (Folder / File drag-and-drop & context pills)
    const [pathChips, setPathChips] = useState<{ id: string; rawPath: string; isFolder: boolean; name: string; lineRange?: string }[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // Real Dynamic Tools from Engine backend (/api/components/list)
    const { getBaseUrl } = useConnectionStore();

    // [P35] Codex Pending Queue & Steer State
    const [pendingQueue, setPendingQueue] = useState<Array<{
        id: string;
        text: string;
        options: import('../../../core/engine').SendChatOptions;
    }>>([]);

    const pendingQueueRef = useRef(pendingQueue);
    pendingQueueRef.current = pendingQueue;

    const handleSendMessageRef = useRef(handleSendMessage);
    handleSendMessageRef.current = handleSendMessage;

    const prevStreamingRef = useRef(isStreaming);
    const dispatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // [P5] Reliable auto-dispatch on stream completion:
    // Does NOT depend on pendingQueue or handleSendMessage so state re-renders never clear the dispatch timer!
    useEffect(() => {
        if (prevStreamingRef.current && !isStreaming && pendingQueueRef.current.length > 0) {
            const nextItem = pendingQueueRef.current[0];
            setPendingQueue(prev => prev.filter(q => q.id !== nextItem.id));

            if (dispatchTimerRef.current) {
                clearTimeout(dispatchTimerRef.current);
            }
            dispatchTimerRef.current = setTimeout(() => {
                dispatchTimerRef.current = null;
                handleSendMessageRef.current(nextItem.text, nextItem.options);
            }, 120);
        }
        prevStreamingRef.current = isStreaming;
    }, [isStreaming]);

    useEffect(() => {
        return () => {
            if (dispatchTimerRef.current) {
                clearTimeout(dispatchTimerRef.current);
            }
        };
    }, []);

    const handleSteer = (item: { id: string; text: string; options: import('../../../core/engine').SendChatOptions }) => {
        onStopStreaming?.();
        setPendingQueue(prev => prev.filter(q => q.id !== item.id));
        setTimeout(() => {
            handleSendMessage(item.text, item.options);
        }, 150);
    };

    const handleRemoveQueued = (id: string) => {
        setPendingQueue(prev => prev.filter(q => q.id !== id));
    };

    // [P3] Edit queued prompt: pop from queue, restore to input, focus input
    const handleEditQueued = (item: { id: string; text: string }) => {
        handleRemoveQueued(item.id);
        replaceInputText(item.text);
        inlineInputRef.current?.focus();
    };

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
        const fetchTools = async () => {
            try {
                const data = await client.get<any>('/api/components/list');
                if (data) {
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

// Strict format whitelists: zero archives (.zip, .tar), zero executables (.exe)
const BASE_DOC_AND_CODE_ACCEPT = ".pdf,.docx,.doc,.txt,.md,.csv,.json,.toml,.yaml,.yml,.rs,.ts,.tsx,.js,.jsx,.py,.c,.cpp,.h,.go,.html,.css,.sql,.sh,.log";
const VISION_MEDIA_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,image/*";
const BANNED_ARCHIVE_OR_BINARY_REGEX = /\.(zip|tar|gz|tgz|rar|7z|bz2|xz|exe|msi|bin|dll|iso|dmg|apk|sys)$/i;

    const handleStageFiles = (files: FileList | any[] | any) => {
        if (!files || files.length === 0) return;
        const rawFiles = Array.from(files);

        const rejectedBanned: string[] = [];
        const rejectedVisuals: string[] = [];
        const acceptedFiles: any[] = [];

        for (const file of rawFiles as any[]) {
            const name = (file?.name as string) || 'attachment';
            const type = (file?.type as string) || '';

            // Reject archives (.zip, .tar) and executable binaries (.exe)
            if (BANNED_ARCHIVE_OR_BINARY_REGEX.test(name)) {
                rejectedBanned.push(name);
                continue;
            }

            const isImg = type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(name);
            const isVid = type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(name);

            if ((isImg || isVid) && !isVisionSupported) {
                rejectedVisuals.push(name);
            } else {
                acceptedFiles.push(file);
            }
        }

        if (rejectedBanned.length > 0) {
            toast.error(
                `Archive and executable files (.zip, .exe, etc.) are not supported. Only documents and supported model media can be attached.`,
                { duration: 4500 }
            );
        }

        if (rejectedVisuals.length > 0) {
            toast.error(
                `"${currentModel?.shortName || 'Selected model'}" does not support visual attachments. Select a vision model (e.g. Gemma with mmproj) to process images.`,
                { duration: 4500 }
            );
        }

        if (acceptedFiles.length === 0) return;

        const newAttachments: StagedAttachment[] = acceptedFiles.map((file: any) => {
            const name = file.name || 'attachment';
            const size = typeof file.size === 'number' ? file.size : 0;
            const type = file.type || '';
            const isImg = type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(name);
            const isVid = type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
            let previewUrl: string | undefined = undefined;
            if ((isImg || isVid) && typeof URL !== 'undefined' && URL.createObjectURL) {
                try {
                    previewUrl = URL.createObjectURL(file as Blob);
                } catch { }
            }
            return {
                id: `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                name,
                size,
                type: type || 'application/octet-stream',
                file: typeof file === 'object' ? file : undefined,
                previewUrl
            };
        });
        setStagedAttachments(prev => [...newAttachments, ...prev]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        handleStageFiles(files);
        e.target.value = '';
        setIsAttachOpen(false);
    };

    const handleRemoveAttachment = (id: string) => {
        setStagedAttachments(prev => {
            const target = prev.find(a => a.id === id);
            if (target?.previewUrl) {
                try { URL.revokeObjectURL(target.previewUrl); } catch { }
            }
            return prev.filter(a => a.id !== id);
        });
    };

    const handlePasteLargeText = (text: string) => {
        const lines = text.split('\n').length;
        const snippetId = `snippet-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const firstLine = text.trim().split('\n')[0].slice(0, 24);
        const snippetName = firstLine ? `Pasted: "${firstLine}..."` : `Pasted Document (${lines} lines)`;

        const newSnippet: StagedAttachment = {
            id: snippetId,
            name: snippetName,
            size: new Blob([text]).size,
            type: 'text/plain',
            isPastedText: true,
            pastedContent: text,
            lineCount: lines
        };
        setStagedAttachments(prev => [newSnippet, ...prev]);
        return true;
    };

    const handleExpandPastedText = (item: StagedAttachment) => {
        if (item.pastedContent) {
            inlineInputRef.current?.insertText(item.pastedContent);
            setStagedAttachments(prev => prev.filter(a => a.id !== item.id));
        }
    };

    // Engine State for Think Mode
    const booster = useEngineStore(s => s.booster);
    const updateBooster = useEngineStore(s => s.updateBooster);
    const permissions = useEngineStore(s => s.permissions);
    const installedModelsMap = useEngineStore(s => s.installedModelsMap);
    const updatePermission = useEngineStore(s => s.updatePermission);
    const fetchStatus = useEngineStore(s => s.fetchStatus);
    const initEngineSettings = useEngineStore(s => s.initEngineSettings);
    const isEngineOnline = Boolean(permissions);

    // Effort and thinking mode start from the user's saved defaults (engine settings)
    useEffect(() => {
        if (booster?.reasoning_effort !== undefined) setEffort(booster.reasoning_effort);
        setBudgetMessage((booster?.reasoning_budget_message ?? '').trim());
        const savedThink = String(booster?.think_mode || '').toLowerCase();
        if (savedThink === 'auto' || savedThink === 'on' || savedThink === 'off') setThinkMode(savedThink);
    }, [booster?.reasoning_effort, booster?.think_mode, booster?.reasoning_budget_message]);

    // Choosing an effort uses it now and saves it as the default
    const chooseEffort = (value: string | number) => {
        setEffort(value);
        if (updateBooster) updateBooster('reasoning_effort', value);
    };

    const applyCustomEffort = () => {
        const tokens = Number(customEffort);
        if (customEffort.trim() === '' || !Number.isInteger(tokens) || tokens < 0) {
            toast.error('Enter a whole number of thinking tokens (0 or more).');
            return;
        }
        chooseEffort(tokens);
        setCustomEffort('');
    };

    // Saved setting; empty = nothing is written when the thinking budget runs out
    const saveBudgetMessage = () => {
        const text = budgetMessage.trim();
        if (updateBooster) updateBooster('reasoning_budget_message', text === '' ? null : ` ${text}`);
    };

    const addPathChip = (rawPath: string, isFolder: boolean, name?: string, lineRange?: string) => {
        if (!rawPath || rawPath.startsWith('http://') || rawPath.startsWith('https://')) return;
        const cleanPath = rawPath.trim();
        inlineInputRef.current?.insertChip({
            type: isFolder ? 'folder' : 'file',
            name: name || extractBaseName(cleanPath),
            rawPath: cleanPath,
            lineRange
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        // 0. Dragged pasted-text snippet from staging deck back into input
        const pastedSnippet = e.dataTransfer.getData('application/cluaiz-pasted-text');
        const snippetId = e.dataTransfer.getData('application/cluaiz-snippet-id');
        if (pastedSnippet) {
            inlineInputRef.current?.insertText(pastedSnippet);
            if (snippetId) {
                handleRemoveAttachment(snippetId);
            }
            return;
        }

        // 1. Check custom application/cluaiz-path from workspace tree
        const customData = e.dataTransfer.getData('application/cluaiz-path');
        if (customData) {
            try {
                const parsed = JSON.parse(customData);
                if (parsed.path) {
                    addPathChip(parsed.path, Boolean(parsed.isFolder), parsed.name);
                    return;
                }
            } catch (err) { }
        }

        // 2. Check dropped files from OS -> Stage in AttachmentStagingDeck
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleStageFiles(e.dataTransfer.files);
            return;
        }

        // 3. Check plain text
        const text = e.dataTransfer.getData('text/plain');
        if (text) {
            const trimmed = text.trim();
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') &&
                (trimmed.match(/^[a-zA-Z]:[\\/]/) || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('.\\'))) {
                addPathChip(trimmed, false);
            } else {
                inlineInputRef.current?.insertText(trimmed);
                if (snippetId) {
                    handleRemoveAttachment(snippetId);
                }
            }
        }
    };

    // Global listener for code selection "Ask AI" context injection
    useEffect(() => {
        const handleInsertContext = (e: any) => {
            const detail = e.detail;
            if (!detail) return;
            if (detail.path) {
                addPathChip(detail.path, Boolean(detail.isFolder), detail.name, detail.lineRange);
            }
            inlineInputRef.current?.focus();
        };
        document.addEventListener('insert-chat-context', handleInsertContext);
        return () => document.removeEventListener('insert-chat-context', handleInsertContext);
    }, []);

    const handlePromptSubmit = async (
        serializedText: string,
        contextData: {
            files: { path: string; lineRange?: string; name: string }[];
            skills: string[];
        }
    ) => {
        if (!serializedText.trim() && contextData.files.length === 0 && contextData.skills.length === 0 && stagedAttachments.length === 0) return;
        if (!isEngineOnline) {
            toast.error('Cluaiz Engine is offline. Start engine to chat.');
            return;
        }

        const promptText = serializedText.trim();
        let finalParts: import('../../../api/engine/chat/chat.types').ChatMessagePart[] | undefined = undefined;
        let attachmentsMeta: Array<{ name: string; size?: number; type?: string; previewUrl?: string }> | undefined = undefined;

        if (stagedAttachments.length > 0) {
            try {
                const serializedResult = await serializeStagedAttachments(stagedAttachments, promptText);
                finalParts = serializedResult.parts;
                attachmentsMeta = serializedResult.attachmentsMeta || stagedAttachments.map(a => ({
                    name: a.name,
                    size: a.size,
                    type: a.type,
                    previewUrl: a.previewUrl
                }));
            } catch (err) {
                console.error('[ChatInput] Attachment serialization error:', err);
                toast.error('Failed to prepare attachments.');
                return;
            }
        }

        const activeTools = contextData.skills
            .filter(s => !['Think Deep', 'Think Lite', 'Long Answer', 'Short Answer'].includes(s))
            .map(s => ({ name: s, id: s }));

        const options: import('../../../core/engine').SendChatOptions = {
            think_mode: thinkMode,
            reasoning_effort: effort,
            model: permissions?.chat_models?.text || undefined,
            tools: activeTools.length > 0 ? activeTools : undefined,
            parts: finalParts,
            attachments: attachmentsMeta
        };

        if (isStreaming) {
            // [P35] Instead of blocking toast, enqueue into pending queue
            setPendingQueue(prev => [
                ...prev,
                {
                    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    text: promptText,
                    options,
                }
            ]);
            setInputValue('');
            setStagedAttachments([]);
            inlineInputRef.current?.clear();
            return;
        }

        handleSendMessage(promptText, options);
        setInputValue('');
        setStagedAttachments([]);
        inlineInputRef.current?.clear();
    };

    const handleSendWithAttachments = () => {
        const content = inlineInputRef.current?.getSerializedContent();
        if (content) {
            handlePromptSubmit(content.text, { files: content.files, skills: content.skills });
        } else if (stagedAttachments.length > 0) {
            handlePromptSubmit('', { files: [], skills: [] });
        }
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
                const data = await modelsApi.getInstalled();
                if (data) {
                    const raw = (data as any).installed || (data as any).installed_models || (data as any).models || [];
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

    const currentModel = modelOptions.find(m => m.id === activeModelId) || modelOptions[0] || { id: 'default', fullName: 'Default Model', shortName: 'Default' };

    const [isVisionSupported, setIsVisionSupported] = useState<boolean>(() => {
        return checkModelVisionSupport(currentModel?.id || activeModelId, installedModelsMap);
    });

    useEffect(() => {
        let isMounted = true;
        const modelId = currentModel?.id;
        if (!modelId || modelId === 'default' || modelId === 'Unknown Model') return;

        const fastCheck = checkModelVisionSupport(modelId, installedModelsMap);
        setIsVisionSupported(fastCheck);

        systemApi.planExecution({ model: modelId })
            .then(plan => {
                if (!isMounted || !plan) return;
                const imageInput = (plan as any).model_info?.inputs?.find((i: any) => i.type === 'image');
                if (imageInput) {
                    setIsVisionSupported(Boolean(imageInput.available));
                }
            })
            .catch(() => {});

        return () => { isMounted = false; };
    }, [currentModel?.id, installedModelsMap]);

    // Automatically remove visual attachments if user switches to a text-only model
    useEffect(() => {
        if (!isVisionSupported && stagedAttachments.length > 0) {
            const hasVisual = stagedAttachments.some(a => a.type.startsWith('image/') || a.type.startsWith('video/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|mp4|mov|avi|mkv|webm)$/i.test(a.name));
            if (hasVisual) {
                setStagedAttachments(prev => prev.filter(a => !a.type.startsWith('image/') && !a.type.startsWith('video/') && !/\.(png|jpe?g|webp|gif|svg|bmp|ico|mp4|mov|avi|mkv|webm)$/i.test(a.name)));
                toast.info(`Removed visual attachments: "${currentModel.shortName}" is a text-only model.`);
            }
        }
    }, [isVisionSupported, currentModel.shortName]);

    const attachMenuRef = useRef<HTMLDivElement>(null);
    const attachButtonRef = useRef<HTMLButtonElement>(null);
    const modelRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const thinkingRef = useRef<HTMLDivElement>(null);
    const recentRef = useRef<HTMLDivElement>(null);

    // Close attachment, model, and thinking dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                isAttachOpen &&
                attachMenuRef.current &&
                !attachMenuRef.current.contains(target) &&
                attachButtonRef.current &&
                !attachButtonRef.current.contains(target)
            ) {
                setIsAttachOpen(false);
                setIsEffortMenuOpen(false);
                setIsThinkModeMenuOpen(false);
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
        inlineInputRef.current?.insertChip({
            type: 'skill',
            name: skill,
            icon: getSelectedToolIcon(skill)
        });
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

    const openSubmenu = (menu: 'skills' | 'plugins' | 'mcp' | 'effort' | 'think_mode') => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
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
            setIsSkillsMenuOpen(false);
            setIsPluginsMenuOpen(false);
            setIsMcpMenuOpen(false);
            setIsEffortMenuOpen(false);
            setIsThinkModeMenuOpen(false);
        }, 120);
    };

    const closeAllSubmenusImmediate = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsSkillsMenuOpen(false);
        setIsPluginsMenuOpen(false);
        setIsMcpMenuOpen(false);
        setIsEffortMenuOpen(false);
        setIsThinkModeMenuOpen(false);
    };

    const attachmentMenu = (
        <div
            ref={attachMenuRef}
            className="absolute bottom-[calc(100%+8px)] left-0 w-56 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5"
            onMouseLeave={closeAllSubmenus}
        >
            {/* Real File Upload */}
            <button
                onClick={() => {
                    fileInputRef.current?.click();
                    setIsAttachOpen(false);
                }}
                onMouseEnter={closeAllSubmenusImmediate}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[0.7rem] sm:text-xs font-medium hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors text-left group rounded-md cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <UploadCloud className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                    <span>Upload File</span>
                </div>
                {!isVisionSupported && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] font-mono">
                        Docs only
                    </span>
                )}
            </button>

            <div className="h-px bg-[var(--border-color)] my-1 mx-2" onMouseEnter={closeAllSubmenusImmediate} />

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
                                    navigateTo({ view: 'tools' });
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
                                    navigateTo({ view: 'tools' });
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
                                    navigateTo({ view: 'tools' });
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
                                        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${thinkMode === item.id
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
                            {typeof effort === 'number' ? `${effort} tok` : effort}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </div>
                </button>

                {isEffortMenuOpen && (
                    <div className="absolute left-8 sm:left-[97%] bottom-0 pl-1 z-50">
                        <div className="w-52 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5">
                            <div className="flex items-start justify-between gap-1 px-2 py-1">
                                <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                                    Thinking token budget for reasoning.
                                </span>
                                <button
                                    type="button"
                                    title="Thinking settings: custom tokens, budget end message"
                                    onClick={() => setIsEffortSettingsOpen(open => !open)}
                                    className={`p-0.5 rounded-md cursor-pointer transition-colors ${isEffortSettingsOpen
                                        ? 'text-[var(--accent-color)] bg-[var(--bg-secondary)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--accent-color)]'
                                        }`}
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>
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
                                        onClick={() => chooseEffort(item.id)}
                                        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${effort === item.id
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
                                {/* A saved custom number shows as the selected row */}
                                {typeof effort === 'number' && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEffortSettingsOpen(true)}
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-sm cursor-pointer"
                                    >
                                        <span>Custom · {effort} tok</span>
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {isEffortSettingsOpen && (<>
                                {/* Custom thinking budget in tokens */}
                                <div className="mt-1 pt-1.5 border-t border-[var(--border-color)] px-2 pb-1">
                                    <div className="text-xs font-medium text-[var(--text-primary)]">Custom tokens</div>
                                    <div className="mt-1 flex items-center gap-1">
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            placeholder="tokens, e.g. 2000"
                                            value={customEffort}
                                            onChange={e => setCustomEffort(e.target.value)}
                                            onKeyDown={e => {
                                                e.stopPropagation();
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    applyCustomEffort();
                                                }
                                            }}
                                            className="w-full min-w-0 px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={applyCustomEffort}
                                            className="px-2 py-1 rounded-md text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                                        >
                                            Set
                                        </button>
                                    </div>
                                </div>

                                {/* Text written when the budget runs out, before the model's end-of-thinking tag */}
                                <div className="mt-1 pt-1.5 border-t border-[var(--border-color)] px-2 pb-1">
                                    <div className="text-xs font-medium text-[var(--text-primary)]">Budget end message</div>
                                    <div className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                                        Written when the thinking budget runs out, so the model wraps up. Empty = nothing.
                                    </div>
                                    <div className="mt-1 flex items-center gap-1">
                                        <input
                                            type="text"
                                            placeholder="e.g. I have to answer now."
                                            value={budgetMessage}
                                            onChange={e => setBudgetMessage(e.target.value)}
                                            onKeyDown={e => {
                                                e.stopPropagation();
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    saveBudgetMessage();
                                                }
                                            }}
                                            className="w-full min-w-0 px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
                                        />
                                        <button
                                            type="button"
                                            onClick={saveBudgetMessage}
                                            className="px-2 py-1 rounded-md text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </>)}
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
                                        const permData = await permissionApi.getPermission();
                                        if (permData) {
                                            const newPerm = permData.permission || permData;
                                            if (!newPerm.active_slots) newPerm.active_slots = {};
                                            if (!newPerm.active_slots.chat_slot) newPerm.active_slots.chat_slot = {};
                                            newPerm.active_slots.chat_slot.model_id = model.id;
                                            if (!newPerm.chat_models) newPerm.chat_models = {};
                                            newPerm.chat_models.text = model.id;
                                            await permissionApi.updatePermission(newPerm);
                                        }
                                        client.get(`/v1/chat/context_telemetry?model=${encodeURIComponent(model.id)}`).catch(() => null);
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
                accept={isVisionSupported ? `${BASE_DOC_AND_CODE_ACCEPT},${VISION_MEDIA_ACCEPT}` : BASE_DOC_AND_CODE_ACCEPT}
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Dedicated Attachment Staging Deck (Inside Chat Input Container) */}
            <AttachmentStagingDeck
                attachments={stagedAttachments}
                onRemove={handleRemoveAttachment}
                onExpandPastedText={handleExpandPastedText}
            />

            {/* ---------------- ROW 1: INLINE PROMPT INPUT (Text + Embedded Context Chips) ---------------- */}
            {/* Typing, deleting or pasting by hand stops the microphone (text set by the
                microphone itself fires no input event) */}
            <div
                className="contents"
                onInput={() => voiceInputRef.current?.cancel()}
                onPaste={() => voiceInputRef.current?.cancel()}
            >
            <InlinePromptInput
                ref={inlineInputRef}
                placeholder={isEngineOnline ? "Ask AI..." : "Cluaiz Engine is offline..."}
                onTextChange={(val) => setInputValue(val)}
                onSubmit={handlePromptSubmit}
                onDropFiles={handleStageFiles}
                onPasteLargeText={handlePasteLargeText}
                onDropSnippet={(snippetId) => handleRemoveAttachment(snippetId)}
                disabled={!isEngineOnline}
                minHeight="22px"
                maxHeight="160px"
            />
            </div>

            {/* ---------------- ROW 2: CLEAN BOTTOM TOOLBAR ---------------- */}
            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/20">
                {/* Left: [+] Attach button */}
                <div className="relative">
                    {isAttachOpen && attachmentMenu}
                    <button
                        ref={attachButtonRef}
                        type="button"
                        onClick={() => setIsAttachOpen(!isAttachOpen)}
                        className={`transition-colors p-1.5 pl-0 rounded-full cursor-pointer ${isAttachOpen ? 'text-[var(--accent-color)] bg-[var(--bg-secondary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-color)]'}`}
                        title="Add context, files, or skills"
                    >
                        <Plus className={`w-5 h-5 transition-transform duration-300 ${isAttachOpen ? 'rotate-45' : 'rotate-0'}`} />
                    </button>
                </div>

                {/* Right: Model Selector + Voice Mic + Send Button */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {renderModelSelector()}

                    <VoiceInputControl
                        ref={voiceInputRef}
                        isAnswering={isStreaming}
                        onText={(heard) => replaceInputText(withBase(heard))}
                        onTurnEnd={handleVoiceTurn}
                        onInterrupt={() => isStreaming && onStopStreaming?.()}
                        onError={(message) => toast.error(message)}
                        onVoiceStateChange={(active, currentMode) => {
                            if (active && !isVoiceActive) {
                                dictationBaseRef.current = inlineInputRef.current?.getSerializedContent().text || '';
                            }
                            setIsVoiceActive(active);
                            setVoiceMode(currentMode);
                        }}
                        onVoiceFrequencyChange={(freq) => setVoiceFrequency(freq)}
                    />

                    <div className={`transition-all duration-100 ease-out overflow-hidden flex items-center ${(isStreaming || inputValue.trim() || !inlineInputRef.current?.isEmpty() || stagedAttachments.length > 0) ? 'w-7 opacity-100 scale-100' : 'w-0 opacity-0 scale-0'}`}>
                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={onStopStreaming}
                                className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 shadow-sm transition-transform active:scale-95 cursor-pointer"
                                title="Stop generating"
                            >
                                <Square className="w-2.5 h-2.5 fill-current" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSendWithAttachments}
                                disabled={!isEngineOnline}
                                className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--accent-color)] text-[var(--accent-contrast)] hover:opacity-90 transition-transform active:scale-95 ${!isEngineOnline ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                title="Send message"
                            >
                                <Send className="w-3 h-3 -ml-0.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
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

    const handleJumpToReplyTarget = (msgIndex: number, textSnippet?: string) => {
        const container = (document.querySelector(`[data-message-index="${msgIndex}"]`) as HTMLElement | null) ||
            document.getElementById(`msg-turn-${msgIndex}`);
        if (!container) return;

        const cleanText = (textSnippet || '').trim();

        if (cleanText) {
            // Clear any existing active pulse marks to avoid duplicates
            const existingMarks = container.querySelectorAll('.reply-target-text-pulse');
            existingMarks.forEach((m) => {
                if (m.parentNode) {
                    while (m.firstChild) {
                        m.parentNode.insertBefore(m.firstChild, m);
                    }
                    m.remove();
                }
            });
            container.normalize();

            // Split selection into distinct lines/paragraphs
            const linesToFind = cleanText
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter((s) => s.length > 2);

            const createdMarks: HTMLElement[] = [];

            for (const line of linesToFind) {
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
                let node: Node | null;
                let targetRange: Range | null = null;

                // 1. Exact match attempt inside paragraph text node
                while ((node = walker.nextNode())) {
                    if ((node.parentElement as HTMLElement | null)?.classList.contains('reply-target-text-pulse')) continue;
                    const val = node.textContent || '';
                    const idx = val.indexOf(line);
                    if (idx !== -1) {
                        targetRange = document.createRange();
                        targetRange.setStart(node, idx);
                        targetRange.setEnd(node, idx + line.length);
                        break;
                    }
                }

                // 2. Substring fallback if line contains inline formatting differences
                if (!targetRange && line.length > 15) {
                    const sub = line.slice(0, 25);
                    const subWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
                    while ((node = subWalker.nextNode())) {
                        if ((node.parentElement as HTMLElement | null)?.classList.contains('reply-target-text-pulse')) continue;
                        const val = node.textContent || '';
                        const idx = val.indexOf(sub);
                        if (idx !== -1) {
                            targetRange = document.createRange();
                            targetRange.setStart(node, idx);
                            targetRange.setEnd(node, Math.min(val.length, idx + line.length));
                            break;
                        }
                    }
                }

                if (targetRange) {
                    const mark = document.createElement('mark');
                    mark.className = 'reply-target-text-pulse';
                    mark.style.backgroundColor = 'rgba(var(--accent-color-rgb, 249, 115, 22), 0.28)';
                    mark.style.color = 'inherit';
                    mark.style.borderRadius = '3px';
                    mark.style.padding = '0';
                    mark.style.margin = '0';
                    mark.style.border = 'none';
                    mark.style.outline = 'none';
                    mark.style.boxShadow = 'none';
                    mark.style.transition = 'background-color 0.45s ease-out';

                    try {
                        targetRange.surroundContents(mark);
                        createdMarks.push(mark);
                    } catch {
                        // If surroundContents fails across tags, continue to next line
                    }
                }
            }

            if (createdMarks.length > 0) {
                // Scroll directly to the first highlighted paragraph
                createdMarks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Pulse outer turn border as well for context
                container.classList.remove('chat-turn-focused');
                void container.offsetWidth;
                container.classList.add('chat-turn-focused');

                setTimeout(() => {
                    createdMarks.forEach((m) => {
                        m.style.backgroundColor = 'transparent';
                    });
                    container.classList.remove('chat-turn-focused');
                    setTimeout(() => {
                        createdMarks.forEach((m) => {
                            if (m.parentNode) {
                                while (m.firstChild) {
                                    m.parentNode.insertBefore(m.firstChild, m);
                                }
                                m.remove();
                            }
                        });
                        container.normalize();
                    }, 450);
                }, 2200);
                return;
            }
        }

        // Fallback: scroll container directly
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        container.classList.remove('chat-turn-focused');
        void container.offsetWidth;
        container.classList.add('chat-turn-focused');
        setTimeout(() => {
            container.classList.remove('chat-turn-focused');
        }, 1800);
    };

    return (
        <div className={`w-full min-w-0 max-w-full max-[300px]:p-0.5 p-1 pb-0 flex-shrink-0 z-10 relative ${isFloating ? 'bg-transparent' : 'bg-[var(--bg-primary)]'}`}>
            {/* Top Fade-Out Shadow Effect */}


            {/* Attached Tabs Stack: Replying & Pending Queue (Flush Inset within Input Shoulders) */}
            {(replyingTo || pendingQueue.length > 0) && (
                <div className="mx-5 -mb-[1px] z-20 relative flex flex-col gap-1">
                    {/* [P1, P2, P4, P5, P6, P7] Attached Replying Tab */}
                    {replyingTo && (
                        <div className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-t-[14px] bg-[var(--bg-secondary)] border border-b-0 border-[var(--border-color)] text-xs text-[var(--text-secondary)] shadow-sm select-none">
                            <div
                                onClick={() => handleJumpToReplyTarget(replyingTo.messageIndex, replyingTo.text)}
                                className="flex items-center gap-2 min-w-0 flex-1 mr-3 cursor-pointer group/reply hover:opacity-90 transition-opacity"
                                title="Click to view referenced text in chat"
                            >
                                <CornerDownRight className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0 transition-transform group-hover/reply:translate-x-0.5" />
                                <span className="text-[10px] uppercase font-bold text-[var(--accent-color)] tracking-wider shrink-0">
                                    Reply
                                </span>
                                <span className="text-zinc-500 shrink-0 select-none">|</span>
                                <span className="truncate text-[12px] font-medium text-[var(--text-primary)] group-hover/reply:underline underline-offset-2">
                                    {replyingTo.text}
                                </span>
                            </div>
                            <div className="flex items-center shrink-0 border-l border-[var(--border-color)] pl-3">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setReplyingTo?.(null);
                                    }}
                                    className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center"
                                    title="Cancel reply"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* [P35 & P3] Attached Queued Prompts (Steer Tab) */}
                    {pendingQueue.map((item) => (
                        <div
                            key={item.id}
                            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-t-[14px] bg-[var(--bg-secondary)] border border-b-0 border-[var(--border-color)] text-xs text-[var(--text-secondary)] shadow-sm select-none"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                                <CornerDownRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                                    {item.text || 'Attached prompt'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 border-l border-[var(--border-color)] pl-3">
                                <button
                                    type="button"
                                    onClick={() => handleSteer(item)}
                                    className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
                                    title="Steer"
                                >
                                    <span>↳ Steer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleEditQueued(item)}
                                    className="text-zinc-500 hover:text-[var(--accent-color)] transition-colors cursor-pointer bg-transparent border-0 p-0"
                                    title="Edit prompt"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveQueued(item.id)}
                                    className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-0 p-0"
                                    title="Cancel"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Container Wrapper */}
            {isFloating ? (
                <BorderGlow
                    className="w-full min-w-0 max-w-full z-10"
                    edgeSensitivity={0}
                    glowColor="var(--accent-color-rgb)"
                    backgroundColor="var(--bg-primary)"
                    borderRadius={20}
                    glowRadius={80}
                    glowIntensity={1}
                    coneSpread={20}
                    animated={true}
                    colors={['#c084fc', '#f472b6', '#38bdf8']}
                    active={isVoiceActive}
                    frequency={voiceFrequency}
                >
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative z-10 flex flex-col w-full max-w-full min-w-0 gap-1.5 bg-[var(--bg-primary)] rounded-[20px] border-[0.5px] p-2.5 sm:p-3 max-[300px]:p-1.5 transition-all duration-200 ${isDraggingOver
                            ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/30 bg-[var(--accent-color)]/5'
                            : 'border-[var(--border-color)]/20 focus-within:border-[var(--accent-color)]/25 focus-within:shadow-[0_0_0_0.5px_rgba(var(--accent-color-rgb),0.15)]'
                            }`}
                        style={{
                            borderStyle: 'var(--border-style)',
                        }}
                    >
                        {renderInputContent()}
                    </div>
                </BorderGlow>
            ) : (
                <BorderGlow
                    className="w-full min-w-0 max-w-full z-10"
                    edgeSensitivity={0}
                    glowColor="var(--accent-color-rgb)"
                    backgroundColor="var(--bg-primary)"
                    borderRadius={20}
                    glowRadius={60}
                    glowIntensity={1}
                    coneSpread={20}
                    animated={false}
                    colors={['#c084fc', '#f472b6', '#38bdf8']}
                    active={isVoiceActive}
                    frequency={voiceFrequency}
                >
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative z-10 flex flex-col w-full max-w-full min-w-0 gap-1.5 bg-[var(--bg-primary)] rounded-[20px] border-[0.5px] p-2.5 sm:p-3 max-[300px]:p-1.5 transition-all duration-200 ${isDraggingOver
                            ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/30 bg-[var(--accent-color)]/5'
                            : 'border-[var(--border-color)]/20 focus-within:border-[var(--accent-color)]/25 focus-within:shadow-[0_0_0_0.5px_rgba(var(--accent-color-rgb),0.15)]'
                            }`}
                        style={{
                            borderStyle: 'var(--border-style)',
                        }}
                    >
                        {renderInputContent()}
                    </div>
                </BorderGlow>
            )}
        </div>
    );
};

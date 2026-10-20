import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, FileText } from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';
import { getFileExtension, extractBaseName } from '../../utils/filePath';
import { useProjectStore } from '../../store/workspace/useProjectStore';

function stripMarkdown(text: string): string {
    if (!text) return '';
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')       // bold **text**
        .replace(/\*([^*]+)\*/g, '$1')           // italic *text*
        .replace(/__([^_]+)__/g, '$1')           // bold __text__
        .replace(/_([^_]+)_/g, '$1')             // italic _text_
        .replace(/`([^`]+)`/g, '$1')             // inline code `code`
        .replace(/^#+\s+/gm, '')                 // headers #, ##
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links [text](url)
        .replace(/^\s*[-*+]\s+/gm, '')           // bullet points
        .replace(/\n+/g, ' ')                    // newlines to space
        .trim();
}

export interface RichHoverCardProps {
    children: React.ReactNode;
    title?: string;
    filePath?: string;
    lineRange?: string;
    stepBadge?: string;
    previewText?: string;
    userPrompt?: string;
    aiSnippet?: string;
    isBookmarked?: boolean;
    onToggleBookmark?: () => void;
    onOpenInEditor?: () => void;
    position?: 'top' | 'bottom' | 'right' | 'left';
    className?: string;
    onClick?: () => void;
    usePortal?: boolean;
}

export const RichHoverCard: React.FC<RichHoverCardProps> = ({
    children,
    title,
    filePath,
    lineRange,
    stepBadge,
    previewText,
    userPrompt,
    aiSnippet,
    isBookmarked,
    onToggleBookmark,
    onOpenInEditor,
    position = 'right',
    className = '',
    onClick,
    usePortal = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<string | null>(previewText || null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const displayName = title || (filePath ? extractBaseName(filePath) : 'Document');
    const ext = filePath ? getFileExtension(displayName) : 'md';

    const cleanUser = userPrompt ? stripMarkdown(userPrompt) : '';
    const cleanAi = aiSnippet ? stripMarkdown(aiSnippet) : '';

    useEffect(() => {
        if (!isOpen) return;

        if (previewText) {
            setContent(previewText);
            setIsLoading(false);
            return;
        }

        if (filePath) {
            setIsLoading(true);
            const timer = setTimeout(() => {
                try {
                    const project = useProjectStore.getState().getActiveProject();
                    const direct = project?.files?.[filePath]?.content;
                    if (direct) {
                        setContent(direct.slice(0, 240));
                    } else {
                        const match = Object.entries(project?.files || {}).find(([p]) =>
                            p.endsWith(displayName) || filePath.endsWith(p)
                        );
                        if (match && match[1]?.content) {
                            setContent(match[1].content.slice(0, 240));
                        } else {
                            setContent(null);
                        }
                    }
                } catch {
                    setContent(null);
                } finally {
                    setIsLoading(false);
                }
            }, 180);

            return () => clearTimeout(timer);
        }
    }, [isOpen, filePath, displayName, previewText]);

    const handleMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        if (usePortal && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top + rect.height / 2,
                left: rect.right + 12
            });
        }
        // Instant hover activation - zero delay
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 80);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            e.stopPropagation();
            onClick();
            setIsOpen(false);
        }
    };

    const getPositionClasses = () => {
        switch (position) {
            case 'right':
                return 'left-full ml-3 top-1/2 -translate-y-1/2 origin-left';
            case 'left':
                return 'right-full mr-3 top-1/2 -translate-y-1/2 origin-right';
            case 'bottom':
                return 'top-full mt-2 left-1/2 -translate-x-1/2 origin-top';
            case 'top':
            default:
                return 'bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom';
        }
    };

    const cardContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, x: position === 'right' ? -6 : 0, y: usePortal ? '-50%' : (position === 'top' ? 6 : 0) }}
                    animate={{ opacity: 1, scale: 1, x: 0, y: usePortal ? '-50%' : 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: position === 'right' ? -4 : 0, y: usePortal ? '-50%' : 0 }}
                    transition={{ duration: 0.1, ease: 'easeOut' }}
                    className={`z-[99999] pointer-events-auto w-[260px] sm:w-[280px] p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-left select-none ${usePortal ? 'fixed' : `absolute ${getPositionClasses()}`}`}
                    style={usePortal && coords ? {
                        top: coords.top,
                        left: coords.left,
                    } : undefined}
                    onMouseEnter={() => {
                        if (closeTimeoutRef.current) {
                            clearTimeout(closeTimeoutRef.current);
                            closeTimeoutRef.current = null;
                        }
                    }}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Pointed notch on the left attached to the tick (vertically centered) */}
                    {position === 'right' && (
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--bg-secondary)] border-l border-b border-[var(--border-color)] rotate-45 pointer-events-none" />
                    )}
                    {position === 'left' && (
                        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[var(--bg-secondary)] border-r border-t border-[var(--border-color)] rotate-45 pointer-events-none" />
                    )}

                    {cleanUser || cleanAi ? (
                            /* Clean Turn Preview: 1-line User SMS (...) + 2-line AI SMS (...) + Bookmark Action */
                            <div className="space-y-1.5 text-left py-0.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        {cleanUser && (
                                            <p className="text-[12px] font-medium text-white truncate leading-snug">
                                                {cleanUser}
                                            </p>
                                        )}
                                    </div>
                                    {onToggleBookmark && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleBookmark();
                                            }}
                                            className={`-mr-1 -mt-0.5 p-1 rounded transition-colors cursor-default shrink-0 ${
                                                isBookmarked
                                                    ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/15'
                                                    : 'text-zinc-500 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            <Bookmark size={12} className={isBookmarked ? "fill-current" : ""} />
                                        </button>
                                    )}
                                </div>
                                {cleanAi && (
                                    <p className={`text-[11.5px] leading-relaxed text-zinc-300 line-clamp-2 ${cleanUser ? 'pt-1.5 border-t border-white/10 mt-1' : ''}`}>
                                        {cleanAi}
                                    </p>
                                )}
                            </div>
                        ) : (
                            /* Standard File / Document preview */
                            <>
                                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
                                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                        {filePath ? (
                                            <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                                                <FileIcon fileName={displayName} fileExtension={ext} size={13} />
                                            </span>
                                        ) : (
                                            <FileText size={13} className="text-zinc-400 shrink-0" />
                                        )}
                                        <span className="text-[11.5px] font-mono font-bold text-white truncate">
                                            {displayName}
                                        </span>
                                        {lineRange && (
                                            <span className="text-[9px] font-mono text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1 py-0.2 rounded font-semibold shrink-0">
                                                {lineRange}
                                            </span>
                                        )}
                                    </div>
                                    {onOpenInEditor ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenInEditor();
                                                setIsOpen(false);
                                            }}
                                            className="text-[10px] font-mono text-zinc-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
                                        >
                                            Open
                                        </button>
                                    ) : (
                                        <Bookmark size={13} className="text-zinc-400 shrink-0 fill-current/20" />
                                    )}
                                </div>

                                {stepBadge && (
                                    <div className="mb-2 text-[10.5px] font-mono font-semibold text-[var(--accent-color)] tracking-wide truncate">
                                        {stepBadge}
                                    </div>
                                )}

                                {isLoading ? (
                                    <div className="space-y-2 py-2 animate-pulse">
                                        <div className="h-2.5 w-3/4 rounded-full bg-white/10" />
                                        <div className="h-2.5 w-full rounded-full bg-white/10" />
                                        <div className="h-2.5 w-5/6 rounded-full bg-white/10" />
                                        <div className="h-2.5 w-1/3 rounded-full bg-white/10" />
                                    </div>
                                ) : content ? (
                                    <div className="text-[11px] leading-relaxed text-zinc-300 font-mono line-clamp-3">
                                        {content}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-zinc-400 italic font-mono">
                                        {filePath || 'No preview available'}
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        );

        return (
            <span
                ref={triggerRef}
                className={`relative inline-flex items-center ${className}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                {children}
                {usePortal ? (typeof document !== 'undefined' ? createPortal(cardContent, document.body) : null) : cardContent}
            </span>
        );
};

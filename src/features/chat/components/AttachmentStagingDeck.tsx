import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, FileCode, Video, Image as ImageIcon, Music, CornerDownRight } from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';

export interface StagedAttachment {
    id: string;
    name: string;
    size: number;
    type: string;
    file?: any;
    previewUrl?: string;
    isPastedText?: boolean;
    pastedContent?: string;
    lineCount?: number;
}

interface AttachmentStagingDeckProps {
    attachments: StagedAttachment[];
    onRemove: (id: string) => void;
    onExpandPastedText?: (attachment: StagedAttachment) => void;
}

function formatBytes(bytes?: number | null) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExt(name: string, type?: string): string {
    const fromName = name.split('.').pop()?.toLowerCase();
    if (fromName && fromName !== name.toLowerCase()) return fromName;
    if (type?.startsWith('image/')) return type.split('/')[1]?.toLowerCase() || 'png';
    if (type?.startsWith('video/')) return type.split('/')[1]?.toLowerCase() || 'mp4';
    if (type?.startsWith('audio/')) return type.split('/')[1]?.toLowerCase() || 'mp3';
    return '';
}

export const AttachmentStagingDeck: React.FC<AttachmentStagingDeckProps> = ({
    attachments,
    onRemove,
    onExpandPastedText
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [hasOverflow, setHasOverflow] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        // Content only has overflow when scrollWidth strictly exceeds visible width
        const hasScroll = el.scrollWidth > el.clientWidth + 4;
        setHasOverflow(hasScroll);
        setCanScrollLeft(hasScroll && el.scrollLeft > 6);
        setCanScrollRight(hasScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
    }, []);

    useEffect(() => {
        updateScrollState();
        const el = scrollContainerRef.current;
        if (!el) return;

        el.addEventListener('scroll', updateScrollState, { passive: true });
        const resizeObserver = new ResizeObserver(() => updateScrollState());
        resizeObserver.observe(el);

        return () => {
            el.removeEventListener('scroll', updateScrollState);
            resizeObserver.disconnect();
        };
    }, [updateScrollState, attachments]);

    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const firstCard = el.querySelector('.group') as HTMLElement | null;
        const step = firstCard ? (firstCard.offsetWidth + 8) * 2 : 210;
        const delta = direction === 'left' ? -step : step;
        el.scrollBy({ left: delta, behavior: 'smooth' });
    };

    if (!attachments || attachments.length === 0) return null;

    // Controls and pagination dots ONLY activate when content genuinely overflows horizontally
    const shouldShowControls = hasOverflow;

    const renderCardBody = (item: StagedAttachment) => {
        const ext = getFileExt(item.name, item.type);
        const isImg = item.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(item.name);
        const isVid = item.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(item.name);
        const isAud = item.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(item.name);
        const isPdf = item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf');

        // 1. PDF Document - Sleek Consistent Dark Card with Real Material PDF Icon
        if (isPdf) {
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between overflow-hidden relative select-none bg-[var(--bg-secondary)]">
                    <div>
                        <div className="font-semibold text-[10.5px] leading-tight text-[var(--text-primary)] line-clamp-2">
                            {item.name.replace(/\.pdf$/i, '')}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] mt-1 font-mono">
                            {formatBytes(item.size)}
                        </div>
                        {/* Subtle dark miniature document lines */}
                        <div className="mt-2 space-y-1 opacity-35">
                            <div className="w-full h-[2px] bg-[var(--text-muted)] rounded-sm" />
                            <div className="w-5/6 h-[2px] bg-[var(--text-muted)] rounded-sm" />
                            <div className="w-full h-[2px] bg-[var(--text-muted)] rounded-sm" />
                            <div className="w-4/5 h-[2px] bg-[var(--text-muted)] rounded-sm" />
                            <div className="w-full h-[2px] bg-[var(--text-muted)] rounded-sm" />
                        </div>
                    </div>
                    {/* Bottom Left: Real Workspace Material PDF Icon + Badge */}
                    <div className="z-10 mt-auto pt-1 flex items-center gap-1.5">
                        <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                            <FileIcon fileName={item.name} fileExtension="pdf" languageId="pdf" size={16} />
                        </span>
                        <span className="text-[8.5px] font-mono font-bold tracking-wider text-[var(--text-primary)] uppercase">
                            PDF
                        </span>
                    </div>
                </div>
            );
        }

        // 2. Images & Videos - 100% Transparent Media with Real Material Icon
        if (isImg || isVid) {
            return (
                <div className="absolute inset-0 w-full h-full overflow-hidden bg-transparent flex items-center justify-center p-1.5">
                    {item.previewUrl ? (
                        isImg ? (
                            <img
                                src={item.previewUrl}
                                alt={item.name}
                                className="w-full h-full object-contain select-none bg-transparent"
                            />
                        ) : (
                            <video
                                src={item.previewUrl}
                                className="w-full h-full object-contain select-none bg-transparent"
                                muted
                            />
                        )
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-transparent">
                            {isImg ? (
                                <ImageIcon className="w-8 h-8 text-sky-400" />
                            ) : (
                                <Video className="w-8 h-8 text-purple-400" />
                            )}
                        </div>
                    )}
                    {/* Bottom Left: Real Material File Icon + Pill with subtle pill backing */}
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-white/10 shadow-xs">
                        <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                            <FileIcon fileName={item.name} fileExtension={isVid ? 'mp4' : (ext || 'png')} languageId={isVid ? 'mp4' : ext} size={14} />
                        </span>
                        <span className="text-[8.5px] font-mono font-bold tracking-wider text-white uppercase drop-shadow">
                            {isVid ? 'VID' : (ext ? ext.toUpperCase() : 'IMG')}
                        </span>
                    </div>
                </div>
            );
        }

        // 3. Audio File Card with Real Material Audio Icon
        if (isAud) {
            return (
                <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-amber-950/20">
                    <div>
                        <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-3 break-words" title={item.name}>
                            {item.name}
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] mt-1 font-mono">
                            {formatBytes(item.size)}
                        </div>
                    </div>
                    <div className="z-10 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                                <FileIcon fileName={item.name} fileExtension={ext || 'mp3'} languageId="audio" size={15} />
                            </span>
                            <span className="text-[8.5px] font-mono font-bold tracking-wider text-amber-200 uppercase">
                                AUDIO
                            </span>
                        </div>
                        <Music className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                </div>
            );
        }

        // 4. Pasted Document Snippet
        if (item.isPastedText) {
            return (
                <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                    <div>
                        <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-3 break-words">
                            {item.name}
                        </div>
                        <div className="text-[9px] text-emerald-400 mt-1 font-mono font-medium">
                            {item.lineCount || 1} lines
                        </div>
                    </div>
                    <div className="z-10 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                                <FileIcon fileName="snippet.txt" fileExtension="txt" languageId="text" size={15} />
                            </span>
                            <span className="text-[8.5px] font-mono font-bold tracking-wider text-emerald-300 uppercase">
                                SNIPPET
                            </span>
                        </div>
                        <FileCode className="w-4 h-4 text-emerald-400" />
                    </div>
                </div>
            );
        }

        // 5. Code, Markdown, JSON, and Text Documents with Real Material Icons from Workspace
        return (
            <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-[var(--bg-secondary)]">
                <div>
                    <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-3 break-words" title={item.name}>
                        {item.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-1.5 font-mono">
                        {item.lineCount ? `${item.lineCount} lines` : formatBytes(item.size)}
                    </div>
                </div>
                <div className="z-10 flex items-center gap-1.5">
                    <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                        <FileIcon fileName={item.name} fileExtension={ext} languageId={ext} size={16} />
                    </span>
                    <span className="text-[8.5px] font-mono font-bold tracking-wider text-[var(--text-primary)] uppercase">
                        {ext ? ext.toUpperCase() : 'DOC'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-full max-w-full min-w-0 mb-1.5 pt-0 pb-0 select-none bg-transparent border-0 shadow-none overflow-hidden">
            {/* Slider Outer Container */}
            <div className="relative flex items-center bg-transparent w-full max-w-full min-w-0 overflow-hidden">
                {/* Left Navigation Arrow with Edge Gradient Fade */}
                {shouldShowControls && canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 z-40 flex items-center pr-3 pl-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/90 to-transparent pointer-events-none">
                        <button
                            type="button"
                            onClick={() => handleScroll('left')}
                            className="pointer-events-auto w-6 h-6 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)] shadow-md flex items-center justify-center transition-colors duration-150 cursor-pointer"
                            title="Previous attachment"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Right Navigation Arrow with Edge Gradient Fade */}
                {shouldShowControls && canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 z-40 flex items-center pl-3 pr-0 bg-gradient-to-l from-[var(--bg-primary)] via-[var(--bg-primary)]/90 to-transparent pointer-events-none">
                        <button
                            type="button"
                            onClick={() => handleScroll('right')}
                            className="pointer-events-auto w-6 h-6 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)] shadow-md flex items-center justify-center transition-colors duration-150 cursor-pointer"
                            title="Next attachment"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Portrait Cards Queue (Tight gap, zero top/left gap, strict max-w-full min-w-0) */}
                <div
                    ref={scrollContainerRef}
                    className="flex items-center gap-2 overflow-x-auto pt-0 pb-0.5 px-0 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full max-w-full min-w-0 bg-transparent"
                >
                    {attachments.map((item) => {
                        const isMedia = item.type?.startsWith('image/') || item.type?.startsWith('video/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|mp4|mov|avi|mkv|webm)$/i.test(item.name);
                        return (
                            <div
                                key={item.id}
                                draggable={Boolean(item.isPastedText)}
                                onDragStart={(e) => {
                                    if (item.isPastedText && item.pastedContent) {
                                        e.dataTransfer.setData('application/cluaiz-pasted-text', item.pastedContent);
                                        e.dataTransfer.setData('text/plain', item.pastedContent);
                                    }
                                }}
                                className={`group relative shrink-0 w-24 h-28 sm:w-26 sm:h-30 rounded-2xl border border-[var(--border-color)]/80 hover:border-[var(--accent-color)]/70 shadow-sm ${isMedia ? 'bg-transparent' : 'bg-[var(--bg-secondary)]'} overflow-hidden transition-colors duration-150 ${item.isPastedText ? 'cursor-grab active:cursor-grabbing border-emerald-500/40 bg-emerald-950/20' : ''}`}
                            >
                            {/* Inner Card Content */}
                            <div className="w-full h-full rounded-2xl overflow-hidden relative">
                                {renderCardBody(item)}
                            </div>

                            {/* Floating Rich Tooltip on Hover */}
                            <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 transform scale-95 group-hover:scale-100 z-50 flex flex-col items-center">
                                <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-2xl rounded-xl px-3 py-2 text-center min-w-max max-w-[240px]">
                                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[220px]" title={item.name}>
                                        {item.name}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--text-muted)] mt-1">
                                        <span className="font-mono">{formatBytes(item.size)}</span>
                                        <span className="text-[9px] font-mono uppercase bg-[var(--bg-secondary)] border border-[var(--border-color)] px-1 rounded text-[var(--accent-color)] font-bold">
                                            {getFileExt(item.name, item.type).toUpperCase() || 'FILE'}
                                        </span>
                                        {item.isPastedText && (
                                            <span className="text-[9px] text-emerald-400 font-medium">
                                                · {item.lineCount || 1} lines
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="w-2.5 h-2.5 rotate-45 bg-[var(--bg-primary)] border-r border-b border-[var(--border-color)] -mt-1" />
                            </div>

                            {/* Expand Pasted Text Action */}
                            {item.isPastedText && onExpandPastedText && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExpandPastedText(item);
                                    }}
                                    className="absolute bottom-2 right-2 z-20 w-6 h-6 rounded-full bg-emerald-600 text-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500 cursor-pointer"
                                    title="Unpack into prompt input"
                                >
                                    <CornerDownRight className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Sleek Delete Badge (X) - INSIDE the card so it NEVER clips */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(item.id);
                                }}
                                className="absolute top-2 right-2 z-30 w-6 h-6 rounded-full bg-red-600/95 text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/25"
                                title="Remove file"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
    );
};

export default AttachmentStagingDeck;

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, FileCode, Video, Image as ImageIcon, Music, CornerDownRight } from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';
import { openAttachmentInWorkspace } from '../utils/workspaceAttachmentOpener';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';
import type { LibraryAsset } from '../../library/types';

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
    onRemove?: (id: string) => void;
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

const renderCardBody = (item: {
    id?: string;
    name: string;
    size?: number | null;
    type?: string;
    previewUrl?: string;
    isPastedText?: boolean;
    pastedContent?: string;
    lineCount?: number;
}) => {
    const ext = (getFileExt(item.name, item.type) || 'file').toUpperCase();
    const isImg = (item.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(item.name)) && Boolean(item.previewUrl);
    const isVid = item.type?.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(item.name);
    const isAud = item.type?.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a)$/i.test(item.name);

    // 1. Image Thumbnail Preview
    if (isImg) {
        return (
            <div className="relative w-full h-full bg-black/40">
                <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-2xl"
                    onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-2.5 pointer-events-none">
                    <span className="text-[10.5px] font-semibold text-white truncate leading-snug drop-shadow-sm">{item.name}</span>
                    <span className="text-[9px] text-white/80 font-mono mt-0.5">{formatBytes(item.size)}</span>
                </div>
            </div>
        );
    }

    // 2. Video Preview with Play Indicator
    if (isVid) {
        return (
            <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-[var(--bg-secondary)]">
                <div>
                    <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 break-words" title={item.name}>
                        {item.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-1 font-mono">
                        {formatBytes(item.size)}
                    </div>
                </div>
                <div className="z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                            <FileIcon fileName={item.name} fileExtension={ext.toLowerCase() || 'mp4'} languageId="video" size={15} />
                        </span>
                        <span className="text-[8.5px] font-mono font-bold tracking-wider text-indigo-300 uppercase">
                            VIDEO
                        </span>
                    </div>
                    <Video className="w-3.5 h-3.5 text-indigo-400" />
                </div>
            </div>
        );
    }

    // 3. Audio with Waveform / Tag (Exact from original design)
    if (isAud) {
        return (
            <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-[var(--bg-secondary)]">
                <div>
                    <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 break-words" title={item.name}>
                        {item.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-1 font-mono">
                        {formatBytes(item.size)}
                    </div>
                </div>
                <div className="z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                            <FileIcon fileName={item.name} fileExtension={ext.toLowerCase() || 'mp3'} languageId="audio" size={15} />
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

    // 4. Pasted Document Snippet (Exact from original design)
    if (item.isPastedText) {
        return (
            <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-[var(--bg-secondary)]">
                <div>
                    <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-3 break-words" title={item.name}>
                        {item.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-1.5 font-mono">
                        {item.lineCount || 1} lines
                    </div>
                </div>
                <div className="z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                            <FileIcon fileName="snippet.txt" fileExtension="txt" languageId="text" size={15} />
                        </span>
                        <span className="text-[8.5px] font-mono font-bold tracking-wider text-[var(--text-primary)] uppercase">
                            SNIPPET
                        </span>
                    </div>
                    <FileCode className="w-4 h-4 text-[var(--accent-color)]" />
                </div>
            </div>
        );
    }

    // 5. Code, Markdown, JSON, PDF & Other Documents with Material Icons & Color-Coded Badges
    const isPdf = ext.toLowerCase() === 'pdf';
    const badgeColor = isPdf
        ? 'text-red-400'
        : ext.toLowerCase() === 'json'
            ? 'text-amber-300'
            : ext.toLowerCase() === 'py'
                ? 'text-blue-400'
                : ext.toLowerCase() === 'rs'
                    ? 'text-orange-400'
                    : ext.toLowerCase() === 'ts' || ext.toLowerCase() === 'tsx'
                        ? 'text-cyan-400'
                        : 'text-[var(--text-primary)]';

    return (
        <div className="w-full h-full flex flex-col justify-between p-2.5 text-left relative overflow-hidden bg-[var(--bg-secondary)]">
            <div>
                <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 break-words" title={item.name}>
                    {item.name}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-1 font-mono">
                    {formatBytes(item.size)}
                </div>
            </div>

            {/* Simulated document page skeleton for PDF */}
            {isPdf && (
                <div className="flex flex-col gap-1 my-auto opacity-30 px-0.5">
                    <div className="h-1 bg-[var(--text-muted)] rounded w-full" />
                    <div className="h-1 bg-[var(--text-muted)] rounded w-4/5" />
                    <div className="h-1 bg-[var(--text-muted)] rounded w-3/5" />
                </div>
            )}

            <div className="z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="shrink-0 flex items-center justify-center drop-shadow-xs">
                        <FileIcon
                            fileName={item.name}
                            fileExtension={ext.toLowerCase()}
                            languageId={ext.toLowerCase()}
                            size={15}
                        />
                    </span>
                    <span className={`text-[8.5px] font-mono font-bold tracking-wider uppercase ${badgeColor}`}>
                        {ext}
                    </span>
                </div>
            </div>
        </div>
    );
};

export const AttachmentCard: React.FC<{
    item: {
        id?: string;
        name: string;
        size?: number | null;
        type?: string;
        previewUrl?: string;
        isPastedText?: boolean;
        pastedContent?: string;
        lineCount?: number;
        file?: File | Blob;
    };
    onRemove?: () => void;
    onExpandPastedText?: () => void;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    className?: string;
}> = ({ item, onRemove, onExpandPastedText, draggable, onDragStart, className = '' }) => {
    const isMedia = item.type?.startsWith('image/') || item.type?.startsWith('video/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|mp4|mov|avi|mkv|webm)$/i.test(item.name);
    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            onClick={async () => {
                const isMedia = item.type?.startsWith('image/') || item.type?.startsWith('video/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|mp4|mov|avi|mkv|webm)$/i.test(item.name);
                let content = item.pastedContent || item.previewUrl;
                if (item.file instanceof File || item.file instanceof Blob) {
                    try {
                        const isText = item.type?.startsWith('text/') || /\.(tsx?|jsx?|rs|py|json|md|txt|html|css|yaml|yml|toml|sh|bat|cmd|env|lock|sql|c|cpp|h|java|go|xml)$/i.test(item.name);
                        if (isText) {
                            content = await item.file.text();
                        }
                    } catch { }
                }

                // Decode base64 if it's text data URI
                const isTextLike = item.type?.startsWith('text/') || /\.(tsx?|jsx?|rs|py|json|md|txt|html|css|yaml|yml|toml|sh|bat|cmd|env|lock|sql|c|cpp|h|java|go|xml)$/i.test(item.name);
                if (content && typeof content === 'string' && content.startsWith('data:') && isTextLike) {
                    try {
                        const base64 = content.split(',')[1];
                        if (base64) {
                            const binaryString = atob(base64);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            content = new TextDecoder('utf-8').decode(bytes);
                        }
                    } catch { }
                }

                const assetToPreview: LibraryAsset = {
                    id: item.id || `att-${item.name}-${Date.now()}`,
                    name: item.name,
                    size: item.size || 0,
                    type: item.type || '',
                    category: isMedia ? 'media' : 'files',
                    extension: item.name.split('.').pop()?.toLowerCase() || '',
                    previewUrl: item.previewUrl,
                    content: content || item.pastedContent,
                    usages: [],
                    latestTimestamp: Date.now()
                };

                useLayoutStore.getState().setPreviewModalAsset(assetToPreview);
            }}
            className={`group relative shrink-0 w-24 h-28 sm:w-26 sm:h-30 rounded-2xl border border-[var(--border-color)]/80 hover:border-[var(--accent-color)]/70 shadow-sm ${isMedia ? 'bg-transparent' : 'bg-[var(--bg-secondary)]'} overflow-hidden transition-colors duration-150 cursor-pointer ${item.isPastedText ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
        >
            {/* Inner Card Content */}
            <div className="w-full h-full rounded-2xl overflow-hidden relative">
                {renderCardBody(item as StagedAttachment)}
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
                            <span className="text-[9px] text-[var(--text-muted)] font-medium">
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
                        onExpandPastedText();
                    }}
                    className="absolute bottom-2 right-2 z-20 w-6 h-6 rounded-full bg-[var(--accent-color)] text-[var(--accent-contrast)] shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:opacity-90 hover:scale-110 active:scale-95 cursor-pointer"
                    title="Unpack into prompt input"
                >
                    <CornerDownRight className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Sleek Delete Badge (X) - INSIDE the card so it NEVER clips */}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute top-2 right-2 z-30 w-6 h-6 rounded-full bg-red-600/95 text-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/25"
                    title="Remove file"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};

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
                    className="flex items-center gap-2 overflow-x-auto pt-0 pb-0.5 px-0 scroll-smooth no-scrollbar w-full max-w-full min-w-0 bg-transparent"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                    }}
                >
                    {attachments.map((item) => (
                        <AttachmentCard
                            key={item.id}
                            item={item}
                            onRemove={onRemove ? () => onRemove(item.id) : undefined}
                            onExpandPastedText={onExpandPastedText ? () => onExpandPastedText(item) : undefined}
                            draggable={Boolean(item.isPastedText)}
                            onDragStart={(e) => {
                                if (item.isPastedText && item.pastedContent) {
                                    e.dataTransfer.setData('application/cluaiz-pasted-text', item.pastedContent);
                                    e.dataTransfer.setData('application/cluaiz-snippet-id', item.id);
                                    e.dataTransfer.setData('text/plain', item.pastedContent);
                                }
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AttachmentStagingDeck;

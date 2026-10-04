import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Code, Eye, FileImage, Loader2 } from 'lucide-react';
import { resolveMediaUrl, resolveMediaUrlSync } from '../../utils/mediaResolver';

interface ImagePreviewProps {
    filePath: string;
    fileName: string;
    content: string; // base64, data URI, or raw text (for SVG)
    rootPath?: string;
    onChangeContent?: (newContent: string) => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
    filePath,
    fileName,
    content,
    rootPath,
    onChangeContent,
}) => {
    const [zoom, setZoom] = useState(1);
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    const isSvg = fileName.toLowerCase().endsWith('.svg');

    // Synchronous 0ms check from cache or content
    const syncUri = useMemo(() => {
        if (isSvg && (content?.trim().startsWith('<svg') || content?.trim().startsWith('<?xml'))) {
            return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
        }
        return resolveMediaUrlSync(rootPath, filePath, content);
    }, [rootPath, filePath, content, isSvg]);

    const [loadedUri, setLoadedUri] = useState<string>(syncUri);
    const [isLoading, setIsLoading] = useState<boolean>(!syncUri);
    const [hasError, setHasError] = useState<boolean>(false);

    // Track container dimensions to calculate responsive fit base scale
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const updateSize = () => {
            if (el.clientWidth > 0 && el.clientHeight > 0) {
                setContainerSize({ width: el.clientWidth, height: el.clientHeight });
            }
        };
        updateSize();
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Fast in-memory resolution
    useEffect(() => {
        let isMounted = true;

        if (syncUri) {
            setLoadedUri(syncUri);
            setIsLoading(false);
            setHasError(false);
            return;
        }

        setIsLoading(true);
        setHasError(false);

        resolveMediaUrl(rootPath, filePath, content)
            .then((url) => {
                if (!isMounted) return;
                if (url) {
                    setLoadedUri(url);
                    if (url.startsWith('data:')) {
                        onChangeContent?.(url);
                    }
                } else {
                    setHasError(true);
                }
            })
            .catch(() => {
                if (isMounted) setHasError(true);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [rootPath, filePath, content, syncUri, onChangeContent]);

    const handleZoomIn = () => setZoom(prev => Math.min(Number((prev + 0.25).toFixed(2)), 5));
    const handleZoomOut = () => setZoom(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.25));
    const handleResetZoom = () => setZoom(1);

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                handleZoomIn();
            } else {
                handleZoomOut();
            }
        }
    };

    // Calculate base fit scale so image fits comfortably inside the viewport at 100%
    const fitScale = useMemo(() => {
        if (!imageDimensions || containerSize.width <= 0 || containerSize.height <= 0) return 1;
        const availW = Math.max(containerSize.width - 80, 100);
        const availH = Math.max(containerSize.height - 80, 100);
        const scaleW = availW / imageDimensions.width;
        const scaleH = availH / imageDimensions.height;
        return Math.min(scaleW, scaleH, 1);
    }, [imageDimensions, containerSize]);

    const displayWidth = imageDimensions ? Math.round(imageDimensions.width * fitScale * zoom) : undefined;
    const displayHeight = imageDimensions ? Math.round(imageDimensions.height * fitScale * zoom) : undefined;

    return (
        <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] select-none font-sans overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)] px-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-[var(--accent-color)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px]">{fileName}</span>
                    {imageDimensions && (
                        <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                            {imageDimensions.width} × {imageDimensions.height} px
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {isSvg && (
                        <div className="flex items-center bg-[var(--bg-tertiary)] p-0.5 rounded-lg border border-[var(--border-color)] mr-2">
                            <button
                                type="button"
                                onClick={() => setViewMode('preview')}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                                    viewMode === 'preview' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Eye className="w-3 h-3 text-[var(--accent-color)]" /> Preview
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('code')}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                                    viewMode === 'code' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-semibold shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Code className="w-3 h-3 text-indigo-400" /> Code
                            </button>
                        </div>
                    )}

                    <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-0.5 border border-[var(--border-color)]">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-mono text-[var(--text-primary)] px-2 min-w-[45px] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleResetZoom}
                            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-0.5 cursor-pointer"
                            title="Reset Zoom (100%)"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div 
                ref={containerRef}
                onWheel={handleWheel}
                className="flex-1 overflow-auto flex p-6 relative select-none custom-scrollbar"
            >
                {viewMode === 'code' && isSvg ? (
                    <pre className="w-full h-full p-4 font-mono text-xs text-zinc-300 bg-zinc-950/60 overflow-auto rounded-lg select-text border border-white/5">
                        {content}
                    </pre>
                ) : isLoading && !loadedUri ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 m-auto">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        <span className="text-xs font-mono">Loading image binary...</span>
                    </div>
                ) : (
                    /* Checkerboard background for transparent PNG/SVG/WebP */
                    <div 
                        className="relative p-6 rounded-xl shadow-2xl transition-all duration-150 flex items-center justify-center m-auto flex-shrink-0"
                        style={{
                            backgroundImage: `
                                linear-gradient(45deg, #181c24 25%, transparent 25%), 
                                linear-gradient(-45deg, #181c24 25%, transparent 25%), 
                                linear-gradient(45deg, transparent 75%, #181c24 75%), 
                                linear-gradient(-45deg, transparent 75%, #181c24 75%)
                            `,
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                            backgroundColor: '#0f131a',
                        }}
                    >
                        {loadedUri && !hasError ? (
                            <img
                                src={loadedUri}
                                alt={fileName}
                                onLoad={(e) => {
                                    const target = e.currentTarget;
                                    setImageDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                                }}
                                onError={() => {
                                    setHasError(true);
                                }}
                                style={{
                                    width: displayWidth ? `${displayWidth}px` : undefined,
                                    height: displayHeight ? `${displayHeight}px` : undefined,
                                    maxWidth: displayWidth ? undefined : '70vw',
                                    maxHeight: displayHeight ? undefined : '65vh',
                                }}
                                className="object-contain drop-shadow-lg select-none transition-all duration-150 rounded"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-500 font-mono text-xs">
                                <FileImage className="w-8 h-8 opacity-40 text-amber-500/80" />
                                <span>{hasError ? 'Failed to decode image binary' : 'Unable to render image'}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

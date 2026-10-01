import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Download, Code, Eye, FileImage, Loader2 } from 'lucide-react';
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

    // Universal 0ms high-speed in-memory resolution
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

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 5));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
    const handleResetZoom = () => setZoom(1);

    const handleDownload = () => {
        if (!loadedUri) return;
        const link = document.createElement('a');
        link.href = loadedUri;
        link.download = fileName;
        link.click();
    };

    return (
        <div className="h-full w-full flex flex-col bg-[#0b0f14] select-none font-sans overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-10 border-b border-white/[0.08] bg-zinc-950/80 px-4 flex items-center justify-between flex-shrink-0 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px]">{fileName}</span>
                    {imageDimensions && (
                        <span className="text-[11px] font-mono text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded border border-white/5">
                            {imageDimensions.width} × {imageDimensions.height} px
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    {isSvg && (
                        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/5 mr-2">
                            <button
                                type="button"
                                onClick={() => setViewMode('preview')}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                                    viewMode === 'preview' ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <Eye className="w-3 h-3" /> Preview
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('code')}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                                    viewMode === 'code' ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <Code className="w-3 h-3" /> Code
                            </button>
                        </div>
                    )}

                    <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 border border-white/5">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-mono text-zinc-300 px-2 min-w-[45px] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleResetZoom}
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors ml-0.5"
                            title="Reset Zoom (100%)"
                        >
                            <RotateCcw className="w-3 h-3" />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-emerald-400 transition-colors ml-1"
                        title="Download Image"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
                {viewMode === 'code' && isSvg ? (
                    <pre className="w-full h-full p-4 font-mono text-xs text-zinc-300 bg-zinc-950/60 overflow-auto rounded-lg select-text border border-white/5">
                        {content}
                    </pre>
                ) : isLoading && !loadedUri ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-zinc-500">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        <span className="text-xs font-mono">Loading image binary...</span>
                    </div>
                ) : (
                    /* Checkerboard background for transparent PNG/SVG/WebP */
                    <div 
                        className="relative p-8 rounded-xl shadow-2xl transition-transform duration-100 flex items-center justify-center"
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
                            transform: `scale(${zoom})`,
                            transformOrigin: 'center center'
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
                                className="max-w-[80vw] max-h-[70vh] object-contain drop-shadow-lg"
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


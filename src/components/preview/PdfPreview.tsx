import React, { useState, useMemo, useEffect } from 'react';
import { Download, ExternalLink, FileText, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { resolveMediaUrl, resolveMediaUrlSync } from '../../utils/mediaResolver';

interface PdfPreviewProps {
    filePath: string;
    fileName: string;
    content: string; // base64, data URI, or binary string
    rootPath?: string;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({
    filePath,
    fileName,
    content,
    rootPath,
}) => {
    const initialSyncUri = useMemo(() => {
        return resolveMediaUrlSync(rootPath, filePath, content);
    }, [rootPath, filePath, content]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string>(initialSyncUri);
    const [isLoading, setIsLoading] = useState<boolean>(!initialSyncUri);

    useEffect(() => {
        let isMounted = true;

        if (initialSyncUri) {
            setPdfUrl(initialSyncUri);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        resolveMediaUrl(rootPath, filePath, content)
            .then((url) => {
                if (!isMounted) return;
                setPdfUrl(url);
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [rootPath, filePath, content, initialSyncUri]);

    const handleDownload = () => {
        if (!pdfUrl) return;
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = fileName;
        a.click();
    };

    const handleOpenExternal = () => {
        if (!pdfUrl) return;
        window.open(pdfUrl, '_blank');
    };

    return (
        <div className={`h-full w-full flex flex-col bg-[#0b0f14] select-none font-sans overflow-hidden ${
            isFullscreen ? 'fixed inset-0 z-50' : 'relative'
        }`}>
            {/* Top Toolbar */}
            <div className="h-10 border-b border-white/[0.08] bg-zinc-950/90 px-4 flex items-center justify-between flex-shrink-0 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-semibold text-zinc-200 truncate max-w-[250px]">{fileName}</span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20">
                        PDF
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={handleOpenExternal}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/10 text-xs text-zinc-300 hover:text-white transition-colors border border-white/5"
                        title="Open in Browser Tab"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Tab</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-emerald-400 transition-colors"
                        title="Download PDF"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsFullscreen(prev => !prev)}
                        className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Embedded Native PDF Viewer */}
            <div className="flex-1 w-full h-full bg-[#12161f] overflow-hidden relative">
                {pdfUrl ? (
                    <iframe
                        src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                        title={fileName}
                        className="w-full h-full border-0"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-500 text-xs font-mono">
                        Loading PDF content...
                    </div>
                )}
            </div>
        </div>
    );
};

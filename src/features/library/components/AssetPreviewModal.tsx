import React, { useState, useEffect } from 'react';
import {
    X,
    ExternalLink,
    Download,
    Copy,
    Check,
    MessageSquare,
    ArrowUpRight
} from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';
import { LibraryAsset } from '../types';
import { CodeEditor } from '../../../components/ui/CodeEditor/CodeEditor';
import { FilePreviewDispatcher, isPreviewableFile } from '../../../components/preview/FilePreviewDispatcher';
import { detectLanguageFromPath } from '../../../store/workspace/useProjectStore';
import { Tooltip } from '../../../components/ui/tooltip';
import { toast } from '../../../components/ui/toast';

interface AssetPreviewModalProps {
    asset: LibraryAsset | null;
    onClose: () => void;
    onOpenInWorkspace: (asset: LibraryAsset) => void;
    onJumpToChat: (sessionId: string) => void;
}

function formatBytes(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
    asset,
    onClose,
    onOpenInWorkspace,
    onJumpToChat
}) => {
    const [copied, setCopied] = useState(false);

    // ESC key closes preview modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const resolvedContent = React.useMemo(() => {
        if (!asset) return '';
        if (asset.content) return asset.content;
        if (asset.previewUrl && asset.previewUrl.startsWith('data:')) {
            try {
                const base64 = asset.previewUrl.split(',')[1];
                if (base64) {
                    const binaryString = atob(base64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    return new TextDecoder('utf-8').decode(bytes);
                }
            } catch {
                try {
                    return atob(asset.previewUrl.split(',')[1] || '');
                } catch {}
            }
        }
        return '';
    }, [asset?.content, asset?.previewUrl]);

    if (!asset) return null;

    const handleCopy = () => {
        if (!resolvedContent) return;
        navigator.clipboard.writeText(resolvedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Code copied to clipboard');
    };

    const handleDownload = () => {
        if (resolvedContent) {
            const blob = new Blob([resolvedContent], { type: asset.type || 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = asset.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(`Downloaded ${asset.name}`);
            return;
        }

        if (asset.previewUrl) {
            const a = document.createElement('a');
            a.href = asset.previewUrl;
            a.download = asset.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success(`Downloaded ${asset.name}`);
            return;
        }

        toast.info('No download available for this file.');
    };

    const language = detectLanguageFromPath(asset.name) as any;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="max-w-5xl w-full h-[85vh] max-h-[900px] flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 select-text"
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: 'var(--font-family)' }}
            >
                {/* Modal Header */}
                <header className="h-14 px-5 border-b border-[var(--border-color)]/70 flex items-center justify-between flex-shrink-0 bg-[var(--bg-tertiary)]/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                            <FileIcon
                                fileName={asset.name}
                                fileExtension={asset.extension || 'file'}
                                size={20}
                            />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-[var(--text-primary)] truncate" title={asset.name}>
                                {asset.name}
                            </h2>
                            <div className="flex items-center gap-2 text-[10.5px] font-mono text-[var(--text-muted)]">
                                <span>{formatBytes(asset.size)}</span>
                                <span>•</span>
                                <span>{formatDate(asset.latestTimestamp)}</span>
                                <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                    {asset.extension || asset.category}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        {resolvedContent && (
                            <Tooltip title="Copy Code" position="bottom">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </Tooltip>
                        )}

                        <Tooltip title="Open in Workspace Editor" position="bottom">
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenInWorkspace({
                                        ...asset,
                                        content: resolvedContent
                                    });
                                    onClose();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] font-medium transition-colors cursor-pointer shadow-xs"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Workspace</span>
                            </button>
                        </Tooltip>

                        <Tooltip title="Download File" position="bottom">
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </Tooltip>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer ml-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Modal Body: 100% Reused Existing Components (FilePreviewDispatcher or CodeEditor) */}
                <div className="flex-1 w-full h-full min-h-0 overflow-hidden bg-[var(--bg-primary)] flex flex-col relative">
                    {isPreviewableFile(asset.name) ? (
                        <FilePreviewDispatcher
                            filePath={asset.previewUrl || asset.name}
                            fileName={asset.name}
                            content={asset.previewUrl || resolvedContent || ''}
                        />
                    ) : (
                        <CodeEditor
                            value={resolvedContent}
                            language={language}
                            filePath={asset.name}
                            fileName={asset.name}
                            readOnly={true}
                            height="100%"
                            className="h-full border-0 rounded-none shadow-none"
                            showToolbar={false}
                            showMinimap={true}
                            showLineNumbers={true}
                        />
                    )}
                </div>

                {/* Modal Footer: Referenced Chats */}
                <footer className="px-5 py-3 border-t border-[var(--border-color)]/70 bg-[var(--bg-tertiary)]/50 flex flex-wrap items-center justify-between gap-3 text-xs select-none shrink-0">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-[11px]">
                        {Array.isArray(asset.usages) && asset.usages.length > 0 ? (
                            <>
                                <span>Referenced in:</span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {asset.usages.map((u, uIdx) => (
                                        <button
                                            key={`${u.sessionId}_${uIdx}`}
                                            type="button"
                                            onClick={() => {
                                                onJumpToChat(u.sessionId);
                                                onClose();
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--accent-color)]/15 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent-color)] text-[11px] font-medium transition-colors cursor-pointer"
                                            title={`Jump to chat: ${u.sessionTitle}`}
                                        >
                                            <MessageSquare className="w-3 h-3 text-[var(--accent-color)]" />
                                            <span className="truncate max-w-[140px]">{u.sessionTitle}</span>
                                            <ArrowUpRight className="w-3 h-3 opacity-50" />
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <span className="text-[var(--text-muted)] opacity-70">Direct attachment / No linked chats</span>
                        )}
                    </div>

                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        Press ESC or click outside to close
                    </span>
                </footer>
            </div>
        </div>
    );
};

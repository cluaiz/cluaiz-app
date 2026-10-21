import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowLeft,
    FolderArchive,
    Search,
    X,
    LayoutGrid,
    List,
    ExternalLink,
    MessageSquare,
    Trash2,
    Download,
    ArrowUpRight,
    ArrowUpDown,
    ChevronDown,
    Layers,
    ArrowLeftRight,
    Eye,
    MoreVertical
} from 'lucide-react';
import { FileIcon } from 'react-material-icon-theme';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';
import { useChatStore } from '../../../store/chat/useChatStore';
import { pushChatRoute, pushViewRoute } from '../../../core/router';
import { useLibraryAssets } from '../hooks/useLibraryAssets';
import { LibraryAsset, LibraryCategory, LibrarySortOption } from '../types';
import { openAttachmentInWorkspace } from '../../chat/utils/workspaceAttachmentOpener';
import { WorkspaceEditorPane } from '../../workspace';
import { ResizableDivider } from '../../../components/ui/ResizableDivider';
import { ActionDropdown, ActionDropdownItem } from '../../../components/ui/dropdown/ActionDropdown';
import { ConfirmationModal } from '../../../components/ui/modal/ConfirmationModal';
import { Tooltip } from '../../../components/ui/tooltip';
import { toast } from '../../../components/ui/toast';

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
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const LibraryHub: React.FC = () => {
    const {
        assets,
        counts,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        sortOption,
        setSortOption,
        deleteAsset
    } = useLibraryAssets();

    const {
        splitPaneWidth,
        setSplitPaneWidth,
        splitReversed,
        toggleSplitReversed,
        setPreviewModalAsset
    } = useLayoutStore();

    const isSplitOpen = splitPaneWidth < 100;

    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [openChatDropdownAssetId, setOpenChatDropdownAssetId] = useState<string | null>(null);
    const [openActionDropdownAssetId, setOpenActionDropdownAssetId] = useState<string | null>(null);
    const [assetToDelete, setAssetToDelete] = useState<LibraryAsset | null>(null);

    // Split pane drag resize listener (when workspace is open)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const relativeX = e.clientX - containerRect.left;
            const percentage = (relativeX / containerRect.width) * 100;

            const targetWidth = splitReversed ? 100 - percentage : percentage;
            if (targetWidth >= 20 && targetWidth <= 80) {
                setSplitPaneWidth(targetWidth);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, splitReversed, setSplitPaneWidth]);

    const handleBackToChat = () => {
        useLayoutStore.getState().setActiveView('chat');
        pushViewRoute('chat');
    };

    const handleJumpToChat = async (sessionId: string) => {
        setOpenChatDropdownAssetId(null);
        await useChatStore.getState().switchSession(sessionId);
        useLayoutStore.getState().setActiveView('chat');
        pushChatRoute(sessionId);
    };

    const handleOpenInWorkspace = async (asset: LibraryAsset) => {
        try {
            await openAttachmentInWorkspace({
                name: asset.name,
                size: asset.size,
                type: asset.type,
                previewUrl: asset.previewUrl,
                pastedContent: asset.content
            });
        } catch (err) {
            console.error('Failed to open in workspace:', err);
        }
    };

    const handleDownload = (asset: LibraryAsset) => {
        if (!asset.previewUrl) {
            if (asset.content) {
                const blob = new Blob([asset.content], { type: 'text/plain' });
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
            toast.info('No direct download available for this file.');
            return;
        }
        try {
            const a = document.createElement('a');
            a.href = asset.previewUrl;
            a.download = asset.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success(`Downloaded ${asset.name}`);
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Failed to download asset');
        }
    };

    const confirmDelete = async () => {
        if (!assetToDelete) return;
        try {
            await deleteAsset(assetToDelete);
            toast.success(`Removed "${assetToDelete.name}" from Library`);
        } catch (err) {
            console.error('Failed to delete asset:', err);
            toast.error('Failed to delete asset');
        } finally {
            setAssetToDelete(null);
        }
    };

    const sortLabels: Record<LibrarySortOption, string> = {
        newest: 'Newest First',
        oldest: 'Oldest First',
        largest: 'Size (Largest)',
        name: 'Name (A-Z)'
    };

    return (
        <div
            ref={containerRef}
            className={`flex-1 flex w-full h-full min-w-0 overflow-hidden relative ${splitReversed ? 'flex-row-reverse' : 'flex-row'
                }`}
            style={{ fontFamily: 'var(--font-family)' }}
        >
            {/* Primary Library Area */}
            <div
                style={{ width: splitPaneWidth < 100 ? `${splitPaneWidth}%` : '100%' }}
                className="h-full flex flex-col min-w-0 overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] select-none"
            >
                {/* Top Workspace Header Bar */}
                <header className="h-16 border-b border-[var(--border-color)]/80 bg-[var(--bg-secondary)]/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 flex-shrink-0 z-20 min-w-0">
                    {/* Left: Library Branding (No Back Button) */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)] shadow-xs shrink-0">
                            <FolderArchive className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] tracking-tight whitespace-nowrap">
                                Library
                            </h1>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30 uppercase tracking-wider shrink-0 hidden xs:inline-block">
                                {counts.all} {counts.all === 1 ? 'Asset' : 'Assets'}
                            </span>
                        </div>
                    </div>

                    {/* Center: Large Prominent Search Bar */}
                    <div className="relative flex-1 max-w-sm sm:max-w-md mx-2 sm:mx-4 min-w-[90px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search media, code, documents..."
                            className="w-full h-9 pl-9 pr-7 bg-[var(--bg-tertiary)]/70 hover:bg-[var(--bg-tertiary)] focus:bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-color)] transition-all font-sans"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Right Controls: Direct controls on wide space, 3-dots on narrow/split space */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {!isSplitOpen ? (
                            <>
                                {/* View Mode Toggle */}
                                <div className="hidden sm:flex items-center p-0.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                                    <Tooltip title="Grid View" position="bottom">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                viewMode === 'grid'
                                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast,#ffffff)] shadow-xs font-bold'
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" />
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="List View" position="bottom">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                viewMode === 'list'
                                                    ? 'bg-[var(--accent-color)] text-[var(--accent-contrast,#ffffff)] shadow-xs font-bold'
                                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            <List className="w-3.5 h-3.5" />
                                        </button>
                                    </Tooltip>
                                </div>

                                {/* Sort Dropdown */}
                                <div className="relative hidden sm:block">
                                    <button
                                        type="button"
                                        onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                                        className="h-9 px-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                        title={`Sort: ${sortLabels[sortOption]}`}
                                    >
                                        <ArrowUpDown className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                        <span className="text-[var(--text-muted)] hidden md:inline">Sort:</span>
                                        <span className="font-semibold">{sortLabels[sortOption]}</span>
                                        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                    </button>

                                    <ActionDropdown
                                        isOpen={isSortDropdownOpen}
                                        onClose={() => setIsSortDropdownOpen(false)}
                                        align="right"
                                        className="w-44"
                                    >
                                        {(
                                            [
                                                { id: 'newest', label: 'Newest First' },
                                                { id: 'oldest', label: 'Oldest First' },
                                                { id: 'largest', label: 'Size (Largest)' },
                                                { id: 'name', label: 'Name (A-Z)' }
                                            ] as const
                                        ).map((opt) => (
                                            <ActionDropdownItem
                                                key={opt.id}
                                                active={sortOption === opt.id}
                                                onClick={() => {
                                                    setSortOption(opt.id);
                                                    setIsSortDropdownOpen(false);
                                                }}
                                            >
                                                {opt.label}
                                            </ActionDropdownItem>
                                        ))}
                                    </ActionDropdown>
                                </div>
                            </>
                        ) : null}

                        {/* 3-dots Menu Button: Active in split pane or on mobile (< 640px) */}
                        <div className={`relative ${!isSplitOpen ? 'sm:hidden' : 'block'}`}>
                            <Tooltip title="View & Sort options" position="bottom">
                                <button
                                    type="button"
                                    onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                                    className="h-9 w-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                                >
                                    <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                                </button>
                            </Tooltip>

                            <ActionDropdown
                                isOpen={isHeaderMenuOpen}
                                onClose={() => setIsHeaderMenuOpen(false)}
                                align="right"
                                className="w-48 z-50 shadow-2xl"
                            >
                                <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--text-muted)] uppercase border-b border-[var(--border-color)]/50">
                                    View Layout
                                </div>
                                <ActionDropdownItem
                                    active={viewMode === 'grid'}
                                    icon={<LayoutGrid className="w-3.5 h-3.5" />}
                                    onClick={() => {
                                        setViewMode('grid');
                                        setIsHeaderMenuOpen(false);
                                    }}
                                >
                                    Grid View
                                </ActionDropdownItem>
                                <ActionDropdownItem
                                    active={viewMode === 'list'}
                                    icon={<List className="w-3.5 h-3.5" />}
                                    onClick={() => {
                                        setViewMode('list');
                                        setIsHeaderMenuOpen(false);
                                    }}
                                >
                                    List View
                                </ActionDropdownItem>

                                <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--text-muted)] uppercase border-b border-t border-[var(--border-color)]/50 mt-1">
                                    Sort By
                                </div>
                                {(
                                    [
                                        { id: 'newest', label: 'Newest First' },
                                        { id: 'oldest', label: 'Oldest First' },
                                        { id: 'largest', label: 'Size (Largest)' },
                                        { id: 'name', label: 'Name (A-Z)' }
                                    ] as const
                                ).map((opt) => (
                                    <ActionDropdownItem
                                        key={opt.id}
                                        active={sortOption === opt.id}
                                        icon={<ArrowUpDown className="w-3 h-3 text-[var(--accent-color)]" />}
                                        onClick={() => {
                                            setSortOption(opt.id);
                                            setIsHeaderMenuOpen(false);
                                        }}
                                    >
                                        {opt.label}
                                    </ActionDropdownItem>
                                ))}
                            </ActionDropdown>
                        </div>
                    </div>
                </header>

                {/* Subheader: Category Segmented Tabs */}
                <div className="px-3 sm:px-6 py-2 border-b border-[var(--border-color)]/70 bg-[var(--bg-secondary)]/30 flex items-center justify-between gap-2 flex-shrink-0">
                    <div className="flex items-center p-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xs">
                        {(
                            [
                                { id: 'all', label: 'All', count: counts.all },
                                { id: 'media', label: 'Media', count: counts.media },
                                { id: 'files', label: 'Files', count: counts.files }
                            ] as const
                        ).map((tab) => {
                            const isActive = activeCategory === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveCategory(tab.id as LibraryCategory)}
                                    className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${isActive
                                        ? 'bg-[var(--accent-color)] text-[var(--accent-contrast,#ffffff)] shadow-sm font-bold'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold ${isActive
                                            ? 'bg-black/25 text-[var(--accent-contrast,#ffffff)]'
                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]/60'
                                            }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-xs text-[var(--text-muted)] font-mono shrink-0 hidden sm:block">
                        Showing {assets.length} of {counts.all}
                    </div>
                </div>

                {/* Main Content Area: Responsive Fluid Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[380px] text-center p-8">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] mb-4 shadow-sm">
                                <FolderArchive className="w-8 h-8 opacity-60" />
                            </div>
                            <h2 className="text-base font-extrabold text-[var(--text-primary)] mb-1">
                                {searchQuery ? 'No matching assets found' : 'Your Library is empty'}
                            </h2>
                            <p className="text-xs text-[var(--text-muted)] max-w-sm mb-5 leading-relaxed">
                                {searchQuery
                                    ? `No media or files matched "${searchQuery}". Try searching with another keyword.`
                                    : 'Images, videos, code files, and documents attached in any conversation will automatically appear here.'}
                            </p>
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors cursor-pointer"
                                >
                                    Clear Search
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleBackToChat}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent-color)] text-[var(--accent-contrast,#ffffff)] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                                >
                                    Go to Chat
                                </button>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* Responsive Fluid Grid across wide displays & split pane */
                        <div
                            className="grid gap-4"
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
                        >
                            {assets.map((asset) => {
                                const isMedia = asset.category === 'media' && Boolean(asset.previewUrl);
                                const usages = asset.usages || [];
                                const hasMultipleUsages = usages.length > 1;
                                const hasSingleUsage = usages.length === 1;
                                const primaryUsage = usages[0];
                                const isChatDropdownOpen = openChatDropdownAssetId === asset.id;
                                const isActionDropdownOpen = openActionDropdownAssetId === asset.id;

                                return (
                                    <div
                                        key={asset.id}
                                        className={`group rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--accent-color)]/60 hover:shadow-xl transition-all duration-200 flex flex-col justify-between relative ${
                                            isActionDropdownOpen ? 'z-50' : 'z-0'
                                        }`}
                                    >
                                        {/* Top Glass 3-dots Action Menu (Placed outside overflow-hidden thumbnail to avoid clipping) */}
                                        <div className="absolute top-2 right-2 z-30">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenActionDropdownAssetId(isActionDropdownOpen ? null : asset.id);
                                                }}
                                                className="p-1 rounded-lg backdrop-blur-md bg-black/60 hover:bg-black/85 text-white/90 border border-white/15 shadow-xs transition-colors cursor-pointer"
                                                title="More options"
                                            >
                                                <MoreVertical className="w-3.5 h-3.5" />
                                            </button>

                                            <ActionDropdown
                                                isOpen={isActionDropdownOpen}
                                                onClose={() => setOpenActionDropdownAssetId(null)}
                                                align="right"
                                                className="w-48 z-50 shadow-2xl"
                                            >
                                                <ActionDropdownItem
                                                    icon={<Eye className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                                    onClick={() => {
                                                        setPreviewModalAsset(asset);
                                                        setOpenActionDropdownAssetId(null);
                                                    }}
                                                >
                                                    Preview
                                                </ActionDropdownItem>

                                                <ActionDropdownItem
                                                    icon={<ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                                                    onClick={() => {
                                                        handleOpenInWorkspace(asset);
                                                        setOpenActionDropdownAssetId(null);
                                                    }}
                                                >
                                                    Open in Workspace
                                                </ActionDropdownItem>

                                                {asset.previewUrl && (
                                                    <ActionDropdownItem
                                                        icon={<Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                                                        onClick={() => {
                                                            handleDownload(asset);
                                                            setOpenActionDropdownAssetId(null);
                                                        }}
                                                    >
                                                        Download
                                                    </ActionDropdownItem>
                                                )}

                                                {hasSingleUsage && primaryUsage ? (
                                                    <ActionDropdownItem
                                                        icon={<MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                                        onClick={() => {
                                                            handleJumpToChat(primaryUsage.sessionId);
                                                            setOpenActionDropdownAssetId(null);
                                                        }}
                                                    >
                                                        <span className="truncate">View in Chat ({primaryUsage.sessionTitle})</span>
                                                    </ActionDropdownItem>
                                                ) : hasMultipleUsages ? (
                                                    <>
                                                        <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--text-muted)] uppercase border-t border-[var(--border-color)]/50 mt-1">
                                                            Referenced Chats ({usages.length})
                                                        </div>
                                                        {usages.map((u, uIdx) => (
                                                            <ActionDropdownItem
                                                                key={`${u.sessionId}_${uIdx}`}
                                                                icon={<MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                                                onClick={() => {
                                                                    handleJumpToChat(u.sessionId);
                                                                    setOpenActionDropdownAssetId(null);
                                                                }}
                                                            >
                                                                <span className="truncate">{u.sessionTitle}</span>
                                                            </ActionDropdownItem>
                                                        ))}
                                                    </>
                                                ) : null}

                                                <div className="border-t border-[var(--border-color)]/50 my-1" />

                                                <ActionDropdownItem
                                                    danger
                                                    icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                                                    onClick={() => {
                                                        setAssetToDelete(asset);
                                                        setOpenActionDropdownAssetId(null);
                                                    }}
                                                >
                                                    Delete
                                                </ActionDropdownItem>
                                            </ActionDropdown>
                                        </div>

                                        {/* 1. Edge-to-Edge Thumbnail Preview: Click opens centered Modal preview */}
                                        <div
                                            className="relative w-full h-40 sm:h-44 rounded-t-2xl overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center cursor-pointer group/thumb"
                                            onClick={() => setPreviewModalAsset(asset)}
                                            title="Click to preview"
                                        >
                                            {isMedia ? (
                                                <img
                                                    src={asset.previewUrl}
                                                    alt={asset.name}
                                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-2 p-3 text-center">
                                                    <div className="drop-shadow-md group-hover/thumb:scale-110 transition-transform duration-200">
                                                        <FileIcon
                                                            fileName={asset.name}
                                                            fileExtension={asset.extension || 'file'}
                                                            size={44}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                                        {asset.extension || 'FILE'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Top Glass Extension Tag */}
                                            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white backdrop-blur-md bg-black/60 px-1.5 py-0.5 rounded border border-white/15 shadow-xs">
                                                    {asset.extension || (isMedia ? 'IMG' : 'DOC')}
                                                </span>
                                            </div>

                                            {/* Bottom Glass Size Tag */}
                                            <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
                                                <span className="text-[9px] font-mono text-white/90 backdrop-blur-md bg-black/60 px-1.5 py-0.5 rounded border border-white/15 shadow-xs">
                                                    {formatBytes(asset.size)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 2. Compact Clean Metadata Container (Duplicate chat/workspace/delete removed) */}
                                        <div className="p-3 flex flex-col gap-1.5 bg-[var(--bg-secondary)] rounded-b-2xl">
                                            <div
                                                className="text-xs font-bold text-[var(--text-primary)] truncate hover:text-[var(--accent-color)] transition-colors cursor-pointer"
                                                onClick={() => setPreviewModalAsset(asset)}
                                                title={asset.name}
                                            >
                                                {asset.name}
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                                                <span>{formatDate(asset.latestTimestamp)}</span>
                                                <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium border border-[var(--border-color)]/50">
                                                    {asset.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Modern List View */
                        <div className="border border-[var(--border-color)] rounded-2xl bg-[var(--bg-secondary)] shadow-xs min-h-[320px] pb-16">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-[var(--bg-tertiary)]/70 text-[var(--text-muted)] border-b border-[var(--border-color)] font-bold">
                                    <tr>
                                        <th className="py-3 px-4">Name</th>
                                        <th className="py-3 px-4 hidden sm:table-cell">Category</th>
                                        <th className="py-3 px-4 hidden md:table-cell">Size</th>
                                        <th className="py-3 px-4 hidden lg:table-cell">Used in Chat(s)</th>
                                        <th className="py-3 px-4 hidden md:table-cell">Date</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]/40 text-[var(--text-secondary)]">
                                    {assets.map((asset) => {
                                        const usages = asset.usages || [];
                                        const hasMultipleUsages = usages.length > 1;
                                        const hasSingleUsage = usages.length === 1;
                                        const primaryUsage = usages[0];
                                        const isChatDropdownOpen = openChatDropdownAssetId === asset.id;
                                        const isActionDropdownOpen = openActionDropdownAssetId === asset.id;

                                        return (
                                            <tr
                                                key={asset.id}
                                                className="hover:bg-[var(--bg-tertiary)]/40 transition-colors group"
                                            >
                                                {/* 1. Name with Large Prominent Preview Thumbnail */}
                                                <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                                                    <div className="flex items-center gap-3.5 max-w-xs md:max-w-md truncate">
                                                        <div
                                                            className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] overflow-hidden border border-[var(--border-color)] shadow-xs cursor-pointer group-hover:border-[var(--accent-color)]/50 transition-colors"
                                                            onClick={() => setPreviewModalAsset(asset)}
                                                            title="Click to preview"
                                                        >
                                                            {asset.category === 'media' && asset.previewUrl ? (
                                                                <img
                                                                    src={asset.previewUrl}
                                                                    alt={asset.name}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                            ) : (
                                                                <FileIcon
                                                                    fileName={asset.name}
                                                                    fileExtension={asset.extension || 'file'}
                                                                    size={26}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span
                                                                className="truncate cursor-pointer hover:text-[var(--accent-color)] font-bold text-xs"
                                                                onClick={() => setPreviewModalAsset(asset)}
                                                                title={asset.name}
                                                            >
                                                                {asset.name}
                                                            </span>
                                                            <div className="flex items-center gap-2 mt-0.5 sm:hidden text-[10px] text-[var(--text-muted)] font-mono">
                                                                <span>{formatBytes(asset.size)}</span>
                                                                <span>•</span>
                                                                <span>{formatDate(asset.latestTimestamp)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 2. Category Pill (hidden on <640px) */}
                                                <td className="py-3 px-4 hidden sm:table-cell">
                                                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md font-bold">
                                                        {asset.category}
                                                    </span>
                                                </td>

                                                {/* 3. Size (hidden on <768px) */}
                                                <td className="py-3 px-4 font-mono text-[11px] hidden md:table-cell">
                                                    {formatBytes(asset.size)}
                                                </td>

                                                {/* 4. Chat Link (hidden on <1024px; accessible via 3-dots on smaller screens) */}
                                                <td className="py-3 px-4 hidden lg:table-cell">
                                                    <div className="relative">
                                                        {hasMultipleUsages ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setOpenChatDropdownAssetId(
                                                                            isChatDropdownOpen ? null : asset.id
                                                                        )
                                                                    }
                                                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-xs font-medium cursor-pointer"
                                                                >
                                                                    <Layers className="w-3.5 h-3.5 shrink-0" />
                                                                    <span>{usages.length} chats</span>
                                                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                                                </button>

                                                                <ActionDropdown
                                                                    isOpen={isChatDropdownOpen}
                                                                    onClose={() => setOpenChatDropdownAssetId(null)}
                                                                    align="left"
                                                                    className="w-56 z-50 shadow-2xl bg-[var(--bg-secondary)]"
                                                                >
                                                                    {usages.map((u, uIdx) => (
                                                                        <ActionDropdownItem
                                                                            key={`${u.sessionId}_${uIdx}`}
                                                                            icon={
                                                                                <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                                                            }
                                                                            onClick={() => handleJumpToChat(u.sessionId)}
                                                                        >
                                                                            {u.sessionTitle}
                                                                        </ActionDropdownItem>
                                                                    ))}
                                                                </ActionDropdown>
                                                            </>
                                                        ) : hasSingleUsage && primaryUsage ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleJumpToChat(primaryUsage.sessionId)}
                                                                className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors cursor-pointer truncate max-w-[200px]"
                                                                title={`Switch to ${primaryUsage.sessionTitle}`}
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                                                <span className="truncate">
                                                                    {primaryUsage.sessionTitle}
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] opacity-60">
                                                                <MessageSquare className="w-3 h-3 shrink-0 opacity-40" />
                                                                <span>No chat</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 5. Date (hidden on <768px) */}
                                                <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-muted)] hidden md:table-cell">
                                                    {formatDate(asset.latestTimestamp)}
                                                </td>

                                                {/* 6. Action 3-dots Menu */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="relative inline-block text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenActionDropdownAssetId(isActionDropdownOpen ? null : asset.id)}
                                                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                                                            title="More options"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>

                                                        <ActionDropdown
                                                            isOpen={isActionDropdownOpen}
                                                            onClose={() => setOpenActionDropdownAssetId(null)}
                                                            align="right"
                                                            className="w-48 z-50 shadow-2xl"
                                                        >
                                                            <ActionDropdownItem
                                                                icon={<Eye className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                                                onClick={() => {
                                                                    setPreviewModalAsset(asset);
                                                                    setOpenActionDropdownAssetId(null);
                                                                }}
                                                            >
                                                                Preview
                                                            </ActionDropdownItem>

                                                            <ActionDropdownItem
                                                                icon={<ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                                                                onClick={() => {
                                                                    handleOpenInWorkspace(asset);
                                                                    setOpenActionDropdownAssetId(null);
                                                                }}
                                                            >
                                                                Open in Workspace
                                                            </ActionDropdownItem>

                                                            {asset.previewUrl && (
                                                                <ActionDropdownItem
                                                                    icon={<Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                                                                    onClick={() => {
                                                                        handleDownload(asset);
                                                                        setOpenActionDropdownAssetId(null);
                                                                    }}
                                                                >
                                                                    Download
                                                                </ActionDropdownItem>
                                                            )}

                                                            {/* View in Chat option */}
                                                            {hasSingleUsage && primaryUsage ? (
                                                                <ActionDropdownItem
                                                                    icon={<MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                                                    onClick={() => {
                                                                        handleJumpToChat(primaryUsage.sessionId);
                                                                        setOpenActionDropdownAssetId(null);
                                                                    }}
                                                                >
                                                                    <span className="truncate">View in Chat ({primaryUsage.sessionTitle})</span>
                                                                </ActionDropdownItem>
                                                            ) : hasMultipleUsages ? (
                                                                <>
                                                                    <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--text-muted)] uppercase border-t border-[var(--border-color)]/50 mt-1">
                                                                        Referenced Chats ({usages.length})
                                                                    </div>
                                                                    {usages.map((u, uIdx) => (
                                                                        <ActionDropdownItem
                                                                            key={`${u.sessionId}_${uIdx}`}
                                                                            icon={<MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                                                                            onClick={() => {
                                                                                handleJumpToChat(u.sessionId);
                                                                                setOpenActionDropdownAssetId(null);
                                                                            }}
                                                                        >
                                                                            <span className="truncate">{u.sessionTitle}</span>
                                                                        </ActionDropdownItem>
                                                                    ))}
                                                                </>
                                                            ) : null}

                                                            <div className="border-t border-[var(--border-color)]/50 my-1" />

                                                            <ActionDropdownItem
                                                                danger
                                                                icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                                                                onClick={() => {
                                                                    setAssetToDelete(asset);
                                                                    setOpenActionDropdownAssetId(null);
                                                                }}
                                                            >
                                                                Delete
                                                            </ActionDropdownItem>
                                                        </ActionDropdown>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Workspace Split Pane (Only visible when user explicitly opens it) */}
            {splitPaneWidth < 100 && (
                <>
                    <ResizableDivider
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        centerAction={{
                            icon: <ArrowLeftRight className="w-3.5 h-3.5" />,
                            tooltip: splitReversed ? "Swap Layout (Library on Left)" : "Swap Layout (Library on Right)",
                            onClick: () => toggleSplitReversed()
                        }}
                    />

                    <div
                        style={{ width: `${100 - splitPaneWidth}%` }}
                        className="h-full flex flex-col bg-[var(--bg-secondary)] overflow-hidden z-10"
                    >
                        <WorkspaceEditorPane />
                    </div>
                </>
            )}

            {/* Reusable ConfirmationModal for Deletion */}
            <ConfirmationModal
                open={Boolean(assetToDelete)}
                title="Delete from Library"
                message={`Are you sure you want to remove "${assetToDelete?.name}"? It will be removed from ${assetToDelete && assetToDelete.usages.length > 1
                    ? `all ${assetToDelete.usages.length} conversations where it was attached`
                    : 'the chat message history'
                    }.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive={true}
                onConfirm={confirmDelete}
                onCancel={() => setAssetToDelete(null)}
            />
        </div>
    );
};

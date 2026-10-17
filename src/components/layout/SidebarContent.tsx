import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { useThemeStore } from '../../store/ui/useThemeStore';
import { useChatStore } from '../../store/chat/useChatStore';
import { isTauri } from '../../core/tauri-api';
import { Tooltip } from '../ui/tooltip';
import {
    Plus,
    MoreVertical,
    Pin,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    Heart,
    BellOff,
    X,
    Archive,
    Trash2,
    MessageSquarePlus,
    FolderPlus,
    NotebookPen,
    MessageCircleWarning,
    Code2,
    FolderGit2,
    LayoutDashboard,
    Wrench,
    Boxes,
    Settings
} from 'lucide-react';
import { useProjectStore } from '../../store/workspace/useProjectStore';
import { pushViewRoute } from '../../core/router';
import { ApiSidebar } from '../../features/api/components/ApiSidebar';
import { Tag } from '../ui/Tag';
import { ChatRibbon } from '../ui/ChatRibbon';
import { ChatContextMenu } from '../ui/context-menu/ChatContextMenu';
import { LabelModal } from '../ui/LabelModal';
import { EditChatModal } from '../ui/EditChatModal';
import { Search as AnimatedSearch } from '../animate-ui/icons/search';

interface SidebarContentProps {
    onOpenLauncher: (e?: React.MouseEvent) => void;
}

interface MockChat {
    id: string;
    name: string;
    avatar: string;
    time: string;
    message: string;
    tags: string[];
    unread: number;
    pinned: boolean;
    pinnedAt?: number;
    favourite: boolean;
    status: string;
    sent: boolean;
    muted: boolean;
    updatedAt?: number;

    blocked?: boolean;
    isNew?: boolean;
    isUnknown?: boolean;
    archived?: boolean;
}

const getChatDate = (timeStr: string): Date => {
    const baseDate = new Date(2026, 5, 12); // June 12, 2026 is Today

    if (timeStr.includes('PM') || timeStr.includes('AM')) {
        return baseDate;
    }
    if (timeStr.toLowerCase() === 'yesterday') {
        const yesterday = new Date(baseDate);
        yesterday.setDate(baseDate.getDate() - 1);
        return yesterday;
    }
    // Check format DD/MM/YYYY
    const parts = timeStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month - 1, day);
    }
    return baseDate;
};



export function SidebarContent({ onOpenLauncher }: SidebarContentProps) {
    const { activeView, sidebarPosition, toggleSidebar, sidebarCollapsed, setSidebarCollapsed, sidebarPeeked, setSidebarPeeked, setActiveChatData } = useLayoutStore();
    const { theme } = useThemeStore();
    const [inTauri, setInTauri] = useState(false);
    const [isLogoHovered, setIsLogoHovered] = useState(false);

    useEffect(() => {
        setInTauri(isTauri());
    }, []);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [addMenuCoords, setAddMenuCoords] = useState({ x: 0, y: 0 });
    const plusBtnRef = useRef<HTMLButtonElement>(null);

    // 🚀 Collapsed Sidebar Floating Flyout State (declared below modal states for closure safety)

    // 💬 Dynamic interactive chats state matching screenshot visual layouts
    const { sessions, activeSessionId, switchSession, updateSession, deleteSession } = useChatStore();
    
    const chats = useMemo(() => {
        return Object.values(sessions).filter(s => !s.isIncognito).map(session => {
            const lastMsg = session.messages && session.messages.length > 0 
                ? session.messages[session.messages.length - 1] 
                : null;
            const lastUserMsg = session.messages 
                ? [...session.messages].reverse().find(m => m.sender === 'user')
                : null;

            const msgDate = lastMsg?.date || (lastMsg as any)?.timestamp || session.createdAt || Date.now();
            
            // Format time string from timestamp
            let timeStr = '';
            if (msgDate) {
               const d = new Date(msgDate);
               if (!isNaN(d.getTime())) {
                   timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
               }
            }

            // Determine preview message and sent status so preview is never empty
            let previewMsg = 'New Chat...';
            let isSentByUser = false;

            if (lastMsg) {
                if (lastMsg.sender === 'user') {
                    previewMsg = lastMsg.text?.trim() || 'New Chat...';
                    isSentByUser = true;
                } else {
                    // Assistant message
                    if (lastMsg.text?.trim()) {
                        previewMsg = lastMsg.text.trim();
                        isSentByUser = false;
                    } else if (lastMsg.thinking || !lastMsg.telemetry) {
                        // Assistant is actively thinking or generating response
                        previewMsg = lastUserMsg?.text?.trim() || 'Thinking...';
                        isSentByUser = Boolean(lastUserMsg);
                    } else {
                        previewMsg = lastUserMsg?.text?.trim() || 'New Chat...';
                        isSentByUser = Boolean(lastUserMsg);
                    }
                }
            } else if (session.lastMessagePreview) {
                previewMsg = session.lastMessagePreview;
            }

            return {
                id: session.id,
                name: session.title,
                avatar: session.avatar || '🤖',
                time: timeStr,
                message: previewMsg,
                tags: session.tags || [],
                unread: session.unread || 0,
                pinned: session.pinned || false,
                pinnedAt: session.pinnedAt,
                favourite: session.favourite || false,
                status: 'online',
                sent: isSentByUser,
                muted: session.muted || false,
                archived: session.archived || false,
                updatedAt: session.updatedAt || msgDate || 0
            } as MockChat;
        });
    }, [sessions]);

    // Update setters to write back to store
    const setChats = (updater: (prev: MockChat[]) => MockChat[]) => {
        // Find changes and dispatch to store
        const prevChats = Object.values(sessions).map(session => ({
            id: session.id,
            name: session.title,
            avatar: session.avatar,
            tags: session.tags || [],
            unread: session.unread || 0,
            pinned: session.pinned || false,
            pinnedAt: session.pinnedAt,
            favourite: session.favourite || false,
            muted: session.muted || false,
            archived: session.archived || false
        } as MockChat));

        const nextChats = updater(prevChats);
        
        // Sync any mutations back to Zustand
        nextChats.forEach(nextChat => {
            const prevChat = prevChats.find(p => p.id === nextChat.id);
            if (prevChat && JSON.stringify(prevChat) !== JSON.stringify(nextChat)) {
                updateSession(nextChat.id, (s) => ({
                    ...s,
                    title: nextChat.name,
                    avatar: nextChat.avatar,
                    tags: nextChat.tags,
                    unread: nextChat.unread,
                    pinned: nextChat.pinned,
                    pinnedAt: nextChat.pinnedAt,
                    favourite: nextChat.favourite,
                    muted: nextChat.muted,
                    archived: nextChat.archived || false
                }));
            } else if (!prevChat) {
                // If a chat was somehow created (unlikely here)
            }
        });

        // Handle deleted chats
        prevChats.forEach(prevChat => {
            if (!nextChats.find(n => n.id === prevChat.id)) {
                deleteSession(prevChat.id);
            }
        });
    };

    // 🎀 Persistent Ribbon Pool State (Zero hardcoded values, backed by localStorage & synced with sessions)
    const [poolRibbons, setPoolRibbons] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('cluaiz_user_ribbons');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch {
            // ignore localStorage error
        }
        return [];
    });

    useEffect(() => {
        try {
            localStorage.setItem('cluaiz_user_ribbons', JSON.stringify(poolRibbons));
        } catch {
            // ignore localStorage error
        }
    }, [poolRibbons]);

    // Sync any custom tags found in active sessions into the pool
    useEffect(() => {
        const sessionTags = Object.values(sessions).flatMap(s => s.tags || []);
        if (sessionTags.length > 0) {
            setPoolRibbons(prev => {
                const combined = Array.from(new Set([...prev, ...sessionTags]));
                return combined.length !== prev.length ? combined : prev;
            });
        }
    }, [sessions]);

    // Filter tabs: standard categories + dynamic user tags
    const filterTabs = useMemo(() => {
        const baseTabs = ['All', 'Old', 'Archive'];
        const userTags = poolRibbons
            .map(t => t.split(':')[0])
            .filter(t => Boolean(t) && !baseTabs.some(b => b.toLowerCase() === t.toLowerCase()));
        return [...baseTabs, ...Array.from(new Set(userTags))];
    }, [poolRibbons]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        chatId: string;
    } | null>(null);

    // Label Modal State
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelTargetId, setLabelTargetId] = useState<string | null>(null);

    // Edit Modal State
    const [editModalData, setEditModalData] = useState<{
        isOpen: boolean;
        chatId: string;
        initialName: string;
        initialEmoji: string;
    } | null>(null);

    // 🚀 Collapsed Sidebar Floating Flyout State
    const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
    const flyoutCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flyoutRef = useRef<HTMLDivElement>(null);

    const handleFlyoutOpen = () => {
        if (flyoutCloseTimerRef.current) {
            clearTimeout(flyoutCloseTimerRef.current);
            flyoutCloseTimerRef.current = null;
        }
        setIsFlyoutOpen(true);
    };

    const handleFlyoutLeave = () => {
        // Guard: Do not auto-close flyout if user is interacting with context menu or modals
        if (contextMenu !== null || isLabelModalOpen || editModalData?.isOpen) {
            return;
        }
        if (flyoutCloseTimerRef.current) clearTimeout(flyoutCloseTimerRef.current);
        flyoutCloseTimerRef.current = setTimeout(() => {
            setIsFlyoutOpen(false);
        }, 220);
    };

    useEffect(() => {
        if (!isFlyoutOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            // Guard: Do not close flyout if clicking inside context menu or child modals
            if (contextMenu !== null || isLabelModalOpen || editModalData?.isOpen) {
                return;
            }
            if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
                setIsFlyoutOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (contextMenu) {
                    setContextMenu(null);
                } else if (isLabelModalOpen) {
                    setIsLabelModalOpen(false);
                } else if (editModalData?.isOpen) {
                    setEditModalData(null);
                } else {
                    setIsFlyoutOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFlyoutOpen, contextMenu, isLabelModalOpen, editModalData]);

    // ✅ Select Mode State
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const enterSelectMode = (initialChatId?: string) => {
        setSelectMode(true);
        setSelectedIds(initialChatId ? new Set([initialChatId]) : new Set());
        setContextMenu(null);
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    const toggleSelectChat = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(filteredChats.map(c => c.id)));

    const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            chatId
        });
    };

    // Toggle Pin/Unpin — sets pinnedAt timestamp so most recently pinned always sorts to top
    const togglePinChat = (chatId: string) => {
        updateSession(chatId, c => ({
            ...c,
            pinned: !c.pinned,
            pinnedAt: !c.pinned ? Date.now() : undefined
        }));
    };

    // Toggle Favourite
    const toggleFavouriteChat = (chatId: string) => {
        updateSession(chatId, c => ({ ...c, favourite: !c.favourite }));
    };

    // Toggle Mute Notifications
    const toggleMuteChat = (chatId: string) => {
        updateSession(chatId, c => ({ ...c, muted: !c.muted }));
    };

    // Delete label globally from the pool
    const handleDeleteLabel = (tagToDelete: string) => {
        const [tagName] = tagToDelete.split(':');
        setPoolRibbons(prev => prev.filter(t => t !== tagToDelete));
        // Remove label from all chats that contain it
        Object.keys(sessions).forEach(sid => {
            const s = sessions[sid];
            if (s.tags && s.tags.some(t => t.split(':')[0].toLowerCase() === tagName.toLowerCase())) {
                updateSession(sid, c => ({
                    ...c,
                    tags: (c.tags || []).filter(t => t.split(':')[0].toLowerCase() !== tagName.toLowerCase())
                }));
            }
        });
    };

    // Apply label to a chat
    const handleApplyLabel = (tagName: string, color: string) => {
        if (!labelTargetId) return;
        const tagValue = `${tagName}:${color}`;

        updateSession(labelTargetId, c => {
            const currentTags = c.tags || [];
            // Toggle off if clicking the same tag
            if (currentTags.includes(tagValue)) {
                return { ...c, tags: [] };
            }
            // Replace with new tag (Single ribbon policy)
            return { ...c, tags: [tagValue] };
        });

        // Also ensure it is in the pool
        const existsInPool = poolRibbons.some(t => {
            const [poolName] = t.split(':');
            return poolName.toLowerCase() === tagName.toLowerCase();
        });

        if (!existsInPool) {
            setPoolRibbons(prev => [...prev, tagValue]);
        }

        setIsLabelModalOpen(false);
        setLabelTargetId(null);
    };

    // Create label in Ribbon Pool
    const handleCreateLabel = (tagName: string, color: string) => {
        const tagValue = `${tagName}:${color}`;
        setPoolRibbons(prev => {
            if (prev.includes(tagValue)) return prev;
            return [...prev, tagValue];
        });
    };

    // Filtered Chats
    const filteredChats = chats.filter(chat => {
        // Search matches Name or Message content
        const searchMatches = chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.message.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchMatches) return false;

        const chatTime = chat.updatedAt || (chat.time ? getChatDate(chat.time).getTime() : 0);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Filter tabs matching
        const filterNorm = activeFilter.toLowerCase();
        if (filterNorm === 'all') {
            // Default view: exclude archived chats
            if (chat.archived) return false;
        } else if (filterNorm === 'favourites') {
            if (!chat.favourite || chat.archived) return false;
        } else if (filterNorm === 'old') {
            // Chats created/updated prior to today
            if (chatTime >= todayStart.getTime() || chat.archived) return false;
        } else if (filterNorm === 'archive') {
            if (!chat.archived && !chat.tags.some(t => t.toUpperCase().includes('ARCHIVE'))) return false;
        } else {
            // Custom user ribbon tag match
            const hasTag = chat.tags.some(t => t.split(':')[0].toLowerCase() === filterNorm);
            if (!hasTag) return false;
        }

        return true;
        // Sort: pinned chats float to top, most recently pinned first; then newest updated chats on top
    }).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0);
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });

    const targetChatForModal = chats.find(c => c.id === labelTargetId);

    // Date grouping for clean ChatGPT/Claude style layout
    const groupedChats = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
        const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

        const groups: { title: string; chats: MockChat[] }[] = [
            { title: 'Today', chats: [] },
            { title: 'Yesterday', chats: [] },
            { title: 'Previous 7 Days', chats: [] },
            { title: 'Older', chats: [] }
        ];

        filteredChats.forEach(chat => {
            const time = chat.updatedAt || (chat.time ? getChatDate(chat.time).getTime() : 0);
            if (time >= startOfToday) {
                groups[0].chats.push(chat);
            } else if (time >= startOfYesterday) {
                groups[1].chats.push(chat);
            } else if (time >= startOf7Days) {
                groups[2].chats.push(chat);
            } else {
                groups[3].chats.push(chat);
            }
        });

        return groups.filter(g => g.chats.length > 0);
    }, [filteredChats]);

    // Reusable Chat Directory (Clean Search + Horizontal Filter Tabs + Chat List)
    const renderChatDirectory = (inFlyout: boolean = false) => (
        <>
            {/* Search Bar */}
            <div className={inFlyout ? "px-3 py-2" : "px-4 py-2"}>
                <div
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] themed-border rounded-lg focus-within:border-[var(--accent-color)] transition-all duration-200 relative"
                    style={{ borderStyle: 'var(--border-style)' }}
                >
                    <AnimatedSearch className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" size={16} />
                    <input
                        type="text"
                        placeholder={activeFilter !== 'All' ? `Filtered by ${activeFilter}...` : "Search chats..."}
                        className="bg-transparent border-0 outline-none w-full text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus={inFlyout}
                    />

                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
                            title="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Horizontal Filter Tabs: All, Favourites, Old, Archive + User custom labels */}
            <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-1 ${inFlyout ? 'px-3' : 'px-4'}`}>
                {filterTabs.map((tab) => {
                    const isActive = activeFilter.toLowerCase() === tab.toLowerCase();
                    return (
                        <button
                            key={tab}
                            onClick={() => {
                                // Clicking active tab toggles it off -> resets to 'All'
                                if (isActive) {
                                    setActiveFilter('All');
                                } else {
                                    setActiveFilter(tab);
                                }
                            }}
                            className={`px-3 py-1 text-[11px] rounded-full shrink-0 transition-all cursor-pointer whitespace-nowrap ${isActive
                                ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] font-semibold shadow-sm'
                                : 'bg-[var(--bg-tertiary)]/70 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
                                }`}
                        >
                            {tab}
                        </button>
                    );
                })}
            </div>


            {/* Chat list viewport */}
            <div className={`flex-1 overflow-y-auto py-1 space-y-3 custom-scrollbar ${inFlyout ? 'px-1' : 'px-2'}`}>
                {groupedChats.map((group) => (
                    <div key={group.title} className="space-y-0.5">
                        {/* Section Header */}
                        <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-[var(--text-muted)] tracking-wide select-none">
                            {group.title}
                        </div>

                        {/* Chats in this group */}
                        {group.chats.map((chat) => {
                            const isSelected = selectMode ? selectedIds.has(chat.id) : (activeSessionId === chat.id);
                            return (
                                <div
                                    key={chat.id}
                                    onContextMenu={(e) => !selectMode && handleContextMenu(e, chat.id)}
                                    onClick={() => {
                                        if (selectMode) {
                                            toggleSelectChat(chat.id);
                                        } else {
                                            switchSession(chat.id);
                                            setActiveChatData({
                                                id: chat.id,
                                                name: chat.name,
                                                avatar: chat.avatar,
                                                status: chat.status,
                                                totalMessages: chat.message ? 1 : 0
                                            });
                                            if (inFlyout) {
                                                setIsFlyoutOpen(false);
                                            }
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer group relative overflow-hidden select-none ${isSelected
                                        ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-semibold border border-[var(--accent-color)]/25'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/70 border border-transparent'
                                        } ${chat.archived ? 'opacity-[0.6]' : ''}`}
                                >
                                    {/* Ribbon Tag overlay sticker */}
                                    {chat.tags && chat.tags.length > 0 && (
                                        <ChatRibbon tags={chat.tags} />
                                    )}

                                    {/* Checkbox in select mode */}
                                    {selectMode && (
                                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0 ${selectedIds.has(chat.id)
                                            ? 'bg-[var(--accent-color)] border-[var(--accent-color)] shadow-sm'
                                            : 'border-[var(--text-muted)]/35 hover:border-[var(--text-secondary)] bg-[var(--bg-tertiary)]/80'
                                            }`}>
                                            {selectedIds.has(chat.id) && (
                                                <CheckCheck className="w-3 h-3 text-[var(--accent-contrast)]" />
                                            )}
                                        </div>
                                    )}

                                    {/* Chat Title only */}
                                    <span className="text-xs truncate flex-1 leading-relaxed">
                                        {chat.name}
                                    </span>

                                    {/* Right side indicators & three-dots menu */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {chat.pinned && (
                                            <Pin className="w-2.5 h-2.5 text-[var(--accent-color)] fill-[var(--accent-color)] rotate-45 shrink-0" />
                                        )}
                                        {!selectMode && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setContextMenu({
                                                        x: rect.left,
                                                        y: rect.bottom + 4,
                                                        chatId: chat.id
                                                    });
                                                }}
                                                className={`p-1 rounded hover:bg-[var(--bg-primary)]/80 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity duration-150 cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                    }`}
                                                title="More options"
                                            >
                                                <MoreVertical className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {filteredChats.length === 0 && (
                    <div className={`py-8 flex flex-col items-center justify-center text-[var(--text-muted)] ${inFlyout ? 'px-2' : 'px-4'}`}>
                        <MessageCircleWarning className="w-8 h-8 opacity-20 mb-3" />
                        <span className="text-center text-[11px] font-medium uppercase tracking-wider opacity-60">
                            No active chats found
                        </span>
                    </div>
                )}
            </div>

            {/* Select Mode Bottom Action Bar */}
            {selectMode && (
                <div className="flex-shrink-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)] shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-black text-[var(--text-primary)]">
                            {selectedIds.size} Selected
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={selectAll}
                                className="text-[10px] font-black text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                SELECT ALL
                            </button>
                            <button
                                onClick={exitSelectMode}
                                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                        <button
                            onClick={() => {
                                setChats(prev => prev.map(c =>
                                    selectedIds.has(c.id) ? { ...c, archived: !c.archived } : c
                                ));
                                exitSelectMode();
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                        >
                            <Archive className="w-3.5 h-3.5" />
                            ARCHIVE
                        </button>
                        <button
                            onClick={() => {
                                setChats(prev => prev.filter(c => !selectedIds.has(c.id)));
                                exitSelectMode();
                            }}
                            className="flex items-center justify-center gap-2 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            DELETE
                        </button>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            <div
                className="flex flex-col h-full bg-[var(--bg-secondary)] overflow-hidden font-[family-name:var(--font-family)] select-none relative"
                style={{ fontFamily: 'var(--font-family)' }}
            >

                {/* Web-only Header: Logo, Name, Toggle, More Menu */}
                {!inTauri && (
                    <div
                        onMouseEnter={() => setIsLogoHovered(true)}
                        onMouseLeave={() => setIsLogoHovered(false)}
                        className={`p-4 flex items-center border-b border-[var(--border-color)] ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                        style={{ borderStyle: 'var(--border-style)' }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 flex items-center justify-center select-none flex-shrink-0">
                                <Tooltip disabled={!sidebarCollapsed} title="Expand Sidebar" position="right">
                                    {sidebarCollapsed && isLogoHovered ? (
                                        <button
                                            onClick={() => setSidebarCollapsed(false)}
                                            className="w-10 h-10 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-200 cursor-pointer flex items-center justify-center animate-scale-in"
                                        >
                                            {sidebarPosition === 'left' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                                        </button>
                                    ) : (
                                        <img src="/logo.ico" alt="cluaiz Logo" className={`w-10 h-10 object-contain drop-shadow-sm transition-all duration-300 ${theme === 'light' ? 'brightness-0' : 'invert dark:invert-0'}`} />
                                    )}
                                </Tooltip>
                            </div>
                            {!sidebarCollapsed && <span className="font-extrabold text-lg tracking-widest text-[var(--text-primary)]">Cluaiz</span>}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-1">
                                <Tooltip title="Menu" position="bottom">
                                    <button
                                        onClick={(e) => onOpenLauncher(e)}
                                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip title="Close Sidebar" position="bottom">
                                    <button
                                        onClick={() => {
                                            if (sidebarPeeked) {
                                                setSidebarPeeked(false);
                                            } else {
                                                setSidebarCollapsed(true);
                                            }
                                        }}
                                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                    >
                                        {sidebarPosition === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                )}

                {/* Chats Sub-Header: Title + Actions */}
                {sidebarCollapsed ? (
                    <div className="flex-1 flex flex-col justify-between items-center py-2 w-full min-h-0 select-none">
                        {/* Top Action Icons */}
                        <div className="flex flex-col items-center gap-2 w-full">
                            {/* 1. New Chat Button */}
                            <Tooltip title="New Chat" position="right">
                                <button 
                                    onClick={() => {
                                        useLayoutStore.getState().setActiveView('chat');
                                        document.dispatchEvent(new CustomEvent('start-new-chat'));
                                        setIsFlyoutOpen(false);
                                    }}
                                    className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors active:scale-95 cursor-pointer"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            {/* 2. Search & Chats Flyout Trigger Button */}
                            <div
                                onMouseEnter={handleFlyoutOpen}
                                onMouseLeave={handleFlyoutLeave}
                                className="relative flex items-center justify-center"
                            >
                                <Tooltip title={isFlyoutOpen ? "" : (activeView === 'apis' ? "Search Endpoints" : "Search & Chats")} position="right">
                                    <button
                                        onClick={() => setIsFlyoutOpen(prev => !prev)}
                                        className={`p-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
                                            isFlyoutOpen
                                                ? 'bg-[var(--accent-color)] text-[var(--accent-contrast)] shadow-md'
                                                : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        <AnimatedSearch className="w-5 h-5" size={20} />
                                    </button>
                                </Tooltip>
                            </div>

                            {/* Divider */}
                            <div className="w-6 h-[1px] bg-[var(--border-color)] my-0.5 opacity-60" />

                            {/* 3. Open Workspace */}
                            <Tooltip title="Open Workspace" position="right">
                                <button
                                    onClick={() => {
                                        useLayoutStore.getState().setActiveView('chat');
                                        useProjectStore.getState().openWorkspace();
                                        useLayoutStore.getState().setSplitPaneWidth(50);
                                        setIsFlyoutOpen(false);
                                    }}
                                    className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors active:scale-95 cursor-pointer"
                                >
                                    <FolderGit2 className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            {/* 4. Dashboard */}
                            <Tooltip title="Dashboard" position="right">
                                <button
                                    onClick={() => {
                                        useLayoutStore.getState().setActiveView('dashboard');
                                        document.dispatchEvent(new CustomEvent('open-dashboard'));
                                        setIsFlyoutOpen(false);
                                    }}
                                    className={`p-2 rounded-xl transition-colors active:scale-95 cursor-pointer ${
                                        activeView === 'dashboard'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                                            : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <LayoutDashboard className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            {/* 5. Tools */}
                            <Tooltip title="Tools" position="right">
                                <button
                                    onClick={() => {
                                        useLayoutStore.getState().setActiveView('tools');
                                        pushViewRoute('tools');
                                        document.dispatchEvent(new CustomEvent('open-tools'));
                                        setIsFlyoutOpen(false);
                                    }}
                                    className={`p-2 rounded-xl transition-colors active:scale-95 cursor-pointer ${
                                        activeView === 'tools'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                                            : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <Wrench className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            {/* 6. APIs */}
                            <Tooltip title="APIs" position="right">
                                <button
                                    onClick={() => {
                                        useLayoutStore.getState().setActiveView('apis');
                                        document.dispatchEvent(new CustomEvent('open-apis'));
                                        setIsFlyoutOpen(false);
                                    }}
                                    className={`p-2 rounded-xl transition-colors active:scale-95 cursor-pointer ${
                                        activeView === 'apis'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                                            : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <Code2 className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            {/* 7. Toolkit */}
                            <Tooltip title="Toolkit" position="right">
                                <button
                                    onClick={() => {
                                        useLayoutStore.getState().setActiveView('toolkit');
                                        document.dispatchEvent(new CustomEvent('open-toolkit'));
                                        setIsFlyoutOpen(false);
                                    }}
                                    className={`p-2 rounded-xl transition-colors active:scale-95 cursor-pointer ${
                                        activeView === 'toolkit'
                                            ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                                            : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <Boxes className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>

                        {/* Bottom Pinned Icon: Settings */}
                        <div className="flex flex-col items-center gap-2 w-full pb-1">
                            <div className="w-6 h-[1px] bg-[var(--border-color)] my-0.5 opacity-60" />
                            <Tooltip title="Settings" position="right">
                                <button
                                    onClick={() => {
                                        document.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'general' } }));
                                        setIsFlyoutOpen(false);
                                    }}
                                    className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors active:scale-95 cursor-pointer"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                ) : (
                    <div className={`px-4 ${inTauri ? 'py-3 border-b border-[var(--border-color)]' : 'py-2 pb-1'} flex items-center justify-between`} style={{ borderStyle: 'var(--border-style)' }}>
                        <h2 className="text-xl font-extrabold tracking-wide text-[var(--text-primary)]">
                            {activeView === 'apis' ? 'APIs' : 'Chats'}
                        </h2>
                        <div className="flex items-center gap-1">
                            {activeView !== 'apis' && (
                                <Tooltip title="New Chat" position="bottom">
                                    <button
                                        ref={plusBtnRef}
                                        onClick={() => {
                                            document.dispatchEvent(new CustomEvent('start-new-chat'));
                                        }}
                                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors active:scale-95 cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                            )}
                            {inTauri && (
                                <>
                                    <Tooltip title="Menu" position="bottom">
                                        <button
                                            onClick={(e) => onOpenLauncher(e)}
                                            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="Close Sidebar" position="bottom">
                                        <button
                                            onClick={() => {
                                                if (sidebarPeeked) {
                                                    setSidebarPeeked(false);
                                                } else {
                                                    setSidebarCollapsed(true);
                                                }
                                            }}
                                            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                        >
                                            {sidebarPosition === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </button>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Search & List Body (Chats or APIs) */}
                {!sidebarCollapsed && (
                    activeView === 'apis' ? (
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                            <ApiSidebar />
                        </div>
                    ) : (
                        renderChatDirectory(false)
                    )
                )}

            </div>

            {/* 🖱️ Context menu + 🏷️ LabelModal — portaled to body to escape overflow:hidden */}
            {typeof document !== 'undefined' && createPortal(
                <>
                    <ChatContextMenu
                        x={contextMenu?.x || 0}
                        y={contextMenu?.y || 0}
                        isOpen={!!contextMenu}
                        isPinned={chats.find(c => c.id === contextMenu?.chatId)?.pinned || false}
                        isFavourite={chats.find(c => c.id === contextMenu?.chatId)?.favourite || false}
                        isMuted={chats.find(c => c.id === contextMenu?.chatId)?.muted || false}
                        status={chats.find(c => c.id === contextMenu?.chatId)?.archived ? 'archived' : 'active'}
                        onClose={() => setContextMenu(null)}
                        onEdit={() => {
                            if (contextMenu?.chatId) {
                                const chat = chats.find(c => c.id === contextMenu.chatId);
                                if (chat) {
                                    setEditModalData({
                                        isOpen: true,
                                        chatId: chat.id,
                                        initialName: chat.name,
                                        initialEmoji: chat.avatar
                                    });
                                }
                            }
                        }}
                        onPin={() => {
                            if (contextMenu?.chatId) togglePinChat(contextMenu.chatId);
                        }}
                        onSelectMessages={() => {
                            if (contextMenu?.chatId) enterSelectMode(contextMenu.chatId);
                        }}
                        onAddLabel={() => {
                            if (contextMenu?.chatId) {
                                setLabelTargetId(contextMenu.chatId);
                                setIsLabelModalOpen(true);
                            }
                        }}
                        onToggleFavourite={() => {
                            if (contextMenu?.chatId) toggleFavouriteChat(contextMenu.chatId);
                        }}
                        onArchive={() => {
                            if (contextMenu?.chatId) {
                                const cid = contextMenu.chatId;
                                updateSession(cid, c => ({ ...c, archived: !c.archived }));
                            }
                        }}
                        onToggleMute={() => {
                            if (contextMenu?.chatId) toggleMuteChat(contextMenu.chatId);
                        }}
                        chatId={contextMenu?.chatId || ''}

                    />

                    <LabelModal
                        isOpen={isLabelModalOpen}
                        onClose={() => {
                            setIsLabelModalOpen(false);
                            setLabelTargetId(null);
                        }}
                        existingTags={poolRibbons}
                        activeTags={targetChatForModal?.tags || []}
                        onApply={handleApplyLabel}
                        onCreate={handleCreateLabel}
                        onDelete={handleDeleteLabel}
                    />

                    <EditChatModal
                        isOpen={editModalData?.isOpen || false}
                        chatId={editModalData?.chatId || null}
                        initialName={editModalData?.initialName || ''}
                        initialEmoji={editModalData?.initialEmoji || ''}
                        onClose={() => setEditModalData(null)}
                        onSave={(id, name, emoji) => {
                            updateSession(id, c => ({ ...c, title: name, avatar: emoji }));
                        }}
                    />

                    {/* Floating Flyout Drawer for Collapsed Sidebar */}
                    {sidebarCollapsed && isFlyoutOpen && (
                        <div
                            ref={flyoutRef}
                            onMouseEnter={handleFlyoutOpen}
                            onMouseLeave={handleFlyoutLeave}
                            className="fixed top-3 bottom-3 w-80 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.5)] z-[9999] flex flex-col overflow-hidden backdrop-blur-2xl animate-fade-in"
                            style={{
                                left: sidebarPosition === 'left' ? '72px' : 'auto',
                                right: sidebarPosition === 'right' ? '72px' : 'auto',
                                borderStyle: 'var(--border-style)'
                            }}
                        >
                            {/* Header */}
                            <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-[var(--border-color)]" style={{ borderStyle: 'var(--border-style)' }}>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-extrabold tracking-wide text-[var(--text-primary)]">
                                        {activeView === 'apis' ? 'APIs' : 'Chats'}
                                    </h3>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]">
                                        {activeView === 'apis' ? '' : filteredChats.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {activeView !== 'apis' && (
                                        <Tooltip title="New Chat" position="bottom">
                                            <button
                                                onClick={() => {
                                                    document.dispatchEvent(new CustomEvent('start-new-chat'));
                                                    setIsFlyoutOpen(false);
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </Tooltip>
                                    )}
                                    <Tooltip title="Close" position="bottom">
                                        <button
                                            onClick={() => setIsFlyoutOpen(false)}
                                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Content Body Reused! (100% DRY) */}
                            {activeView === 'apis' ? (
                                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                    <ApiSidebar />
                                </div>
                            ) : (
                                renderChatDirectory(true)
                            )}
                        </div>
                    )}

                </>,
                document.body
            )}
        </>
    );
}


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
    MessageCircleWarning
} from 'lucide-react';
import { Tag } from '../ui/Tag';
import { ChatRibbon } from '../ui/ChatRibbon';
import { ChatContextMenu } from '../ui/context-menu/ChatContextMenu';
import { LabelModal } from '../ui/LabelModal';
import { EditChatModal } from '../ui/EditChatModal';
import { FilterDropdown } from '../ui/dropdown/FilterDropdown';
import { CalendarDropdown } from '../ui/dropdown/CalendarDropdown';
import { Calendar as AnimatedCalendar } from '../animate-ui/icons/calendar';
import { Search as AnimatedSearch } from '../animate-ui/icons/search';
import { SlidersHorizontal as AnimatedSliders } from '../animate-ui/icons/sliders-horizontal';

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
    const { sidebarPosition, toggleSidebar, sidebarCollapsed, setSidebarCollapsed, sidebarPeeked, setSidebarPeeked, setActiveChatData } = useLayoutStore();
    const { theme } = useThemeStore();
    const [inTauri, setInTauri] = useState(false);
    const [isLogoHovered, setIsLogoHovered] = useState(false);

    useEffect(() => {
        setInTauri(isTauri());
    }, []);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterBtnRef = useRef<HTMLButtonElement>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [addMenuCoords, setAddMenuCoords] = useState({ x: 0, y: 0 });
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const { dateRange, setDateRange } = useLayoutStore();
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const calendarBtnRef = useRef<HTMLButtonElement>(null);

    // 💬 Dynamic interactive chats state matching screenshot visual layouts
    const { sessions, activeSessionId, switchSession, updateSession, deleteSession } = useChatStore();
    
    const chats = useMemo(() => {
        return Object.values(sessions).map(session => {
            const lastMsg = session.messages[session.messages.length - 1];
            const msgDate = lastMsg?.date || (lastMsg as any)?.timestamp || session.createdAt || Date.now();
            
            // Format time string from timestamp
            let timeStr = '';
            if (msgDate) {
               const d = new Date(msgDate);
               if (!isNaN(d.getTime())) {
                   timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
               }
            }

            return {
                id: session.id,
                name: session.title,
                avatar: session.avatar || '🤖',
                time: timeStr,
                message: lastMsg ? lastMsg.text : 'New Chat...',
                tags: session.tags || [],
                unread: session.unread || 0,
                pinned: session.pinned || false,
                pinnedAt: session.pinnedAt,
                favourite: session.favourite || false,
                status: 'online',
                sent: lastMsg?.sender === 'user',
                muted: session.muted || false,
                archived: session.archived || false
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

    // 🎀 Persistent Ribbon Pool State
    const [poolRibbons, setPoolRibbons] = useState<string[]>([
        'VIP:success',
        'AI ASSISTANT:success',
        'URGENT:urgent',
        'WARNING:warning',
        'SUCCESS:success',
        'INFO:info',
        'PRIORITY:priority',
        'PENDING:pending'
    ]);

    // Reusable category filters dynamically listing only the tags
    const categories = useMemo(() => {
        return ['All', ...poolRibbons.map(t => t.split(':')[0])];
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
        setChats(prev => prev.map(c =>
            c.id === chatId
                ? { ...c, pinned: !c.pinned, pinnedAt: !c.pinned ? Date.now() : undefined }
                : c
        ));
    };

    // Toggle Favourite
    const toggleFavouriteChat = (chatId: string) => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, favourite: !c.favourite } : c));
    };

    // Toggle Mute Notifications
    const toggleMuteChat = (chatId: string) => {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, muted: !c.muted } : c));
    };

    // Delete label globally from the pool
    const handleDeleteLabel = (tagToDelete: string) => {
        const [tagName] = tagToDelete.split(':');
        setPoolRibbons(prev => prev.filter(t => t !== tagToDelete));
        // Remove label from all chats that contain it
        setChats(prev => prev.map(c => ({
            ...c,
            tags: c.tags.filter(t => {
                const [cTagName] = t.split(':');
                return cTagName.toLowerCase() !== tagName.toLowerCase();
            })
        })));
    };

    // Apply label to a chat
    const handleApplyLabel = (tagName: string, color: string) => {
        if (!labelTargetId) return;
        const tagValue = `${tagName}:${color}`;

        setChats(prev => prev.map(c => {
            if (c.id !== labelTargetId) return c;
            // Toggle off if clicking the same tag
            if (c.tags.includes(tagValue)) {
                return { ...c, tags: [] };
            }
            // Replace with new tag (Single ribbon policy)
            return { ...c, tags: [tagValue] };
        }));

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

    const bookedDates = useMemo(() => {
        const datesMap = new Map<string, Date>();
        chats.forEach(c => {
            const date = getChatDate(c.time);
            date.setHours(0, 0, 0, 0);
            datesMap.set(date.toDateString(), date);
        });
        return Array.from(datesMap.values());
    }, [chats]);

    // Filtered Chats
    const filteredChats = chats.filter(chat => {
        // Search matches Name or Message content
        const searchMatches = chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.message.toLowerCase().includes(searchQuery.toLowerCase());
        if (!searchMatches) return false;

        // Category matching dynamically matching the active tag
        if (activeCategory !== 'All') {
            const hasTag = chat.tags.some(t => t.split(':')[0].toLowerCase() === activeCategory.toLowerCase());
            if (!hasTag) return false;
        }

        // Advanced Filter matching
        if (activeFilter !== 'All') {
            if (activeFilter === 'Unread') {
                if (!(chat.unread > 0)) return false;
            } else if (activeFilter === 'Favourites') {
                if (!chat.favourite) return false;
            } else if (activeFilter === 'Archive') {
                if (!chat.archived && !chat.tags.some(t => t.toUpperCase().includes('ARCHIVE'))) return false;
            } else if (activeFilter === 'Groups') {
                return false;
            } else if (activeFilter === 'Assistants') {
                if (!chat.tags.some(t => t.toUpperCase().includes('ASSISTANT') || t.toUpperCase().includes('AI'))) return false;
            } else if (activeFilter === 'Blocked') {
                if (!chat.blocked) return false;
            } else if (activeFilter === 'New User') {
                if (!chat.isNew) return false;
            } else if (activeFilter === 'Old User') {
                if (chat.isNew) return false;
            } else if (activeFilter === 'Unknown User') {
                if (!chat.isUnknown) return false;
            }
        }

        // Date range matching
        if (dateRange && dateRange.from) {
            const chatDate = getChatDate(chat.time);
            chatDate.setHours(0, 0, 0, 0);
            const start = new Date(dateRange.from);
            start.setHours(0, 0, 0, 0);
            const end = dateRange.to ? new Date(dateRange.to) : start;
            end.setHours(23, 59, 59, 999);
            if (chatDate < start || chatDate > end) return false;
        }

        return true;
        // Sort: pinned chats float to top, most recently pinned first
    }).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0);
        return 0;
    });


    const targetChatForModal = chats.find(c => c.id === labelTargetId);

    return (
        <>
            <div className="flex flex-col h-full bg-[var(--bg-secondary)] overflow-hidden font-sans select-none relative">

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
                                        <img src="/logo.ico" alt="Cluaize Logo" className={`w-10 h-10 object-contain drop-shadow-sm transition-all duration-300 ${theme === 'light' ? 'brightness-0' : 'invert dark:invert-0'}`} />
                                    )}
                                </Tooltip>
                            </div>
                            {!sidebarCollapsed && <span className="font-extrabold text-lg tracking-widest text-[var(--text-primary)]">Cluaize</span>}
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
                    <div className={`pt-4 pb-2 flex flex-col items-center gap-3 relative ${inTauri ? 'border-b border-[var(--border-color)]' : ''}`} style={{ borderStyle: 'var(--border-style)' }}>

                        <Tooltip title="New Chat" position="right">
                            <button 
                                onClick={() => {
                                    document.dispatchEvent(new CustomEvent('start-new-chat'));
                                }}
                                className="p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors active:scale-95 cursor-pointer"
                            >
                                <Plus className="w-4.5 h-4.5" />
                            </button>
                        </Tooltip>

                        <Tooltip title="Search Chat" position="right">
                            <button
                                onClick={() => setSidebarCollapsed(false)}
                                className="p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors active:scale-95 cursor-pointer"
                            >
                                <AnimatedSearch className="w-4.5 h-4.5" size={18} />
                            </button>
                        </Tooltip>
                    </div>
                ) : (
                    <div className={`px-4 ${inTauri ? 'py-3 border-b border-[var(--border-color)]' : 'py-2 pb-1'} flex items-center justify-between`} style={{ borderStyle: 'var(--border-style)' }}>
                        <h2 className="text-xl font-extrabold tracking-wide text-[var(--text-primary)]">Chats</h2>
                        <div className="flex items-center gap-1">
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

                {/* Search Input Bar (WhatsApp style) */}
                {!sidebarCollapsed && (
                    <div className="px-4 py-2">
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
                            />

                            <button
                                ref={filterBtnRef}
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${activeFilter !== 'All'
                                    ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                title="Advanced Filters"
                            >
                                <AnimatedSliders className="w-3.5 h-3.5" size={14} animate={isFilterOpen} />
                            </button>

                            <FilterDropdown
                                isOpen={isFilterOpen}
                                onClose={() => setIsFilterOpen(false)}
                                activeFilter={activeFilter}
                                onFilterChange={(filter) => {
                                    setActiveFilter(filter);
                                    setActiveCategory('All');
                                }}
                                align="right"
                                triggerRef={filterBtnRef}
                            />

                            {dateRange?.from && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDateRange(undefined);
                                    }}
                                    className="p-0.5 text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer shrink-0"
                                    title="Reset Date Filter"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}

                            <button
                                ref={calendarBtnRef}
                                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${dateRange?.from
                                    ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                    }`}
                                title="Date Filter"
                            >
                                <AnimatedCalendar className="w-3.5 h-3.5" size={14} animate={isCalendarOpen} />
                            </button>

                            <CalendarDropdown
                                isOpen={isCalendarOpen}
                                onClose={() => setIsCalendarOpen(false)}
                                dateRange={dateRange}
                                onDateRangeChange={setDateRange}
                                bookedDates={bookedDates}
                                filteredChatsCount={filteredChats.length}
                                align="right"
                                triggerRef={calendarBtnRef}
                            />
                        </div>
                    </div>
                )}

                {/* Category Filter Chips (using naye Reusable Tag component) */}
                {!sidebarCollapsed && (
                    <div className="px-4 py-1.5 overflow-x-auto flex gap-1.5 no-scrollbar scroll-smooth flex-shrink-0 select-none">
                        {categories.map((cat) => (
                            <Tag
                                key={cat}
                                name={cat}
                                active={activeCategory === cat}
                                onClick={() => {
                                    setActiveCategory(cat);
                                    setActiveFilter('All');
                                }}
                            >
                                {cat}
                            </Tag>
                        ))}
                    </div>
                )}

                {/* Chat list viewport */}
                <div className={`flex-1 overflow-y-auto py-1 space-y-0 ${sidebarCollapsed ? 'no-scrollbar' : ''}`}>
                    {filteredChats.map((chat) => {
                        const isSelected = selectedIds.has(chat.id);
                        return (
                            <div
                                key={chat.id}
                                onContextMenu={(e) => !selectMode && handleContextMenu(e, chat.id)}
                                onClick={() => {
                                    if (selectMode) {
                                        toggleSelectChat(chat.id);
                                    } else {
                                        // Set active chat data for header
                                        setActiveChatData({
                                            id: chat.id,
                                            name: chat.name,
                                            avatar: chat.avatar,
                                            status: chat.status,
                                            totalMessages: chat.message ? 1 : 0
                                        });
                                    }
                                }}
                                className={`flex items-center transition-colors duration-150 cursor-pointer group relative overflow-hidden ${isSelected
                                    ? 'bg-[var(--accent-color)]/10'
                                    : chat.pinned
                                        ? 'bg-[var(--bg-tertiary)]/40'
                                        : 'hover:bg-[var(--bg-tertiary)]/60'
                                    } ${chat.archived ? 'opacity-[0.6]' : ''} ${sidebarCollapsed ? 'justify-center p-2 gap-0' : 'gap-3 p-2.5'}`}
                            >
                                {/* 🎀 Ribbon Tag overlay sticker */}
                                {chat.tags && chat.tags.length > 0 && !sidebarCollapsed && (
                                    <ChatRibbon tags={chat.tags} />
                                )}

                                {/* Checkbox in select mode OR Avatar */}
                                <Tooltip disabled={!sidebarCollapsed} title={chat.name} subtitle={chat.message}>
                                    <div className="relative flex-shrink-0">
                                        {selectMode && !sidebarCollapsed ? (
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isSelected
                                                ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                                                : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/50'
                                                }`}>
                                                {isSelected && (
                                                    <CheckCheck className="w-5 h-5 text-white" />
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {chat.avatar?.startsWith('http') || chat.avatar?.startsWith('/') ? (
                                                    <img
                                                        src={chat.avatar}
                                                        alt={chat.name}
                                                        className="w-10 h-10 rounded-full object-cover border border-[var(--border-color)]"
                                                        style={{ borderStyle: 'var(--border-style)' }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-10 h-10 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex items-center justify-center text-xl select-none"
                                                        style={{ borderStyle: 'var(--border-style)' }}
                                                    >
                                                        {chat.avatar}
                                                    </div>
                                                )}
                                                {chat.status === 'online' && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--bg-secondary)] shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                                )}
                                                {sidebarCollapsed && chat.unread > 0 && (
                                                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-[var(--accent-color)] text-[var(--accent-contrast)] text-[8px] font-black rounded-full flex items-center justify-center border border-[var(--bg-secondary)] shadow-sm animate-scale-in">
                                                        {chat.unread}
                                                    </span>
                                                )}
                                                {sidebarCollapsed && chat.favourite && (
                                                    <span className="absolute -top-1 -left-1 flex items-center justify-center w-3.5 h-3.5 bg-red-500 rounded-full border border-[var(--bg-secondary)] shadow-sm animate-scale-in">
                                                        <Heart className="w-2 h-2 text-white fill-white" />
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </Tooltip>

                                {/* Chat Details */}
                                {!sidebarCollapsed && (
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between mb-0.5">
                                            <h3 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-color)] transition-colors flex items-center gap-1.5">
                                                {chat.name}
                                                {chat.favourite && (
                                                    <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500 shrink-0" />
                                                )}
                                                {chat.muted && (
                                                    <BellOff className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                                )}
                                            </h3>
                                            <span className={`text-[9px] font-bold ${chat.unread > 0 ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`}>
                                                {chat.time}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between min-w-0">
                                            <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] min-w-0 flex-1">
                                                {chat.sent && (
                                                    <CheckCheck className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                                                )}
                                                <p className="truncate font-medium flex-1">{chat.message}</p>
                                            </div>

                                            {/* Right side: pin/unread OR three-dot menu button */}
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
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
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-primary)]/60 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-150 cursor-pointer"
                                                        title="More options"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {chat.pinned && !selectMode && (
                                                    <Pin className="w-3 h-3 text-[var(--accent-color)] fill-[var(--accent-color)] rotate-45 flex-shrink-0" />
                                                )}
                                                {chat.unread > 0 && !selectMode && (
                                                    <span className="min-w-[15px] h-[15px] px-1 bg-[var(--accent-color)] text-[var(--accent-contrast)] text-[9px] font-black rounded-full flex items-center justify-center shrink-0">
                                                        {chat.unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredChats.length === 0 && (
                        <div className={`py-8 flex flex-col items-center justify-center text-[var(--text-muted)] ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
                            <Tooltip disabled={!sidebarCollapsed} title="No active chats" position="right">
                                <MessageCircleWarning className={`w-8 h-8 opacity-20 mb-3`} />
                            </Tooltip>
                            {!sidebarCollapsed && (
                                <span className="text-center text-[11px] font-medium uppercase tracking-wider opacity-60">
                                    No active chats found
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ✅ Select Mode Bottom Action Bar */}
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
                                className="flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                DELETE
                            </button>
                        </div>
                    </div>
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
                                setChats(prev => prev.map(c => c.id === cid ? { ...c, archived: !c.archived } : c));
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
                            setChats(prev => prev.map(c => c.id === id ? { ...c, name, avatar: emoji } : c));
                        }}
                    />

                </>,
                document.body
            )}
        </>
    );
}


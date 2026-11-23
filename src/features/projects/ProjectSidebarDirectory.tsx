import React, { useMemo, useState } from 'react';
import {
    ArrowLeft,
    ChevronRight,
    FolderPlus,
    MessageSquarePlus,
    PanelRightOpen,
    Paperclip,
    Plus,
} from 'lucide-react';
import { useChatProjectsStore } from '../../store/chat/useChatProjectsStore';
import { useChatStore } from '../../store/chat/useChatStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';
import { pushChatRoute, pushViewRoute } from '../../core/router';
import { Tooltip } from '../../components/ui/tooltip';
import { SwipeableChatCard, type ChatItemCardData } from '../../components/layout/SwipeableChatCard';
import { ProjectIcon } from './ProjectIcons';

interface ProjectSidebarDirectoryProps {
    chats: Array<ChatItemCardData & { projectId?: string; updatedAt?: number; pinnedAt?: number; message?: string; status?: string }>;
    searchQuery: string;
    selectMode: boolean;
    selectedIds: Set<string>;
    editingChatId: string | null;
    inFlyout?: boolean;
    onCloseFlyout: () => void;
    onSetEditingChatId: (id: string | null) => void;
    onToggleSelectChat: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onTogglePinChat: (id: string) => void;
}

export const ProjectSidebarDirectory: React.FC<ProjectSidebarDirectoryProps> = ({
    chats,
    searchQuery,
    selectMode,
    selectedIds,
    editingChatId,
    inFlyout = false,
    onCloseFlyout,
    onSetEditingChatId,
    onToggleSelectChat,
    onContextMenu,
    onTogglePinChat,
}) => {
    const {
        projects: projectsMap,
        activeProjectId,
        openProject,
        startCreatingProject,
        setProjectPaneOpen,
    } = useChatProjectsStore();
    const { activeSessionId, streamingSessionId, switchSession, updateSession, deleteSession } = useChatStore();
    const { setActiveChatData } = useLayoutStore();

    // Sync local drill-down folder with activeProjectId when user opens a project
    const [browsingProjectId, setBrowsingProjectId] = useState<string | null>(activeProjectId);
    const activeDrillId = browsingProjectId && projectsMap[browsingProjectId] ? browsingProjectId : null;
    const activeDrillProject = activeDrillId ? projectsMap[activeDrillId] : null;

    const projects = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return Object.values(projectsMap)
            .filter((p) => !q || p.name.toLowerCase().includes(q))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [projectsMap, searchQuery]);

    const handleNewChatInProject = (projectId: string) => {
        openProject(projectId);
        useLayoutStore.getState().setActiveView('chat');
        pushViewRoute('chat');
        void switchSession(null);
        if (inFlyout) onCloseFlyout();
    };

    // ── LEVEL 2: INSIDE A SELECTED PROJECT (SHOWS ITS CHATS) ────────────────────
    if (activeDrillProject) {
        const projectChats = chats
            .filter(
                (c) =>
                    c.projectId === activeDrillProject.id &&
                    !c.archived &&
                    (!searchQuery.trim() ||
                        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (c.message || '').toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0);
                return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
            });

        return (
            <div className="space-y-2 px-1">
                {/* Project Drill-Down Navigation Header */}
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[var(--bg-primary)]/45 border border-[var(--border-color)]">
                    <button
                        type="button"
                        onClick={() => setBrowsingProjectId(null)}
                        className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
                        title="Back to Projects list"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] shrink-0 transition-colors" />
                        <div className="w-6 h-6 rounded-lg bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] shrink-0">
                            <ProjectIcon name={activeDrillProject.iconName} className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-color)] transition-colors">
                            {activeDrillProject.name}
                        </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                        <Tooltip title="New chat in project" position="bottom">
                            <button
                                type="button"
                                onClick={() => handleNewChatInProject(activeDrillProject.id)}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-colors cursor-pointer"
                            >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                        <Tooltip title="Open project details" position="bottom">
                            <button
                                type="button"
                                onClick={() => {
                                    openProject(activeDrillProject.id);
                                    setProjectPaneOpen(true);
                                    useLayoutStore.getState().setActiveView('chat');
                                    pushViewRoute('chat');
                                    if (inFlyout) onCloseFlyout();
                                }}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            >
                                <PanelRightOpen className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Project Chats List */}
                {projectChats.length > 0 ? (
                    <div className="space-y-0.5">
                        {projectChats.map((chat) => {
                            const isSelected = selectMode ? selectedIds.has(chat.id) : activeSessionId === chat.id;
                            return (
                                <SwipeableChatCard
                                    key={chat.id}
                                    chat={chat}
                                    isSelected={isSelected}
                                    selectMode={selectMode}
                                    isStreaming={streamingSessionId === chat.id}
                                    selectedIds={selectedIds}
                                    isEditing={editingChatId === chat.id}
                                    onSaveTitle={(newTitle) => {
                                        updateSession(chat.id, (s) => ({ ...s, title: newTitle }));
                                        onSetEditingChatId(null);
                                    }}
                                    onCancelEdit={() => onSetEditingChatId(null)}
                                    onSelectChat={() => {
                                        openProject(activeDrillProject.id);
                                        useLayoutStore.getState().setActiveView('chat');
                                        pushViewRoute('chat');
                                        void switchSession(chat.id);
                                        pushChatRoute(chat.id);
                                        setActiveChatData({
                                            id: chat.id,
                                            name: chat.name,
                                            avatar: chat.avatar || '',
                                            status: chat.status || 'online',
                                            totalMessages: chat.message ? 1 : 0,
                                        });
                                        if (inFlyout) onCloseFlyout();
                                    }}
                                    onToggleSelect={() => onToggleSelectChat(chat.id)}
                                    onContextMenu={(e) => onContextMenu(e, chat.id)}
                                    onDeleteChat={(chatId) => void deleteSession(chatId)}
                                    onToggleArchive={(chatId) => {
                                        updateSession(chatId, (c) => ({ ...c, archived: !c.archived }));
                                    }}
                                    onTogglePin={(chatId) => onTogglePinChat(chatId)}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-8 px-3 text-center space-y-2.5 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-primary)]/20">
                        <p className="text-[11px] text-[var(--text-muted)]">
                            No chats in <span className="text-[var(--text-primary)] font-semibold">{activeDrillProject.name}</span> yet.
                        </p>
                        <button
                            type="button"
                            onClick={() => handleNewChatInProject(activeDrillProject.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)]/15 hover:bg-[var(--accent-color)]/25 text-[var(--accent-color)] border border-[var(--accent-color)]/30 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Start Chat</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ── LEVEL 1: CLEAN PROJECTS LIST + TOP ADD ICON ─────────────────────────────
    return (
        <div className="space-y-2 px-1">
            {/* Top Projects Header + Add Project Icon */}
            <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wide">
                    Projects ({projects.length})
                </span>
                <Tooltip title="Create Project" position="bottom">
                    <button
                        type="button"
                        onClick={() => {
                            useLayoutStore.getState().setActiveView('chat');
                            pushViewRoute('chat');
                            void switchSession(null);
                            startCreatingProject();
                            if (inFlyout) onCloseFlyout();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--accent-color)]/15 hover:bg-[var(--accent-color)]/25 text-[var(--accent-color)] border border-[var(--accent-color)]/30 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Add</span>
                    </button>
                </Tooltip>
            </div>

            {projects.map((proj) => {
                const count = chats.filter((c) => c.projectId === proj.id && !c.archived).length;
                const isActive = activeProjectId === proj.id;
                return (
                    <button
                        key={proj.id}
                        type="button"
                        onClick={() => {
                            setBrowsingProjectId(proj.id);
                            openProject(proj.id);
                            useLayoutStore.getState().setActiveView('chat');
                            pushViewRoute('chat');
                            // Keep open chat only if it belongs to this project; otherwise open full-screen project hub
                            const current = activeSessionId ? chats.find((c) => c.id === activeSessionId) : undefined;
                            if (!current || current.projectId !== proj.id) {
                                void switchSession(null);
                            }
                            if (inFlyout) onCloseFlyout();
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer group ${
                            isActive
                                ? 'bg-[var(--bg-tertiary)] border-[var(--accent-color)]/45 text-[var(--text-primary)]'
                                : 'bg-[var(--bg-primary)]/30 border-[var(--border-color)]/70 hover:bg-[var(--bg-tertiary)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] shrink-0">
                                <ProjectIcon name={proj.iconName} className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-[var(--text-primary)] truncate">{proj.name}</div>
                                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-mono">
                                    <span>{count} {count === 1 ? 'chat' : 'chats'}</span>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-0.5">
                                        <Paperclip className="w-2.5 h-2.5" />
                                        {proj.attachments.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                );
            })}

            {projects.length === 0 && (
                <div className="py-8 px-4 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[var(--bg-primary)]/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/25 flex items-center justify-center text-[var(--accent-color)]">
                        <FolderPlus className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-[var(--text-primary)]">No Projects Yet</p>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            Create a project folder with a React icon, shared files, and grouped chats.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            useLayoutStore.getState().setActiveView('chat');
                            pushViewRoute('chat');
                            void switchSession(null);
                            startCreatingProject();
                            if (inFlyout) onCloseFlyout();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-color)] text-[var(--accent-contrast,#ffffff)] text-xs font-bold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Project</span>
                    </button>
                </div>
            )}
        </div>
    );
};

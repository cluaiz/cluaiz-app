import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Check,
    Edit2,
    File as FileIcon,
    FileCode2,
    FileText,
    Image as ImageIcon,
    MessageSquare,
    Paperclip,
    Plus,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import {
    useChatProjectsStore,
    fileToProjectAttachment,
    type ChatProject,
    type ChatProjectAttachment,
} from '../../store/chat/useChatProjectsStore';
import { useChatStore } from '../../store/chat/useChatStore';
import { pushChatRoute } from '../../core/router';
import { Tooltip } from '../../components/ui/tooltip';
import { ProjectIcon, ProjectIconPicker } from './ProjectIcons';

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function AttachmentKindIcon({ att }: { att: ChatProjectAttachment }) {
    const mime = (att.type || '').toLowerCase();
    if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-[var(--accent-color)] shrink-0" />;
    if (att.textContent !== undefined) return <FileCode2 className="w-4 h-4 text-[var(--accent-color)] shrink-0" />;
    if (mime.includes('pdf') || mime.startsWith('text/')) return <FileText className="w-4 h-4 text-[var(--accent-color)] shrink-0" />;
    return <FileIcon className="w-4 h-4 text-[var(--accent-color)] shrink-0" />;
}

interface ProjectWorkspacePaneProps {
    /**
     * - `create`: Full-canvas Create Project page (opened from sidebar + Add icon)
     * - `full`: Full-canvas Project Hub when a project has no started/selected chat yet
     * - `split`: Right split-pane alongside Chat (same UX as Code Workspace)
     */
    mode: 'create' | 'full' | 'split';
    project?: ChatProject;
    /** Rendered in `full` mode so the user can start their first project chat right on the page */
    composerSlot?: React.ReactNode;
}

export const ProjectWorkspacePane: React.FC<ProjectWorkspacePaneProps> = ({
    mode,
    project,
    composerSlot,
}) => {
    const {
        createProject,
        updateProject,
        deleteProject,
        addAttachments,
        removeAttachment,
        cancelCreatingProject,
        setProjectPaneOpen,
        closeProject,
    } = useChatProjectsStore();
    const { sessions, switchSession, updateSession } = useChatStore();

    // Shared Create / Edit form state
    const [name, setName] = useState(project?.name || '');
    const [iconName, setIconName] = useState(project?.iconName || 'Folder');
    const [instructions, setInstructions] = useState(project?.instructions || '');
    const [draftAttachments, setDraftAttachments] = useState<ChatProjectAttachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<ChatProjectAttachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (mode === 'create') {
            setName('');
            setIconName('Folder');
            setInstructions('');
            setDraftAttachments([]);
            setIsEditingMeta(false);
            setShowIconPicker(false);
            setPreviewAttachment(null);
        } else if (project) {
            setName(project.name);
            setIconName(project.iconName);
            setInstructions(project.instructions || '');
            setIsEditingMeta(false);
            setShowIconPicker(false);
            setPreviewAttachment(null);
        }
    }, [mode, project?.id]);

    const projectChats = useMemo(() => {
        if (!project) return [];
        return Object.values(sessions)
            .filter((s) => !s.isIncognito && !s.archived && s.projectId === project.id)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [sessions, project]);

    const handleFilesSelected = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const converted: ChatProjectAttachment[] = [];
            for (const file of Array.from(files)) {
                converted.push(await fileToProjectAttachment(file));
            }
            if (mode === 'create') {
                setDraftAttachments((prev) => [...prev, ...converted]);
            } else if (project) {
                addAttachments(project.id, converted);
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        createProject({
            name: trimmed,
            iconName,
            instructions: instructions.trim(),
            attachments: draftAttachments,
        });
        // Start with no open non-project chat so first-time Project Hub opens full-screen
        void switchSession(null);
    };

    const handleSaveMeta = () => {
        if (!project) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        updateProject(project.id, (prev) => ({
            ...prev,
            name: trimmed,
            iconName,
            instructions: instructions.trim(),
        }));
        setIsEditingMeta(false);
        setShowIconPicker(false);
    };

    const handleDeleteProject = () => {
        if (!project) return;
        Object.values(sessions).forEach((s) => {
            if (s.projectId === project.id) {
                updateSession(s.id, (curr) => ({ ...curr, projectId: undefined }));
            }
        });
        deleteProject(project.id);
    };

    // ── MODE 1: FULL-SCREEN CREATE PROJECT PAGE (NO POPUP) ──────────────────────
    if (mode === 'create') {
        return (
            <div className="flex-1 h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-[family-name:var(--font-family)]">
                {/* Header */}
                <div className="h-14 px-6 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 bg-[var(--bg-secondary)]/30">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={cancelCreatingProject}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            title="Back to Chat"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="w-8 h-8 rounded-xl bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)]">
                            <ProjectIcon name={iconName} className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold tracking-wide">Create Project</h2>
                            <p className="text-[11px] text-[var(--text-muted)]">Organize chats with shared files, context, and instructions</p>
                        </div>
                    </div>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                    <form onSubmit={handleCreateSubmit} className="max-w-2xl mx-auto space-y-6">
                        {/* Name & Selected Icon */}
                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/45 p-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Rust Engine Research, Product Launch, API Docs..."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] font-medium transition-colors"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                        Folder Icon
                                    </label>
                                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{iconName}</span>
                                </div>
                                <ProjectIconPicker value={iconName} onChange={setIconName} columns={12} />
                            </div>
                        </div>

                        {/* Project Files / Resources */}
                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/45 p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-bold text-[var(--text-primary)]">Project Resources & Files</h3>
                                    <p className="text-[11px] text-[var(--text-muted)]">Upload multiple documents, code, PDFs, or images used across all chats in this project</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-color)]/15 hover:bg-[var(--accent-color)]/25 text-[var(--accent-color)] border border-[var(--accent-color)]/30 text-xs font-bold transition-colors cursor-pointer shrink-0"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Files</span>
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => void handleFilesSelected(e.target.files)}
                                />
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    void handleFilesSelected(e.dataTransfer.files);
                                }}
                                className="p-5 rounded-xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)]/60 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center"
                            >
                                <Upload className="w-5 h-5 text-[var(--accent-color)]" />
                                <span className="text-xs font-medium text-[var(--text-secondary)]">
                                    {isUploading ? 'Reading files...' : 'Click or drag & drop multiple files here'}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)]">
                                    Code, Markdown, JSON, PDF, Text, Audio, Video, Images
                                </span>
                            </div>

                            {draftAttachments.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {draftAttachments.map((att) => (
                                        <div
                                            key={att.id}
                                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <AttachmentKindIcon att={att} />
                                                <div className="min-w-0">
                                                    <div className="text-[var(--text-primary)] font-medium truncate">{att.name}</div>
                                                    <div className="text-[10px] font-mono text-[var(--text-muted)]">{formatBytes(att.size)}</div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setDraftAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                                                className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Project Instructions */}
                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/45 p-5 space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                Project Instructions (Optional)
                            </label>
                            <textarea
                                rows={3}
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="How should the assistant behave across all chats in this project?"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] leading-relaxed resize-none custom-scrollbar"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={cancelCreatingProject}
                                className="px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!name.trim() || isUploading}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-color)] hover:opacity-95 disabled:opacity-40 text-xs font-bold text-[var(--accent-contrast,#ffffff)] transition-opacity cursor-pointer shadow-sm"
                            >
                                <Check className="w-4 h-4" />
                                <span>Create Project</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    if (!project) return null;

    // Reusable Resources + Instructions body shared cleanly between `full` and `split` modes
    const renderDetailsBody = (compact: boolean) => (
        <div className={compact ? 'space-y-4' : 'space-y-5'}>
            {/* Inline Edit Meta Form */}
            {isEditingMeta && (
                <div className="rounded-2xl border border-[var(--accent-color)]/40 bg-[var(--bg-primary)]/70 p-4 space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Project Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none text-xs text-[var(--text-primary)] font-semibold"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">React Icon</label>
                        <ProjectIconPicker value={iconName} onChange={setIconName} columns={compact ? 6 : 12} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Instructions</label>
                        <textarea
                            rows={3}
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Shared instructions for every chat in this project..."
                            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none text-xs text-[var(--text-primary)] leading-relaxed resize-none custom-scrollbar"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setName(project.name);
                                setIconName(project.iconName);
                                setInstructions(project.instructions || '');
                                setIsEditingMeta(false);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveMeta}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-color)] text-[var(--accent-contrast,#ffffff)] cursor-pointer"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Icon Swapper when not full-editing */}
            {!isEditingMeta && showIconPicker && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]/70 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <span>Choose React Icon</span>
                        <button type="button" onClick={() => setShowIconPicker(false)} className="hover:text-[var(--text-primary)] cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <ProjectIconPicker
                        value={project.iconName}
                        columns={compact ? 6 : 12}
                        onChange={(nextIcon) => {
                            setIconName(nextIcon);
                            updateProject(project.id, (prev) => ({ ...prev, iconName: nextIcon }));
                            setShowIconPicker(false);
                        }}
                    />
                </div>
            )}

            {/* Instructions Card */}
            {!isEditingMeta && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]/40 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Project Instructions
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsEditingMeta(true)}
                            className="text-[11px] font-semibold text-[var(--accent-color)] hover:underline cursor-pointer"
                        >
                            {project.instructions ? 'Edit' : '+ Add instructions'}
                        </button>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                        {project.instructions || 'No custom instructions yet. Add guidelines or context that apply to every chat in this project.'}
                    </p>
                </div>
            )}

            {/* Project Files & Resources */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Resources & Files ({project.attachments.length})
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-color)]/15 hover:bg-[var(--accent-color)]/25 text-[var(--accent-color)] border border-[var(--accent-color)]/30 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                        <Plus className="w-3 h-3" />
                        <span>Add Files</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => void handleFilesSelected(e.target.files)}
                    />
                </div>

                {/* Dropzone */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        void handleFilesSelected(e.dataTransfer.files);
                    }}
                    className="px-3 py-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-dashed border-[var(--border-color)] hover:border-[var(--accent-color)]/60 transition-colors cursor-pointer flex items-center justify-center gap-2 text-center"
                >
                    <Upload className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                    <span className="text-[11px] text-[var(--text-secondary)]">
                        {isUploading ? 'Adding files...' : 'Click or drop multiple files to share with project chats'}
                    </span>
                </div>

                {/* Files List */}
                {project.attachments.length > 0 && (
                    <div className={compact ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
                        {project.attachments.map((att) => (
                            <div
                                key={att.id}
                                onClick={() => setPreviewAttachment(previewAttachment?.id === att.id ? null : att)}
                                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                                    previewAttachment?.id === att.id
                                        ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/40'
                                        : 'bg-[var(--bg-secondary)]/70 border-[var(--border-color)] hover:border-[var(--accent-color)]/40'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <AttachmentKindIcon att={att} />
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{att.name}</div>
                                        <div className="text-[10px] font-mono text-[var(--text-muted)]">{formatBytes(att.size)}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (previewAttachment?.id === att.id) setPreviewAttachment(null);
                                        removeAttachment(project.id, att.id);
                                    }}
                                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                    title="Remove resource"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Inline Resource Preview */}
                {previewAttachment && (
                    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                            <span className="truncate font-semibold text-[var(--text-primary)]">{previewAttachment.name}</span>
                            <button type="button" onClick={() => setPreviewAttachment(null)} className="hover:text-[var(--text-primary)] cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {previewAttachment.textContent !== undefined ? (
                            <pre className="max-h-48 overflow-auto text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap custom-scrollbar">
                                {previewAttachment.textContent.slice(0, 4000)}
                                {previewAttachment.textContent.length > 4000 ? '\n…(truncated preview)' : ''}
                            </pre>
                        ) : previewAttachment.dataUri && previewAttachment.type.startsWith('image/') ? (
                            <img src={previewAttachment.dataUri} alt={previewAttachment.name} className="max-h-48 rounded-lg object-contain mx-auto" />
                        ) : (
                            <p className="text-[11px] text-[var(--text-muted)]">
                                Attached binary resource ({formatBytes(previewAttachment.size)}) — sent with project chats.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // ── MODE 2: RIGHT SPLIT-PANE WORKSPACE (ALONGSIDE LEFT CHAT) ────────────────
    if (mode === 'split') {
        return (
            <div className="flex flex-col h-full bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-hidden font-[family-name:var(--font-family)]">
                {/* Workspace Header */}
                <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between gap-2 shrink-0 bg-[var(--bg-tertiary)]/25">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Tooltip title="Change React Icon" position="bottom">
                            <button
                                type="button"
                                onClick={() => setShowIconPicker((prev) => !prev)}
                                className="w-8 h-8 rounded-xl bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] hover:bg-[var(--accent-color)]/25 transition-colors cursor-pointer shrink-0"
                            >
                                <ProjectIcon name={project.iconName} className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <div className="min-w-0">
                            <div className="text-xs font-extrabold text-[var(--text-primary)] truncate">{project.name}</div>
                            <div className="text-[10px] font-mono text-[var(--text-muted)]">
                                {projectChats.length} chats · {project.attachments.length} files
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <Tooltip title="Edit project" position="bottom">
                            <button
                                type="button"
                                onClick={() => setIsEditingMeta((prev) => !prev)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                        <Tooltip title="Delete project" position="bottom">
                            <button
                                type="button"
                                onClick={handleDeleteProject}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                        <Tooltip title="Hide Project Pane" position="bottom">
                            <button
                                type="button"
                                onClick={() => setProjectPaneOpen(false)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {renderDetailsBody(true)}
                </div>
            </div>
        );
    }

    // ── MODE 3: FULL-SCREEN PROJECT HUB (FIRST TIME / NO CHAT STARTED YET) ──────
    return (
        <div className="flex-1 h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-[family-name:var(--font-family)]">
            {/* Top Bar */}
            <div className="px-6 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between gap-3 shrink-0 bg-[var(--bg-secondary)]/30">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={() => setShowIconPicker((prev) => !prev)}
                        title="Change React Icon"
                        className="w-9 h-9 rounded-xl bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] hover:bg-[var(--accent-color)]/25 transition-colors cursor-pointer shrink-0"
                    >
                        <ProjectIcon name={project.iconName} className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-base font-extrabold text-[var(--text-primary)] truncate">{project.name}</h2>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono">
                            {projectChats.length} {projectChats.length === 1 ? 'chat' : 'chats'} · {project.attachments.length} {project.attachments.length === 1 ? 'file' : 'files'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsEditingMeta((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors cursor-pointer"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteProject}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-400 border border-rose-500/25 transition-colors cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                    </button>
                    <button
                        type="button"
                        onClick={closeProject}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                        title="Exit Project View"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Center Full-Screen Project Hub + Composer */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Composer to start a chat inside this project immediately */}
                    {composerSlot && (
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-[var(--text-muted)] px-1">
                                New chat in <span className="text-[var(--text-primary)] font-bold">{project.name}</span> — project files and instructions are included automatically
                            </div>
                            {composerSlot}
                        </div>
                    )}

                    {/* Project Instructions & Files */}
                    {renderDetailsBody(false)}

                    {/* Project Chats List (if any exist) */}
                    {projectChats.length > 0 && (
                        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]/40 p-4 space-y-2.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                Chats in this Project ({projectChats.length})
                            </span>
                            <div className="space-y-1">
                                {projectChats.map((chat) => (
                                    <button
                                        key={chat.id}
                                        type="button"
                                        onClick={() => {
                                            void switchSession(chat.id);
                                            pushChatRoute(chat.id);
                                        }}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-left transition-colors cursor-pointer"
                                    >
                                        <span className="flex items-center gap-2 min-w-0 text-xs font-semibold text-[var(--text-primary)]">
                                            <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />
                                            <span className="truncate">{chat.title || 'New Chat'}</span>
                                        </span>
                                        <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                                            {chat.messageCount || chat.messages.length || 0} msgs
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

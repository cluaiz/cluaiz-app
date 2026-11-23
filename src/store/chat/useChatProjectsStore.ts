import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessagePart } from '../../api/engine/chat/chat.types';

export interface ChatProjectAttachment {
    id: string;
    name: string;
    size: number;
    type: string;
    addedAt: number;
    /** Text/code content for plain text or code files */
    textContent?: string;
    /** Base64 Data URI for images, PDFs, documents, audio, video */
    dataUri?: string;
}

export interface ChatProject {
    id: string;
    name: string;
    description?: string;
    instructions?: string;
    /** Key from CHAT_PROJECT_ICONS (React Lucide icons only — never emojis) */
    iconName: string;
    attachments: ChatProjectAttachment[];
    createdAt: number;
    updatedAt: number;
}

interface ChatProjectsState {
    projects: Record<string, ChatProject>;
    activeProjectId: string | null;
    isCreatingProject: boolean;
    projectPaneOpen: boolean;
    setActiveProjectId: (projectId: string | null) => void;
    openProject: (projectId: string) => void;
    closeProject: () => void;
    startCreatingProject: () => void;
    cancelCreatingProject: () => void;
    setProjectPaneOpen: (open: boolean) => void;
    createProject: (input: {
        name: string;
        iconName: string;
        description?: string;
        instructions?: string;
        attachments?: ChatProjectAttachment[];
    }) => ChatProject;
    updateProject: (projectId: string, updater: (prev: ChatProject) => ChatProject) => void;
    deleteProject: (projectId: string) => void;
    addAttachments: (projectId: string, items: ChatProjectAttachment[]) => void;
    removeAttachment: (projectId: string, attachmentId: string) => void;
}

const generateProjectId = () => {
    const rand = Math.random().toString(36).substring(2, 7);
    return `proj_${Date.now()}_${rand}`;
};

export const useChatProjectsStore = create<ChatProjectsState>()(
    persist(
        (set) => ({
            projects: {},
            activeProjectId: null,
            isCreatingProject: false,
            projectPaneOpen: true,
            setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
            openProject: (projectId) => set({ activeProjectId: projectId, isCreatingProject: false, projectPaneOpen: true }),
            closeProject: () => set({ activeProjectId: null, isCreatingProject: false, projectPaneOpen: false }),
            startCreatingProject: () => set({ isCreatingProject: true, activeProjectId: null, projectPaneOpen: false }),
            cancelCreatingProject: () => set({ isCreatingProject: false }),
            setProjectPaneOpen: (projectPaneOpen) => set({ projectPaneOpen }),
            createProject: (input) => {
                const now = Date.now();
                const id = generateProjectId();
                const project: ChatProject = {
                    id,
                    name: input.name.trim() || 'Untitled Project',
                    iconName: input.iconName || 'Folder',
                    description: input.description?.trim() || '',
                    instructions: input.instructions?.trim() || '',
                    attachments: input.attachments ? [...input.attachments] : [],
                    createdAt: now,
                    updatedAt: now,
                };
                set((state) => ({
                    projects: { ...state.projects, [id]: project },
                    activeProjectId: id,
                    isCreatingProject: false,
                    projectPaneOpen: true,
                }));
                return project;
            },
            updateProject: (projectId, updater) =>
                set((state) => {
                    const existing = state.projects[projectId];
                    if (!existing) return state;
                    const updated = updater(existing);
                    return {
                        projects: {
                            ...state.projects,
                            [projectId]: { ...updated, id: projectId, updatedAt: Date.now() },
                        },
                    };
                }),
            deleteProject: (projectId) =>
                set((state) => {
                    const next = { ...state.projects };
                    delete next[projectId];
                    return {
                        projects: next,
                        activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
                    };
                }),
            addAttachments: (projectId, items) =>
                set((state) => {
                    const existing = state.projects[projectId];
                    if (!existing || items.length === 0) return state;
                    return {
                        projects: {
                            ...state.projects,
                            [projectId]: {
                                ...existing,
                                attachments: [...existing.attachments, ...items],
                                updatedAt: Date.now(),
                            },
                        },
                    };
                }),
            removeAttachment: (projectId, attachmentId) =>
                set((state) => {
                    const existing = state.projects[projectId];
                    if (!existing) return state;
                    return {
                        projects: {
                            ...state.projects,
                            [projectId]: {
                                ...existing,
                                attachments: existing.attachments.filter((a) => a.id !== attachmentId),
                                updatedAt: Date.now(),
                            },
                        },
                    };
                }),
        }),
        {
            name: 'cluaiz_chat_projects_v1',
            partialize: (state) => ({
                projects: state.projects,
            }),
        }
    )
);

/**
 * Converts a Browser File into a ChatProjectAttachment (text/code read as UTF-8 + DataURI for binary/media/PDF).
 */
export async function fileToProjectAttachment(file: File): Promise<ChatProjectAttachment> {
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const mime = (file.type || '').toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isTextLike =
        mime.startsWith('text/') ||
        mime === 'application/json' ||
        mime === 'application/javascript' ||
        mime === 'application/typescript' ||
        mime === 'application/xml' ||
        [
            'md', 'txt', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'csv', 'ts', 'tsx',
            'js', 'jsx', 'py', 'rs', 'go', 'c', 'cpp', 'h', 'hpp', 'java', 'kt',
            'swift', 'rb', 'php', 'sql', 'sh', 'ps1', 'html', 'css', 'scss', 'xml',
        ].includes(ext);

    if (isTextLike && file.size <= 512 * 1024) {
        const textContent = await file.text();
        return {
            id,
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            addedAt: Date.now(),
            textContent,
        };
    }

    const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });

    return {
        id,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        addedAt: Date.now(),
        dataUri,
    };
}

/**
 * Builds system/context blocks and multimodal parts from a project's instructions and attachments
 * so every chat inside the project automatically grounds on the project's files.
 */
export function buildProjectContextParts(project: ChatProject | undefined): {
    systemPrefix: string;
    attachmentParts: ChatMessagePart[];
} {
    if (!project) return { systemPrefix: '', attachmentParts: [] };
    const blocks: string[] = [];
    if (project.instructions?.trim()) {
        blocks.push(`[Project Instructions — "${project.name}"]\n${project.instructions.trim()}`);
    }
    const attachmentParts: ChatMessagePart[] = [];
    for (const att of project.attachments || []) {
        if (att.textContent !== undefined) {
            blocks.push(`[Project File: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\``);
        } else if (att.dataUri) {
            const mime = (att.type || '').toLowerCase();
            if (mime.startsWith('image/')) {
                attachmentParts.push({
                    type: 'image_url',
                    image_url: { url: att.dataUri, detail: 'auto' },
                });
            } else if (mime.startsWith('video/')) {
                attachmentParts.push({
                    type: 'video_url',
                    video_url: { url: att.dataUri },
                });
            } else if (mime.startsWith('audio/')) {
                attachmentParts.push({
                    type: 'audio_url',
                    audio_url: { url: att.dataUri },
                });
            } else {
                attachmentParts.push({
                    type: 'file_url',
                    file_url: { url: att.dataUri, name: att.name, detail: 'auto' },
                });
            }
        }
    }
    return {
        systemPrefix: blocks.join('\n\n'),
        attachmentParts,
    };
}

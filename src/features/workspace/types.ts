export interface ProjectFile {
    path: string;
    name: string;
    content: string;
    language: string;
    isModified?: boolean;
}

export interface FileTreeNode {
    id: string;
    name: string;
    path: string;
    isFolder: boolean;
    children?: FileTreeNode[];
    extension?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    rootPath?: string;
    files: Record<string, ProjectFile>;
    folders?: string[];
    activeFilePath: string;
    openFilePaths: string[];
    createdAt: number;
    updatedAt: number;
}
export interface RecentWorkspace {
    path: string;
    name: string;
    lastOpened: number;
}

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
    files: Record<string, ProjectFile>;
    activeFilePath: string;
    openFilePaths: string[];
    createdAt: number;
    updatedAt: number;
}

import React, { useState } from 'react';
import { FolderGit2, ArrowUpRight, CheckCircle2, FileCode, Loader2 } from 'lucide-react';
import { useProjectStore } from '../../../store/workspace/useProjectStore';
import { useLayoutStore } from '../../../store/ui/useLayoutStore';

interface ProjectCardProps {
    id: string;
    name: string;
    description?: string;
    files: Record<string, string>;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ id, name, description, files }) => {
    const [isOpening, setIsOpening] = useState(false);
    const { createOrUpdateProject, openWorkspace, setActiveFile } = useProjectStore();
    const { setSplitPaneWidth } = useLayoutStore();

    const fileList = Object.keys(files);

    const handleOpenWorkspace = async (specificFile?: string) => {
        if (isOpening) return;
        setIsOpening(true);
        try {
            await createOrUpdateProject(id, name, files, description);
            if (specificFile) {
                setActiveFile(specificFile);
            }
            openWorkspace(id);
            setSplitPaneWidth(50);
        } catch (err) {
            console.error('Failed to open workspace project:', err);
        } finally {
            setIsOpening(false);
        }
    };

    return (
        <div className="my-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/70 p-3.5 shadow-sm max-w-xl font-mono select-none">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/30 flex items-center justify-center text-[var(--accent-color)] flex-shrink-0">
                        <FolderGit2 className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">{name}</h4>
                        <span className="text-[11px] text-[var(--text-muted)]">{fileList.length} files generated</span>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={isOpening}
                    onClick={() => handleOpenWorkspace()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] text-[var(--accent-contrast, #ffffff)] text-xs font-semibold hover:opacity-90 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-60"
                >
                    {isOpening ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Opening...</span>
                        </>
                    ) : (
                        <>
                            <span>Open in Workspace</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
            </div>

            {description && (
                <p className="text-xs text-[var(--text-secondary)] mb-3 font-sans line-clamp-2">
                    {description}
                </p>
            )}

            {/* File List Grid / Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-[var(--border-color)]/50">
                {fileList.map((filePath) => {
                    const fileName = filePath.split('/').pop() || filePath;
                    return (
                        <div
                            key={filePath}
                            onClick={() => handleOpenWorkspace(filePath)}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white cursor-pointer transition-colors text-xs group"
                        >
                            <div className="flex items-center gap-1.5 truncate">
                                <FileCode className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[var(--accent-color)] transition-colors flex-shrink-0" />
                                <span className="truncate">{fileName}</span>
                            </div>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 opacity-60 flex-shrink-0" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

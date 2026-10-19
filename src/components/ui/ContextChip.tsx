import React from 'react';
import { FileIcon, FolderIcon } from 'react-material-icon-theme';
import { X, Sparkles } from 'lucide-react';
import { Tooltip } from './tooltip';
import { RichHoverCard } from './RichHoverCard';
import { extractBaseName, getFileExtension, parseLineRange, getRelativeWorkspacePath } from '../../utils/filePath';
import { useProjectStore } from '../../store/workspace/useProjectStore';
import { useLayoutStore } from '../../store/ui/useLayoutStore';

export type ContextChipType = 'file' | 'folder' | 'skill';

export interface ContextChipProps {
    type?: ContextChipType;
    /** For files/folders: full absolute path or relative path. For skills: skill identifier */
    id: string;
    /** Display name */
    name?: string;
    /** Raw path for files/folders */
    rawPath?: string;
    /** Code selection line range, e.g. "L14-L35" */
    lineRange?: string;
    /** Optional custom SVG or ReactNode icon for skills/plugins */
    icon?: React.ReactNode;
    /** Removal callback */
    onRemove?: () => void;
    /** Extra CSS classes */
    className?: string;
    /** Whether user interaction is disabled */
    disabled?: boolean;
}

export const ContextChip: React.FC<ContextChipProps> = ({
    type = 'file',
    id,
    name,
    rawPath,
    lineRange,
    icon,
    onRemove,
    className = '',
    disabled = false
}) => {
    const displayName = name || (rawPath ? extractBaseName(rawPath) : id);
    const fullPath = rawPath || id;
    const ext = type === 'file' ? getFileExtension(displayName) : undefined;

    let tooltipTitle = displayName;
    let tooltipSubtitle = 'Context Reference';

    if (type === 'file') {
        tooltipTitle = lineRange ? `${fullPath} (${lineRange})` : fullPath;
        tooltipSubtitle = 'Click to open in editor';
    } else if (type === 'folder') {
        tooltipTitle = fullPath;
        tooltipSubtitle = 'Click to open workspace folder';
    } else if (type === 'skill') {
        tooltipTitle = displayName;
        tooltipSubtitle = 'Active Skill / Tool';
    }

    const handleChipClick = (e: React.MouseEvent) => {
        if (type === 'folder') {
            e.preventDefault();
            e.stopPropagation();
            try {
                if (fullPath) {
                    useProjectStore.getState().openFolder(fullPath);
                    const layout = useLayoutStore.getState();
                    if (layout.splitPaneWidth >= 95 || layout.splitPaneWidth <= 5) {
                        layout.setSplitPaneWidth(50);
                    }
                }
            } catch (err) {
                console.error('Failed to open folder from chip:', err);
            }
            return;
        }

        if (type === 'file') {
            e.preventDefault();
            e.stopPropagation();
            try {
                if (!fullPath) return;

                // Ensure split pane is visible
                const layout = useLayoutStore.getState();
                if (layout.splitPaneWidth >= 95 || layout.splitPaneWidth <= 5) {
                    layout.setSplitPaneWidth(50);
                }

                const projectStore = useProjectStore.getState();
                const activeId = projectStore.activeProjectId;
                const activeProj = projectStore.getActiveProject();
                const rootPath = activeProj?.rootPath;
                const relPath = getRelativeWorkspacePath(fullPath, rootPath);
                const targetPath = relPath || fullPath;

                // Ensure file exists in project store state so setActiveFile doesn't silently reject it
                if (activeId && activeProj && !activeProj.files[targetPath]) {
                    const fileName = extractBaseName(targetPath);
                    useProjectStore.setState((state) => {
                        const cur = state.projects[activeId];
                        if (!cur) return state;
                        return {
                            projects: {
                                ...state.projects,
                                [activeId]: {
                                    ...cur,
                                    files: {
                                        ...cur.files,
                                        [targetPath]: {
                                            path: targetPath,
                                            name: fileName,
                                            content: '',
                                            language: getFileExtension(fileName) || 'text',
                                            isModified: false
                                        }
                                    }
                                }
                            }
                        };
                    });
                }

                projectStore.openFile(targetPath);

                const parsedRange = parseLineRange(lineRange);
                document.dispatchEvent(new CustomEvent('workspace-navigate-file', {
                    detail: {
                        path: targetPath,
                        rawPath: fullPath,
                        lineRange,
                        startLine: parsedRange?.startLine,
                        endLine: parsedRange?.endLine
                    }
                }));
            } catch (err) {
                console.error('Failed to open file from chip:', err);
            }
        }
    };

    const renderIcon = () => {
        if (icon) {
            return <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">{icon}</span>;
        }

        if (type === 'folder') {
            return (
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    <FolderIcon folderName={displayName} size={14} />
                </span>
            );
        }

        if (type === 'file') {
            return (
                <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    <FileIcon
                        fileName={displayName}
                        fileExtension={ext}
                        languageId={ext}
                        size={14}
                    />
                </span>
            );
        }

        return <Sparkles className="w-3.5 h-3.5 text-[var(--accent-color)] shrink-0" />;
    };

    const chipBody = (
        
        <span
            contentEditable={false}
            data-chip-id={id}
            data-chip-type={type}
            data-raw-path={rawPath || ''}
            data-line-range={lineRange || ''}
            onClick={handleChipClick}
            className={`relative inline-flex items-center align-middle gap-1.5 pl-2 ${onRemove ? 'pr-2 group-hover:pr-5' : 'pr-2'} py-0.5 mx-0.5 my-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] font-mono font-medium text-[var(--text-primary)] hover:border-[var(--accent-color)]/60 transition-all select-all selection:bg-[var(--accent-color)] selection:text-white shadow-xs group cursor-pointer ${className}`}
            style={{
                verticalAlign: 'baseline',
                lineHeight: '1.15rem'
            }}
        >
            {renderIcon()}
            <span className="truncate max-w-[130px] sm:max-w-[180px]" title={tooltipTitle}>
                {displayName}
            </span>

            {lineRange && (
                <span className="text-[9.5px] text-[var(--accent-color)] font-mono font-semibold px-1 py-0.2 rounded bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 shrink-0">
                    {lineRange}
                </span>
            )}

            {!disabled && onRemove && (
                <button
                    type="button"
                    contentEditable={false}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 transition-opacity cursor-pointer bg-[var(--bg-secondary)]/90 backdrop-blur-xs"
                    title="Remove reference"
                >
                    <X className="w-2.5 h-2.5" />
                </button>
            )}
        </span>
    );

    if (type === 'file') {
        return (
            <RichHoverCard
                title={displayName}
                filePath={fullPath}
                lineRange={lineRange}
                position="top"
                onOpenInEditor={() => handleChipClick({ preventDefault: () => {}, stopPropagation: () => {} } as any)}
            >
                {chipBody}
            </RichHoverCard>
        );
    }

    return (
        <Tooltip title={tooltipTitle} subtitle={tooltipSubtitle} position="top">
            {chipBody}
        </Tooltip>
    );
};

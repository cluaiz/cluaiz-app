import React from 'react';
import { 
    Archive, 
    Binary, 
    FileBox 
} from 'lucide-react';
import { isArchiveFile, isExecutableFile } from '../../utils/mediaResolver';

interface BinaryFileCardProps {
    filePath: string;
    fileName: string;
    rootPath?: string;
    content?: string;
}

export const BinaryFileCard: React.FC<BinaryFileCardProps> = ({
    fileName,
}) => {
    const isArchive = isArchiveFile(fileName);
    const isExe = isExecutableFile(fileName);

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[var(--bg-primary)] select-none font-sans text-center">
            <div className="flex flex-col items-center max-w-sm px-4">
                {/* Minimal Icon */}
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mb-4 text-[var(--text-muted)] shadow-sm">
                    {isArchive ? (
                        <Archive className="w-6 h-6 text-amber-400/80" />
                    ) : isExe ? (
                        <Binary className="w-6 h-6 text-cyan-400/80" />
                    ) : (
                        <FileBox className="w-6 h-6 text-[var(--text-muted)]" />
                    )}
                </div>

                {/* File Name */}
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 truncate max-w-xs" title={fileName}>
                    {fileName}
                </h3>

                {/* Minimal VS Code style text */}
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    The file cannot be displayed in the text editor because it is either binary or uses an unsupported format.
                </p>
            </div>
        </div>
    );
};

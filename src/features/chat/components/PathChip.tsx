import React from 'react';
import { ContextChip, ContextChipProps } from '../../../components/ui/ContextChip';
import { extractBaseName } from '../../../utils/filePath';

export { extractBaseName };

export interface PathChipProps {
    path: string;
    isFolder?: boolean;
    name?: string;
    lineRange?: string;
    onRemove?: () => void;
    className?: string;
}

export const PathChip: React.FC<PathChipProps> = ({
    path,
    isFolder = false,
    name,
    lineRange,
    onRemove,
    className = ''
}) => {
    return (
        <ContextChip
            id={path}
            type={isFolder ? 'folder' : 'file'}
            rawPath={path}
            name={name}
            lineRange={lineRange}
            onRemove={onRemove}
            className={className}
        />
    );
};

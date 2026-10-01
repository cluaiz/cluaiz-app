import React from 'react';
import { ImagePreview } from './ImagePreview';
import { VideoPreview } from './VideoPreview';
import { AudioPreview } from './AudioPreview';
import { PdfPreview } from './PdfPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { BinaryFileCard } from './BinaryFileCard';
import {
    isImageFile,
    isVideoFile,
    isAudioFile,
    isPdfFile,
    isMarkdownFile,
    isBinaryUnsupportedFile,
    isPreviewableFile
} from '../../utils/mediaResolver';

export { isImageFile, isVideoFile, isAudioFile, isPdfFile, isMarkdownFile, isBinaryUnsupportedFile, isPreviewableFile };

interface FilePreviewDispatcherProps {
    filePath: string;
    fileName: string;
    content: string;
    rootPath?: string;
    onChangeContent?: (newContent: string) => void;
}

export const FilePreviewDispatcher: React.FC<FilePreviewDispatcherProps> = ({
    filePath,
    fileName,
    content,
    rootPath,
    onChangeContent,
}) => {
    if (isImageFile(fileName)) {
        return (
            <ImagePreview
                filePath={filePath}
                fileName={fileName}
                content={content}
                rootPath={rootPath}
                onChangeContent={onChangeContent}
            />
        );
    }

    if (isVideoFile(fileName)) {
        return (
            <VideoPreview
                filePath={filePath}
                fileName={fileName}
                rootPath={rootPath}
                content={content}
            />
        );
    }

    if (isAudioFile(fileName)) {
        return (
            <AudioPreview
                filePath={filePath}
                fileName={fileName}
                rootPath={rootPath}
                content={content}
            />
        );
    }

    if (isPdfFile(fileName)) {
        return (
            <PdfPreview
                filePath={filePath}
                fileName={fileName}
                content={content}
                rootPath={rootPath}
            />
        );
    }

    if (isMarkdownFile(fileName)) {
        return (
            <MarkdownPreview
                fileName={fileName}
                content={content}
                onChange={onChangeContent}
            />
        );
    }

    if (isBinaryUnsupportedFile(fileName)) {
        return (
            <BinaryFileCard
                filePath={filePath}
                fileName={fileName}
                rootPath={rootPath}
                content={content}
            />
        );
    }

    return null;
};


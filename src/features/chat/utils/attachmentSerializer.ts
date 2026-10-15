import { StagedAttachment } from '../components/AttachmentStagingDeck';
import type { ChatMessagePart } from '../../../api/engine/chat/chat.types';

/**
 * Converts a File or Blob into a Base64 Data URI (e.g. data:image/png;base64,...).
 */
export async function fileToDataUri(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

export interface SerializedAttachmentsResult {
    parts: ChatMessagePart[];
    hasMultimodal: boolean;
    summary: string;
}

/**
 * Serializes staged attachments and prompt text into standard polymorphic ChatMessagePart array.
 * Supports:
 * - Images (PNG, JPG, WEBP, GIF) -> { type: 'image_url', image_url: { url: DataURI } }
 * - Documents (PDF, Word, Code, Text) -> { type: 'file_url', file_url: { url: DataURI, name } }
 * - Videos -> { type: 'video_url', video_url: { url: DataURI } }
 * - Pasted Code / Text Snippets -> { type: 'text', text: formattedCodeBlock }
 * - User Prompt Text -> { type: 'text', text: userPrompt }
 */
export async function serializeStagedAttachments(
    attachments: StagedAttachment[],
    userPrompt: string
): Promise<SerializedAttachmentsResult> {
    const parts: ChatMessagePart[] = [];
    let hasMultimodal = false;
    const summaryNames: string[] = [];

    // 1. Process attachments
    for (const att of attachments) {
        summaryNames.push(att.name);

        // Pasted Code Snippet
        if (att.isPastedText && att.pastedContent) {
            parts.push({
                type: 'text',
                text: `\`\`\`\n// Snippet: ${att.name}\n${att.pastedContent}\n\`\`\``
            });
            continue;
        }

        // File object available
        if (att.file instanceof File || att.file instanceof Blob) {
            try {
                const dataUri = await fileToDataUri(att.file);
                const mime = att.type?.toLowerCase() || att.file.type?.toLowerCase() || '';

                if (mime.startsWith('image/')) {
                    hasMultimodal = true;
                    parts.push({
                        type: 'image_url',
                        image_url: {
                            url: dataUri,
                            detail: 'auto'
                        }
                    });
                } else if (mime.startsWith('video/')) {
                    hasMultimodal = true;
                    parts.push({
                        type: 'video_url',
                        video_url: {
                            url: dataUri,
                            fps: 1
                        }
                    });
                } else if (mime.startsWith('audio/')) {
                    hasMultimodal = true;
                    const base64Data = dataUri.split(',')[1] || '';
                    const format = mime.includes('mp3') ? 'mp3' : 'wav';
                    parts.push({
                        type: 'input_audio',
                        input_audio: {
                            data: base64Data,
                            format
                        }
                    });
                } else {
                    // Documents: PDF, DOCX, TXT, JSON, etc.
                    hasMultimodal = true;
                    parts.push({
                        type: 'file_url',
                        file_url: {
                            url: dataUri,
                            name: att.name,
                            detail: 'full'
                        }
                    });
                }
            } catch (err) {
                console.error(`[attachmentSerializer] Failed to convert ${att.name} to Data URI:`, err);
            }
        }
    }

    // 2. Append User Prompt Text
    const trimmedPrompt = userPrompt.trim();
    if (trimmedPrompt) {
        parts.push({
            type: 'text',
            text: trimmedPrompt
        });
    }

    return {
        parts,
        hasMultimodal,
        summary: summaryNames.join(', ')
    };
}

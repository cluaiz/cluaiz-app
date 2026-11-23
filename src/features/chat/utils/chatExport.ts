import type { ChatMessage, ChatSession } from '../../../store/chat/types';

/** What a message holds, for the search filters */
export type MessageKind = 'image' | 'document' | 'code' | 'media';

const isImage = (type = '', name = '') => type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
const isMedia = (type = '', name = '') => type.startsWith('audio/') || type.startsWith('video/') || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)$/i.test(name);

export function messageKinds(message: ChatMessage): Set<MessageKind> {
    const kinds = new Set<MessageKind>();
    for (const file of message.attachments ?? []) {
        kinds.add(isImage(file.type, file.name) ? 'image' : isMedia(file.type, file.name) ? 'media' : 'document');
    }
    for (const part of message.parts ?? []) {
        if (part.type === 'image_url') kinds.add('image');
        else if (part.type === 'input_audio' || part.type === 'video_url') kinds.add('media');
        else if (part.type === 'file_url' || part.type === 'file') kinds.add('document');
    }
    if (/```/.test(message.text)) kinds.add('code');
    return kinds;
}

const when = (message: ChatMessage) => new Date(message.date).toISOString();
const safeName = (title: string) => (title || 'chat').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'chat';

/** The chat as Markdown: each message under its sender and time, files listed by name */
export function chatToMarkdown(session: ChatSession): string {
    const lines = [`# ${session.title || 'Chat'}`, '', `Exported ${new Date().toISOString()}`, ''];
    for (const message of session.messages) {
        if (message.compaction) continue;
        lines.push(`## ${message.sender === 'user' ? 'You' : message.sender === 'assistant' ? (message.model || 'Assistant') : 'System'} · ${when(message)}`, '');
        if (message.text) lines.push(message.text, '');
        for (const file of message.attachments ?? []) lines.push(`- Attached: ${file.name}`);
        if (message.attachments?.length) lines.push('');
    }
    return lines.join('\n');
}

/** The chat as JSON: title, times and every message as saved (preview images left out, they are local blobs) */
export function chatToJson(session: ChatSession): string {
    const messages = session.messages.map(message => ({
        ...message, attachments: message.attachments?.map(({ previewUrl: _preview, ...file }) => file),
    }));
    return JSON.stringify({ id: session.id, title: session.title, createdAt: session.createdAt, updatedAt: session.updatedAt, messages }, null, 2);
}

export const chatFileName = (session: ChatSession, extension: 'md' | 'json') => `${safeName(session.title)}.${extension}`;

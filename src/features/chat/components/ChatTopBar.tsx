import { useRef, useState } from 'react';
import { Archive, ArchiveRestore, CheckSquare, FileJson, FileText, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ActionDropdown, ActionDropdownItem } from '../../../components/ui/dropdown/ActionDropdown';
import { useChatStore } from '../../../store/chat/useChatStore';
import { downloadFile } from '../../workspace/utils/zipExport';
import { chatFileName, chatToJson, chatToMarkdown } from '../utils/chatExport';
import { ChatSearchBar } from './ChatSearchBar';

/** The chat input puts its model picker here (a portal), so the input keeps only what is typed */
export const CHAT_MODEL_SLOT = 'chat-model-slot';

/** The chat's top bar: the model on the left; on the right search with filters, and the chat's menu (select, export, archive, delete) */
export function ChatTopBar({ onSelectMessages }: { onSelectMessages(): void }) {
    const chatId = useChatStore(s => s.activeSessionId);
    const session = useChatStore(s => (s.activeSessionId ? s.sessions[s.activeSessionId] : undefined));
    const updateSession = useChatStore(s => s.updateSession), deleteSession = useChatStore(s => s.deleteSession), switchSession = useChatStore(s => s.switchSession);
    const [menu, setMenu] = useState(false), [searching, setSearching] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const hasMessages = Boolean(session?.messages.length);
    const act = (run: () => void) => () => { setMenu(false); run(); };

    // pr-20 leaves room for the private-chat and project buttons in the top right corner
    return <div className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 px-2 pr-20 sm:px-4 sm:pr-20">
        <div id={CHAT_MODEL_SLOT} className="flex min-w-0 items-center" />
        {chatId && session && hasMessages && <div className="relative flex items-center gap-1">
            {searching && <ChatSearchBar key={chatId} messages={session.messages} onClose={() => setSearching(false)} />}
            <Button ref={trigger} variant="ghost" size="icon" aria-label="Chat menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                <MoreHorizontal size={18} />
            </Button>
            <ActionDropdown isOpen={menu} onClose={() => setMenu(false)} floating triggerRef={trigger} className="w-56">
                <ActionDropdownItem icon={<Search size={14} />} onClick={act(() => setSearching(true))}>Search</ActionDropdownItem>
                <ActionDropdownItem icon={<CheckSquare size={14} />} onClick={act(onSelectMessages)}>Select messages</ActionDropdownItem>
                <div className="my-1 h-px bg-[var(--border-color)]/60" />
                <ActionDropdownItem icon={<FileText size={14} />} onClick={act(() => downloadFile(chatFileName(session, 'md'), chatToMarkdown(session), 'text/markdown;charset=utf-8'))}>Export as Markdown</ActionDropdownItem>
                <ActionDropdownItem icon={<FileJson size={14} />} onClick={act(() => downloadFile(chatFileName(session, 'json'), chatToJson(session), 'application/json;charset=utf-8'))}>Export as JSON</ActionDropdownItem>
                <div className="my-1 h-px bg-[var(--border-color)]/60" />
                <ActionDropdownItem icon={session.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    onClick={act(() => updateSession(chatId, chat => ({ ...chat, archived: !chat.archived, archivedAt: chat.archived ? undefined : Date.now() })))}>
                    {session.archived ? 'Unarchive' : 'Archive'}
                </ActionDropdownItem>
                <ActionDropdownItem danger icon={<Trash2 size={14} />} onClick={act(async () => {
                    if (!window.confirm(`Delete "${session.title || 'this chat'}"? This cannot be undone.`)) return;
                    if (await deleteSession(chatId)) await switchSession(null);
                })}>Delete chat</ActionDropdownItem>
            </ActionDropdown>
        </div>}
    </div>;
}

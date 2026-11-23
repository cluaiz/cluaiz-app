import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useChatControlsStore } from '../../../store/chat/useChatControlsStore';

/** The chat input puts its model picker here (a portal), so the input keeps only what is typed */
export const CHAT_MODEL_SLOT = 'chat-model-slot';

/** The chat's top bar: the model on the left, the settings panel button on the right */
export function ChatTopBar() {
    const open = useChatControlsStore(s => s.panelOpen), setOpen = useChatControlsStore(s => s.setPanelOpen);
    // pr-16 leaves room for the private-chat and project buttons that sit in the top right corner
    return <div className="relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 px-2 pr-16 sm:px-4 sm:pr-16">
        <div id={CHAT_MODEL_SLOT} className="flex min-w-0 items-center" />
        <Button variant="ghost" size="icon" aria-label="Chat settings" aria-pressed={open} title="Chat settings and live system"
            onClick={() => setOpen(!open)} className={open ? 'text-[var(--accent-color)]' : undefined}>
            <SlidersHorizontal size={16} />
        </Button>
    </div>;
}

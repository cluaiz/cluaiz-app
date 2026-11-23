/** The chat input puts its model picker here (a portal), so the input keeps only what is typed */
export const CHAT_MODEL_SLOT = 'chat-model-slot';

/** The chat's top bar: the model on the left; the right corner keeps the private-chat and project buttons */
export function ChatTopBar() {
    return <div className="relative z-30 flex h-12 shrink-0 items-center px-2 pr-20 sm:px-4 sm:pr-20">
        <div id={CHAT_MODEL_SLOT} className="flex min-w-0 items-center" />
    </div>;
}

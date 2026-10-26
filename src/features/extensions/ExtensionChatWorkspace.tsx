import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { ExtensionViewProps } from '../../extensions/registry';
import type { ExtensionChatHandle } from '../../extensions/chat';
import type { ExtensionSDK } from '../../extensions/sdk';

export interface ExtensionChatBinding { sdk: ExtensionSDK; handle: ExtensionChatHandle; }
const SharedChatWorkspace = lazy(() => import('../chat/components/ChatWorkspace').then(module => ({ default: module.ChatWorkspace })));

/** The view explicitly chooses a session; merely opening a workspace never creates/selects a chat. */
export function ExtensionChatWorkspace({ View, sdk }: { View: React.ComponentType<ExtensionViewProps>; sdk: ExtensionSDK }) {
    const [binding, setBinding] = useState<ExtensionChatBinding>();
    const generation = useRef(0);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; generation.current++; };
    }, []);
    const showChat = useCallback(async (handle: ExtensionChatHandle) => {
        if (!alive.current) throw new Error('Chat workspace is closed.');
        const version = ++generation.current;
        // Validates the instance-issued handle, saved package owner and history before displaying it.
        await sdk.chat.read(handle).result;
        if (!alive.current || generation.current !== version) throw new DOMException('Chat view request cancelled.', 'AbortError');
        setBinding({ sdk, handle });
    }, [sdk]);
    const workspace = <View sdk={sdk} showChat={showChat} />;
    return <Suspense fallback={<div role="status">Opening chat workspace…</div>}>
        <SharedChatWorkspace workspace={workspace} chatBinding={binding ?? null} />
    </Suspense>;
}

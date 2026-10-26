import { useEffect } from 'react';
import { useChatStore } from '../../../store/chat/useChatStore';
import type { useChatTelemetry } from './useChatTelemetry';

/** Existing desktop token listener; owned extension turns use their SDK stream instead. */
export function useLegacyChatEvents(enabled: boolean, launchOnStartup: boolean, telemetry: ReturnType<typeof useChatTelemetry>) {
    const { endStreaming, syncSessionTokens, setBreakdown, recordToolExecution, recordToken } = telemetry;
    useEffect(() => {
        if (!enabled) return;
        let unlistenToken: (() => void) | undefined;
        let isUnmounted = false;

        import('../../../core/engine').then(({ cluaizEngine }) => {
            // Conditionally boot the engine based on user settings
            if (launchOnStartup) {
                cluaizEngine.boot().catch(console.error);
            }

            cluaizEngine.onToken((chunk) => {
                const store = useChatStore.getState();
                if (!store.activeSessionId) return;

                if (chunk === '[DONE]') {
                    const finalStats = endStreaming();
                    const now = new Date();
                    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

                    if (finalStats && finalStats.tokens > 0) {
                        store.attachTelemetryToLastMessage(store.activeSessionId, finalStats);
                    }
                    const activeSess = store.sessions[store.activeSessionId];
                    if (activeSess?.messages && activeSess.messages.length > 0) {
                        const lastIdx = activeSess.messages.length - 1;
                        const lastMsg = activeSess.messages[lastIdx];
                        if (lastMsg.sender === 'assistant' && !lastMsg.time) {
                            store.updateMessage(store.activeSessionId, lastIdx, m => ({ ...m, time: timeStr }));
                        }
                        syncSessionTokens(activeSess.messages);
                    }
                    store.finalizeAssistantMessage(store.activeSessionId);
                    return;
                }

                // If chunk has contextTelemetry from SSE
                if (typeof chunk === 'object' && chunk.contextTelemetry) {
                    const telemetry = chunk.contextTelemetry.context_breakdown || chunk.contextTelemetry;
                    setBreakdown(telemetry);
                    return;
                }

                // If chunk has permissionRequest
                if (typeof chunk === 'object' && chunk.permissionRequest) {
                    store.setPermissionRequestOnLastMessage(store.activeSessionId, chunk.permissionRequest);
                    return;
                }

                // If chunk has toolCall
                if (typeof chunk === 'object' && chunk.toolCall) {
                    store.appendToolCallToLastMessage(store.activeSessionId, chunk.toolCall);
                    recordToolExecution(chunk.toolCall.name, undefined, 'running', chunk.toolCall.category);
                    return;
                }

                // If chunk has toolResult
                if (typeof chunk === 'object' && chunk.toolResult) {
                    store.updateToolResultOnLastMessage(store.activeSessionId, chunk.toolResult);
                    recordToolExecution(chunk.toolResult.name || 'tool', chunk.toolResult.latency_ms, 'completed', chunk.toolResult.category);
                    return;
                }

                recordToken();

                const reasoning = typeof chunk === 'object' ? chunk.reasoning : undefined;
                const content = typeof chunk === 'object' ? chunk.content : chunk;

                const session = store.sessions[store.activeSessionId];
                const lastMsg = session?.messages[session.messages.length - 1];

                if (!lastMsg || lastMsg.sender !== 'assistant') {
                    store.addMessage(store.activeSessionId, {
                        sender: 'assistant',
                        text: content || '',
                        thinking: reasoning || '',
                        time: '',
                        date: Date.now()
                    });
                } else {
                    if (reasoning) {
                        store.appendThinkingToLastMessage(store.activeSessionId, reasoning);
                    }
                    if (content) {
                        store.appendTokenToLastMessage(store.activeSessionId, content);
                    }
                }
            }).then(unlisten => {
                if (isUnmounted) {
                    unlisten();
                } else {
                    unlistenToken = unlisten;
                }
            }).catch(console.error);
        });

        return () => {
            isUnmounted = true;
            if (unlistenToken) unlistenToken();
        };
    }, [enabled]);
}

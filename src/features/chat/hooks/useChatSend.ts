import { useState } from 'react';
import { toast } from '../../../components/ui/toast';
import type { Dispatch, SetStateAction } from 'react';
import { useChatStore } from '../../../store/chat/useChatStore';
import type { ChatMessage } from '../../../store/chat/useChatStore';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { inferChatTopicAndEmoji } from '../../../utils/topicProber';
import { errorMessage } from '../../../api/client/errors';
import { buildChatHistory, processingLabel, selectChatContext } from '../utils/chatRequest';
import type { useChatTelemetry } from './useChatTelemetry';

type Reply = { text: string; messageIndex: number; type?: 'message' | 'selection' } | null;
interface SendState {
    inputValue: string;
    setInputValue: Dispatch<SetStateAction<string>>;
    replyingTo: Reply;
    setReplyingTo: Dispatch<SetStateAction<Reply>>;
    isIncognito: boolean;
    messages: ChatMessage[];
    telemetry: ReturnType<typeof useChatTelemetry>;
}

/** Owns one chat request's progress, error recovery and conversation updates. */
export function useChatSend({ inputValue, setInputValue, replyingTo, setReplyingTo, isIncognito, messages, telemetry }: SendState) {
    const { startStreaming, endStreaming, recordToken, recordToolExecution, setBreakdown, syncSessionTokens } = telemetry;
    const [processing, setProcessing] = useState<{ sessionId: string; label: string } | null>(null);
    const handleSendMessage = async (customText?: string, options?: import('../../../core/engine').SendChatOptions) => {
        const textToSend = typeof customText === 'string' ? customText : inputValue;
        const hasAttachments = Boolean((options?.attachments && options.attachments.length > 0) || (options?.parts && options.parts.length > 0));
        if (!textToSend.trim() && !replyingTo && !hasAttachments) return;
        const messageText = textToSend || (replyingTo ? 'Replying to context...' : '');

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const store = useChatStore.getState();
        let sessionId = store.activeSessionId;

        // The engine answers one chat at a time: another chat's answer must finish (or be stopped) first
        const busy = store.streamingSessionId;
        if (busy && busy !== sessionId) {
            const title = store.sessions[busy]?.title || 'another chat';
            toast.info(`"${title}" is still answering. Wait for it to finish, or open it and stop it.`);
            return;
        }

        if (!sessionId) {
            sessionId = store.createNewSession(isIncognito ? 'Temporary Chat' : undefined, { incognito: isIncognito });
        } else if (isIncognito) {
            store.updateSession(sessionId, s => ({ ...s, isIncognito: true }));
        }

        const replyContext = replyingTo ? {
            text: replyingTo.text,
            sender: (replyingTo.messageIndex !== undefined && messages[replyingTo.messageIndex]?.sender) || 'assistant'
        } : undefined;

        store.addMessage(sessionId, {
            sender: 'user',
            text: messageText,
            replyTo: replyContext,
            attachments: options?.attachments,
            parts: options?.parts,
            time: timeStr,
            date: now.getTime()
        });
        const userId = useChatStore.getState().sessions[sessionId]?.messages.slice(-1)[0]?.id;

        // Create the assistant row before waiting for the engine.
        store.addMessage(sessionId, {
            sender: 'assistant',
            text: '',
            thinking: '',
            time: '',
            date: now.getTime()
        });
        const assistantId = useChatStore.getState().sessions[sessionId]?.messages.slice(-1)[0]?.id;
        let terminalSeen = false;
        const failRequest = (detail: string) => {
            if (terminalSeen) return;
            terminalSeen = true;
            endStreaming();
            setProcessing(null);
            const current = useChatStore.getState();
            const items = current.sessions[sessionId]?.messages || [];
            const userIndex = items.findIndex(message => message.id === userId);
            const assistantIndex = items.findIndex(message => message.id === assistantId);
            if (userIndex >= 0) current.updateMessage(sessionId, userIndex, message => ({ ...message, finishReason: 'error' }));
            if (assistantIndex >= 0) current.updateMessage(sessionId, assistantIndex, message => ({
                ...message, finishReason: 'error', time: timeStr,
                text: `${message.text ? `${message.text}\n\n` : ''}Request failed: ${detail}`
            }));
            current.finalizeAssistantMessage(sessionId);
        };

        setInputValue('');
        setReplyingTo(null);

        try {
            startStreaming();
            useChatStore.getState().setStreamingSession(sessionId);
            setProcessing({ sessionId, label: 'Waiting for engine' });
            if (useEngineStore.getState().permissions?.lazy_load_model) {
                const { cluaizEngine } = await import('../../../core/engine');
                await cluaizEngine.boot();
            }
            // Build conversation history from the active session for context memory
            const currentSession = useChatStore.getState().sessions[sessionId];
            const contextMessages = selectChatContext(currentSession?.messages || []);
            const conversationMessages = buildChatHistory(contextMessages);

            const chatOptions = {
                ...options,
                session_id: sessionId,
                // Private chats: the engine saves no model memory of them either
                temporary_chat: currentSession?.isIncognito ? 'lite' as const : undefined,
                messages: conversationMessages
            };

            let thinkingStartTime: number | null = null;
            let thinkingDurationSec: string | undefined = undefined;

            const promptToSend = replyContext ? `[In reply to: "${replyContext.text}"]\n\n${messageText}` : messageText;

            const { cluaizEngine } = await import('../../../core/engine');
            await cluaizEngine.send(promptToSend, chatOptions, (chunk) => {
                const liveStore = useChatStore.getState();
                if (chunk === '[DONE]') {
                    if (terminalSeen) return;
                    terminalSeen = true;
                    setProcessing(null);
                    const finalStats = endStreaming();
                    const now = new Date();
                    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

                    if (thinkingStartTime !== null && thinkingDurationSec === undefined) {
                        thinkingDurationSec = ((performance.now() - thinkingStartTime) / 1000).toFixed(1);
                    }

                    if (finalStats && finalStats.tokens > 0) {
                        liveStore.attachTelemetryToLastMessage(sessionId, finalStats);
                    }
                    const activeSess = liveStore.sessions[sessionId];
                    if (activeSess?.messages && activeSess.messages.length > 0) {
                        const lastIdx = activeSess.messages.length - 1;
                        const lastMsg = activeSess.messages[lastIdx];
                        liveStore.updateMessage(sessionId, lastIdx, m => ({
                            ...m,
                            ...(lastMsg && !lastMsg.time ? { time: timeStr } : {}),
                            ...(thinkingDurationSec ? { thinkingDuration: thinkingDurationSec } : {})
                        }));
                        syncSessionTokens(activeSess.messages);

                        // If title or avatar is still provisional/default, refine topic dynamically using full exchange
                        if (activeSess.messages.length <= 2 && (!activeSess.title || activeSess.title === 'New Chat' || activeSess.avatar === '🤖' || activeSess.avatar === '💬')) {
                            const firstUserMsg = activeSess.messages.find(m => m.sender === 'user')?.text || '';
                            const assistantReply = lastMsg?.text || '';
                            if (firstUserMsg) {
                                const refined = inferChatTopicAndEmoji(firstUserMsg, assistantReply);
                                liveStore.updateSession(sessionId, s => ({
                                    ...s,
                                    title: refined.title,
                                    avatar: refined.emoji
                                }));
                            }
                        }
                    }
                    liveStore.finalizeAssistantMessage(sessionId);
                    return;
                }
                if (terminalSeen) return;
                if (typeof chunk === 'object' && chunk.error) {
                    failRequest(chunk.error.message);
                    return;
                }
                if (typeof chunk === 'object' && chunk.processing) {
                    setProcessing(chunk.processing.stage === 'request' ? null : {
                        sessionId, label: processingLabel(chunk.processing, contextMessages)
                    });
                    return;
                }
                if (typeof chunk === 'object' && (chunk.engine || chunk.finishReason)) {
                    const items = liveStore.sessions[sessionId]?.messages || [];
                    const index = items.findIndex(message => message.id === assistantId);
                    if (index >= 0) liveStore.updateMessage(sessionId, index, message => ({
                        ...message,
                        ...(chunk.engine?.context ? { contextReport: chunk.engine.context } : {}),
                        ...(chunk.finishReason ? { finishReason: chunk.finishReason } : {})
                    }));
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
                    liveStore.setPermissionRequestOnLastMessage(sessionId, chunk.permissionRequest);
                    return;
                }

                // If chunk has toolCall
                if (typeof chunk === 'object' && chunk.toolCall) {
                    liveStore.appendToolCallToLastMessage(sessionId, chunk.toolCall);
                    recordToolExecution(chunk.toolCall.name, undefined, 'running', chunk.toolCall.category);
                    return;
                }

                // If chunk has toolResult
                if (typeof chunk === 'object' && chunk.toolResult) {
                    liveStore.updateToolResultOnLastMessage(sessionId, chunk.toolResult);
                    recordToolExecution(chunk.toolResult.name || 'tool', chunk.toolResult.latency_ms, 'completed', chunk.toolResult.category);
                    return;
                }

                const reasoning = typeof chunk === 'object' ? chunk.reasoning : undefined;
                const content = typeof chunk === 'object' ? chunk.content : chunk;
                if (!reasoning && !content) return;
                recordToken();
                setProcessing(null);

                if (reasoning) {
                    if (thinkingStartTime === null) {
                        thinkingStartTime = performance.now();
                    }
                    liveStore.appendThinkingToLastMessage(sessionId, reasoning);
                }
                if (content) {
                    if (thinkingStartTime !== null && thinkingDurationSec === undefined) {
                        thinkingDurationSec = ((performance.now() - thinkingStartTime) / 1000).toFixed(1);
                        const activeSess = liveStore.sessions[sessionId];
                        if (activeSess?.messages && activeSess.messages.length > 0) {
                            const lastIdx = activeSess.messages.length - 1;
                            liveStore.updateMessage(sessionId, lastIdx, m => ({ ...m, thinkingDuration: thinkingDurationSec }));
                        }
                    }
                    liveStore.appendTokenToLastMessage(sessionId, content);
                }
            });
        } catch (error) {
            failRequest(errorMessage(error));
        } finally {
            endStreaming();
            if (useChatStore.getState().streamingSessionId === sessionId) {
                useChatStore.getState().setStreamingSession(null);
            }
            setProcessing(current => current?.sessionId === sessionId ? null : current);
            // Remove an empty assistant row after cancellation or empty completion.
            const currentStore = useChatStore.getState();
            if (sessionId) {
                const activeSess = currentStore.sessions[sessionId];
                if (activeSess?.messages && activeSess.messages.length > 0) {
                    const lastIdx = activeSess.messages.length - 1;
                    const lastMsg = activeSess.messages[lastIdx];
                    if (lastMsg && lastMsg.sender === 'assistant' && !lastMsg.text && !lastMsg.thinking && !lastMsg.toolCalls?.length) {
                        currentStore.deleteMessage(sessionId, lastIdx);
                    }
                }
            }
        }
    };


    return { handleSendMessage, processing };
}

import { useState } from 'react';
import { toast } from '../../../components/ui/toast';
import type { Dispatch, SetStateAction } from 'react';
import { useChatStore } from '../../../store/chat/useChatStore';
import type { ChatMessage } from '../../../store/chat/useChatStore';
import { buildProjectContextParts, useChatProjectsStore } from '../../../store/chat/useChatProjectsStore';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { inferChatTopicAndEmoji } from '../../../utils/topicProber';
import { errorMessage } from '../../../api/client/errors';
import { buildChatHistory, chatHistoryOptions, finalizeChatModelLoad, processingLabel, reduceChatModelLoading, selectChatContext } from '../utils/chatRequest';
import type { useChatTelemetry } from './useChatTelemetry';
import { soundManager } from '../../../services/sound/soundManager';
import { receiveChatApproval } from '../approvals';
import { chatRequestModel, isProviderModel, useProvidersStore } from '../../../store/cloud/useProvidersStore';

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
    const [processing, setProcessing] = useState<{ sessionId: string; label: string; loadingModel?: string } | null>(null);
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
            const activeProjectId = isIncognito ? undefined : (useChatProjectsStore.getState().activeProjectId || undefined);
            sessionId = store.createNewSession(isIncognito ? 'Temporary Chat' : undefined, {
                incognito: isIncognito,
                projectId: activeProjectId,
            });
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

        // The model this request runs on, the same one the composer sends: a provider's model or the Engine's chat model.
        const currentModelName = options?.model || chatRequestModel(useEngineStore.getState().permissions?.chat_models?.text);
        const modelProvider = isProviderModel(currentModelName, useProvidersStore.getState().providers) ? 'cloud' : 'local';

        // Create the assistant row before waiting for the engine.
        store.addMessage(sessionId, {
            sender: 'assistant',
            text: '',
            thinking: '',
            model: currentModelName,
            time: '',
            date: now.getTime()
        });
        store.updateSession(sessionId, s => ({
            ...s,
            model: currentModelName,
            modelProvider,
        }));
        const assistantId = useChatStore.getState().sessions[sessionId]?.messages.slice(-1)[0]?.id;
        const updateAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
            const current = useChatStore.getState();
            const items = current.sessions[sessionId]?.messages || [];
            const idx = items.findIndex(message => message.id === assistantId);
            if (idx >= 0) current.updateMessage(sessionId, idx, updater);
        };
        let terminalSeen = false;
        let thinkingStartTime: number | null = null;
        let thinkingDurationSec: string | undefined = undefined;
        const failRequest = (detail: string) => {
            if (terminalSeen) return;
            terminalSeen = true;
            const finalStats = endStreaming();
            setProcessing(null);
            if (thinkingStartTime !== null && thinkingDurationSec === undefined) {
                thinkingDurationSec = ((performance.now() - thinkingStartTime) / 1000).toFixed(1);
            }
            const current = useChatStore.getState();
            if (finalStats && finalStats.tokens > 0) {
                current.attachTelemetryToLastMessage(sessionId, finalStats);
            }
            const items = current.sessions[sessionId]?.messages || [];
            const userIndex = items.findIndex(message => message.id === userId);
            const assistantIndex = items.findIndex(message => message.id === assistantId);
            if (userIndex >= 0) current.updateMessage(sessionId, userIndex, message => ({ ...message, finishReason: 'error' }));
            if (assistantIndex >= 0) current.updateMessage(sessionId, assistantIndex, message => ({
                ...message, finishReason: 'error', time: timeStr,
                ...(thinkingDurationSec && !message.thinkingDuration ? { thinkingDuration: thinkingDurationSec } : {}),
                ...(message.modelLoad ? { modelLoad: { ...message.modelLoad, status: 'failed' } } : {}),
                text: `${message.text ? `${message.text}\n\n` : ''}Request failed: ${detail}`
            }));
            current.finalizeAssistantMessage(sessionId);
            soundManager.playError();
        };

        setInputValue('');
        setReplyingTo(null);
        soundManager.playSend();

        try {
            startStreaming();
            useChatStore.getState().setStreamingSession(sessionId);
            const loadingModel = modelProvider === 'local' ? currentModelName : undefined;
            setProcessing({ sessionId, label: 'Waiting for engine', loadingModel });
            if (useEngineStore.getState().permissions?.lazy_load_model) {
                const { cluaizEngine } = await import('../../../core/engine');
                await cluaizEngine.boot();
            }
            // Build conversation history from the active session for context memory
            const currentSession = useChatStore.getState().sessions[sessionId];
            const contextMessages = selectChatContext(currentSession?.messages || []);
            const baseMessages = buildChatHistory(contextMessages);
            const activeProject = currentSession?.projectId
                ? useChatProjectsStore.getState().projects[currentSession.projectId]
                : undefined;
            const projectContext = buildProjectContextParts(activeProject);
            const conversationMessages: Array<{ role: string; content: any }> = projectContext.systemPrefix
                ? [{ role: 'system', content: projectContext.systemPrefix }, ...baseMessages]
                : baseMessages;
            if (projectContext.attachmentParts.length > 0 && conversationMessages.length > 0) {
                const lastIdx = conversationMessages.length - 1;
                const last = conversationMessages[lastIdx];
                if (last.role === 'user') {
                    const existingParts = Array.isArray(last.content)
                        ? last.content
                        : [{ type: 'text', text: String(last.content || '') }];
                    conversationMessages[lastIdx] = {
                        ...last,
                        content: [...projectContext.attachmentParts, ...existingParts],
                    };
                }
            }

            const isPrivateSession = Boolean(currentSession?.isIncognito);
            const chatOptions = {
                ...options,
                model: currentModelName,
                session_id: sessionId,
                ...chatHistoryOptions(options, isPrivateSession),
                messages: conversationMessages
            };

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
                    soundManager.playComplete();
                    const finalAnswer = activeSess?.messages?.[activeSess.messages.length - 1]?.text || '';
                    soundManager.notifyBackground('Cluaiz Assistant', {
                        body: finalAnswer.slice(0, 100).trim() || 'Response completed.'
                    });
                    return;
                }
                if (terminalSeen) return;
                if (typeof chunk === 'object' && chunk.error) {
                    failRequest(chunk.error.message);
                    return;
                }
                if (typeof chunk === 'object' && chunk.processing) {
                    const p = chunk.processing;
                    if (p.stage === 'model_loading') {
                        updateAssistant(message => ({
                            ...message,
                            modelLoad: reduceChatModelLoading(message.modelLoad, p, currentModelName),
                        }));
                        if (p.load && p.load.kind !== 'unloaded') {
                            setProcessing(p.state === 'completed' || p.load.kind === 'loaded' ? null : {
                                sessionId, label: processingLabel(p, contextMessages), loadingModel
                            });
                        } else if (p.state === 'completed' || p.state === 'failed' || p.state === 'reused') {
                            setProcessing(prev => prev?.label === 'Loading model' ? null : prev);
                        } else {
                            setProcessing({ sessionId, label: processingLabel(p, contextMessages), loadingModel });
                        }
                        return;
                    }
                    if (p.stage === 'request') {
                        setProcessing(previous => previous?.loadingModel ? previous : null);
                    } else {
                        setProcessing({
                            sessionId, label: processingLabel(p, contextMessages),
                            loadingModel: p.stage === 'queued' ? loadingModel : undefined,
                        });
                    }
                    return;
                }
                if (typeof chunk === 'object' && (chunk.engine || chunk.finishReason)) {
                    updateAssistant(message => {
                        const nextModelLoad = chunk.engine?.load
                            ? finalizeChatModelLoad(message.modelLoad, chunk.engine.load, currentModelName)
                            : message.modelLoad;
                        return {
                            ...message,
                            ...(chunk.engine?.context ? { contextReport: chunk.engine.context } : {}),
                            ...(chunk.engine?.load ? { modelLoad: nextModelLoad } : {}),
                            ...(chunk.finishReason ? { finishReason: chunk.finishReason } : {})
                        };
                    });
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
                    receiveChatApproval(sessionId, chunk.permissionRequest);
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
                    recordToolExecution(chunk.toolResult.name || 'tool', chunk.toolResult.latency_ms, chunk.toolResult.status, chunk.toolResult.category);
                    return;
                }

                const reasoning = typeof chunk === 'object' ? chunk.reasoning : undefined;
                const content = typeof chunk === 'object' ? chunk.content : chunk;
                if (!reasoning && !content) return;
                recordToken();
                setProcessing(null);
                // Ensure any in-progress load card closes immediately once tokens/thinking begin
                updateAssistant(message => {
                    if (!message.modelLoad || message.modelLoad.status !== 'loading') return message;
                    if (message.modelLoad.steps.length === 0) return { ...message, modelLoad: undefined };
                    return {
                        ...message,
                        modelLoad: { ...message.modelLoad, status: 'loaded', percent: undefined }
                    };
                });

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
            const finalStats = endStreaming();
            if (thinkingStartTime !== null && thinkingDurationSec === undefined) {
                thinkingDurationSec = ((performance.now() - thinkingStartTime) / 1000).toFixed(1);
            }
            if (useChatStore.getState().streamingSessionId === sessionId) {
                useChatStore.getState().setStreamingSession(null);
            }
            setProcessing(current => current?.sessionId === sessionId ? null : current);
            // Finalize partial thinking duration / telemetry or remove an empty assistant row after cancellation.
            const currentStore = useChatStore.getState();
            if (sessionId) {
                if (finalStats && finalStats.tokens > 0) {
                    currentStore.attachTelemetryToLastMessage(sessionId, finalStats);
                }
                const activeSess = currentStore.sessions[sessionId];
                if (activeSess?.messages && activeSess.messages.length > 0) {
                    const lastIdx = activeSess.messages.length - 1;
                    const lastMsg = activeSess.messages[lastIdx];
                    if (lastMsg && lastMsg.sender === 'assistant' && !lastMsg.text && !lastMsg.thinking && !lastMsg.toolCalls?.length) {
                        currentStore.deleteMessage(sessionId, lastIdx);
                    } else if (lastMsg && lastMsg.sender === 'assistant') {
                        currentStore.updateMessage(sessionId, lastIdx, m => ({
                            ...m,
                            ...(!m.time ? { time: timeStr } : {}),
                            ...(thinkingDurationSec && !m.thinkingDuration ? { thinkingDuration: thinkingDurationSec } : {}),
                            ...(m.modelLoad && m.modelLoad.status === 'loading'
                                ? { modelLoad: m.modelLoad.steps.length > 0 ? { ...m.modelLoad, status: 'loaded', percent: undefined } : undefined }
                                : {}),
                        }));
                        currentStore.finalizeAssistantMessage(sessionId);
                    }
                }
            }
        }
    };

    const handleRetryMessage = async (assistantMsgIndex: number) => {
        const store = useChatStore.getState();
        const sessionId = store.activeSessionId;
        if (!sessionId) return;
        const session = store.sessions[sessionId];
        if (!session || !session.messages) return;

        const targetAssistantMsg = session.messages[assistantMsgIndex];
        if (!targetAssistantMsg) return;

        // Find the preceding user message
        let userPrompt = '';
        let userAttachments: any[] | undefined = undefined;
        let userParts: any[] | undefined = undefined;
        for (let i = assistantMsgIndex - 1; i >= 0; i--) {
            if (session.messages[i]?.sender === 'user') {
                userPrompt = session.messages[i].text || '';
                userAttachments = session.messages[i].attachments;
                userParts = session.messages[i].parts;
                break;
            }
        }

        // Check if there was partial text before the error marker
        let partialText = '';
        if (targetAssistantMsg.text) {
            const marker = 'Request failed:';
            const idx = targetAssistantMsg.text.indexOf(marker);
            if (idx > 0) {
                partialText = targetAssistantMsg.text.slice(0, idx).trim();
            }
        }

        if (partialText) {
            // RESUME FLOW:
            // 1. Keep the generated partial text and clear the error flag
            store.updateMessage(sessionId, assistantMsgIndex, m => ({
                ...m,
                finishReason: undefined,
                text: partialText
            }));

            // 2. Prompt model to continue from the exact cutoff point
            const continuationPrompt = `Please continue your response directly from where you stopped. Do not repeat previous text. Last sentence was: "${partialText.slice(-100)}"`;
            await handleSendMessage(continuationPrompt);
        } else {
            // CLEAN RETRY FLOW:
            // 1. Remove the failed assistant message row and its user message turn
            // so re-sending it produces a clean, fresh turn without duplicating the user prompt.
            const userIdx = assistantMsgIndex - 1;
            store.deleteMessage(sessionId, assistantMsgIndex);
            if (userIdx >= 0 && session.messages[userIdx]?.sender === 'user') {
                store.deleteMessage(sessionId, userIdx);
            }

            // 2. Re-send original user prompt cleanly
            if (userPrompt || userAttachments || userParts) {
                await handleSendMessage(userPrompt, { attachments: userAttachments, parts: userParts });
            }
        }
    };

    return { handleSendMessage, handleRetryMessage, processing };
}

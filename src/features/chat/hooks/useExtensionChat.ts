import { useEffect, useRef, useState } from 'react';
import type { ExtensionChatBinding } from '../../extensions/ExtensionChatWorkspace';
import type { ExtensionJob } from '../../../extensions/jobs';
import type { SendChatOptions } from '../../../core/engine';
import type { useChatTelemetry } from './useChatTelemetry';
import { toast } from '../../../components/ui/toast';
import { errorMessage } from '../../../api/client/errors';
import { extensionTextPayload } from '../../../extensions/requests';
import { useChatStore } from '../../../store/chat/useChatStore';

/** Shared chat UI delegates turns to the existing owned SDK, never to the main selection. */
export function useExtensionChat(binding: ExtensionChatBinding | undefined, telemetry: ReturnType<typeof useChatTelemetry>,
    clearInput: () => void, input: string, reply?: string) {
    const job = useRef<ExtensionJob<void> | null>(null);
    const alive = useRef(true);
    const [running, setRunning] = useState(false);
    useEffect(() => {
        alive.current = true;
        setRunning(false);
        return () => { alive.current = false; job.current?.cancel(); job.current = null; };
    }, [binding?.sdk, binding?.handle]);
    const send = (text = input, options?: SendChatOptions): boolean => {
        if (!binding || job.current) return false;
        if (options?.parts?.length || options?.attachments?.length || options?.tools?.length) {
            toast.error('Extension shared chat currently accepts text only.');
            return false;
        }
        if (!text.trim()) return false;
        try {
            if (useChatStore.getState().streamingSessionId) throw new Error('Another chat is answering; wait for it to finish.');
            const payload = { model: options?.model || '', input: reply ? `[In reply to: "${reply}"]\n\n${text}` : text };
            extensionTextPayload(payload);
            const request = binding.sdk.chat.send(binding.handle, payload,
                () => { if (alive.current && job.current === request) telemetry.recordToken(); });
            job.current = request;
            setRunning(true);
            telemetry.startStreaming();
            clearInput();
            void request.result.catch(error => {
                if (alive.current && job.current === request && !(error instanceof Error && error.name === 'AbortError')) {
                    toast.error(errorMessage(error));
                }
            }).finally(() => {
                if (job.current !== request) return;
                job.current = null;
                if (alive.current) { setRunning(false); telemetry.endStreaming(); }
            });
            return true;
        } catch (error) {
            if (alive.current) toast.error(errorMessage(error));
            return false;
        }
    };
    return { send, running, stop: () => job.current?.cancel() };
}

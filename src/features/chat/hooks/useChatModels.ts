import { useEffect, useRef, useState } from 'react';
import { modelsApi } from '../../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../../api/engine/models/models.types';
import { errorMessage } from '../../../api/client/errors';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { useEngineStore } from '../../../store/engine/useEngineStore';

/** Model discovery/selection for the existing chat dropdown, without settings-API calls in UI. */
export function useChatModels() {
    const connection = useConnectionStore(state => `${state.protocol}:${state.getBaseUrl()}`);
    const settingsReady = useEngineStore(state => state.fetchStatus === 'success');
    const [models, setModels] = useState<ModelRegistryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [selecting, setSelecting] = useState(false);
    const busy = useRef(false);
    const selection = useRef<AbortController | null>(null);
    const generation = useRef(0);

    useEffect(() => {
        const controller = new AbortController();
        const version = ++generation.current;
        setModels([]);
        setError(null);
        setLoading(true);
        setSelecting(false);
        modelsApi.getInstalled(controller.signal).then(result => {
            if (!controller.signal.aborted && generation.current === version) {
                setModels(result.installed.filter(model => !model.category || model.category === 'chat'));
            }
        }).catch(failure => {
            if (!controller.signal.aborted && generation.current === version) setError(errorMessage(failure));
        }).finally(() => {
            if (!controller.signal.aborted && generation.current === version) setLoading(false);
        });
        return () => { controller.abort(); selection.current?.abort(); generation.current++; };
    }, [connection, settingsReady, attempt]);

    const select = async (id: string): Promise<boolean> => {
        if (busy.current) return false;
        const model = models.find(entry => entry.id === id);
        if (!model) throw new Error('The selected chat model is not in the installed inventory');
        const version = generation.current;
        busy.current = true;
        setSelecting(true);
        const controller = new AbortController();
        selection.current = controller;
        try {
            const permission = await modelsApi.selectChatModel(model, controller.signal);
            if (generation.current !== version) return false;
            useEngineStore.setState(state => ({ permissions: { ...state.permissions, ...permission } }));
            return true;
        } catch (failure) {
            if (controller.signal.aborted) return false;
            throw failure;
        } finally {
            busy.current = false;
            selection.current = null;
            if (generation.current === version) setSelecting(false);
        }
    };
    return { models, loading, error, selecting, select, retry: () => setAttempt(value => value + 1) };
}

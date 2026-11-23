import { useEffect, useRef, useState } from 'react';
import { modelsApi } from '../../../api/engine/models/models.api';
import type { ModelRegistryEntry } from '../../../api/engine/models/models.types';
import { errorMessage } from '../../../api/client/errors';
import { useConnectionStore } from '../../../store/engine/useConnectionStore';
import { useEngineStore } from '../../../store/engine/useEngineStore';
import { useModelDownloadStore } from '../../extensions/modelDownloadStore';

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
    /** Bumped by the Toolkit when a download finishes or a model is removed */
    const installedRevision = useModelDownloadStore(state => state.revision);
    const [quiet, setQuiet] = useState(0);

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

    // Read the installed list again without emptying it first, so the open dropdown does not flicker:
    // after an install or removal in the Toolkit, and each time the dropdown opens (`reload`)
    useEffect(() => {
        if (!installedRevision && !quiet) return;
        const controller = new AbortController();
        const version = generation.current;
        modelsApi.getInstalled(controller.signal).then(result => {
            if (!controller.signal.aborted && generation.current === version) {
                setModels(result.installed.filter(model => !model.category || model.category === 'chat'));
                setError(null);
            }
        }).catch(() => { /* the list on screen stays; the first read already reports errors */ });
        return () => controller.abort();
    }, [installedRevision, quiet]);

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
    return { models, loading, error, selecting, select, retry: () => setAttempt(value => value + 1), reload: () => setQuiet(value => value + 1) };
}

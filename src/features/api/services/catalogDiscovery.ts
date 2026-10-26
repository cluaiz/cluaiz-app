import { callCep } from '../../../api/client/cep';
import { modelsApi } from '../../../api/engine/models/models.api';
import type { InstalledModel } from '../types';

/** Explorer metadata uses the same configured authenticated/native client as its requests. */
export async function discoverCatalog<T>(method: 'models.list' | 'audio.voices', params: object,
    signal?: AbortSignal): Promise<T> {
    return callCep<T>(method, params, { signal });
}

export async function discoverInstalledModels(): Promise<InstalledModel[]> {
    return (await modelsApi.getInstalled()).installed;
}

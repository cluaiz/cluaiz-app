import { client } from '../../../api/client';
import type { InstalledModel } from '../types';

/** Explorer metadata uses the same configured authenticated/native client as its requests. */
export async function discoverCatalog<T>(method: 'models.list' | 'audio.voices', params: object,
    signal?: AbortSignal): Promise<T> {
    const reply = await client.post<{ result?: T; error?: { message: string } }>('/v1/cep',
        { jsonrpc: '2.0', id: 1, method, params }, { signal });
    if (reply.error) throw new Error(reply.error.message);
    if (reply.result === undefined) throw new Error('CEP returned no result');
    return reply.result;
}

export async function discoverInstalledModels(): Promise<InstalledModel[]> {
    const models = await discoverCatalog<(InstalledModel & { format: string })[]>('models.list', {});
    return models.map(model => ({ ...model, format_type: model.format }));
}

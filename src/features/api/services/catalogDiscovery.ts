import { modelsApi } from '../../../api/engine/models/models.api';
import type { InstalledModel } from '../types';

export async function discoverInstalledModels(): Promise<InstalledModel[]> {
    return (await modelsApi.getInstalled()).installed;
}

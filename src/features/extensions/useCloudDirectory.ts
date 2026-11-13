import { providerCatalogue, type CloudProvider } from '../../api/catalogue/providers';
import { useProvidersStore } from '../../store/cloud/useProvidersStore';
import { useModelCatalogueStore } from './modelCatalogueStore';
import { bareModel, useCloudDirectoryFilter } from './cloudModelView';
import { useCatalogue } from './useCatalogue';

/**
 * The Cloud providers the sidebar and the overview show: Browse lists every supported provider,
 * Installed the ones connected in the Engine's providers.json (custom ones too). The sidebar's
 * search and filter narrow both; each entry carries its models that pass the filter.
 */
export function useCloudDirectory(query = '') {
    const providers = useProvidersStore(state => state.providers);
    const listing = useModelCatalogueStore(state => state.listing);
    const catalogue = useCatalogue(providerCatalogue.list);
    const filter = useCloudDirectoryFilter();
    const known = catalogue.reply?.data ?? [];
    const connected = new Map(providers.map(item => [item.name, item]));
    const text = query.trim().toLowerCase();
    const match = (...values: string[]) => !text || values.some(value => value.toLowerCase().includes(text));

    /** Custom providers (not in the catalogue) as entries of their own, with the models listed in providers.json */
    const custom: CloudProvider[] = listing === 'installed'
        ? providers.filter(item => !known.some(entry => entry.id === item.name)).map(item => ({
            id: item.name, name: item.name, api: item.base_url, env: [], doc: '', tested: false,
            models: item.models.map(model => bareModel(model.id, model.context, model.kind)),
        }))
        : [];
    const entries = [...custom, ...known.filter(item => listing === 'browse' || connected.has(item.id))]
        .filter(item => match(item.name, item.id, item.api))
        .map(item => ({ item, engine: connected.get(item.id), models: item.models.filter(filter.matches) }))
        .filter(entry => !filter.active || entry.models.length > 0)
        .sort((a, b) => Number(!!b.engine) - Number(!!a.engine) || Number(b.item.tested) - Number(a.item.tested));
    return { catalogue, known, entries, filter, listing, counts: { browse: known.length, installed: providers.length } };
}

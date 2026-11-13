import { create } from 'zustand';
import { Boxes, History, ListChecks, Sparkles } from 'lucide-react';
import type { MultiLevelCategory } from '../../components/ui/dropdown';
import type { CloudModel, CloudModelKind } from '../../api/catalogue/providers';
import { setToolkitParams, toolkitParam } from './toolkitNavigation';
import { useToolkitUrl } from './useToolkitUrl';

export const KIND_LABELS: Record<CloudModelKind, string> = { chat: 'Chat', embedding: 'Embedding', tts: 'Speech (TTS)', stt: 'Transcription (STT)' };
/** What a model can do besides its kind; filter options and card tags come from here */
export const TRAITS: Record<string, (model: CloudModel) => boolean> = {
    Tools: model => model.tools,
    Reasoning: model => model.reasoning,
    Vision: model => model.inputs.includes('image'),
    'Audio input': model => model.kind !== 'stt' && model.inputs.includes('audio'),
    PDF: model => model.inputs.includes('pdf'),
    'Open weights': model => model.openWeights,
};

export const dollars = (value?: number) => value === undefined ? 'Not listed' : value === 0 ? 'Free' : `$${value}`;
/** Providers state limits in decimal tokens (1,000,000 is 1M) */
export const tokens = (value?: number) => !value ? 'Not listed'
    : value >= 1e6 ? `${+(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${Math.round(value / 1e3)}K` : String(value);

/** A model's kind (when not chat) and traits, as catalogue tags */
export const capabilities = (model: CloudModel) => [
    ...(model.kind !== 'chat' ? [KIND_LABELS[model.kind]] : []),
    ...Object.keys(TRAITS).filter(trait => TRAITS[trait](model)),
];
export const providerCapabilities = (models: CloudModel[]) => [...new Set(models.flatMap(capabilities))];

/** A model the catalogue does not describe (typed by hand or read from the provider) */
export const bareModel = (id: string, context?: number, kind?: string): CloudModel => ({
    id, name: id, description: '', family: '', kind: kind && kind in KIND_LABELS ? kind as CloudModelKind : 'chat',
    context, inputs: [], tools: false, reasoning: false, openWeights: false, knowledge: '', released: '', updated: '', status: '',
});

export type CloudSort = 'newest' | 'context' | 'price' | 'name';
export const SORTS: Record<CloudSort, string> = { newest: 'Latest / New', context: 'Largest context', price: 'Lowest price', name: 'Name' };
/** Deprecated models always come last */
export const compareModels = (sort: CloudSort) => (a: CloudModel, b: CloudModel) =>
    Number(a.status === 'deprecated') - Number(b.status === 'deprecated')
    || (sort === 'context' ? (b.context ?? 0) - (a.context ?? 0)
        : sort === 'price' ? (a.price?.input ?? Infinity) - (b.price?.input ?? Infinity)
        : sort === 'name' ? a.name.localeCompare(b.name)
        : (b.released || '').localeCompare(a.released || ''));

export type PickerFilter = '' | 'listed' | 'unlisted';
export interface CloudFilter { kind: CloudModelKind | ''; traits: string[]; hideDeprecated: boolean; picker: PickerFilter }
const NO_FILTER: CloudFilter = { kind: '', traits: [], hideDeprecated: false, picker: '' };
const PICKER_LABELS: Record<Exclude<PickerFilter, ''>, string> = { listed: 'In model picker', unlisted: 'Not in model picker' };

/** `listed`: ids in the Engine's providers.json, for the model picker filter */
export const matchesFilter = (model: CloudModel, filter: CloudFilter, listed?: Set<string>) =>
    (!filter.kind || model.kind === filter.kind) && filter.traits.every(trait => TRAITS[trait]?.(model))
    && !(filter.hideDeprecated && model.status === 'deprecated')
    && (!filter.picker || !listed || listed.has(model.id) === (filter.picker === 'listed'));

type SetFilter = (next: CloudFilter | ((previous: CloudFilter) => CloudFilter)) => void;

/**
 * The catalogue's filter menu categories and chips for a model filter, and its test.
 * With `available`, a type, capability or status appears only when one of those models has it.
 */
function filterControls(filter: CloudFilter, setFilter: SetFilter, listed?: Set<string>, available?: CloudModel[]) {
    const kinds = Object.entries(KIND_LABELS).filter(([kind]) => !available || available.some(model => model.kind === kind));
    const traits = Object.keys(TRAITS).filter(trait => !available || available.some(TRAITS[trait]));
    const update = (patch: Partial<CloudFilter>) => setFilter(previous => ({ ...previous, ...patch }));
    const toggleTrait = (trait: string) => setFilter(previous => ({ ...previous,
        traits: previous.traits.includes(trait) ? previous.traits.filter(item => item !== trait) : [...previous.traits, trait] }));
    const categories: MultiLevelCategory[] = [
        ...(kinds.length ? [{ id: 'kind', label: 'Model Type', icon: Boxes, selectedValue: filter.kind, onSelect: (value: string) => update({ kind: value as CloudModelKind | '' }),
            options: [{ value: '', label: 'All Types' }, ...kinds.map(([value, label]) => ({ value, label }))] }] : []),
        ...(traits.length ? [{ id: 'traits', label: 'Capabilities', icon: Sparkles, isMultiSelect: true, selectedValue: filter.traits, onSelect: toggleTrait,
            options: traits.map(trait => ({ value: trait, label: trait })) }] : []),
        ...(!available || available.some(model => model.status === 'deprecated') ? [{ id: 'status', label: 'Status', icon: History, selectedValue: filter.hideDeprecated ? 'current' : '',
            onSelect: (value: string) => update({ hideDeprecated: value === 'current' }),
            options: [{ value: '', label: 'All Models' }, { value: 'current', label: 'Current only' }] }] : []),
        ...(listed ? [{ id: 'picker', label: 'Model Picker', icon: ListChecks, selectedValue: filter.picker,
            onSelect: (value: string) => update({ picker: value as PickerFilter }),
            options: [{ value: '', label: 'All Models' }, ...Object.entries(PICKER_LABELS).map(([value, label]) => ({ value, label }))] }] : []),
    ];
    const chips = [
        ...(filter.kind ? [{ key: 'kind', label: KIND_LABELS[filter.kind], remove: () => update({ kind: '' }) }] : []),
        ...filter.traits.map(trait => ({ key: `trait:${trait}`, label: trait, remove: () => toggleTrait(trait) })),
        ...(filter.hideDeprecated ? [{ key: 'deprecated', label: 'Current only', remove: () => update({ hideDeprecated: false }) }] : []),
        ...(filter.picker && listed ? [{ key: 'picker', label: PICKER_LABELS[filter.picker], remove: () => update({ picker: '' }) }] : []),
    ];
    return { categories, chips, active: chips.length > 0, clear: () => setFilter(NO_FILTER), matches: (model: CloudModel) => matchesFilter(model, filter, listed) };
}

const own = (labels: object, key: string) => Object.prototype.hasOwnProperty.call(labels, key);
/** A provider page's filter in the URL: type, traits, status=current, picker */
const filterFromUrl = (): CloudFilter => {
    const kind = toolkitParam('type'), picker = toolkitParam('picker');
    return {
        kind: own(KIND_LABELS, kind) ? kind as CloudModelKind : '',
        traits: toolkitParam('traits').split(',').filter(trait => own(TRAITS, trait)),
        hideDeprecated: toolkitParam('status') === 'current',
        picker: own(PICKER_LABELS, picker) ? picker as PickerFilter : '',
    };
};
const setFilterUrl: SetFilter = next => {
    const filter = typeof next === 'function' ? next(filterFromUrl()) : next;
    setToolkitParams({ type: filter.kind, traits: filter.traits.join(','), status: filter.hideDeprecated ? 'current' : '', picker: filter.picker });
};

/**
 * A provider page's own model filter, kept in the URL. `listed` adds the model picker choice;
 * `available` (the provider's models) limits the choices to what they have.
 */
export function useCloudFilter(listed?: Set<string>, available?: CloudModel[]) {
    useToolkitUrl();
    return filterControls(filterFromUrl(), setFilterUrl, listed, available);
}

const useDirectoryFilterStore = create<{ filter: CloudFilter; setFilter: SetFilter }>(set => ({
    filter: NO_FILTER,
    setFilter: next => set(state => ({ filter: typeof next === 'function' ? next(state.filter) : next })),
}));

/** The Cloud sidebar's filter: it narrows the provider list and the overview of all providers. */
export function useCloudDirectoryFilter() {
    const { filter, setFilter } = useDirectoryFilterStore();
    return filterControls(filter, setFilter);
}
